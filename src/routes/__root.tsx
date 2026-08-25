import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth";
import { LanguageProvider } from "../lib/i18n";
import { LookupsProvider } from "../lib/lookups-context";
import { Toaster } from "../components/ui/sonner";
import { TooltipProvider } from "../components/ui/tooltip";
import {
  StatusPrimaryButton,
  StatusScreen,
  StatusSecondaryAnchor,
} from "../components/status-screen";

function NotFoundComponent() {
  return (
    <StatusScreen
      code="404 · missing stop"
      title="This route isn't on the map"
      description="The page you asked for isn't in FleetOps — it may have moved, or the link is outdated."
      primaryAction={<StatusPrimaryButton href="/">Back to FleetOps</StatusPrimaryButton>}
    />
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <StatusScreen
      code="Detour"
      title="Couldn't load this page"
      description="Something stalled on our side. Try again, or head home and continue from there."
      primaryAction={
        <StatusPrimaryButton
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </StatusPrimaryButton>
      }
      secondaryAction={<StatusSecondaryAnchor>Go home</StatusSecondaryAnchor>}
    />
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "FleetOps — Vehicle Request & Dispatch" },
      {
        name: "description",
        content:
          "Enterprise vehicle requests, intelligent dispatch matching and live fleet operations in one console.",
      },
      { property: "og:title", content: "FleetOps — Vehicle Request & Dispatch" },
      {
        property: "og:description",
        content: "Request vehicles, match drivers intelligently and track every trip in real time.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og-image.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <LookupsProvider>
            <TooltipProvider delayDuration={400}>
              {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
              <Outlet />
              <Toaster position="top-center" richColors className="sm:!top-4" toastOptions={{ className: "max-w-[calc(100vw-2rem)]" }} />
            </TooltipProvider>
          </LookupsProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
