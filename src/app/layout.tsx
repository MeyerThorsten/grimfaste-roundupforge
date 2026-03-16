import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "RoundupForge by Grimfaste",
  description: "Amazon Roundup Scout — Find and extract Amazon product data for roundup articles. A free tool by Grimfaste.com.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen flex flex-col`}
      >
        <nav className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <span className="font-semibold text-lg text-gray-900">RoundupForge</span>
                <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded font-medium">
                  by Grimfaste
                </span>
              </Link>
              <div className="flex gap-4 text-sm">
                <Link href="/" className="text-gray-600 hover:text-gray-900">
                  Home
                </Link>
                <Link href="/profiles" className="text-gray-600 hover:text-gray-900">
                  Profiles
                </Link>
                <Link href="/settings" className="text-gray-600 hover:text-gray-900">
                  Settings
                </Link>
              </div>
            </div>
            <a
              href="https://grimfaste.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-teal-600 transition-colors hidden sm:block"
            >
              grimfaste.com
            </a>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
        <footer className="border-t border-gray-200 bg-white mt-auto">
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">RoundupForge</span>
                <span className="text-xs text-gray-400">Amazon Roundup Scout</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>A free tool by</span>
                <a
                  href="https://grimfaste.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Grimfaste
                </a>
                <span className="text-gray-300 mx-1">|</span>
                <span className="text-gray-400">
                  The analytics command center for publishers managing hundreds of WordPress sites.
                </span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
