import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/AuthContext";
import { UploadQueueProvider } from "@/components/UploadQueueProvider";
import { NetworkProvider } from "@/components/NetworkContext";

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
    display: "swap",
});

const fraunces = Fraunces({
    variable: "--font-fraunces",
    subsets: ["latin"],
    display: "swap",
    axes: ["opsz"],
});

export const metadata: Metadata = {
    title: "V-Pics - Face Grouping",
    description: "Upload photos and group faces by person using AI-powered clustering.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "V-Pics",
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#F9F9F9" },
        { media: "(prefers-color-scheme: dark)", color: "#0D0D0D" },
    ],
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${dmSans.variable} ${fraunces.variable}`}
                style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
            >
                <NetworkProvider>
                    <AuthProvider>
                        <ThemeProvider>
                            <UploadQueueProvider>
                                <AppShell>{children}</AppShell>
                            </UploadQueueProvider>
                        </ThemeProvider>
                    </AuthProvider>
                </NetworkProvider>
            </body>
        </html>
    );
}
