import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; data: { user: User | null; session: Session | null } | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const validatingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // Apenas valida na inicialização, não em cada mudança de estado
    const validateOnce = async (currentSession: Session | null) => {
      if (!currentSession?.access_token) return;
      if (validatingRef.current) return;

      validatingRef.current = true;
      try {
        const { error } = await supabase.auth.getUser();
        if (error && isMounted) {
          console.warn('Sessão inválida, fazendo logout:', error.message);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
        }
      } catch (err) {
        console.warn('Erro ao validar sessão:', err);
      } finally {
        validatingRef.current = false;
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;
      
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);

      // Só valida em eventos específicos, não em TOKEN_REFRESHED
      if (event === 'SIGNED_IN' && newSession) {
        setTimeout(() => validateOnce(newSession), 100);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!isMounted) return;
      
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);

      // Validação única na inicialização
      if (initialSession) {
        setTimeout(() => validateOnce(initialSession), 100);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error, data };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
