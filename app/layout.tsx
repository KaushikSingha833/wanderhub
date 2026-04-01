import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeListener from "./ThemeListener"; // <-- 1. WE IMPORT THE LISTENER HERE

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// <-- 2. UPDATED YOUR SEO METADATA TO LOOK PROFESSIONAL
export const metadata: Metadata = {
  title: "WanderHub | Group Travel Planner",
  description: "Collaborative itineraries, hotel bookings, and expense splitting.",
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
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <ThemeListener /> {/* <-- 3. WE DROP THE LISTENER RIGHT INSIDE THE BODY */}
        {children}
      </body>
    </html>
  );
}