/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchProfile = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        setAuthError({ type: 'user_not_registered' });
        setProfile(null);
      } else {
        setProfile(data);
        setAuthError(null);
      }
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    // Single source of truth for Auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      console.log("--- AUTH DEBUG ---");
      console.log("Event:", event);
      console.log("User Email:", currentUser?.email);
      
      // 1. Update the base Auth User
      setUser(currentUser);
      
      // 2. If we have a user, we MUST wait for the profile before stopping the loading state
      console.log("Auth Event:", event, "User:", currentUser?.email);
      if (currentUser) {
        await fetchProfile(currentUser.id);
        console.log("Profile after fetch:", profile);
      } else {
        setProfile(null);
        setAuthError(null);
      }

      // 3. ONLY NOW do we stop the loading spinner
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile: profile, 
      isLoadingAuth: loading, 
      isAuthenticated: !!user, 
      authError 
    }}>
      {children} 
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};











// /* eslint-disable react-refresh/only-export-components */
// import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// import { supabase } from '@/api/supabaseClient';

// export const AuthContext = createContext({});

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [profile, setProfile] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [authError, setAuthError] = useState(null); // Added for registration checks

//   const fetchProfile = useCallback(async (userId) => {
//     try {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', userId)
//         .maybeSingle(); // Changed to maybeSingle to handle 'not registered' gracefully
      
//       if (error) throw error;
      
//       if (!data) {
//         setAuthError({ type: 'user_not_registered' });
//       } else {
//         setProfile(data);
//         setAuthError(null);
//       }
//     } catch (err) {
//       console.error("Error fetching profile:", err.message);
//       setProfile(null);
//     }
//   }, []);

//   useEffect(() => {
//     const initializeAuth = async () => {
//       const { data: { session } } = await supabase.auth.getSession();
//       const currentUser = session?.user ?? null;
//       setUser(currentUser);
//       if (currentUser) await fetchProfile(currentUser.id);
//       setLoading(false);
//     };

//     initializeAuth();

//     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
//       const currentUser = session?.user ?? null;
//       setUser(currentUser);
      
//       if (currentUser) {
//         await fetchProfile(currentUser.id);
//       } else {
//         setProfile(null);
//         setAuthError(null);
//       }
//       setLoading(false);
//     });

//     return () => subscription.unsubscribe();
//   }, [fetchProfile]);

//   return (
//     <AuthContext.Provider value={{ 
//       user, 
//       userProfile: profile, // Maps to APP.jsx 'userProfile'
//       isLoadingAuth: loading, // Maps to APP.jsx 'isLoadingAuth'
//       isAuthenticated: !!user, // Helper boolean
//       authError 
//     }}>
//       {/* We allow children to render so the Guard in APP.jsx can handle the UI states */}
//       {children} 
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) throw new Error('useAuth must be used within an AuthProvider');
//   return context;
// };
