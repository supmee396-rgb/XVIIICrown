import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Guild Queue — Dungeon Party Manager',description:'ระบบลงคิวและจัดตี้แบกดันเจี้ยนสำหรับกิล'};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="th"><body>{children}</body></html>; }
