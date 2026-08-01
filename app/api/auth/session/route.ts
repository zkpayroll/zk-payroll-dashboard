import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth/session';
import { resolveRole } from '@/lib/auth/roles';

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

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'No session' },
        { status: 401 }
      );
    }

    const session = await verifySessionToken(token);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      publicKey: session.publicKey,
      role: session.role,
      expiresAt: session.expiresAt,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
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
