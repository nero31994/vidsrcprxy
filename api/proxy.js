let currentMirrorIndex = 0;

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Rotating mirrors (edit freely)
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc.to",
      "https://vidapi.xyz",
    ];

    // Function to fetch from mirror
    async function fetchFromMirror(mirror) {
      const response = await fetch(`${mirror}/${path}`, {
        headers: {
          "User-Agent":
            req.headers["user-agent"] ||
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          "Referer": mirror,
          "Origin": mirror,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      const text = await response.text();
      return { status: response.status, headers: response.headers, body: text };
    }

    let success = false;
    let finalResponse = null;

    // Try each mirror until a working one is found
    for (let i = 0; i < mirrors.length; i++) {
      const mirror = mirrors[currentMirrorIndex];
      currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;

      const result = await fetchFromMirror(mirror);

      // Check if it contains a video iframe or embed script
      if (
        result.body.includes("<iframe") ||
        result.body.includes("player") ||
        result.body.includes("videojs") ||
        result.body.includes("jwplayer")
      ) {
        success = true;
        finalResponse = result;
        break;
      }

      // Skip if it’s just tracking or blank page
      if (
        result.body.includes("histats") ||
        result.body.trim().length < 300
      ) {
        continue;
      }
    }

    if (!success || !finalResponse) {
      return res
        .status(404)
        .json({ error: "No working mirror found for this video." });
    }

    res.setHeader(
      "Content-Type",
      finalResponse.headers.get("content-type") || "text/html"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(finalResponse.status).send(finalResponse.body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
