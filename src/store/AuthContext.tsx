import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { AppMode, UserRole } from "@/types/app";
import { supabase } from "@/services/supabase";
import { setChildOnlineStatus } from "@/services/childPresence";
import { registerAndSavePushToken } from "@/services/pushNotifications";
import { isSupabaseConfigured } from "@/config/env";
import { completeSessionFromUrl, isParentEmailUnconfirmed, isParentSignupPending } from "@/services/parentEmailAuth";

type AuthContextValue = {
  appMode: AppMode;
  isBootstrapping: boolean;
  isSupabaseConfigured: boolean;
  pendingParentSignup: boolean;
  selectRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
  /** Keeps the auth stack visible while signup finishes and the session is cleared. */
  holdOnAuth: () => void;
  releaseAuthHold: () => void;
  finishParentSignup: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [appMode, setAppMode] = useState<AppMode>("auth");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [pendingParentSignup, setPendingParentSignup] = useState(false);
  const stayOnAuthRef = useRef(false);

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
        setPendingParentSignup(false);
        setAppMode("auth");
        setIsBootstrapping(false);
        return;
      }

      if (isParentSignupPending(data.session.user)) {
        setPendingParentSignup(true);
        setAppMode("auth");
        setIsBootstrapping(false);
        return;
      }

      if (isParentEmailUnconfirmed(data.session.user)) {
        await supabase.auth.signOut();
        if (!mounted) {
          return;
        }
        setPendingParentSignup(false);
        setAppMode("auth");
        setIsBootstrapping(false);
        return;
      }

      const nextMode = await resolveModeFromProfile(data.session.user.id);
      if (!mounted) {
        return;
      }
      if (nextMode === "child") {
        void setChildOnlineStatus(true);
      }
      setAppMode(nextMode);
      if (nextMode !== "auth") {
        void registerAndSavePushToken().then((result) => {
          if (!result.ok && __DEV__) {
            console.warn("[push] auto-register on login:", result.message);
          }
        });
      }
      setIsBootstrapping(false);
    }

    void bootstrap();

    const applySession = (session: Session | null) => {
      if (stayOnAuthRef.current) {
        if (!session) {
          stayOnAuthRef.current = false;
          setPendingParentSignup(false);
          setAppMode("auth");
        }
        return;
      }
      if (!session) {
        setPendingParentSignup(false);
        setAppMode("auth");
        return;
      }
      if (isParentSignupPending(session.user)) {
        setPendingParentSignup(true);
        setAppMode("auth");
        return;
      }
      if (isParentEmailUnconfirmed(session.user)) {
        void supabase?.auth.signOut();
        setPendingParentSignup(false);
        setAppMode("auth");
        return;
      }

      setPendingParentSignup(false);
      void resolveModeFromProfile(session.user.id).then((nextMode) => {
        if (nextMode === "child") {
          void setChildOnlineStatus(true);
        }
        setAppMode(nextMode);
        if (nextMode !== "auth") {
          void registerAndSavePushToken().then((result) => {
            if (!result.ok && __DEV__) {
              console.warn("[push] auto-register on auth change:", result.message);
            }
          });
        }
      });
    };

    const { data: authListener } =
      supabase?.auth.onAuthStateChange((_event, session) => {
        applySession(session);
      }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

    const handleAuthUrl = (url: string | null) => {
      if (!url || !supabase) {
        return;
      }
      void completeSessionFromUrl(supabase, url);
    };

    void Linking.getInitialURL().then(handleAuthUrl);
    const linkingSub = Linking.addEventListener("url", ({ url }) => handleAuthUrl(url));

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      appMode,
      isBootstrapping,
      isSupabaseConfigured,
      pendingParentSignup,
      selectRole: (role: UserRole) => setAppMode(role),
      signOut: async () => {
        stayOnAuthRef.current = true;
        if (supabase) {
          await setChildOnlineStatus(false);
          await supabase.auth.signOut();
        }
        stayOnAuthRef.current = false;
        setPendingParentSignup(false);
        setAppMode("auth");
      },
      holdOnAuth: () => {
        stayOnAuthRef.current = true;
      },
      releaseAuthHold: () => {
        stayOnAuthRef.current = false;
      },
      finishParentSignup: async () => {
        if (!supabase) {
          return;
        }
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session || isParentSignupPending(session.user)) {
          return;
        }
        setPendingParentSignup(false);
        const nextMode = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile, error }) => {
            if (error || !profile?.role) {
              return "parent" as AppMode;
            }
            return profile.role === "child" ? "child" : "parent";
          });
        setAppMode(nextMode);
        if (nextMode !== "auth") {
          void registerAndSavePushToken();
        }
      },
    }),
    [appMode, isBootstrapping, pendingParentSignup]
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
