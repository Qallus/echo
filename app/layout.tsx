import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Echo | Conversations, Captured', description: 'Echo standalone starter' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
