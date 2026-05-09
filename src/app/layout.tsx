import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Joson's SmartKids Academy Portal",
  description: "Joson's SmartKids Academy administrative portal for student, fee, and class management.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
