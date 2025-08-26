import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import SessionTracker from "./components/SessionTracker.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import ActiveOrderGuard from "./components/ActiveOrderGuard.jsx";
import ActiveDriverGuard from "./components/ActiveDriverGuard.jsx";
import { Suspense } from "react";
import PWAInstallPrompt from "./components/PWAInstallPrompt.jsx";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Tricycle — Réservez un tricycle en 2 clics",
  description: "PWA de réservation de tricycle pour des trajets urbains rapides.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#fb923c" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Tricycle" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/globe.svg" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <SessionTracker />
        </Suspense>
        <Suspense fallback={null}>
          <ActiveOrderGuard />
        </Suspense>
        <ActiveDriverGuard />
        <ToastProvider>
          <PWAInstallPrompt />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
