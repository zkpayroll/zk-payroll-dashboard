import { NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import type { UserRole } from '@/types';

function resolveRole(publicKey: string): UserRole {
  const adminKey = process.env.ADMIN_PUBLIC_KEY;
  if (publicKey === adminKey) return 'admin';

  const operatorKeys = (process.env.OPERATOR_PUBLIC_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (operatorKeys.includes(publicKey)) return 'operator';

  const auditorKeys = (process.env.AUDITOR_PUBLIC_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (auditorKeys.includes(publicKey)) return 'auditor';

  return 'employee';
}

export async function POST(request: Request) {
  try {
    const { publicKey } = await request.json();

    if (!publicKey || typeof publicKey !== 'string') {
      return NextResponse.json(
        { error: 'publicKey is required' },
        { status: 400 }
      );
    }

    const role = resolveRole(publicKey);
    const token = await createSessionToken(publicKey, role);

    const response = NextResponse.json({ success: true, role });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
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
