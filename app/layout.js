import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import SessionTracker from "./components/SessionTracker.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import ActiveOrderGuard from "./components/ActiveOrderGuard.jsx";
import ActiveDriverGuard from "./components/ActiveDriverGuard.jsx";

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionTracker />
        <ActiveOrderGuard />
        <ActiveDriverGuard />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
