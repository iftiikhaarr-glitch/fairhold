// A shared access gate for a private sandbox judging demo. Rental role keys
// still control payment actions. This is not a replacement for user accounts.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function digest(value) {
  return createHash("sha256").update(value).digest();
}

const SESSION_SECONDS = 8 * 60 * 60;
const COOKIE = "fairhold_demo";
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function loginPage(username, returnTo = "/", failed = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FairHold demo sign in</title><style>body{margin:0;background:#1c2020;color:#eee;font:16px system-ui;display:grid;place-items:center;min-height:100vh}main{width:min(85vw,360px);padding:32px;border:1px solid #6f756a;border-radius:14px}h1{margin-top:0}p{line-height:1.5;color:#ccc}label{display:block;margin:20px 0 6px}input,button{box-sizing:border-box;width:100%;padding:12px;border:1px solid #888;border-radius:6px;font:inherit}input{background:#252929;color:#fff}button{margin-top:24px;background:#008e70;color:#fff;cursor:pointer}.error{color:#ffb6a4}</style></head><body><main><h1>FairHold</h1><p>Sign in to the protected sandbox demo using the judging credentials supplied by the entrant.</p>${failed ? '<p class="error" role="alert">The demo username or password is incorrect.</p>' : ""}<form method="post" action="/demo/login"><label for="username">Demo username</label><input id="username" name="username" autocomplete="username" value="${escape(username)}" required><label for="password">Demo password</label><input id="password" name="password" type="password" autocomplete="current-password" required><input type="hidden" name="returnTo" value="${escape(returnTo)}"><button type="submit">Sign in to demo</button></form><p>All payments use PayPal's sandbox. No real money moves.</p></main></body></html>`;
}

export function demoAccess({ username = "judge", password = "", appBaseUrl, now = Date.now } = {}) {
  const expected = digest(`${username}:${password}`);
  const expectedOrigin = appBaseUrl ? new URL(appBaseUrl).origin : null;
  const signature = payload => createHmac("sha256", password).update(`fairhold-demo:${expectedOrigin || "local"}:${payload}`).digest("hex");
  const cookieOptions = { httpOnly: true, secure: expectedOrigin?.startsWith("https://") || false, sameSite: "lax", path: "/" };
  function validSession(req) {
    const cookie = (req.get("Cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`));
    if (!cookie) return false;
    const pieces = cookie.slice(COOKIE.length + 1).split(".");
    if (pieces.length !== 2 || !timingSafeEqual(digest(pieces[1]), digest(signature(pieces[0])))) return false;
    try {
      const payload = JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8"));
      return payload.u === username && typeof payload.exp === "number" && payload.exp > now();
    } catch { return false; }
  }
  return (req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Referrer-Policy", "same-origin");
    res.set("X-Frame-Options", "DENY");
    if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
    if (["GET", "HEAD"].includes(req.method) && req.path === "/api/health") return next();
    // Both cookie sessions and automatic Basic credentials need CSRF checks.
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.get("Origin");
      if (req.get("Sec-Fetch-Site") === "cross-site" || (origin && expectedOrigin && origin !== expectedOrigin)) {
        return res.status(403).json({ error: { code: "CROSS_SITE_WRITE", message: "Open FairHold directly before changing demo data." } });
      }
    }
    if (req.method === "POST" && req.path === "/demo/logout") {
      res.clearCookie(COOKIE, cookieOptions);
      return res.redirect(303, "/");
    }
    if (password) {
      res.set("Cache-Control", "no-store");
      if (req.method === "POST" && req.path === "/demo/login") {
        const supplied = `${req.body?.username || ""}:${req.body?.password || ""}`;
        const returnTo = typeof req.body?.returnTo === "string" && /^\/(?:\?|$)/.test(req.body.returnTo) ? req.body.returnTo.slice(0, 2048) : "/";
        if (!timingSafeEqual(digest(supplied), expected)) return res.status(401).type("html").send(loginPage(username, returnTo, true));
        const payload = Buffer.from(JSON.stringify({ u: username, exp: now() + SESSION_SECONDS * 1000, n: randomBytes(16).toString("hex") })).toString("base64url");
        res.cookie(COOKIE, `${payload}.${signature(payload)}`, { ...cookieOptions, maxAge: SESSION_SECONDS * 1000 });
        return res.redirect(303, returnTo);
      }
      const header = req.get("Authorization") || "";
      const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
      const supplied = match ? Buffer.from(match[1], "base64").toString("utf8") : "";
      if ((!match || !timingSafeEqual(digest(supplied), expected)) && !validSession(req)) {
        // Render a normal form without a browser HTTP-auth prompt. Basic auth
        // remains supported for API scripts; no secret is put into a URL.
        if (["GET", "HEAD"].includes(req.method) && req.path === "/") {
          const returnTo = req.originalUrl.startsWith("/?") ? req.originalUrl.slice(0, 2048) : "/";
          return res.status(401).type("html").send(loginPage(username, returnTo));
        }
        res.set("WWW-Authenticate", 'Basic realm="FairHold sandbox demo", charset="UTF-8"');
        res.set("Cache-Control", "no-store");
        return res.status(401).json({ error: { code: "DEMO_ACCESS_REQUIRED", message: "Enter the demo access credentials supplied by the entrant." } });
      }
    }
    next();
  };
}
