import { AuthIllustration } from "@/components/auth-illustration";

/** @deprecated Use AuthIllustration variant="signin" */
export function AuthRouteIllustration({ className }: { className?: string }) {
  return <AuthIllustration variant="signin" className={className} />;
}
