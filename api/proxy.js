export default async function handler(req, res) {
  try {
    const mirrors = [
      "https://vidsrcme.ru/",
      "https://vidsrcme.ru/",
      "https://vidsrcme.ru/",
    ];

    const path = req.url.replace(/^\/api\/proxy\//, "");
    const target = mirrors[Math.floor(Math.random() * mirrors.length)] + "/" + path;

    const upstream = await fetch(target, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0",
        "Referer": "https://vidsrc-embed.ru/",
      },
    });

    let html = await upstream.text();

    // 🧹 Remove popups & ad scripts
    html = html
      .replace(/<script[^>]*histats[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*popunder[^>]*<\/script>/gi, "")
      .replace(/<script[^>]*ads[^>]*<\/script>/gi, "")
      .replace(/window\.open\s*\(/gi, "//blocked(")
      .replace(/on(click|mousedown|mouseup)="[^"]*"/gi, "")
      .replace(/location\.href\s*=/gi, "//blockedHref=")
      .replace(/intent:\/\//gi, "#safe://");

    // 🎬 Player fullscreen & autoplay styles
    const playerCSS = `
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

    // 🛡 SafeLock + Autoplay script
    const safeLock = `
      <style>
        #safeLock {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.25);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #fff;
          font-family: system-ui, sans-serif;
          font-size: 16px;
          backdrop-filter: blur(4px);
          transition: opacity 1s ease;
        }
        #safeLock.hidden {
          opacity: 0;
          pointer-events: none;
        }
        #safeLock span {
          background: rgba(0,0,0,0.6);
          padding: 12px 20px;
          border-radius: 10px;
          box-shadow: 0 0 20px rgba(255,255,255,0.1);
        }
      </style>
      <script>
        const safeLock = document.createElement('div');
        safeLock.id = 'safeLock';
        safeLock.innerHTML = '<span>⚠️ Do not tap screen Ads will appear autoplay mode on — please wait...</span>';
        document.body.appendChild(safeLock);

        // Auto-hide SafeLock
        let tapCount = 0;
        safeLock.addEventListener('click', () => {
          tapCount++;
          if (tapCount >= 2) safeLock.classList.add('hidden');
        });

        const enableAutoplay = () => {
          const vid = document.querySelector('video');
          const iframe = document.querySelector('iframe');

          // Try autoplay for video
          if (vid) {
            vid.muted = true;
            vid.autoplay = true;
            vid.play().catch(()=>{});
            setTimeout(() => safeLock.classList.add('hidden'), 3000);
          }

          // Force iframe autoplay (append ?autoplay=1)
          if (iframe && !iframe.src.includes("autoplay")) {
            try {
              const url = new URL(iframe.src);
              url.searchParams.set("autoplay", "1");
              iframe.src = url.toString();
            } catch(e){}
            setTimeout(() => safeLock.classList.add('hidden'), 5000);
          }
        };

        window.addEventListener('load', enableAutoplay);
        new MutationObserver(enableAutoplay).observe(document.body, { childList: true, subtree: true });
      </script>
    `;

    html = html.replace("</head>", playerCSS + "</head>");
    html = html.replace("</body>", safeLock + "</body>");

    res.setHeader("Content-Type", "text/html");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
