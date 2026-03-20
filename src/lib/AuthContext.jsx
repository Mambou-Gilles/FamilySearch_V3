/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/api/supabaseClient';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const isInitialMount = useRef(true);

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
      return data;
    } catch (err) {
      console.error("Profile Fetch Error:", err.message);
      return null;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 1. BOOTSTRAP: Get session immediately on load
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        
        if (currentUser) {
          setUser(currentUser);
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error("Initialization Error:", err);
      } finally {
        // 2. ONLY stop loading after we checked the session AND profile
        setLoading(false);
        isInitialMount.current = false;
      }
    };

    initializeAuth();

    // 3. LISTEN: Handle login/logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip the initial 'INITIAL_SESSION' event if we already bootstrapped
      if (event === 'INITIAL_SESSION' && !isInitialMount.current) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setAuthError(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile: profile, 
      isLoadingAuth: loading, 
      isLoadingPublicSettings: false, // Matches your App.jsx expectations
      isAuthenticated: !!user && !!profile, 
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