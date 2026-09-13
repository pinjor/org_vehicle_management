import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/app-icon";
import { cn } from "@/lib/utils";

type StatusScreenProps = {
  code?: string;
  title: string;
  description: string;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
};

/** Full-viewport recovery screen for route errors and 404s. */
export function StatusScreen({
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: StatusScreenProps) {
  return (
    <div className={cn("status-screen", className)}>
      <div className="status-screen__glow status-screen__glow--a" aria-hidden />
      <div className="status-screen__glow status-screen__glow--b" aria-hidden />

      <div className="status-screen__route" aria-hidden>
        <svg viewBox="0 0 320 120" fill="none" className="status-screen__route-svg">
          <path
            d="M12 88 C 70 88, 90 32, 150 32 S 230 88, 308 48"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="6 8"
            className="status-screen__path"
          />
          <circle cx="12" cy="88" r="5" className="status-screen__dot status-screen__dot--start" />
          <circle cx="308" cy="48" r="6" className="status-screen__dot status-screen__dot--end" />
        </svg>
      </div>

      <div className="status-screen__card">
        <div className="status-screen__brand">
          <AppIcon className="size-9" />
          <span>Vehicle Management System</span>
        </div>

        {code ? <p className="status-screen__code">{code}</p> : null}

        <h1 className="status-screen__title">{title}</h1>
        <p className="status-screen__desc">{description}</p>

        <div className="status-screen__actions">
          {primaryAction}
          {secondaryAction}
        </div>
      </div>
    </div>
  );
}

export function StatusPrimaryButton({
  children,
  onClick,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  if (href) {
    return (
      <a href={href} className="status-screen__btn status-screen__btn--primary">
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className="status-screen__btn status-screen__btn--primary">
      {children}
    </button>
  );
}

export function StatusSecondaryLink({ to = "/", children }: { to?: "/"; children: ReactNode }) {
  return (
    <Link to={to} className="status-screen__btn status-screen__btn--ghost">
      {children}
    </Link>
  );
}

export function StatusSecondaryAnchor({ href = "/", children }: { href?: string; children: ReactNode }) {
  return (
    <a href={href} className="status-screen__btn status-screen__btn--ghost">
      {children}
    </a>
  );
}
