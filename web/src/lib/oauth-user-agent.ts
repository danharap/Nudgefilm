/**
 * Google blocks OAuth in many embedded / non-system browsers ("disallowed_user_agent").
 * We only flag UAs that are very likely blocked so normal Chrome/Safari/Edge on Windows stay unaffected.
 *
 * @see https://developers.googleblog.com/2021/06/upcoming-security-changes-to-googles-oauth-2.0-authorization-endpoint-in-embedded-webviews.html
 */
export function isGoogleOAuthLikelyBlockedUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  const u = userAgent.toLowerCase();

  if (u.includes("instagram")) return true;
  if (u.includes("fbav/") || u.includes("fban/") || u.includes("fb_iab")) return true;
  if (u.includes("snapchat")) return true;
  if (u.includes(" line/")) return true;
  if (u.includes("linkedinapp")) return true;
  if (u.includes("micromessenger")) return true; // WeChat
  if (u.includes("bytedancewebview") || u.includes("musical_ly")) return true;

  // In-app Twitter / X clients
  if (u.includes("twitter for") || u.includes("twitterandroid")) return true;

  // VS Code, Cursor Simple Browser, Slack, etc.
  if (u.includes("electron/")) return true;

  // Android WebView marker (full Chrome does not send "; wv)")
  if (u.includes("; wv)")) return true;

  return false;
}
