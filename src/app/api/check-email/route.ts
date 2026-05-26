import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Check if user exists in auth
    const { data: user, error: userError } =
      await supabase.auth.admin.listUsers();

    if (userError) {
      return NextResponse.json(
        { error: "Failed to verify email" },
        { status: 500 },
      );
    }

    const userExists = user?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    return NextResponse.json({ exists: !!userExists });
  } catch (error: any) {
    console.error("Email check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
