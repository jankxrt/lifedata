import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PasswordGate from "./components/PasswordGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ABH Index",
  description: "Ausländerbehörden Index",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        <PasswordGate>
          <header className="border-b border-[color:var(--border)] bg-[color:var(--surface)]">
            <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 h-14">
              <a href="/" className="flex items-center gap-2 text-base font-semibold text-[color:var(--foreground)] hover:opacity-80 transition-opacity">
                ABH Index
              </a>
              <div className="flex items-center gap-1">
                <a href="/" className="nav-link">Übersicht</a>
                <a href="/statistics" className="nav-link">Statistik</a>
                <a href="/summary" className="nav-link">Summary</a>
                {/* Outreach dropdown */}
                <div className="group relative">
                  <a href="/outreach" className="nav-link flex items-center gap-1">
                    Outreach
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true" className="opacity-50">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                  {/* pt-1 acts as an invisible hover bridge so the dropdown doesn't flicker */}
                  <div className="absolute left-0 top-full z-50 hidden pt-1 group-hover:block">
                    <div className="min-w-[160px] overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
                      <a href="/outreach" className="flex items-center px-3 py-2 text-sm font-medium text-[color:var(--muted-strong)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
                        Outreach
                      </a>
                      <a href="/outreach/email" className="flex items-center px-3 py-2 text-sm font-medium text-[color:var(--muted-strong)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
                        E-Mail
                      </a>
                      <a href="/outreach/planung" className="flex items-center px-3 py-2 text-sm font-medium text-[color:var(--muted-strong)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]">
                        Planung
                      </a>
                    </div>
                  </div>
                </div>
                <span className="nav-link opacity-40 cursor-not-allowed pointer-events-none select-none" title="Demnächst verfügbar">Karte</span>
              </div>
            </nav>
          </header>
          {children}
        </PasswordGate>
      </body>
    </html>
  );
}
