/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  const isInitialMount = useRef(true);

  // --- 1. THE BULLETPROOF FETCH PROFILE ---
  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setIsLoadingAuth(false);
      return;
    }

    console.log("🔍 [AuthContext] Fetching profile for UUID:", userId);
    console.time("⏱️ DB_RESPONSE_TIME"); // Starts the timer

    try {
      // We use .select().eq().maybeSingle() for the most reliable fetch
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();

      console.timeEnd("⏱️ DB_RESPONSE_TIME"); // Stops the timer and prints to console
      console.log("📦 [AuthContext] Database Response:", { data, error });

      if (error) {
        console.error("❌ Database Profile Error:", error.message);
        setAuthError({ type: 'database_error', message: error.message });
      } else if (!data) {
        console.warn("⚠️ No profile row found in DB for ID:", userId);
        setAuthError({ type: 'user_not_registered' });
        setProfile(null);
      } else {
        setProfile(data);
        setAuthError(null);
      }
    } catch (err) {
      console.error("🚨 Critical Profile Fetch Crash:", err);
    } finally {
      // This MUST run to stop the spinner
      setIsLoadingAuth(false);
    }
  }, []);

  // --- 2. THE LOGOUT FUNCTION ---
  const logout = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setAuthError(null);
      window.location.href = '/login'; 
    } catch (err) {
      console.error("Logout failed:", err);
      localStorage.clear();
      window.location.href = '/login';
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  // --- 3. THE INITIALIZATION LOGIC ---
  const initialize = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) throw sessionError;

      if (session?.user) {
        setUser(session.user);
        // This will trigger fetchProfile and eventually set isLoadingAuth(false)
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoadingAuth(false);
      }
    } catch (err) {
      console.error("Auth Initialization Failed:", err.message);
      setIsLoadingAuth(false);
    }
  }, [fetchProfile]);

  useEffect(() => {
    // 1. Define a variable to track if we've already started a fetch
    let isFetching = false;

    const syncAuth = async () => {
      if (isFetching) return;
      isFetching = true;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setIsLoadingAuth(false);
        }
      } catch (err) {
        setIsLoadingAuth(false);
      } finally {
        isFetching = false;
      }
    };

    // 2. Run initial sync
    syncAuth();

    // 3. Listen for changes, but ignore the ones that happen during initial boot
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("⚡ Auth Event:", event);

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsLoadingAuth(false);
        return;
      }

      // Only fetch profile if a user exists and we don't have one yet
      // This prevents the double-fetch on refresh
      if (session?.user && !isFetching) {
        setUser(session.user);
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
           fetchProfile(session.user.id);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile: profile, 
      isLoadingAuth, 
      isLoadingPublicSettings: false, 
      isAuthenticated: !!user, 
      authError,
      logout
    }}>
      {children} 
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);








// /* eslint-disable react-refresh/only-export-components */
// import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// import { supabase } from '@/api/supabaseClient';

// export const AuthContext = createContext({});

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [profile, setProfile] = useState(null);
//   const [isLoadingAuth, setIsLoadingAuth] = useState(true);
//   const [authError, setAuthError] = useState(null);

//   // ✅ LOGOUT FUNCTION: The missing link
//   const logout = useCallback(async () => {
//     try {
//       setIsLoadingAuth(true);
//       await supabase.auth.signOut();
//       // Reset all states manually for immediate UI response
//       setUser(null);
//       setProfile(null);
//       setAuthError(null);
//     } catch (err) {
//       console.error("Logout error:", err.message);
//     } finally {
//       setIsLoadingAuth(false);
//     }
//   }, []);

//   const fetchProfile = useCallback(async (userId) => {
//     try {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', userId) 
//         .maybeSingle();
      
//       if (error) throw error;
      
//       if (!data) {
//         setAuthError({ type: 'user_not_registered' });
//         setProfile(null);
//       } else {
//         setProfile(data);
//         setAuthError(null);
//       }
//     } catch (err) {
//       console.error("Profile fetch error:", err.message);
//       setProfile(null);
//     }
//   }, []);

//   useEffect(() => {
//     const initialize = async () => {
//       try {
//         const { data: { session } } = await supabase.auth.getSession();
//         const currentUser = session?.user ?? null;
//         setUser(currentUser);
        
//         if (currentUser) {
//           await fetchProfile(currentUser.id);
//         }
//       } finally {
//         setIsLoadingAuth(false);
//       }
//     };

