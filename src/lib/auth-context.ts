import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export async function getAuthContext() {
  const cookieStore = await cookies();
  const supabaseServer = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { },
      },
    }
  );

  const { data: { user }, error } = await supabaseServer.auth.getUser();
  if (error || !user) {
    throw new AuthError('Unauthorized', 401);
  }

  // Access control checks: ensure facility_id, staff_id, and role are in app_metadata
  const facilityId = user.app_metadata?.facility_id;
  const role = user.app_metadata?.role;
  const staffId = user.app_metadata?.staff_id;

  if (!role || !staffId || (role !== 'platform_admin' && !facilityId)) {
    throw new AuthError('Forbidden: Missing required app metadata properties in session context', 403);
  }

  return {
    userId: user.id,
    staffId: staffId as string,
    facilityId: facilityId as string | null,
    role: role as string,
  };
}
