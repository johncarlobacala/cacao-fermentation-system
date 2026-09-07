import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admins only." };

  return { ok: true as const };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const body = await request.json();
  const { full_name, contact_number, status } = body;

  const admin = createAdminClient();
  const updatePayload: Record<string, unknown> = {};
  if (full_name !== undefined) updatePayload.full_name = full_name;
  if (contact_number !== undefined) updatePayload.contact_number = contact_number;
  if (status !== undefined) updatePayload.status = status;

  const { error } = await admin.from("profiles").update(updatePayload).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { id } = await params;
  const admin = createAdminClient();

  // Deleting the auth user cascades to profiles (and from there to that
  // farmer's farms/batches/etc, per the on-delete-cascade FKs in the schema).
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
