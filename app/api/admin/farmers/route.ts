import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  console.log("========== REQUIRE ADMIN ==========");
  console.log("USER:", user);
  console.log("USER ERROR:", userError);

  if (!user) {
    return {
      ok: false as const,
      status: 401,
      error: "Not authenticated.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  console.log("PROFILE:", profile);
  console.log("PROFILE ERROR:", profileError);
  console.log("===================================");

  if (profileError) {
    return {
      ok: false as const,
      status: 500,
      error: profileError.message,
    };
  }

  if (profile?.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      error: "Admins only.",
    };
  }

  return {
    ok: true as const,
    user,
    profile,
  };
}

export async function GET() {
  console.log("========== FARMERS GET ROUTE HIT ==========");

  const check = await requireAdmin();

  if (!check.ok) {
    return NextResponse.json(
      { error: check.error },
      { status: check.status }
    );
  }

  const admin = createAdminClient();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select(
      `
      id,
      full_name,
      contact_number,
      status,
      created_at
      `
    )
    .eq("role", "farmer")
    .order("created_at", { ascending: false });

  console.log("FARMER PROFILES:", profiles);
  console.log("PROFILES ERROR:", profilesError);

  if (profilesError) {
    return NextResponse.json(
      { error: profilesError.message },
      { status: 500 }
    );
  }

  const { data: farms, error: farmsError } = await admin
    .from("farms")
    .select("id,name,farmer_id");

  console.log("FARMS:", farms);
  console.log("FARMS ERROR:", farmsError);

  const {
    data: usersPage,
    error: usersError,
  } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  console.log("AUTH USERS:", usersPage);
  console.log("USERS ERROR:", usersError);

  const emailById = new Map(
    usersPage?.users.map((u) => [u.id, u.email]) ?? []
  );

  const farmsByFarmer = new Map<string, string[]>();

  (farms ?? []).forEach((farm) => {
    if (!farm.farmer_id) return;

    const list = farmsByFarmer.get(farm.farmer_id) ?? [];
    list.push(farm.name);
    farmsByFarmer.set(farm.farmer_id, list);
  });

  const farmers = (profiles ?? []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    contact_number: profile.contact_number,
    status: profile.status,
    created_at: profile.created_at,
    email: emailById.get(profile.id) ?? "—",
    farms: farmsByFarmer.get(profile.id) ?? [],
  }));

  console.log("FINAL FARMERS:", farmers);

  return NextResponse.json({
    success: true,
    farmers,
  });
}