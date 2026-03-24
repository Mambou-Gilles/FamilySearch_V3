import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Initialize Supabase Admin Client
    // Deno.env gets these from your Supabase Project Settings automatically
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 3. Parse the request body
    const { email, full_name, role, custom_redirect } = await req.json()

    // 4. Determine the Redirect URL
    // Priority: 1. Manual override, 2. Request Origin, 3. Production Fallback
    const origin = req.headers.get('origin') || 'https://your-production-app.com'
    const finalRedirect = custom_redirect || `${origin}/reset-password`

    // 5. Invite the User
    // This creates the auth.user and triggers your 'handle_new_user' SQL function
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { 
          full_name: full_name, 
          role: role 
        },
        redirectTo: finalRedirect,
      }
    )

    if (error) throw error

    // 6. Return Success
    return new Response(
      JSON.stringify({ 
        message: 'Invitation sent successfully', 
        user: data.user 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    )
  }
})







// import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// const corsHeaders = {
//   'Access-Control-Allow-Origin': '*',
//   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
// }

// serve(async (req) => {
//   if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

//   try {
//     const { email } = await req.json()
//     const supabaseAdmin = createClient(
//       Deno.env.get('SUPABASE_URL') ?? '',
//       Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
//     )

//     const cleanEmail = email.toLowerCase().trim()

//     // 1. Fetch existing Dashboard Profile
//     const { data: oldProfile, error: fetchError } = await supabaseAdmin
//       .from('profiles')
//       .select('*')
//       .eq('email', cleanEmail)
//       .single()

//     if (fetchError || !oldProfile) {
//       throw new Error("No pre-existing profile found for this email.")
//     }

//     let authUserId: string;

//     // 2. Try to Invite the User
//     const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
//       redirectTo: `${req.headers.get('origin')}/reset-password` 
//     })

//     if (inviteError) {
//       // Check if they are already in the Auth system
//       if (inviteError.message.includes("already been invited") || inviteError.message.includes("already registered")) {
        
//         // Find their existing Auth ID so we can still sync the profile
//         const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
//         const existingUser = users.users.find(u => u.email === cleanEmail)
        
//         if (listError || !existingUser) throw new Error("User exists in Auth but ID could not be retrieved.")
        
//         authUserId = existingUser.id;
//       } else {
//         throw inviteError
//       }
//     } else {
//       authUserId = inviteData.user.id
//     }

//     // 3. THE SYNC SWAP
//     // If the IDs already match, just update the sync status
//     if (oldProfile.id === authUserId) {
//       await supabaseAdmin.from('profiles').update({ synced: true }).eq('id', authUserId)
//     } else {
//       // Otherwise, perform the Delete/Insert swap
//       const { error: deleteError } = await supabaseAdmin
//         .from('profiles')
//         .delete()
//         .eq('id', oldProfile.id)

//       if (deleteError) throw new Error("Failed to clear temp profile: " + deleteError.message)

//       const { error: insertError } = await supabaseAdmin
//         .from('profiles')
//         .insert({
//           ...oldProfile,
//           id: authUserId,
//           synced: true,
//           last_login: oldProfile.last_login || null
//         })

//       if (insertError) throw new Error("Sync swap failed: " + insertError.message)
//     }

//     return new Response(JSON.stringify({ success: true, userId: authUserId }), { 
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//       status: 200 
//     })

//   } catch (error) {
//     return new Response(JSON.stringify({ error: error.message }), { 
//       headers: { ...corsHeaders, "Content-Type": "application/json" },
//       status: 400 
//     })
//   }
// })




