import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Google returns the ID token in the URL *fragment* (#id_token=…), which
// never reaches a server. This tiny page reads it in the browser, removes it
// from the address bar, hands it to POST /api/auth/google for checking, and
// goes wherever that says. No user-supplied text is written into the page.
const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Signing in…</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#E6E6E6;color:#14161A">
<p>Signing in…</p>
<script>
(function () {
  var params = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, "", location.pathname);
  fetch("/api/auth/google", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: params.get("id_token"), state: params.get("state"), error: params.get("error") })
  })
    .then(function (r) { return r.json(); })
    .then(function (d) { location.replace(typeof d.redirect === "string" && d.redirect.charAt(0) === "/" ? d.redirect : "/"); })
    .catch(function () { location.replace("/"); });
})();
</script>
</body></html>`;

/** Step 2: where Google sends the customer back. */
export async function GET() {
  return new NextResponse(PAGE, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
