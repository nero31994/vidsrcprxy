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

    // 🧹 Remove ads, popup triggers, and redirect attempts
    html = html
      .replace(/<script[^>]*histats[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*popunder[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*ads[^>]*<\/script>/gi, "")
      .replace(/on(click|mousedown|mouseup)="[^"]*"/gi, "")
      .replace(/window\.open\s*\(/gi, "//blocked(")
      .replace(/location\.href\s*=/gi, "//blockedHref=")
      .replace(/intent:\/\//gi, "#safe://");

    // 🖥 Force Fullscreen Player
    const fullPlayerCSS = `
      <style>
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #000 !important;
          height: 100% !important;
          width: 100% !important;
          overflow: hidden !important;
        }
        iframe, video, #player, .video-js, .jwplayer, .plyr {
          width: 100% !important;
          height: 100% !important;
          max-width: 100vw !important;
          max-height: 100vh !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          object-fit: cover !important;
          z-index: 10 !important;
        }
      </style>
    `;

    // 🛡 SafeLock with Auto Fade
    const safeLockScript = `
      <style>
        #safeLock {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.25);
          z-index: 9999;
          transition: opacity 1s ease;
        }
        #safeLock.hidden {
          opacity: 0;
          pointer-events: none;
        }
      </style>
      <script>
        const safeLock = document.createElement('div');
        safeLock.id = 'safeLock';
        document.body.appendChild(safeLock);

        // Double-tap unlock protection (manual unlock fallback)
        let safeClicks = 0;
        safeLock.addEventListener('click', () => {
          safeClicks++;
          if (safeClicks >= 2) safeLock.classList.add('hidden');
        });

        // Auto fade after playback starts
        const fadeWhenPlaying = () => {
          const vid = document.querySelector('video');
          const iframe = document.querySelector('iframe');
          if (vid) {
            vid.addEventListener('play', () => {
              setTimeout(() => safeLock.classList.add('hidden'), 3000);
            });
          } else if (iframe) {
            // Fallback for iframe-based players
            setTimeout(() => safeLock.classList.add('hidden'), 5000);
          }
        };

        window.addEventListener('load', fadeWhenPlaying);
        new MutationObserver(fadeWhenPlaying).observe(document.body, { childList: true, subtree: true });
      </script>
    `;

    html = html.replace("</head>", fullPlayerCSS + "</head>");
    html = html.replace("</body>", safeLockScript + "</body>");

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
