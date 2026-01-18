import "./globals.css";
import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "A Squared Client Portal",
  description: "Client-facing project status portal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Top navigation / header */}
        <div className="w-full border-b border-slate-200/70 bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              {/* LOGO */}
              <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <Image
                  src="/logo.png"
                  alt="A Squared logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>

              {/* Brand text */}
              <div>
                <div className="text-sm font-extrabold tracking-tight text-slate-900">
                  A Squared Client Portal
                </div>
                <div className="text-xs text-slate-600">
                  Project updates + notes
                </div>
              </div>
            </div>

            {/* Right-side badge */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                Secure access
              </span>
            </div>
          </div>
        </div>

        {children}
      </body>
    </html>
  );
}
