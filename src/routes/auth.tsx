import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Lock, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { AuthBackground } from "@/components/auth-background";
import { AuthIllustration } from "@/components/auth-illustration";
import { StatusChip } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { ROSTER_ROLE } from "@/lib/fleet";
import type { RosterLookup } from "@/lib/queries";
import { isValidBdPhone, maskBdPhoneInput, normalizeBdPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

const authSearchSchema = z.object({
  signup: z.boolean().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) =>
    authSearchSchema.parse({
      signup: search.signup === true || search.signup === "true" || search.signup === "1",
    }),
  component: AuthPage,
});

type SignupStep = "phone" | "details";
type AuthMode = "signin" | "signup";

function AuthPage() {
  const { signup } = Route.useSearch();
  const mode: AuthMode = signup ? "signup" : "signin";
  const [signupStep, setSignupStep] = useState<SignupStep>("phone");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rosterInfo, setRosterInfo] = useState<RosterLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const { session, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard" });
  }, [session, navigate]);

  useEffect(() => {
    document.title = mode === "signin" ? "Sign in — FleetOps" : "Create account — FleetOps";
  }, [mode]);

  useEffect(() => {
    if (mode === "signin") {
      setSignupStep("phone");
      setRosterInfo(null);
      setPassword("");
      setShowPassword(false);
    }
  }, [mode]);

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBdPhone(phoneLocal)) {
      toast.error("Enter a valid Bangladesh mobile number (01XXXXXXXXX)");
      return;
    }
    setBusy(true);
    try {
      const result = await apiGet<RosterLookup>(`/api/roster/lookup?phone=${encodeURIComponent(phoneLocal)}`);
      if (!result.allowed) {
        if (result.reason === "already_registered") {
          toast.error("This phone already has an account. Please sign in.");
          void navigate({ to: "/auth", search: {} });
          return;
        }
        if (result.reason === "invalid_phone") {
          toast.error("Invalid Bangladesh mobile number");
          return;
        }
        toast.error("This phone is not on the admin roster. Contact HR or admin to be added.");
        return;
      }
      setRosterInfo(result);
      setSignupStep("details");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify phone");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBdPhone(phoneLocal) || !rosterInfo?.allowed) return;
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

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidBdPhone(phoneLocal)) {
      toast.error("Enter a valid Bangladesh mobile number");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/auth/login", { phone: phoneLocal, password });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  const formKey = mode === "signin" ? "signin" : signupStep;

  const visualCaption =
    mode === "signin"
      ? "Plan trips & manage your fleet in one place."
      : signupStep === "phone"
        ? "Register with a roster phone number."
        : "Set a password to finish signup.";

  return (
    <div className="auth-shell auth-page" data-auth-mode={mode}>
      <AuthBackground />
      <div className="auth-page-inner">
        <div key={formKey} className="auth-form-enter auth-split-frame">
          <aside className="auth-split-visual">
            <div className="auth-illus-stage">
              <AuthIllustration variant={mode === "signin" ? "signin" : "signup"} className="auth-stage-illus" />
            </div>
            <p className="auth-visual-caption">{visualCaption}</p>
          </aside>

          <section className="auth-split-form">
            {mode === "signin" ? (
              <form onSubmit={signIn} className="auth-form-stack">
                <FormHeader size="md" title="Sign in" description="Use your mobile number and password to access FleetOps." />
                <AuthField label="Mobile number">
                  <PhoneInput value={phoneLocal} onChange={setPhoneLocal} />
                </AuthField>
                <AuthField label="Password">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    onToggle={() => setShowPassword((v) => !v)}
                  />
                </AuthField>
                <Button type="submit" className="auth-submit-btn auth-btn w-full" disabled={busy || !isValidBdPhone(phoneLocal)} tooltip="Sign in with your roster phone and password">
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
              </form>
            ) : (
              <>
                <SignupSteps
                  step={signupStep === "phone" ? 1 : 2}
                  className="auth-steps--signup"
                  onGoToPhone={
                    signupStep === "details"
                      ? () => {
                          setSignupStep("phone");
                          setRosterInfo(null);
                          setPassword("");
                          setShowPassword(false);
                        }
                      : undefined
                  }
                />
                {signupStep === "phone" ? (
                  <form onSubmit={verifyPhone} className="auth-form-stack">
                    <FormHeader
                      size="md"
                      title="Create account"
                      description="Your phone must be on the admin roster before you can register."
                    />
                    <AuthField label="Mobile number" hint="Pre-registered by admin or HR">
                      <PhoneInput value={phoneLocal} onChange={setPhoneLocal} />
                    </AuthField>
                    <Button type="submit" className="auth-submit-btn auth-btn w-full" disabled={busy || !isValidBdPhone(phoneLocal)} tooltip="Check if your phone is on the admin roster">
                      {busy ? "Checking…" : "Continue"}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={createAccount} className="auth-form-stack">
                    <FormHeader
                      size="md"
                      title="Set password"
                      description="Choose a password with at least 6 characters."
                    />
                    <RosterPreview
                      name={rosterInfo?.full_name ?? "User"}
                      phone={phoneLocal}
                      role={rosterInfo?.role}
                      onEditPhone={() => {
                        setSignupStep("phone");
                        setRosterInfo(null);
                        setPassword("");
                        setShowPassword(false);
                      }}
                    />
                    <AuthField label="Password">
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        show={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                      />
                    </AuthField>
                    <Button type="submit" className="auth-submit-btn auth-btn w-full" disabled={busy || password.length < 6} tooltip="Create your account — you'll sign in automatically">
                      {busy ? "Creating…" : "Create account"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-sm text-[color:var(--auth-muted)] hover:text-[color:var(--auth-fg)]"
                      onClick={() => {
                        setSignupStep("phone");
                        setRosterInfo(null);
                        setPassword("");
                      }}
                    >
                      Use a different number
                    </button>
                  </form>
                )}
              </>
            )}

            <AuthModeSwitch mode={mode} />
          </section>
        </div>
      </div>
    </div>
  );
}

function AuthModeSwitch({ mode }: { mode: AuthMode }) {
  return (
    <p className="auth-mode-switch text-center text-sm text-[color:var(--auth-muted)]">
      {mode === "signin" ? (
        <>
          No account?{" "}
          <Link to="/auth" search={{ signup: true }} className="auth-text-link font-medium hover:underline">
            Create one
          </Link>
        </>
      ) : (
        <>
          Have an account?{" "}
          <Link to="/auth" search={{}} className="auth-text-link font-medium hover:underline">
            Sign in
          </Link>
        </>
      )}
    </p>
  );
}

function SignupSteps({
  step,
  className,
  onGoToPhone,
}: {
  step: 1 | 2;
  className?: string;
  onGoToPhone?: () => void;
}) {
  return (
    <ol className={cn("auth-steps", className)}>
      {(["Phone", "Password"] as const).map((label, i) => {
        const n = (i + 1) as 1 | 2;
        const active = n === step;
        const done = n < step;
        const canGoBack = n === 1 && done && !!onGoToPhone;

        return (
          <li key={label} className={cn("auth-step", active && "is-active", done && "is-done")}>
            {canGoBack ? (
              <button
                type="button"
                className="auth-step-btn"
                onClick={onGoToPhone}
                aria-label="Go back to phone number"
              >
                <span className="auth-step-num">✓</span>
                <span className="auth-step-label">{label}</span>
              </button>
            ) : (
              <>
                <span className="auth-step-num">{done ? "✓" : n}</span>
                <span className="auth-step-label">{label}</span>
              </>
            )}
          </li>
        );
      })}
    </ol>
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
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="auth-password-field">
      <Lock className="auth-field-leading-icon" />
      <input
        type={show ? "text" : "password"}
        className="auth-field-input auth-field-input--leading auth-field-input--trailing"
        autoComplete={show ? "off" : "current-password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={6}
        required
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
