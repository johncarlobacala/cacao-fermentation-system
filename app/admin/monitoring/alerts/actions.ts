"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAlertResolved(alertId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("alerts")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/monitoring/alerts");
  return { error: null };
}