import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InboxPilot - AI-ready email triage",
  description:
    "A local-first MVP for mode-aware inbox triage, prioritization, and review workflows.",
  icons: {
    icon: [
      { url: "/brand/inboxpilot-logo-120.png", sizes: "120x120", type: "image/png" },
      { url: "/brand/inboxpilot-logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/inboxpilot-logo-512.png", sizes: "512x512", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