//     initialize();

//     const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
//       const currentUser = session?.user ?? null;
      
//       // If signed out, clear everything immediately
//       if (event === 'SIGNED_OUT') {
//         setUser(null);
//         setProfile(null);
//         setAuthError(null);
//         setIsLoadingAuth(false);
//         return;
//       }

//       if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
//         setIsLoadingAuth(true); 
//       }

//       setUser(currentUser);
      
//       if (currentUser) {
//         await fetchProfile(currentUser.id);
//       }
      
//       setIsLoadingAuth(false);
//     });

//     return () => subscription.unsubscribe();
//   }, [fetchProfile]);

//   return (
//     <AuthContext.Provider value={{ 
//       user, 
//       userProfile: profile, 
//       logout, // ✅ Exporting the logout function
//       isLoadingAuth, 
//       isLoadingPublicSettings: false, 
//       isAuthenticated: !!user && (!!profile || authError?.type === 'user_not_registered'), 
//       authError 
//     }}>
//       {children} 
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => useContext(AuthContext);




















// /* eslint-disable react-refresh/only-export-components */
// import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
// import { supabase } from '@/api/supabaseClient';

// export const AuthContext = createContext({});

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [profile, setProfile] = useState(null);
//   const [isLoadingAuth, setIsLoadingAuth] = useState(true);
//   const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
//   const [authError, setAuthError] = useState(null);

//   const fetchProfile = useCallback(async (userId) => {
//     console.log('FETCHING PROFILE FOR:', userId);
//     try {
//       const { data, error } = await supabase
//         .from('profiles')
//         .select('*')
//         .eq('id', userId)
//         .maybeSingle();
//       console.log('PROFILE RESULT:', data, error);
//       if (error) throw error;

//       if (!data) {
//         setAuthError({ type: 'user_not_registered' });
//         setProfile(null);
//         return null;
//       }

//       setProfile(data);
//       setAuthError(null);
//       return data;
//     } catch (err) {
//       console.error('Error fetching profile:', err.message);
//       setProfile(null);
//       setAuthError(null);
//       return null;
//     }
//   }, []);

//   useEffect(() => {
//     let mounted = true;

//     const initializeAuth = async () => {
//       try {
//         setIsLoadingPublicSettings(false);

//         const { data, error } = await supabase.auth.getSession();
//         console.log('INITIAL SESSION:', data.session);
//         if (error) throw error;

//         const currentUser = data.session?.user ?? null;

//         if (!mounted) return;

//         setUser(currentUser);

//         if (currentUser) {
//           await fetchProfile(currentUser.id);
//         } else {
//           setProfile(null);
//           setAuthError(null);
//         }
//       } catch (err) {
//         console.error('Initial auth check failed:', err.message);
//         if (mounted) {
//           setUser(null);
//           setProfile(null);
//           setAuthError(null);
//         }
//       } finally {
//         if (mounted) {
//           setIsLoadingAuth(false);
//         }
//       }
//     };

//     initializeAuth();

//     const {
//       data: { subscription },
//     } = supabase.auth.onAuthStateChange(async (_event, session) => {
//       const currentUser = session?.user ?? null;
//       console.log('AUTH EVENT:', _event, session);

//       if (!mounted) return;

//       setUser(currentUser);

//       if (currentUser) {
//         await fetchProfile(currentUser.id);
//       } else {
//         setProfile(null);
//         setAuthError(null);
//       }

//       setIsLoadingAuth(false);
//     });

//     return () => {
//       mounted = false;
//       subscription.unsubscribe();
//     };
//   }, [fetchProfile]);

//   const logout = async () => {
//     if (user?.id) {
//       await supabase
//         .from('profiles')
//         .update({ logged_in: false })
//         .eq('id', user.id);
//     }

//     await supabase.auth.signOut();
//     setUser(null);
//     setProfile(null);
//     setAuthError(null);
//     window.location.href = '/login';
//   };

//   const navigateToLogin = () => {
//     window.location.href = '/login';
//   };

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         userProfile: profile,
//         isLoadingAuth,
//         isLoadingPublicSettings,
//         isAuthenticated: !!user,
//         authError,
//         logout,
//         navigateToLogin,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// };

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) throw new Error('useAuth must be used within an AuthProvider');
//   return context;
// };