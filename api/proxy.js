// /api/proxy.js

export default async function handler(req, res) {
  try {
    const urlPath = req.url.replace(/^\/api\/proxy\//, "");
    if (!urlPath) return res.status(400).send("No path specified.");

    const targetUrl = decodeURIComponent(urlPath);
    console.log("Fetching:", targetUrl);

    // Fetch the original embed HTML
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": "https://vidsrc.me/",
      },
    });

    let html = await upstream.text();

    // --- 🧹 CLEAN AD SCRIPTS ---
    // Remove base64 ad injections
    html = html.replace(/eval\(atob\([^)]+\)\);?/g, "");
    html = html.replace(/window\.open\s*\([^)]*\)/g, "");
    html = html.replace(/onclick="[^"]*"/g, "");
    html = html.replace(/onfocus="[^"]*"/g, "");
    html = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (match, script) => {
      if (
        /ads|popunder|adblock|banners|base64|window\.open|intent:/.test(script)
      ) return "";
      return match;
    });

    // Force autoplay & mute to avoid user tap = ad trigger
    html = html.replace(
      /<video([^>]*)>/,
      '<video$1 autoplay muted playsinline controls>'
    );

    // Disable JS redirections
    html = html.replace(/top\.location\s*=/g, "//blocked//");

    // Optional: inject overlay reminder
    const reminder = `
      <div style="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);
        background:rgba(0,0,0,0.7);color:#fff;padding:6px 12px;border-radius:8px;
        font-family:sans-serif;font-size:13px;z-index:9999;">
        Reminder: Ads were removed. Please don't tap the player.
      </div>`;
    html = html.replace("</body>", `${reminder}</body>`);

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Proxy failed.", details: e.message });
  }
}
