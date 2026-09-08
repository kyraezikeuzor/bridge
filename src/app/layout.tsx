import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import NextTopLoader from "nextjs-toploader";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Omelora Bridge",
    template: "%s - Omelora",
  },
  description:
    "Track your hours, claim activities, and manage your chapter — all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="https://unpkg.com/react-scan@0.5.7/dist/auto.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        <NextTopLoader
          color="#09b5ff"
          height={3}
          showSpinner={false}
          crawl
          speed={200}
          shadow={false}
        />
        <AuthSessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
