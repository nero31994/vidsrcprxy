export default async function handler(req, res) {
  try {
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidapi.xyz",
      "https://vidsrc.to",
    ];

    const path = req.url.replace(/^\/api\/proxy\//, "");
    const target = mirrors[0] + "/" + path;

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": "https://vidsrc-embed.ru/",
        "Accept": "text/html",
      },
    });

    let html = await upstream.text();

    // 🧹 Remove common ad scripts and event handlers
    html = html
      // Remove histats and known ad scripts
      .replace(/<script[^>]*histats[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*popunder[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*ads[^>]*<\/script>/gi, "")
      .replace(/on(click|mousedown|mouseup)="[^"]*"/gi, "")
      .replace(/window\.open\s*\(/gi, "// blocked(")
      .replace(/location\.href\s*=/gi, "// lockedHref=")
      .replace(/intent:\/\//gi, "#safe://");

    // 🛡 Add Safe-Lock Layer
    const safeLockScript = `
      <style>
        #safeLock {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.3);
          z-index: 9999;
        }
        #safeLock.hidden { display: none; }
      </style>
      <script>
        let safeClicks = 0;
        const lock = document.createElement('div');
        lock.id = 'safeLock';
        document.body.appendChild(lock);
        lock.onclick = () => {
          safeClicks++;
          if (safeClicks >= 2) lock.classList.add('hidden');
        };
      </script>
    `;
    html = html.replace("</body>", safeLockScript + "</body>");

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).send(html);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
