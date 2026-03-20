import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User-context client: validates who is calling
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optional but strongly recommended:
    // verify the caller is allowed to invite users
    const { data: callerProfile, error: profileError } = await supabaseUser
      .from("profiles")
      .select("system_role")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    const allowedRoles = ["Manager", "Lead"];
    if (!allowedRoles.includes(callerProfile.system_role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client: privileged operations happen only on the server
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, profileId, fullName, role } = await req.json();

    let finalAuthId: string | null = null;

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${req.headers.get("origin")}/reset-password`,
        data: { full_name: fullName, system_role: role },
      });

    if (inviteError) {
      const isConflict =
        inviteError.message.includes("already") || inviteError.status === 422;

      if (isConflict) {
        const { data: listData, error: findError } =
          await supabaseAdmin.auth.admin.listUsers();

        if (findError) throw findError;

        const existingUser = listData.users.find((u) => u.email === email);
        if (!existingUser) {
          throw new Error(`Lookup failed for ${email}: user not found`);
        }

        finalAuthId = existingUser.id;
      } else {
        throw inviteError;
      }
    } else {
      finalAuthId = inviteData.user.id;
    }

    if (!finalAuthId) {
      throw new Error("Could not determine Auth ID for user.");
    }

    const { data: getUserData, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(finalAuthId);

    if (getUserError) throw getUserError;

    const authUser = getUserData.user;

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        id: finalAuthId,
        synced: true,
        last_login: authUser.last_sign_in_at,
      })
      .eq("id", profileId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        status: authUser.last_sign_in_at ? "confirmed" : "pending",
        last_login: authUser.last_sign_in_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message ?? "Unexpected error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});









// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-key',
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

//   try {
//     const supabaseAdmin = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     )

//     const { email, profileId, fullName, role } = await req.json()
//     console.log(`Processing sync for: ${email}`);

//     let finalAuthId: string | null = null;

//     // 1. TRY TO INVITE
//     const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
//       redirectTo: `${req.headers.get('origin')}/reset-password`,
//       data: { full_name: fullName, system_role: role }
//     })

//     if (inviteError) {
//       const isConflict = inviteError.message.includes("already") || inviteError.status === 422;

//       if (isConflict) {
//         console.log(`User ${email} exists. Fetching data by email...`);
        
//         // Find existing user
//         const { data: { users }, error: findError } = await supabaseAdmin.auth.admin.listUsers({
//           filter: { email: email } 
//         });

//         if (findError || users.length === 0) {
//           throw new Error(`Lookup failed for ${email}: ${findError?.message || "User not found"}`);
//         }
        
//         finalAuthId = users[0].id;
//       } else {
//         throw inviteError;
//       }
//     } else {
//       // THIS WAS MISSING: Handle the case where the invite was SUCCESSFUL
//       finalAuthId = inviteData.user.id;
//       console.log(`New user invited successfully. ID: ${finalAuthId}`);
//     }

//     // 2. SAFETY CHECK: Ensure we have an ID before calling getUserById
//     if (!finalAuthId) throw new Error("Could not determine Auth ID for user.");

//     // 3. FETCH LATEST DATA & UPDATE PROFILE
//     const { data: { user: authUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(finalAuthId);
//     if (getUserError) throw getUserError;

//     console.log(`Syncing last_login: ${authUser.last_sign_in_at} to profile: ${profileId}`);

//     const { error: updateError } = await supabaseAdmin
//       .from('profiles')
//       .update({ 
//         id: finalAuthId, 
//         synced: true,
//         last_login: authUser.last_sign_in_at 
//       })
//       .eq('id', profileId)

//     if (updateError) throw updateError;

//     return new Response(
//       JSON.stringify({ 
//         success: true, 
//         status: authUser.last_sign_in_at ? "confirmed" : "pending",
//         last_login: authUser.last_sign_in_at 
//       }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
//     )

//   } catch (error) {
//     console.error("Critical Function Error:", error.message);
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
//     )
//   }
// })








