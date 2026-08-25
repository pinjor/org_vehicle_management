import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/messages";

/** Compact EN | বাংলা switch for driver portal. */
export function LanguageToggle({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  function pick(next: Locale) {
    setLocale(next);
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-semibold",
        className,
      )}
      role="group"
      aria-label={t("shell.language")}
    >
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1.5 transition-colors",
          locale === "bn" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => pick("bn")}
      >
        {t("shell.langBn")}
      </button>
      <button
        type="button"
        className={cn(
          "rounded-md px-2.5 py-1.5 transition-colors",
          locale === "en" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
        )}
        onClick={() => pick("en")}
      >
        {t("shell.langEn")}
      </button>
    </div>
  );
}
