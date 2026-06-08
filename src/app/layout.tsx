import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { RealtimeProvider } from "@/lib/realtime-context";
import { TooltipProvider } from "@/components/ui/tooltip";

// ─── System Font Stack for Fast FCP on CI Mobile Networks ───────────────────
// No external fonts are loaded — uses the device's local system fonts.
// This eliminates ~100-300ms font download delay on slow 3G/4G connections
// common in Côte d'Ivoire, ensuring FCP < 1 second.

export const metadata: Metadata = {
  title: "OGOU_Hôtel — Gestion Hôtelière Côte d'Ivoire",
  description:
    "Application de gestion hôtelière N° 1 en Côte d'Ivoire. Gestion des réservations, chambres, clients et plus.",
  keywords: [
    "OGOU_Hôtel",
    "gestion hôtelière",
    "Côte d'Ivoire",
    "application",
    "hôtellerie",
    "réservation",
  ],
  authors: [{ name: "OGOU_Hôtel" }],
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
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
