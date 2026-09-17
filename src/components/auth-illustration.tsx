import enterPasswordSvg from "../../svgs/undraw_enter-password_1kl4.svg?raw";
import fleetLoginSvg from "../../svgs/7533750_3676661.svg?raw";
import { cn } from "@/lib/utils";

export type AuthIllustrationVariant = "signin" | "signup";

/** Strip fixed px size so CSS can scale SVG inside the stage without crop/overlap. */
function normalizeAuthSvg(raw: string): string {
  return raw.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    let next = attrs
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "")
      .replace(/\spreserveAspectRatio="[^"]*"/i, "");
    return `<svg${next} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
  });
}

const SVG_BY_VARIANT: Record<AuthIllustrationVariant, string> = {
  signin: normalizeAuthSvg(fleetLoginSvg),
  signup: normalizeAuthSvg(enterPasswordSvg),
};

type AuthIllustrationProps = {
  variant: AuthIllustrationVariant;
  className?: string | undefined;
};

export function AuthIllustration({ variant, className }: AuthIllustrationProps) {
  const wrapperClass =
    variant === "signin" ? "auth-fleet-illus auth-illus-fade" : "auth-password-illus auth-illus-fade";

  return (
    <div
      key={variant}
      className={cn(
        wrapperClass,
        "relative flex h-full w-full max-h-full items-center justify-center overflow-hidden",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: SVG_BY_VARIANT[variant] }}
    />
  );
}
