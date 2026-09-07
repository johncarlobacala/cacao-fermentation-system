import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/login";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // type === "recovery" -> came from "forgot password" email -> go set new password
      // type === "email" / "signup" -> came from admin-created account verification
      if (type === "recovery") {
        redirect(next);
      }
      redirect("/email-verified");
    }
  }

  redirect("/login?error=invalid_or_expired_link");
}
