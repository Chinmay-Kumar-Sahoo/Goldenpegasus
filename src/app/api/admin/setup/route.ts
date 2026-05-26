import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * POST /api/admin/setup
 * Creates the default admin account if it doesn't already exist
 * This endpoint is for initial setup purposes only
 */
export async function POST(request: Request) {
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing",
        },
        { status: 500 },
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const defaultAdminEmail =
      process.env.NEXT_PUBLIC_DEFAULT_ADMIN_EMAIL || "admin@goldenpegasusit.com";
    const defaultAdminPassword =
      process.env.NEXT_PUBLIC_DEFAULT_ADMIN_PASSWORD || "Admin@2026";

    // Check if admin already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const adminExists = existingUsers?.users?.some(
      (u) => u.email === defaultAdminEmail,
    );

    if (adminExists) {
      const existingAdmin = existingUsers?.users?.find(
        (u) => u.email === defaultAdminEmail,
      );

      if (existingAdmin) {
        await supabaseAdmin.from("profiles").upsert(
          {
            id: existingAdmin.id,
            email: defaultAdminEmail,
            full_name: "Admin",
            role: "admin",
            must_change_password: false,
            email_confirmed_at: existingAdmin.email_confirmed_at || new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        await supabaseAdmin.from("admin_profiles").upsert(
          {
            user_id: existingAdmin.id,
            email: defaultAdminEmail,
            full_name: "Admin",
            is_root: true,
            status: "active",
            email_confirmed_at: existingAdmin.email_confirmed_at || new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }

      return NextResponse.json({
        message: "Root admin account already exists",
        email: defaultAdminEmail,
        status: "already_exists",
      });
    }

    // Create the default admin user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: defaultAdminEmail,
      password: defaultAdminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Admin",
        role: "admin",
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user) {
      await supabaseAdmin.from("profiles").upsert(
        {
          id: data.user.id,
          email: defaultAdminEmail,
          full_name: "Admin",
          role: "admin",
          must_change_password: false,
          email_confirmed_at: data.user.email_confirmed_at || new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      await supabaseAdmin.from("admin_profiles").upsert(
        {
          user_id: data.user.id,
          email: defaultAdminEmail,
          full_name: "Admin",
          is_root: true,
          status: "active",
          email_confirmed_at: data.user.email_confirmed_at || new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    }

    return NextResponse.json({
      message: "Root admin account created successfully",
      email: defaultAdminEmail,
      note: "Root admin is email-confirmed and can sign in directly.",
      status: "created",
    });
  } catch (error: any) {
    console.error("Admin setup error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
