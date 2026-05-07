import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'School Management System',
  description: 'School management system for student records and academic reporting.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
