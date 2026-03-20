import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext'; 

export default function NavigationTracker() {
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth(); 

  useEffect(() => {
    // 1. Guard: Wait until Auth is initialized
    if (isLoadingAuth) return;

    // 2. Guard: If no user is logged in, don't even try to log.
    // This prevents 401/403 errors on the Login page.
    if (!user) return;

    async function logNavigation() {
      try {
        const pathname = location.pathname;
        let pageName = pathname === '/' ? 'Home' : pathname.replace(/^\//, '');

        const { error } = await supabase.from('app_logs').insert([
          { 
            user_email: user.email, 
            page_name: pageName, 
            action: 'view_page',
            metadata: { 
              full_path: location.pathname + location.search,
              is_authenticated: true 
            }
          }
        ]);

        if (error) {
          // This catches Supabase-specific errors (like RLS)
          console.warn("Navigation log skipped (Supabase):", error.message);
        }
      } catch (err) {
        // This catches network crashes or code errors
        console.error("Critical Navigation Log Error:", err.message);
      }
    }

    logNavigation();
  }, [location.pathname, user, isLoadingAuth]); 

  return null;
}






// import { useEffect } from 'react';
// import { useLocation } from 'react-router-dom';
// import { supabase } from '@/api/supabaseClient';

// export default function NavigationTracker() {
//   const location = useLocation();

//   useEffect(() => {
//     async function logNavigation() {
//       // 1. Get the current user
//       const { data: { user } } = await supabase.auth.getUser();
//       if (!user) return;

//       // 2. Determine the page name from the URL
//       const pathname = location.pathname;
//       let pageName = pathname === '/' ? 'Home' : pathname.replace(/^\//, '');

//       // 3. Log to Supabase
//       // We use the email-based approach as requested
//       await supabase.from('app_logs').insert([
//         { 
//           user_email: user.email, 
//           page_name: pageName, 
//           action: 'view_page',
//           metadata: { full_path: location.pathname + location.search }
//         }
//       ]).select();
//     }

//     logNavigation().catch(() => {
//         // Silently fail - logging shouldn't break the user experience
//     });
//   }, [location]);

//   return null;
// }