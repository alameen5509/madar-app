import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token) {
    return NextResponse.json({ error: 'No token' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('madar_token', token, {
    path:     '/',
    maxAge:   86400,
    sameSite: 'lax',
    httpOnly: false,
    secure:   process.env.NODE_ENV === 'production',
  });

  return response;
}
