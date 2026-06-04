import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { RealtimeProvider } from "@/lib/realtime-context";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HôtelCI — Gestion Hôtelière Côte d'Ivoire",
  description:
    "Système SaaS de gestion hôtelière multi-tenant pour les hôtels de Côte d'Ivoire. Gestion des réservations, chambres, clients et plus.",
  keywords: [
    "HôtelCI",
    "gestion hôtelière",
    "Côte d'Ivoire",
    "SaaS",
    "hôtellerie",
    "réservation",
  ],
  authors: [{ name: "HôtelCI" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <RealtimeProvider>
            <TooltipProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </RealtimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
