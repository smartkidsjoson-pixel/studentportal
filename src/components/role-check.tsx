'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function RoleCheck({ sessionRole }: { sessionRole: string }) {
  const router = useRouter();

  useEffect(() => {
    // Fetch the DB role
    fetch('/api/check-role') // Need to create this API
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