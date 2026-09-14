import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'AeroComm Master', description: 'Cross-device aviation radio communications trainer' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
