import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    // =====================================================
    // 1. CURRENT LOGGED-IN USER
    // =====================================================

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
        {
          error: authError.message,
        },
        { status: 401 }
      );
    }

    if (!user) {
      return NextResponse.json(
        {
          error: "Not authenticated.",
        },
        { status: 401 }
      );
    }

    // =====================================================
    // 2. GET CURRENT USER PROFILE
    // =====================================================

    const { data: callerProfile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .single();

    console.log("CALLER PROFILE:", callerProfile);
    console.log("PROFILE ERROR:", profileError);

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

    // =====================================================
    // 3. ONLY ADMIN CAN CREATE FARMER ACCOUNTS
    // =====================================================

    if (callerProfile.role?.toLowerCase() !== "admin") {
      return NextResponse.json(
        {
          error: `Only admins can create accounts. Your role is "${callerProfile.role}".`,
        },
        { status: 403 }
      );
    }

    // =====================================================
    // 4. READ REQUEST BODY
    // =====================================================

    const body = await request.json();

    const {
      full_name,
      email,
      contact_number,
      temporary_password,
      farm_id,
    } = body;

    if (
      !full_name ||
      !email ||
      !temporary_password
    ) {
      return NextResponse.json(
        {
          error:
            "full_name, email and temporary_password are required.",
        },
        { status: 400 }
      );
    }

    // =====================================================
    // 5. CREATE SUPABASE ADMIN CLIENT
    // =====================================================

    const admin = createAdminClient();

    // =====================================================
    // 6. CREATE AUTH USER
    // =====================================================

    const { data: newUserData, error: createError } =
      await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: temporary_password,
        email_confirm: true,

        // Metadata only.
        // Actual role is also forced below in profiles.
        user_metadata: {
          full_name: full_name.trim(),
          role: "farmer",
          contact_number: contact_number || "",
        },
      });

    console.log("NEW USER:", newUserData);
    console.log("CREATE ERROR:", createError);

    if (createError) {
      return NextResponse.json(
        {
          error: createError.message,
        },
        { status: 400 }
      );
    }

    if (!newUserData.user) {
      return NextResponse.json(
        {
          error: "User was created but no user data was returned.",
        },
        { status: 500 }
      );
    }

    const newUserId = newUserData.user.id;

    console.log("NEW FARMER UID:", newUserId);

    // =====================================================
    // 7. CREATE / UPDATE PROFILE
    // =====================================================
    //
    // IMPORTANT:
    // This guarantees that the new account is a FARMER.
    //
    // profiles.id = auth.users.id
    // profiles.role = farmer
    // profiles.status = active
    //
    // =====================================================

    const { error: profileUpsertError } =
      await admin
        .from("profiles")
        .upsert(
          {
            id: newUserId,
            role: "farmer",
            full_name: full_name.trim(),
            contact_number: contact_number || "",
            status: "active",
          },
          {
            onConflict: "id",
          }
        );

    console.log(
      "PROFILE UPSERT ERROR:",
      profileUpsertError
    );

    if (profileUpsertError) {
      // ---------------------------------------------------
      // If profile creation fails, remove the Auth user
      // so we don't leave an incomplete account behind.
      // ---------------------------------------------------

      console.error(
        "Profile creation failed. Removing Auth user..."
      );

      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        {
          error:
            "Farmer account could not be completed.",
          details: profileUpsertError.message,
        },
        { status: 500 }
      );
    }

    // =====================================================
    // 8. ASSIGN FARM (OPTIONAL)
    // =====================================================

    if (farm_id) {
      const { error: farmError } =
        await admin
          .from("farms")
          .update({
            farmer_id: newUserId,
          })
          .eq("id", farm_id);

      console.log("FARM ERROR:", farmError);

      if (farmError) {
        return NextResponse.json(
          {
            success: true,
            warning:
              "Farmer account created, but the farm could not be assigned.",
            user_id: newUserId,
          },
          { status: 200 }
        );
      }
    }

    // =====================================================
    // 9. SUCCESS
    // =====================================================

    return NextResponse.json(
      {
        success: true,
        message: "Farmer account created successfully.",
        user_id: newUserId,
        role: "farmer",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(
      "CREATE FARMER ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Something went wrong while creating the farmer account.",
      },
      { status: 500 }
    );
  }
}