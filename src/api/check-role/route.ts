import { NextResponse } from 'next/server';

import { getSessionUserProfile } from '@/lib/data';

export async function GET() {
  try {
    const profile = await getSessionUserProfile();
    if (!profile) {
      return NextResponse.json({ error: 'No session' }, { status: 401 });
    }
    return NextResponse.json({ role: profile.role });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}