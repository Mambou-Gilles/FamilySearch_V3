import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext'; // Import your Auth hook

export default function NavigationTracker() {
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth(); // Get user from Context

  useEffect(() => {
    // 1. Guard: Don't do anything if we are still checking auth 
    // or if no user is logged in.
    if (isLoadingAuth || !user) return;

    async function logNavigation() {
      // 2. Determine the page name from the URL
      const pathname = location.pathname;
      let pageName = pathname === '/' ? 'Home' : pathname.replace(/^\//, '');

      // 3. Log to Supabase
      const { error } = await supabase.from('app_logs').insert([
        { 
          user_email: user.email, 
          page_name: pageName, 
          action: 'view_page',
          metadata: { 
            full_path: location.pathname + location.search,
            timestamp: new Date().toISOString()
          }
        }
      ]);

      if (error) {
        // Log locally for debugging but don't crash the app
        console.warn("Navigation log skipped:", error.message);
      }
    }

    logNavigation();
  }, [location, user, isLoadingAuth]); // Fires when location OR user changes

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