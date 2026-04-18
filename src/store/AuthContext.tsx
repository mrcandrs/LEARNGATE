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

    async function resolveModeFromProfile(userId: string): Promise<AppMode> {
      if (!supabase) {
        return "auth";
      }

      const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
      if (error || !data?.role) {
        return "auth";
      }

      return data.role === "child" ? "child" : "parent";
    }

    async function bootstrap() {
      if (!supabase) {
        setIsBootstrapping(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }

      if (!data.session) {
        setAppMode("auth");
        setIsBootstrapping(false);
        return;
      }

      const nextMode = await resolveModeFromProfile(data.session.user.id);
      if (!mounted) {
        return;
      }
      setAppMode(nextMode);
      setIsBootstrapping(false);
    }

    void bootstrap();

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          setAppMode("auth");
          return;
        }

        void resolveModeFromProfile(session.user.id).then((nextMode) => {
          setAppMode(nextMode);
        });
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
