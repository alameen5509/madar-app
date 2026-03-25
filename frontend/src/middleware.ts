import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/watch-login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('madar_token')?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // No token and not public page → redirect to login
  // But also check for localStorage token via a client-side approach
  if (!token && !isPublic) {
    // Instead of hard redirect, let client-side handle auth
    // This prevents the login loop when cookie isn't set yet
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Has token and on public page → redirect to tasks
  if (token && isPublic) {
    return NextResponse.redirect(new URL('/habits', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon\\.svg|manifest\\.json|.*\\.png|.*\\.ico).*)'],
};
