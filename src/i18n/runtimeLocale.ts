import { translate } from "@/i18n";
import type { AppLocale, TranslateParams, TranslationKey } from "@/i18n/types";

let currentLocale: AppLocale = "en";

export function setRuntimeLocale(locale: AppLocale) {
  currentLocale = locale;
}

export function tRuntime(key: TranslationKey, params?: TranslateParams) {
  return translate(currentLocale, key, params);
}
