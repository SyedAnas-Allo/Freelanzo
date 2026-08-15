import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { NetworkStatusCard } from "@/components/network-status-card";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Freelanzo — Work. Connect. Earn.",
  description:
    "India’s on-demand local freelancing platform for blue-collar and event gigs.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Freelanzo",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/logo.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8e30ff",
  colorScheme: "light",
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-muted/40 font-sans text-foreground">
        <NetworkStatusCard />
        <div className="app-shell flex min-h-dvh flex-col">{children}</div>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
