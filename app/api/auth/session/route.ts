import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const { publicKey } = await request.json();

    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json(
        { error: 'publicKey is required' },
        { status: 400 }
      );
    }

    const adminKey = process.env.ADMIN_PUBLIC_KEY;
    const role: UserRole = publicKey === adminKey ? 'admin' : 'employee';

    const token = await createSessionToken(publicKey, role);

    const response = NextResponse.json({ success: true, role });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
