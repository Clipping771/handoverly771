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

const PUBLIC_PATHS = ['/login', '/admin/login', '/system-admin/login'];
const PUBLIC_API_PATHS = ['/api/auth/login'];
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

  const { data: { session } } = await supabase.auth.getSession();

  // Not authenticated → redirect to login
  if (!session) {
    let loginRoute = '/login';
    if (pathname.startsWith('/admin')) loginRoute = '/admin/login';
    if (pathname.startsWith('/system-admin')) loginRoute = '/system-admin/login';

    const loginUrl = new URL(loginRoute, request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.user_metadata?.role as string | undefined;

  // Platform-admin-only routes
  if (requiresPlatformAdmin(pathname) && role !== 'platform_admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Admin-only routes
  if (requiresAdmin(pathname) && role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
