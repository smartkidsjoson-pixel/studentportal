import { NextResponse } from 'next/server';

import { getFeeStatementData } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const data = await getFeeStatementData(studentId);
  return NextResponse.json(data);
}
