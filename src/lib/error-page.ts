/** SSR / server fallback when the React app cannot mount. */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Couldn't load — Vehicle Management System</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root {
        --bg: #f7f6fb;
        --fg: #1a2332;
        --muted: #5b6472;
        --primary: #0f8a78;
        --primary-fg: #f4fffc;
        --coral: #e07040;
        --border: color-mix(in srgb, #1a2332 12%, transparent);
        --card: color-mix(in srgb, #ffffff 82%, #f7f6fb);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: 1.5rem;
        font-family: "Plus Jakarta Sans", system-ui, sans-serif;
        color: var(--fg);
        background:
          radial-gradient(ellipse 80% 55% at 85% -5%, color-mix(in srgb, var(--coral) 18%, transparent), transparent 58%),
          radial-gradient(ellipse 70% 50% at 5% 100%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 55%),
          var(--bg);
        -webkit-font-smoothing: antialiased;
      }
      .wrap { position: relative; width: min(100%, 26rem); }
      .route {
        position: absolute; inset-inline: 0; top: -4.5rem; opacity: 0.3; color: var(--primary);
        pointer-events: none; display: grid; place-items: center;
      }
      .route svg { width: min(28rem, 88vw); height: auto; }
      .card {
        position: relative;
        text-align: center;
        padding: 1.75rem 1.5rem 1.5rem;
        border-radius: 1rem;
        border: 1px solid color-mix(in srgb, var(--primary) 22%, var(--border));
        background: var(--card);
        box-shadow: 0 18px 40px -24px color-mix(in srgb, #1a2332 35%, transparent);
        backdrop-filter: blur(10px);
      }
      .brand {
        display: inline-flex; align-items: center; gap: 0.55rem;
        margin-bottom: 1.15rem; font-size: 0.8125rem; font-weight: 700; letter-spacing: -0.02em;
      }
      .mark {
        width: 2.25rem; height: 2.25rem; border-radius: 0.55rem; background: #1a2332;
        display: grid; place-items: center; color: #ff9a5c; font-size: 0.85rem;
      }
      .code {
        display: inline-flex; margin: 0 auto 0.85rem; padding: 0.2rem 0.65rem;
        border-radius: 999px; border: 1px solid color-mix(in srgb, var(--coral) 35%, var(--border));
        background: color-mix(in srgb, var(--coral) 12%, transparent);
        color: color-mix(in srgb, var(--coral) 75%, var(--fg));
        font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      }
      h1 { margin: 0; font-size: clamp(1.35rem, 3.5vw, 1.7rem); letter-spacing: -0.03em; line-height: 1.2; }
      p { margin: 0.65rem 0 0; color: var(--muted); font-size: 0.875rem; line-height: 1.55; }
      .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 1.4rem; }
      a, button {
        display: inline-flex; min-height: 2.5rem; align-items: center; justify-content: center;
        padding: 0.5rem 1rem; border-radius: 0.55rem; font: inherit; font-size: 0.875rem; font-weight: 600;
        cursor: pointer; text-decoration: none; border: 1px solid transparent;
      }
      .primary { background: var(--primary); color: var(--primary-fg); }
      .primary:hover { filter: brightness(0.95); }
      .ghost { background: transparent; color: var(--fg); border-color: var(--border); }
      .ghost:hover { background: color-mix(in srgb, #1a2332 4%, transparent); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="route" aria-hidden="true">
        <svg viewBox="0 0 320 120" fill="none">
          <path d="M12 88 C 70 88, 90 32, 150 32 S 230 88, 308 48" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="6 8" />
          <circle cx="12" cy="88" r="5" fill="#4db8a6" />
          <circle cx="308" cy="48" r="6" fill="#e07040" />
        </svg>
      </div>
      <div class="card">
        <div class="brand"><span class="mark" aria-hidden="true">VM</span><span>Vehicle Management System</span></div>
        <p class="code">Detour</p>
        <h1>Couldn't load this page</h1>
        <p>Something stalled on our side. Try again, or head home and continue from there.</p>
        <div class="actions">
          <button class="primary" type="button" onclick="location.reload()">Try again</button>
          <a class="ghost" href="/">Go home</a>
        </div>
      </div>
    </div>
  </body>
</html>`;
}
