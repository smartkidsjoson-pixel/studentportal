'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RoleCheck({ sessionRole }: { sessionRole: string }) {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/check-role')
      .then(res => res.json())
      .then(data => {
        if (data.role !== sessionRole) {
          console.log('Role mismatch, refreshing:', data.role, sessionRole);
          router.refresh();
        }
      })
      .catch(err => console.error('Role check failed', err));
  }, [sessionRole, router]);

  return null;
}