import { createBrowserClient } from "@supabase/ssr";

/**
 * Use this client inside Client Components ("use client").
 * Example: const supabase = createClient();
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
