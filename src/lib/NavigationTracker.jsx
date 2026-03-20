import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext'; 

export default function NavigationTracker() {
  const location = useLocation();
  const { user, isLoadingAuth } = useAuth(); 

  useEffect(() => {
    // Wait until the Auth check is finished
    if (isLoadingAuth) return;

    async function logNavigation() {
      const pathname = location.pathname;
      let pageName = pathname === '/' ? 'Home' : pathname.replace(/^\//, '');

      // Identify the user: use email if logged in, otherwise 'anonymous'
      const userIdentifier = user?.email || 'anonymous_visitor';

      const { error } = await supabase.from('app_logs').insert([
        { 
          user_email: userIdentifier, 
          page_name: pageName, 
          action: 'view_page',
          metadata: { 
            full_path: location.pathname + location.search,
            is_authenticated: !!user 
          }
        }
      ]);

      if (error) {
        // Silently log the error to console for your eyes only
        console.warn("Analytics blocked by RLS:", error.message);
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