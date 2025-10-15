let currentMirrorIndex = 0;

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Rotating mirrors
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc.to",
      "https://vidapi.xyz",
    ];

    const mirror = mirrors[currentMirrorIndex];
    currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;

    // Forward the request
    const upstream = await fetch(`${mirror}/${path}`, {
      headers: {
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": mirror,
        "Origin": mirror,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = upstream.headers.get("content-type") || "";
    const body = await upstream.text();

    // If upstream returns tracking-only HTML (Histats), try next mirror automatically
    if (body.includes("histats.com") && mirrors.length > 1) {
      currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;
      const nextMirror = mirrors[currentMirrorIndex];
      const retry = await fetch(`${nextMirror}/${path}`, {
        headers: {
          "User-Agent":
            req.headers["user-agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": nextMirror,
          "Origin": nextMirror,
        },
      });
      const retryBody = await retry.text();
      res.setHeader("Content-Type", retry.headers.get("content-type") || "text/html");
      return res.status(retry.status).send(retryBody);
    }

    // Pass through video player HTML
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(upstream.status).send(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
