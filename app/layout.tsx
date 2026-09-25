import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AEROSFORGE ONE | Helicopter Checkride Readiness",
  description: "Structured helicopter checkride preparation, oral practice, communications, and decision scenarios.",
  robots: process.env.PUBLIC_INDEXING_ENABLED === "true" ? { index: true, follow: true } : { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <header className="siteHeader">
      <Link className="brand" href="/">✦ AEROS<span>FORGE</span> <b>ONE</b></Link>
      <nav><Link href="/checkride">Checkride</Link><Link href="/academy">Academy</Link><Link href="/gauntlet">Gauntlet</Link><Link href="/dashboard">Dashboard</Link><Link href="/winchester">Winchester 2027</Link><Link className="button small" href="/sign-in">Sign in</Link></nav>
    </header>
    {children}
    <footer>AEROSFORGE™ • Educational platform prototype • Not FAA certification, flight instruction, or a substitute for a qualified CFI. • <Link href="/privacy">Privacy</Link></footer>
  </body></html>;
}
