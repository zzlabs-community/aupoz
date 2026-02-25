import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SpaceBackground from "@/src/components/SpaceBackground";
import { getSession } from "@/src/lib/auth";
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
  title: "AUPOZ — AI Content Studio",
  description: "AUPOZ: generación de contenido y visuales con IA para marcas. Creado por ZZLABZ.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sess = await getSession();
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black min-h-screen`}> 
        <SpaceBackground />
        {children}
      </body>
    </html>
  );
}
