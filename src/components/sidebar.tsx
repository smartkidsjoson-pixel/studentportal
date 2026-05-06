'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/lib/actions';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/teachers', label: 'Teachers' },
  { href: '/classes', label: 'Classes' },
  { href: '/fees', label: 'Fees' },
  { href: '/results', label: 'Results' },
  { href: '/reports', label: 'Reports' },
];

export function Sidebar({ schoolName }: { schoolName: string }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <h1>{schoolName}</h1>
      <nav>
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={cn(pathname === item.href && 'active')}>
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={logoutAction} style={{ marginTop: '1.5rem' }}>
        <button type="submit" className="secondary" style={{ width: '100%' }}>
          Sign out
        </button>
      </form>
    </aside>
  );
}
