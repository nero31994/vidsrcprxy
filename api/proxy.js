export default async function handler(req, res) {
  try {
    const { type = "movie", id, season, episode } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing required ?id parameter" });
    }

    // Mirror rotation
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc-embed.su",
      "https://vidsrcme.ru",
      "https://vidsrcme.su"
    ];
    const mirror = mirrors[Math.floor(Math.random() * mirrors.length)];

    // Detect URL format (movie or TV)
    let embedUrl;
    if (type === "tv" && season && episode) {
      embedUrl = `${mirror}/embed/tv/${id}/${season}/${episode}`;
    } else {
      embedUrl = `${mirror}/embed/movie/${id}`;
    }

    console.log("🔗 Fetching embed:", embedUrl);

    // Fetch the embed HTML
    const html = await fetch(embedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": mirror
      }
    }).then(r => r.text());

    // Try to find m3u8 URL in HTML (most embeds store it directly)
    let m3u8Match = html.match(/https?:\/\/[^"']+\.m3u8[^"']*/);

    // Some mirrors use obfuscated script with base64 URLs
    if (!m3u8Match) {
      const base64Match = html.match(/atob\(["']([A-Za-z0-9+/=]+)["']\)/);
      if (base64Match) {
        try {
          const decoded = Buffer.from(base64Match[1], "base64").toString("utf-8");
          m3u8Match = decoded.match(/https?:\/\/[^"']+\.m3u8[^"']*/);
        } catch {}
      }
    }

    if (!m3u8Match) {
      return res.status(404).json({ error: "No m3u8 URL found on embed page" });
    }

    const m3u8Url = m3u8Match[0];
    console.log("✅ Found stream:", m3u8Url);

    // Proxy the .m3u8 file to hide the original host
    const upstream = await fetch(m3u8Url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": mirror
      }
    });

    if (!upstream.ok) throw new Error(`Failed to fetch upstream: ${upstream.status}`);

    const m3u8Text = await upstream.text();

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(m3u8Text);

  } catch (err) {
    console.error("❌ Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
