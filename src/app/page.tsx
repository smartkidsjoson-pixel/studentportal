import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  // This is JOSON'S SMARTKIDS ACADEMY - not a multi-school SaaS
  // Redirect directly to login/dashboard based on auth status
  const supabase = await createClient();
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // User is authenticated - redirect to dashboard
      redirect('/dashboard');
    }
  } catch (error) {
    console.log('Not authenticated, redirecting to login');
  }
  
  // Not authenticated - redirect to login
  redirect('/login');
}
