export type AppLocale = "en" | "fil";

export const APP_LOCALES: AppLocale[] = ["en", "fil"];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fil: "Filipino",
};

type Join<K, P> = K extends string | number ? (P extends string | number ? `${K}.${P}` : never) : never;

type DotNestedKeys<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends Record<string, unknown> ? Join<K, DotNestedKeys<T[K]>> : never;
}[keyof T & string];

export type TranslationKey = DotNestedKeys<typeof import("./en").en>;

export type TranslateParams = Record<string, string | number>;
