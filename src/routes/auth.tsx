import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { AuthBackground } from "@/components/auth-background";
import { AuthIllustration } from "@/components/auth-illustration";
import { StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROSTER_ROLE } from "@/lib/fleet";
import type { RosterLookup } from "@/lib/queries";
import { isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type AuthView = "signin" | "set-password";

const DEMO_USERS = [
  {
    id: "admin",
    role: "Admin",
    name: "Transport Admin",
    detail: "Dispatch, fleet, approvals",
    phone: "1711000001",
    password: "admin123",
  },
  {
    id: "employee",
    role: "Employee",
    name: "Nusrat Jahan",
    detail: "Request & track rides",
    phone: "1712000003",
    password: "emp123",
  },
  {
    id: "driver",
    role: "Driver",
    name: "Karim Hassan",
    detail: "Assigned trips & navigation",
    phone: "1712000002",
    password: "driver123",
  },
] as const;

type DemoUser = (typeof DEMO_USERS)[number];

function AuthPage() {
  const [view, setView] = useState<AuthView>("signin");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rosterInfo, setRosterInfo] = useState<RosterLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusyId, setDemoBusyId] = useState<string | null>(null);
  const [notEnlistedOpen, setNotEnlistedOpen] = useState(false);
  const { session, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard" });
  }, [session, navigate]);

  useEffect(() => {
    document.title = view === "signin" ? "Sign in — FleetOps" : "Set password — FleetOps";
  }, [view]);

  function goSignIn(clearPhone = false) {
    setView("signin");
    setRosterInfo(null);
    setPassword("");
    setShowPassword(false);
    if (clearPhone) setPhoneLocal("");
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBdPhone(phoneLocal)) {
      toast.error("Enter a valid Bangladesh mobile number (01XXXXXXXXX)");
      return;
    }
    setBusy(true);
    try {
      const result = await apiGet<RosterLookup>(
        `/api/roster/lookup?phone=${encodeURIComponent(phoneLocal)}`,
      );

      if (!result.allowed) {
        if (result.reason === "already_registered") {
          // Returning user — password required to sign in
          if (password.length < 6) {
            toast.error("Enter your password to sign in");
            return;
          }
          await apiPost("/api/auth/login", { phone: phoneLocal, password });
          await refresh();
          return;
        }
        if (result.reason === "invalid_phone") {
          toast.error("Invalid Bangladesh mobile number");
          return;
        }
        setNotEnlistedOpen(true);
        return;
      }

      // New on roster (no account yet) — go set password even if password field blank
      setRosterInfo(result);
      setPassword("");
      setShowPassword(false);
      setView("set-password");
      toast.message("Phone found on roster", {
        description: "Set a password to finish creating your account.",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBdPhone(phoneLocal) || !rosterInfo?.allowed) return;
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/auth/signup", { phone: phoneLocal, password });
      await refresh();
      toast.success("Account created. Welcome!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  async function demoSignIn(user: DemoUser) {
    if (busy || demoBusyId) return;
    setView("signin");
    setRosterInfo(null);
    setPhoneLocal(user.phone);
    setPassword(user.password);
    setShowPassword(false);
    setDemoBusyId(user.id);
    setBusy(true);
    try {
      await apiPost("/api/auth/login", { phone: user.phone, password: user.password });
      await refresh();
      toast.success(`Signed in as ${user.role}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Demo sign-in failed");
    } finally {
      setBusy(false);
      setDemoBusyId(null);
    }
  }

  const visualCaption =
    view === "signin"
      ? "Plan trips & manage your fleet in one place."
      : "Set a password to finish signup.";

  return (
    <div className="auth-shell auth-page" data-auth-mode={view === "signin" ? "signin" : "signup"}>
      <AuthBackground />
      <div className="auth-page-inner">
        <div key={view} className="auth-form-enter auth-split-frame">
          <aside className="auth-split-visual">
            <div className="auth-illus-stage">
              <AuthIllustration
                variant={view === "signin" ? "signin" : "signup"}
                className="auth-stage-illus"
              />
            </div>
            <p className="auth-visual-caption">{visualCaption}</p>
          </aside>

          <section className="auth-split-form">
            {view === "signin" ? (
              <form onSubmit={signIn} className="auth-form-stack">
                <FormHeader
                  size="md"
                  title="Sign in"
                  description="Use your roster mobile number. First time? Leave password blank and continue — we'll take you to set one."
                />
                <AuthField label="Mobile number">
                  <PhoneInput value={phoneLocal} onChange={setPhoneLocal} />
                </AuthField>
                <AuthField label="Password" hint="Leave blank if you haven't created an account yet">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    required={false}
                    autoComplete="current-password"
                  />
                </AuthField>
                <Button
                  type="submit"
                  className="auth-submit-btn auth-btn w-full"
                  disabled={busy || !isValidBdPhone(phoneLocal)}
                  tooltip="Sign in, or continue to set password if your phone is on the roster"
                >
                  {busy && !demoBusyId ? "Please wait…" : "Continue"}
                </Button>

                <div className="auth-demo">
                  <p className="auth-demo__label">Demo quick sign-in</p>
                  <ul className="auth-demo__list">
                    {DEMO_USERS.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          className={cn(
                            "auth-demo__btn",
                            `auth-demo__btn--${user.id}`,
                            demoBusyId === user.id && "auth-demo__btn--busy",
                          )}
                          disabled={busy}
                          onClick={() => void demoSignIn(user)}
                        >
                          <span className="auth-demo__role">{user.role}</span>
                          <span className="auth-demo__name">{user.name}</span>
                          <span className="auth-demo__detail">{user.detail}</span>
                          <span className="auth-demo__creds">
                            0{user.phone} · {user.password}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-center text-sm text-[color:var(--auth-muted)]">
                  Must be on the admin roster before you can access FleetOps.
                </p>
              </form>
            ) : (
              <form onSubmit={createAccount} className="auth-form-stack">
                <FormHeader
                  size="md"
                  title="Set password"
                  description="Your phone is on the admin roster. Choose a password with at least 6 characters."
                />
                <RosterPreview
                  name={rosterInfo?.full_name ?? "User"}
                  phone={phoneLocal}
                  role={rosterInfo?.role}
                  onEditPhone={() => goSignIn(false)}
                />
                <AuthField label="Password">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                    autoComplete="new-password"
                  />
                </AuthField>
                <Button
                  type="submit"
                  className="auth-submit-btn auth-btn w-full"
                  disabled={busy || password.length < 6}
                  tooltip="Create your account — you'll sign in automatically"
                >
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <button
                  type="button"
                  className="w-full text-sm text-[color:var(--auth-muted)] hover:text-[color:var(--auth-fg)]"
                  onClick={() => goSignIn(true)}
                >
                  Use a different number
                </button>
              </form>
            )}
          </section>
        </div>
      </div>

      <Dialog open={notEnlistedOpen} onOpenChange={setNotEnlistedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Phone not on roster</DialogTitle>
            <DialogDescription>
              This number is not enlisted by admin or HR. You cannot create an account until your phone
              is added to the roster.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Contact your transport admin or HR office and ask them to add{" "}
            <span className="font-medium text-foreground">
              {normalizeBdPhone(phoneLocal) ? `+880 ${phoneLocal}` : phoneLocal}
            </span>{" "}
            to FleetOps. After that, come back here and continue.
          </p>
          <DialogFooter>
            <Button type="button" onClick={() => setNotEnlistedOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormHeader({ title, description, size = "md" }: { title: string; description: string; size?: "md" | "lg" }) {
  return (
    <div className="auth-form-header">
      <h1
        className={cn(
          "auth-form-title font-semibold tracking-tight text-[color:var(--auth-fg)]",
          size === "lg" ? "text-3xl sm:text-[2.125rem] sm:leading-tight" : "text-2xl lg:text-[1.875rem] lg:leading-tight",
        )}
      >
        {title}
      </h1>
      <p className="auth-form-desc mt-1.5 text-sm leading-relaxed text-[color:var(--auth-muted)] sm:mt-2.5 sm:text-base">
        {description}
      </p>
    </div>
  );
}

function AuthField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="auth-field block space-y-1 sm:space-y-1.5">
      <span className="auth-field-label text-sm font-medium text-[color:var(--auth-fg)] sm:text-base">{label}</span>
      {children}
      {hint && <span className="auth-field-hint block text-[11px] text-[color:var(--auth-muted)]">{hint}</span>}
    </label>
  );
}

function RosterPreview({
  name,
  phone,
  role,
  onEditPhone,
}: {
  name: string;
  phone: string;
  role?: RosterLookup["role"];
  onEditPhone?: () => void;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="auth-roster-card flex items-center gap-4 rounded-xl p-4">
      <span className="auth-roster-avatar flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        {onEditPhone ? (
          <button
            type="button"
            className="auth-roster-phone-btn text-sm text-[color:var(--auth-muted)] hover:text-[color:var(--auth-accent)] hover:underline"
            onClick={onEditPhone}
          >
            {normalizeBdPhone(phone) ? `+880 ${phone}` : phone}
            <span className="ml-1.5 text-xs font-medium text-[color:var(--auth-accent)]">Change</span>
          </button>
        ) : (
          <p className="text-sm text-[color:var(--auth-muted)]">
            {normalizeBdPhone(phone) ? `+880 ${phone}` : phone}
          </p>
        )}
        {role && (
          <div className="mt-1.5">
            <StatusChip label={ROSTER_ROLE[role].label} tone={ROSTER_ROLE[role].tone} />
          </div>
        )}
      </div>
    </div>
  );
}

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <div className="auth-phone-field">
        <span className="auth-phone-prefix" aria-hidden="true">
          <Phone className="size-4 shrink-0" />
          <span>+880</span>
        </span>
        <input
          type="tel"
          className="auth-phone-input"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="1711234567"
          value={value}
          onChange={(e) => onChange(maskBdPhoneInput(e.target.value))}
          maxLength={10}
          required
        />
      </div>
      {value && !isValidBdPhone(value) && (
        <p className="text-xs text-destructive">Use a valid BD mobile (013–019)</p>
      )}
    </>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  onToggle,
  required = true,
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="auth-password-field">
      <Lock className="auth-field-leading-icon" />
      <input
        type={show ? "text" : "password"}
        className="auth-field-input auth-field-input--leading auth-field-input--trailing"
        autoComplete={show ? "off" : autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={required ? 6 : undefined}
        required={required}
      />
      <button
        type="button"
        className="auth-field-trailing-btn"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
