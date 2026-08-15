import AsyncStorage from "@react-native-async-storage/async-storage";
import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { translate } from "@/i18n";
import { setRuntimeLocale } from "@/i18n/runtimeLocale";
import type { AppLocale, TranslateParams, TranslationKey } from "@/i18n/types";
import { APP_LOCALES } from "@/i18n/types";

const LOCALE_STORAGE_KEY = "learngate.locale.v1";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  ready: boolean;
};

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<AppLocale>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
        if (!active) return;
        if (raw && APP_LOCALES.includes(raw as AppLocale)) {
          setRuntimeLocale(raw as AppLocale);
          setLocaleState(raw as AppLocale);
        }
      } catch {
        // ignore
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback((next: AppLocale) => {
    setRuntimeLocale(next);
    setLocaleState(next);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      ready,
    }),
    [locale, setLocale, t, ready],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider.");
  }
  return ctx;
}
