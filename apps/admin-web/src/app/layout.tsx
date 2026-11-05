import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BrandingProvider } from "@/components/BrandLogos";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MoventraX Admin",
  description: "MoventraX operations portal",
  icons: { icon: "/brand/moventrax-logo.png", apple: "/brand/moventrax-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${inter.className} antialiased`}>
        <AuthProvider>
          <BrandingProvider>{children}</BrandingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
