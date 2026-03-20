import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, email } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Permanently remove the user from Supabase Auth
    // This invalidates all sessions immediately.
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    // We ignore "User not found" errors in case they were already 
    // partially deleted or never synced.
    if (authError && !authError.message.includes("User not found")) {
      throw authError
    }

    // 2. Update the Profile table
    // We set synced to false and status to 'attrited'.
    // We keep the record for historical reporting but they can't log in.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        synced: false,
        status: 'attrited',
        updated_at: new Date().toISOString()
      })
      .eq('email', email.toLowerCase())

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true, message: "User access revoked and profile archived." }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    )
  }
})