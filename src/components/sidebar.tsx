'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/lib/actions';
import { cn } from '@/lib/utils';

const commonItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/students', label: 'Students' },
  { href: '/classes', label: 'Classes' },
];

const ownerItems = [
  { href: '/fees', label: 'Fees' },
  { href: '/fees#fee-structures', label: 'Fee Structures' },
  { href: '/fees#payments', label: 'Payments' },
  { href: '/fees#balances', label: 'Balances' },
  { href: '/teachers', label: 'Teachers' },
  { href: '/promotions', label: 'Promotions' },
];

export function Sidebar({ schoolName, userRole }: { schoolName: string; userRole: string }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <Image src="/logos/IMG-20260506-WA0004(1).jpg" alt={schoolName} width={150} height={100} />
      </div>
      <h1>{schoolName}</h1>
      <nav>
        {commonItems.map((item) => (
          <Link key={item.href} href={item.href} className={cn(pathname === item.href && 'active')}>
            {item.label}
          </Link>
        ))}
        {userRole === 'OWNER'
          ? ownerItems.map((item) => (
              <Link key={item.href} href={item.href} className={cn(pathname === item.href && 'active')}>
                {item.label}
              </Link>
            ))
          : null}
      </nav>
      <form action={logoutAction} style={{ marginTop: '1.5rem' }}>
        <button type="submit" className="secondary" style={{ width: '100%' }}>
          Sign out
        </button>
      </form>
    </aside>
  );
}
