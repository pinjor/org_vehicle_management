import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/fleet-ui";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FleetOps" },
      { name: "description", content: "Sign in to raise vehicle requests, dispatch drivers and track trips." },
      { property: "og:title", content: "Sign in — FleetOps" },
      { property: "og:description", content: "Access the enterprise fleet dispatch console." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) void navigate({ to: "/dashboard" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. You can sign in now.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <p className="text-sm font-semibold text-sidebar-accent-foreground">FleetOps</p>
        <div>
          <h2 className="text-3xl font-semibold text-sidebar-accent-foreground">
            One console for every vehicle, driver and trip.
          </h2>
          <p className="mt-3 max-w-md text-sm text-sidebar-foreground/75">
            Raise multi-stop requests, let the matching engine rank vehicle and driver pairs, and follow each
            journey through its full lifecycle.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Enterprise transport operations</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="panel w-full max-w-sm space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">{mode === "signin" ? "Sign in" : "Create account"}</h1>
            <p className="text-xs text-muted-foreground">Use your corporate email address.</p>
          </div>
          {mode === "signup" && (
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account yet? Create one" : "Already registered? Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}