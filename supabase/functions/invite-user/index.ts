import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-key',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { email, profileId, fullName, role } = await req.json()
    console.log(`Processing sync for: ${email}`);

    let finalAuthId: string | null = null;

    // 1. TRY TO INVITE
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.headers.get('origin')}/reset-password`,
      data: { full_name: fullName, system_role: role }
    })

    if (inviteError) {
      const isConflict = inviteError.message.includes("already") || inviteError.status === 422;

      if (isConflict) {
        console.log(`User ${email} exists. Fetching data by email...`);
        
        // Find existing user
        const { data: { users }, error: findError } = await supabaseAdmin.auth.admin.listUsers({
          filter: { email: email } 
        });

        if (findError || users.length === 0) {
          throw new Error(`Lookup failed for ${email}: ${findError?.message || "User not found"}`);
        }
        
        finalAuthId = users[0].id;
      } else {
        throw inviteError;
      }
    } else {
      // THIS WAS MISSING: Handle the case where the invite was SUCCESSFUL
      finalAuthId = inviteData.user.id;
      console.log(`New user invited successfully. ID: ${finalAuthId}`);
    }

    // 2. SAFETY CHECK: Ensure we have an ID before calling getUserById
    if (!finalAuthId) throw new Error("Could not determine Auth ID for user.");

    // 3. FETCH LATEST DATA & UPDATE PROFILE
    const { data: { user: authUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(finalAuthId);
    if (getUserError) throw getUserError;

    console.log(`Syncing last_login: ${authUser.last_sign_in_at} to profile: ${profileId}`);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        id: finalAuthId, 
        synced: true,
        last_login: authUser.last_sign_in_at 
      })
      .eq('id', profileId)

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: authUser.last_sign_in_at ? "confirmed" : "pending",
        last_login: authUser.last_sign_in_at 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error("Critical Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})








// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-service-key',
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

//   try {
//     const internalSecret = Deno.env.get('SYNC_AUTH_SECRET');
//     const incomingKey = req.headers.get('x-service-key');

//     if (!incomingKey || incomingKey !== internalSecret) {
//       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
//     }

//     const supabaseAdmin = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     )

//     const { email, profileId, fullName, role } = await req.json()
//     let finalAuthId: string;

//     // 1. TRY TO INVITE
//     const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
//       redirectTo: `${req.headers.get('origin')}/reset-password`,
//       // We pass metadata so the user is created with the right info in Auth
//       data: { full_name: fullName, system_role: role }
//     })

//     if (inviteError) {
//       // 2. SMARTER ERROR CHECK
//       // We check for typical "already exists" messages AND the 422 Unprocessable Entity status
//       const isConflict = 
//         inviteError.message.includes("already has an account") || 
//         inviteError.message.includes("already been invited") ||
//         inviteError.status === 422;

//       if (isConflict) {
//         console.log(`User ${email} exists or already active. Syncing instead...`);
        
//         // Find the user to get their ID and current login status
//         const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
//         if (listError) throw listError;
        
//         const existingUser = listData.users.find(u => u.email === email);
//         if (!existingUser) throw new Error("User reported as existing but not found in Auth list.");
        
//         finalAuthId = existingUser.id;
//       } else {
//         // If it's a genuine error (invalid email, etc), stop here
//         throw inviteError;
//       }
//     } else {
//       finalAuthId = inviteData.user.id;
//     }

//     // 3. FETCH THE LATEST DATA FROM AUTH
//     // This ensures we get the most recent 'last_sign_in_at' directly from the source
//     const { data: { user: authUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(finalAuthId);
//     if (getUserError) throw getUserError;

//     // 4. SYNC TO PROFILES TABLE
//     // This bridges the gap between Supabase Auth and your public database
//     const { error: updateError } = await supabaseAdmin
//       .from('profiles')
//       .update({ 
//         id: finalAuthId, 
//         synced: true,
//         last_login: authUser.last_sign_in_at // Maps Auth timestamp to your DB column
//       })
//       .eq('id', profileId)

//     if (updateError) throw new Error(`Profile sync failed: ${updateError.message}`);

//     return new Response(
//       JSON.stringify({ 
//         success: true, 
//         newId: finalAuthId, 
//         // If they have a login timestamp, they are 'confirmed', otherwise 'pending'
//         status: authUser.last_sign_in_at ? "confirmed" : "pending",
//         lastLogin: authUser.last_sign_in_at 
//       }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
//     )

//   } catch (error) {
//     console.error("Edge Function Error:", error.message);
//     return new Response(
//       JSON.stringify({ error: error.message }),
//       { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
//     )
//   }
// })