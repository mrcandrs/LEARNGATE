import { en } from "./en";
import { fil } from "./fil";
import type { AppLocale, TranslateParams, TranslationKey } from "./types";

const catalogs: Record<AppLocale, typeof en> = {
  en,
  fil,
};

function getNestedValue(source: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

export function translate(locale: AppLocale, key: TranslationKey, params?: TranslateParams): string {
  const localized = getNestedValue(catalogs[locale] as unknown as Record<string, unknown>, key);
  const fallback = getNestedValue(catalogs.en as unknown as Record<string, unknown>, key);
  const template = localized ?? fallback ?? key;
  return interpolate(template, params);
}

export { en, fil };
