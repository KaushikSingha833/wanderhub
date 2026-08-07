import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ThemeListener from "./ThemeListener";
import { Toaster } from "react-hot-toast";
import LiquidBackground from "./components/LiquidBackground";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AERO | Group Travel Planner",
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
      {/* 🚀 FIX: Changed bg-slate-50 to bg-transparent so the liquid is visible! */}
      <body className="min-h-full flex flex-col bg-transparent transition-colors duration-300 relative">
        
        {/* 🚀 NEW: The Liquid Canvas sits behind everything */}
        <LiquidBackground />
        
        <ThemeListener /> 
        
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1e293b',
              color: '#fff',
              borderRadius: '1rem',
              fontWeight: '600',
            },
          }} 
        />
        
        {children}
      </body>
    </html>
  );
}