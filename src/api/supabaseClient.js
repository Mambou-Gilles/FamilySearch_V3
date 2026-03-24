import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// This 'anon' client respects all the RLS we wrote!
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
window.supabase = supabase;





// import { createClient } from '@supabase/supabase-js'

// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// // Error check: Ensure keys are actually loading
// if (!supabaseUrl || !supabasePublishableKey) {
//   console.error("Supabase environment variables are missing! Check your .env file.");
// }

// export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
//   auth: {
//     persistSession: true,       // Added missing comma here
//     autoRefreshToken: true,
//     detectSessionInUrl: true,   // Required for password reset/invite links
//     storageKey: 'sb-auth-token', // Custom key name is fine
//     storage: window.localStorage // Explicitly use window.localStorage
//   }
// })