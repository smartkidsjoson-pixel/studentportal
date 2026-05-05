import { redirect } from 'next/navigation';

import { getCurrentSessionUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getCurrentSessionUser();
  redirect(user ? '/dashboard' : '/login');
}
