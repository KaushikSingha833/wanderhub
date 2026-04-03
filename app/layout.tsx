import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeListener from "./ThemeListener"; // <-- UNCOMMENTED!

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      suppressHydrationWarning 
    >
      {/* suppressHydrationWarning stops Next.js from complaining about the dark class being added dynamically */}
      <body className="min-h-full flex flex-col bg-slate-50 dark:bg-[#030712] transition-colors duration-300">
        
        {/* THIS NOW RUNS ON EVERY SINGLE PAGE */}
        <ThemeListener /> 
        
        {children}
      </body>
    </html>
  );
}