import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Interview Coach",
  description: "Practice technical interviews with an AI-powered interviewer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white`}
      >
        <NetworkStatusBanner />
        {children}
      </body>
    </html>
  );
}
