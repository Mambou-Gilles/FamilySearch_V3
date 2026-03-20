import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'supabase-app' });

  useEffect(() => {
    checkAppState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        checkUserAuth(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        await checkUserAuth(session.user);
      } else {
        setIsLoadingAuth(false);
        setIsAuthenticated(false);
      }
      
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.error('App state check failed:', error);
      setAuthError({ type: 'unknown', message: error.message });
      setIsLoadingPublicSettings(false);
    }
  };

  const checkUserAuth = async (authUser) => {
    try {
      setIsLoadingAuth(true);
      
      // CRITICAL CHANGE: Use 'id' instead of 'email'
      // This matches the profiles.id to auth.users.id alignment we set up in Batch 5
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id) // Use the UID for maximum security and RLS speed
        .single();

      if (error || !profile) {
        // If ID check fails, we can fallback to email once during migration, 
        // but generally, an error here means they aren't in our system yet.
        console.error('Profile fetch error:', error);
        setAuthError({ 
          type: 'user_not_registered', 
          message: 'User profile not found in the system.' 
        });
        setUser(null);
        setIsAuthenticated(false);
      } else {
        // Build the combined user object
        setUser({
          ...authUser,
          ...profile,
          role: profile.system_role
        });

        // 1. Check if we are in the middle of a password reset
        // 2. Check if the user is 'active'
        const isResetting = window.location.pathname === '/reset-password';
        
        if (profile.status === 'active') {
          // If they are on the reset page, we don't mark 'isAuthenticated' as true yet
          // to prevent the main App.jsx router from redirecting them to /dashboard
          // before they finish setting their password.
          if (!isResetting) {
            setIsAuthenticated(true);
          }
        } else {
          setAuthError({ type: 'inactive', message: 'Your account is currently inactive.' });
        }
          
        setAuthError(null);
      }
      
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
    }
  };


  // const checkUserAuth = async (authUser) => {
  //   try {
  //     setIsLoadingAuth(true);
      
  //     const { data: profile, error } = await supabase
  //       .from('profiles')
  //       .select('*')
  //       .eq('email', authUser.email)
  //       .single();

  //     if (error || !profile) {
  //       setAuthError({ 
  //         type: 'user_not_registered', 
  //         message: 'User not registered in the system.' 
  //       });
  //       setUser(null);
  //       setIsAuthenticated(false);
  //     } else {
  //       // --- ADD THIS CHECK ---
  //       // If the user hasn't set a password yet (first time invite), 
  //       // they are "Auth-ed" but maybe not fully "Authenticated" for the Dashboard.
  //       // For now, we allow them through, but we ensure the profile ID matches.
        
  //       setUser({
  //         ...authUser,
  //         ...profile,
  //         role: profile.system_role
  //       });

  //       // Only mark as fully authenticated if we aren't mid-password-reset
  //       // This prevents the App.jsx from redirecting them away from the reset page.
  //       if (window.location.pathname !== '/reset-password') {
  //         setIsAuthenticated(true);
  //       }
        
  //       // Background update for login status
  //       supabase
  //         .from('profiles')
  //         .update({ logged_in: true, last_login: new Date().toISOString() })
  //         .eq('id', profile.id)
  //         .then(({ error: uErr }) => uErr && console.error(uErr));
          
  //       setAuthError(null);
  //     }
      
  //     setIsLoadingAuth(false);
  //   } catch (error) {
  //     console.error('User auth check failed:', error);
  //     setIsLoadingAuth(false);
  //     setIsAuthenticated(false);
  //   }
  // };


  const logout = async () => {
    // Optional: Set logged_in to false in the database before signing out
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ logged_in: false })
        .eq('id', user.id);
    }

    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};