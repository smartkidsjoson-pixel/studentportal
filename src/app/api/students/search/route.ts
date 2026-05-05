import { NextResponse } from 'next/server';

import { getStudents } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? undefined;
  const classId = searchParams.get('classId') ?? undefined;
  const results = await getStudents({ query: q, classId });
  return NextResponse.json({ results });
}
