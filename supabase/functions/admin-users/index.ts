import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {

  // REQUIRED FOR GITHUB → SUPABASE CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed" },
      405
    );
  }

  try {

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authorization =
      req.headers.get("Authorization") || "";

    const caller = createClient(
      supabaseUrl,
      anonKey,
      {
        global: {
          headers: {
            Authorization: authorization,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser();

    if (userError || !user) {
      return json(
        { error: "Unauthorized" },
        401
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const { data: profile } =
      await admin
        .from("profiles")
        .select("role,is_active")
        .eq("id", user.id)
        .single();

    if (
      profile?.role !== "admin" ||
      profile?.is_active !== true
    ) {
      return json(
        { error: "Admin access required" },
        403
      );
    }

    const body = await req.json();

    // ============================================
    // CREATE TEAM MEMBER
    // ============================================

    if (body.action === "create") {

      if (
        !body.display_name ||
        !body.email ||
        !body.password
      ) {
        return json(
          {
            error:
              "Name, email and password are required",
          },
          400
        );
      }

      const allowedRoles = [
        "admin",
        "manager",
        "team_member",
      ];

      if (!allowedRoles.includes(body.role)) {
        return json(
          { error: "Invalid role" },
          400
        );
      }

      const {
        data,
        error,
      } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,

        // Allows them to log in immediately
        email_confirm: true,

        user_metadata: {
          display_name: body.display_name,
        },
      });

      if (error) {
        return json(
          { error: error.message },
          400
        );
      }

      // Profile was automatically created by our
      // auth trigger. Update it with team details.

      const { error: profileError } =
        await admin
          .from("profiles")
          .update({
            display_name: body.display_name,
            email: body.email,
            role: body.role,
            department:
              body.department || null,
            is_active: true,
          })
          .eq("id", data.user.id);

      if (profileError) {
        return json(
          { error: profileError.message },
          400
        );
      }

      return json({
        ok: true,
        user_id: data.user.id,
      });
    }

    // ============================================
    // ACTIVATE / DEACTIVATE TEAM MEMBER
    // ============================================

    if (body.action === "set_active") {

      if (
        !body.user_id ||
        body.user_id === user.id
      ) {
        return json(
          { error: "Invalid user" },
          400
        );
      }

      const { error } =
        await admin
          .from("profiles")
          .update({
            is_active:
              Boolean(body.is_active),
          })
          .eq("id", body.user_id);

      if (error) {
        return json(
          { error: error.message },
          400
        );
      }

      return json({
        ok: true,
      });
    }

    return json(
      { error: "Unsupported action" },
      400
    );

  } catch (error) {

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
});
