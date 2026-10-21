// A shared access gate for a private sandbox judging demo. Rental role keys
// still control payment actions. This is not a replacement for user accounts.
import { createHash, timingSafeEqual } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function demoAccess({ username = "judge", password = "", appBaseUrl } = {}) {
  const expected = digest(`${username}:${password}`);
  const expectedOrigin = appBaseUrl ? new URL(appBaseUrl).origin : null;
  return (req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (["GET", "HEAD"].includes(req.method) && req.path === "/api/health") return next();
    if (password) {
      const header = req.get("Authorization") || "";
      const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
      const supplied = match ? Buffer.from(match[1], "base64").toString("utf8") : "";
      if (!match || !timingSafeEqual(digest(supplied), expected)) {
        res.set("WWW-Authenticate", 'Basic realm="FairHold sandbox demo", charset="UTF-8"');
        res.set("Cache-Control", "no-store");
        return res.status(401).json({ error: { code: "DEMO_ACCESS_REQUIRED", message: "Enter the demo access credentials supplied by the entrant." } });
      }
    }
    // Browser Basic credentials are automatic, so reject cross-site writes.
    // Direct scripts without an Origin still require access and rental keys.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("Origin");
      if (req.get("Sec-Fetch-Site") === "cross-site" || (origin && expectedOrigin && origin !== expectedOrigin)) {
        return res.status(403).json({ error: { code: "CROSS_SITE_WRITE", message: "Open FairHold directly before changing demo data." } });
      }
    }
    next();
  };
}
