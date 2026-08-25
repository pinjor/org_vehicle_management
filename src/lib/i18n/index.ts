import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth";
import {
  catalogs,
  DRIVER_LOCALE_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  type Locale,
  type MessageKey,
} from "@/lib/i18n/messages";

type Vars = Record<string, string | number>;

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
  /** Pure driver (no dispatch/admin) — Bengali is default. */
  isDriverPortal: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

function readDriverStoredLocale(): Locale | null {
  try {
    const v =
      localStorage.getItem(DRIVER_LOCALE_STORAGE_KEY) ?? localStorage.getItem(LOCALE_STORAGE_KEY);
    if (v === "en" || v === "bn") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { isDriver, isDispatcher, isAdmin, loading, session } = useAuth();
  const isDriverPortal = Boolean(session && isDriver && !isDispatcher && !isAdmin);

  const [driverLocale, setDriverLocaleState] = useState<Locale>("bn");
  const [hydrated, setHydrated] = useState(false);

  // Drivers: stored preference or default bn. Everyone else: always English.
  useEffect(() => {
    if (loading) return;
    if (isDriverPortal) {
      setDriverLocaleState(readDriverStoredLocale() ?? "bn");
    }
    setHydrated(true);
  }, [loading, isDriverPortal, session?.user?.id]);

  // Effective UI locale — never Bengali outside driver portal
  const locale: Locale = isDriverPortal ? driverLocale : "en";

  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.lang = locale === "bn" ? "bn" : "en";
  }, [locale, hydrated]);

  const setLocale = useCallback(
    (next: Locale) => {
      // Language switch only for pure drivers
      if (!isDriverPortal) return;
      setDriverLocaleState(next);
      try {
        localStorage.setItem(DRIVER_LOCALE_STORAGE_KEY, next);
        localStorage.removeItem(LOCALE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    [isDriverPortal],
  );

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => {
      const catalog = catalogs[locale] ?? catalogs.en;
      const raw = catalog[key] ?? catalogs.en[key] ?? key;
      return interpolate(raw, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, isDriverPortal }),
    [locale, setLocale, t, isDriverPortal],
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside LanguageProvider");
  return ctx;
}

/** Safe translate when outside provider (falls back to English). */
export function translate(locale: Locale, key: MessageKey, vars?: Vars) {
  const raw = catalogs[locale]?.[key] ?? catalogs.en[key] ?? key;
  return interpolate(raw, vars);
}

export type { Locale, MessageKey } from "@/lib/i18n/messages";
