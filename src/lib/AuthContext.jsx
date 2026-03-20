/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
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
        return null;
      } else {
        setProfile(data);
        setAuthError(null);
        return data;
      }
    } catch (err) {
      console.error("Error fetching profile:", err.message);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    // 1. Initial State Check
    setIsLoadingPublicSettings(false); // Set to false once app settings are "ready"

    // 2. Auth State Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setAuthError(null);
      }

      setIsLoadingAuth(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile: profile, 
      isLoadingAuth, 
      isLoadingPublicSettings,
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