export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Mirrors
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidapi.xyz",
      "https://vidsrc.to"
    ];

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36"
    ];

    const referers = [
      "https://vidsrc.to/",
      "https://vidsrc-embed.ru/",
      "https://google.com/"
    ];

    let html;
    for (const base of mirrors) {
      try {
        const upstream = await fetch(base + "/" + path, {
          headers: {
            "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
            "Referer": referers[Math.floor(Math.random() * referers.length)]
          }
        });
        if (!upstream.ok) continue;

        html = await upstream.text();

        // Try to extract M3U8 or MPD URL from page
        const m3u8Match = html.match(/(https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*)/i);
        const mpdMatch = html.match(/(https?:\/\/[^\s"'<>]+\.mpd[^\s"'<>]*)/i);
        const videoUrl = m3u8Match?.[1] || mpdMatch?.[1];

        if (videoUrl) {
          // Fetch video manifest
          const videoResp = await fetch(videoUrl, {
            headers: {
              "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
              "Referer": base + "/"
            }
          });
          const buffer = Buffer.from(await videoResp.arrayBuffer());
          res.setHeader("access-control-allow-origin", "*");
          res.setHeader("content-type", videoResp.headers.get("content-type") || "application/vnd.apple.mpegurl");
          return res.status(videoResp.status).send(buffer);
        }
      } catch (err) {
        console.error("Mirror failed:", base, err.message);
        continue;
      }
    }

    res.status(404).json({ error: "Video URL not found in any mirror." });
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
