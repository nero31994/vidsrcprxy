let currentMirrorIndex = 0;

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc.to",
      "https://vidapi.xyz",
    ];

    const mirror = mirrors[currentMirrorIndex];
    currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;

    const target = `${mirror}/${path}`;
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          req.headers["user-agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        Referer: mirror,
        Origin: mirror,
      },
    });

    const contentType = upstream.headers.get("content-type") || "";

    // For media, JS, etc., just pass through
    if (!contentType.includes("text/html")) {
      const buf = await upstream.arrayBuffer();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.status(upstream.status).send(Buffer.from(buf));
      return;
    }

    let html = await upstream.text();

    // ---- inject anti-popup script ----
    const injection = `
      <script>
        // stop popups, redirects, and layer ads
        const openBackup = window.open;
        window.open = function(...args) {
          console.log('Popup blocked:', args);
          return null;
        };
        const blockRedirects = () => {
          for (const prop of ['location','top','parent']) {
            try {
              Object.defineProperty(window[prop], 'href', {
                get: () => window[prop].href,
                set: () => console.log('Redirect blocked')
              });
            } catch(e){}
          }
        };
        blockRedirects();
        document.addEventListener('click', e => {
          const a = e.target.closest('a');
          if (a && /ads|click|sponsor/i.test(a.href)) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Ad link blocked');
          }
        }, true);
      </script>
      <style>
        html,body{margin:0;padding:0;background:#000;overflow:hidden}
        iframe,video,#player,.player{width:100vw!important;height:100vh!important;border:0}
      </style>
    `;

    html = html.replace(/<\/body>/i, `${injection}</body>`);

    // Relaxed CSP and CORS so player can load manifests
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Security-Policy",
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src *; media-src * data: blob:; object-src 'none';"
    );
    res.status(upstream.status).send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
