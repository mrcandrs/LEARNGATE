import { PropsWithChildren, createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type AppToastVariant = "success" | "error";

type AppToastState = {
  message: string;
  variant: AppToastVariant;
};

type AppToastContextValue = {
  toast: AppToastState | null;
  showToast: (message: string, variant?: AppToastVariant) => void;
  hideToast: () => void;
};

const AppToastContext = createContext<AppToastContextValue | undefined>(undefined);

export function AppToastProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<AppToastState | null>(null);
  const tokenRef = useRef(0);

  const hideToast = useCallback(() => {
    tokenRef.current += 1;
    setToast(null);
  }, []);

  const showToast = useCallback((message: string, variant: AppToastVariant = "success") => {
    tokenRef.current += 1;
    setToast({ message, variant });
  }, []);

  const value = useMemo(
    () => ({
      toast,
      showToast,
      hideToast,
    }),
    [toast, showToast, hideToast],
  );

  return <AppToastContext.Provider value={value}>{children}</AppToastContext.Provider>;
}

export function useAppToast() {
  const ctx = useContext(AppToastContext);
  if (!ctx) {
    throw new Error("useAppToast must be used within AppToastProvider.");
  }
  return ctx;
}
