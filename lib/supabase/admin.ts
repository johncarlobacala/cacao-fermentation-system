import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * DANGER: service-role client. Bypasses Row Level Security completely.
 * Only ever import this inside server-only code (Route Handlers /
 * Server Actions) — never in a Client Component, never in middleware.
 * Used for: admin creating a farmer account (needs auth.admin API).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
