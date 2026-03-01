import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get("v-pics-session");
    const { pathname } = request.nextUrl;

    const isLoginPath = pathname.startsWith("/login");
    const isApiPath = pathname.startsWith("/api");
    const isPublicFile = pathname.match(/\.(.*)$/);

    // Skip middleware for public files (manifest, images, etc.)
    if (isPublicFile && !isApiPath) {
        return NextResponse.next();
    }

    // Redirect to login if no session (except for login page and certain APIs)
    if (!sessionCookie && !isLoginPath) {
        // Special case for API
        if (isApiPath) {
            // Allow only specific public APIs if any
            return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // Redirect to home if session exists and trying to access login
    if (sessionCookie && isLoginPath) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
