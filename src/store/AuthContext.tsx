import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppMode, UserRole } from "@/types/app";
import { supabase } from "@/services/supabase";
import { isSupabaseConfigured } from "@/config/env";

type AuthContextValue = {
  appMode: AppMode;
  isBootstrapping: boolean;
  isSupabaseConfigured: boolean;
  selectRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [appMode, setAppMode] = useState<AppMode>("auth");
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!supabase) {
        setIsBootstrapping(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      setAppMode(data.session ? "parent" : "auth");
      setIsBootstrapping(false);
    }

    bootstrap();

    const { data: authListener } = supabase?.auth.onAuthStateChange((_event, session) => {
      setAppMode(session ? "parent" : "auth");
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      appMode,
      isBootstrapping,
      isSupabaseConfigured,
      selectRole: (role: UserRole) => setAppMode(role),
      signOut: async () => {
        if (supabase) {
          await supabase.auth.signOut();
        }
        setAppMode("auth");
      },
    }),
    [appMode, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
