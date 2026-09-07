import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // ==========================================
    // Current logged-in user
    // ==========================================
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("========== CREATE FARMER ==========");
    console.log("AUTH USER:", user);
    console.log("AUTH ERROR:", authError);

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    // ==========================================
    // Get current user's profile
    // ==========================================
    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    console.log("PROFILE:", callerProfile);
    console.log("PROFILE ERROR:", profileError);
    console.log("USER ID:", user.id);
    console.log("ROLE:", callerProfile?.role);

    if (profileError) {
      return NextResponse.json(
        {
          error: "Unable to read your profile.",
          details: profileError.message,
        },
        { status: 500 }
      );
    }

    if (!callerProfile) {
      return NextResponse.json(
        {
          error: "Your profile does not exist.",
        },
        { status: 404 }
      );
    }

    // Allow both "admin" and "Admin"
    if (
      callerProfile.role?.toLowerCase() !== "admin"
    ) {
      return NextResponse.json(
        {
          error: `Only admins can create accounts. Your role is "${callerProfile.role}".`,
        },
        { status: 403 }
      );
    }

    // ==========================================
    // Read request body
    // ==========================================
    const body = await request.json();

    const {
      full_name,
      email,
      contact_number,
      temporary_password,
      farm_id,
    } = body;

    if (!full_name || !email || !temporary_password) {
      return NextResponse.json(
        {
          error:
            "full_name, email and temporary_password are required.",
        },
        { status: 400 }
      );
    }

    // ==========================================
    // Admin Client
    // ==========================================
    const admin = createAdminClient();

    const { data: newUser, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password: temporary_password,
        email_confirm: true,
        user_metadata: {
          full_name,
          role: "farmer",
        },
      });

    console.log("NEW USER:", newUser);
    console.log("CREATE ERROR:", createError);

    if (createError) {
      return NextResponse.json(
        {
          error: createError.message,
        },
        { status: 400 }
      );
    }

    // ==========================================
    // Update profile
    // ==========================================
    const { error: updateProfileError } = await admin
      .from("profiles")
      .update({
        contact_number,
      })
      .eq("id", newUser.user.id);

    console.log("UPDATE PROFILE ERROR:", updateProfileError);

    // ==========================================
    // Assign farm (optional)
    // ==========================================
    if (farm_id) {
      const { error: farmError } = await admin
        .from("farms")
        .update({
          farmer_id: newUser.user.id,
        })
        .eq("id", farm_id);

      console.log("FARM ERROR:", farmError);
    }

    // ==========================================
    // Success
    // ==========================================
    return NextResponse.json({
      success: true,
      user_id: newUser.user.id,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message,
      },
      {
        status: 500,
      }
    );
  }
}