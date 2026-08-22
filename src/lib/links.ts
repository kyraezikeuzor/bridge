/**
 * Outbound links that appear in more than one place.
 *
 * The Discord invite lived in three separate literals and drifted into two
 * different servers, one of them dead — keep it defined once.
 */
export const DISCORD_INVITE_URL = "https://discord.gg/VfARrtgpHG";

/** Where Bridge actually lives. */
export const APP_URL = "https://bridge.omelora.org";

function isLocalHost(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i.test(
    url.trim()
  );
}

/**
 * Base URL for links we put inside emails.
 *
 * Deliberately does NOT read NEXTAUTH_URL/AUTH_URL. Those are auth callback
 * settings and are legitimately http://localhost:3000 in development, so
 * deriving emailed links from them ships "http://localhost:3000/summary" to a
 * volunteer's inbox the moment anyone reviews hours against a dev server.
 *
 * A localhost value is rejected even when explicitly configured: an emailed
 * link is useless to its recipient no matter which machine sent it.
 */
export function emailLinkBase(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured && !isLocalHost(configured)) {
    return configured.replace(/\/$/, "");
  }
  if (configured) {
    console.warn(
      `[links] ignoring NEXT_PUBLIC_APP_URL="${configured}" for an emailed link — falling back to ${APP_URL}`
    );
  }
  return APP_URL;
}

/** Absolute URL for a Bridge path, safe to put in an email. */
export function emailLink(path: string): string {
  return `${emailLinkBase()}${path.startsWith("/") ? path : `/${path}`}`;
}
