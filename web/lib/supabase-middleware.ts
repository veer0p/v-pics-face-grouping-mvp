import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Protective Logic
    const isLoginPath = request.nextUrl.pathname.startsWith("/login");
    const isApiPath = request.nextUrl.pathname.startsWith("/api");
    const isAuthPath = request.nextUrl.pathname.startsWith("/auth");

    // 1. If user is logged in and tries to access login page, redirect to home
    if (user && isLoginPath) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    // 2. If user is NOT logged in and tries to access protected routes
    if (!user && !isLoginPath && !isAuthPath) {
        // Allow public access to manifest, images, etc. if needed, but for MVP we lock it down.
        const isPublicFile = request.nextUrl.pathname.match(/\.(.*)$/);
        if (!isPublicFile && !isApiPath) {
            return NextResponse.redirect(new URL("/login", request.url));
        }

        // Return 401 for protected API calls
        if (isApiPath && !request.nextUrl.pathname.startsWith("/api/upload/cleanup")) {
            return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return response;
}
