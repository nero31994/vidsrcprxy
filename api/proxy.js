let currentMirrorIndex = 0; // rotate through mirrors

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc.to",
      "https://vidapi.xyz"
    ];
    const mirror = mirrors[currentMirrorIndex];
    currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;

    const upstreamUrl = `${mirror}/${path}`;
    const response = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": mirror,
        "Origin": mirror,
      },
    });

    // sanitize HTML to strip ad/redirect scripts
    let body = await response.text();
    body = body
      .replace(/<script[^>]*histats[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<script[^>]*popup[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/window\.open\s*\([^)]*\)/gi, "")
      .replace(/onbeforeunload\s*=\s*[^;]+;/gi, "")
      .replace(/setInterval\s*\([^)]*redirect[^)]*\)/gi, "")
      .replace(/top\.location\s*=\s*[^;]+;/gi, "")
      .replace(/window\.location\s*=\s*[^;]+;/gi, "");

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(response.status).send(body);
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
