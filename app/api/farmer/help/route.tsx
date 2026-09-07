import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Normal client (logged-in farmer)
    const supabase = await createClient();

    // Get authenticated farmer
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    // Get request body
    const body = await request.json();
    const { subject, message } = body;

    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Subject and message are required." },
        { status: 400 }
      );
    }

    // Save support message
    // Ang trigger nga "trg_notify_admin_on_support_message" na ang bahala
    // mag-notify sa tanan admins automatically pag naay bag-ong row diri.
    const { error: supportError } = await supabase
      .from("support_messages")
      .insert({
        farmer_id: user.id,
        subject: subject.trim(),
        message: message.trim(),
      });

    if (supportError) {
      console.error("Support Message Error:", supportError);

      return NextResponse.json(
        { error: supportError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Support message sent successfully.",
    });
  } catch (error: any) {
    console.error("Unexpected Error:", error);

    return NextResponse.json(
      {
        error: error.message || "Unexpected server error.",
      },
      {
        status: 500,
      }
    );
  }
}