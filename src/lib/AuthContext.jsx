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
      }

      setProfile(data);
      setAuthError(null);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err.message);
      setProfile(null);
      setAuthError(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        setIsLoadingPublicSettings(false);

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const currentUser = data.session?.user ?? null;

        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
          setAuthError(null);
        }
      } catch (err) {
        console.error('Initial auth check failed:', err.message);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setAuthError(null);
        }
      } finally {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;

      if (!mounted) return;

      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setAuthError(null);
      }

      setIsLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const logout = async () => {
    if (user?.id) {
      await supabase
        .from('profiles')
        .update({ logged_in: false })
        .eq('id', user.id);
    }

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAuthError(null);
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile: profile,
        isLoadingAuth,
        isLoadingPublicSettings,
        isAuthenticated: !!user,
        authError,
        logout,
        navigateToLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};