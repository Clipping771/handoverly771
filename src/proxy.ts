import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Route-level auth proxy (Next.js 16+ uses proxy.ts, not middleware.ts).
 *
 * Public routes (no auth required):
 *   /login, /admin/login, /api/auth/login
 *
 * Platform-admin only:
 *   /system-admin, /api/auth/create-admin
 *
 * Admin or platform-admin only:
 *   /admin, /api/auth/register-staff, /api/auth/update-staff, /api/auth/delete-staff
 *
 * Any authenticated user:
 *   Everything else
 */

const PUBLIC_PATHS = ['/login', '/admin/login', '/system-admin/login', '/register'];
const PUBLIC_API_PATHS = ['/api/auth/login', '/api/auth/register-public', '/api/message', '/api/public'];
const PLATFORM_ADMIN_PATHS = ['/system-admin', '/api/auth/create-admin'];
const ADMIN_PATHS = [
  '/admin',
  '/api/auth/register-staff',
  '/api/auth/update-staff',
  '/api/auth/delete-staff',
];

function isPublic(path: string) {
  return (
    PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/')) ||
    PUBLIC_API_PATHS.some(p => path === p || path.startsWith(p + '/'))
  );
}

function requiresPlatformAdmin(path: string) {
  return PLATFORM_ADMIN_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

function requiresAdmin(path: string) {
  return ADMIN_PATHS.some(p => path === p || path.startsWith(p + '/'));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.match(/\.(ico|png|svg|jpg|jpeg|webp|woff2?|css|js|json|txt|map)$/)
  ) {
    return NextResponse.next();
  }

  // Public routes — no auth needed
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Build response so Supabase SSR can refresh + set cookies
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user) {
    let loginRoute = '/login';
    if (pathname.startsWith('/admin')) loginRoute = '/admin/login';
    if (pathname.startsWith('/system-admin')) loginRoute = '/system-admin/login';

    const loginUrl = new URL(loginRoute, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roleRaw = user.app_metadata?.role as string | undefined;
  const role = roleRaw ? roleRaw.toLowerCase().trim() : undefined;

  // Platform-admin-only routes
  if (requiresPlatformAdmin(pathname) && role !== 'platform_admin') {
    const loginUrl = new URL('/system-admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes
  if (requiresAdmin(pathname) && role !== 'admin' && role !== 'platform_admin') {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
