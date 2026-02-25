import { NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('csp-report');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const report = body['csp-report'] ?? body;

    log.warn('CSP violation', { report });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 400 });
  }
}
