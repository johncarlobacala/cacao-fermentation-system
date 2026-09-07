import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Use this client inside Server Components, Server Actions, and Route Handlers.
 * Must be awaited: const supabase = await createClient();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component (not a Server Action /
            // Route Handler) — safe to ignore because middleware.ts already
            // refreshes the session cookie on every request.
          }
        },
      },
    }
  );
}
