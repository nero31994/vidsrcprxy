export default async function handler(req, res) {
  try {
    let path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // --- Mirrors (rotate or fallback) ---
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc-embed.su",
      "https://vidsrc.to"
    ];

    // Default mirror (for auto-prepend)
    const defaultMirror = mirrors[0];

    // Detect if full URL or relative path
    let targetUrl = path.startsWith("http")
      ? path
      : `${defaultMirror}/${path.replace(/^\/+/, "")}`;

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36"
    ];

    const referers = mirrors;

    // Random rotation
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const referer = referers[Math.floor(Math.random() * referers.length)];

    // Fetch from upstream
    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": userAgent,
        "Referer": referer,
        "Accept": "*/*"
      }
    });

    if (!upstream.ok)
      throw new Error(`Upstream request failed: ${upstream.status}`);

    const contentType = upstream.headers.get("content-type") || "";

    // Non-HTML passthrough (like video segments, subtitles)
    if (!contentType.includes("text/html")) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("content-type", contentType);
      return res.status(upstream.status).send(buffer);
    }

    // Modify HTML
    let html = await upstream.text();

    // Remove popups / base64 ad scripts
    html = html
      .replace(/window\.open\(.*?\);?/g, "")
      .replace(/<script[^>]*>[^<]*(popup|click|ad|redirect|atob)[^<]*<\/script>/gi, "")
      .replace(/eval\(atob\(.*?\)\);?/gi, "")
      .replace(/onbeforeunload=.*?['"]/gi, "");

    // Inject autoplay, fullscreen player, and ad protection
    const injection = `
      <script>
        (() => {
          const safeLock = () => {
            document.body.insertAdjacentHTML('beforeend', '<div id="nxb-lock" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;z-index:99999;">⚠️ Ads may appear if you tap the player.<br>Video will autoplay safely.</div>');
            setTimeout(() => document.getElementById('nxb-lock')?.remove(), 5000);
          };

          const preventPopups = () => {
            window.open = () => null;
            document.querySelectorAll('a').forEach(a => {
              if (/ads?|sponsor|click|redirect|intent/i.test(a.href)) a.removeAttribute('href');
            });
          };

          const fixPlayer = () => {
            const p = document.querySelector('iframe, video, #player, .player');
            if (p) Object.assign(p.style, {
              width: "100vw",
              height: "100vh",
              position: "fixed",
              top: "0",
              left: "0",
              zIndex: "9999"
            });
          };

          const autoplay = () => {
            const v = document.querySelector('video');
            if (v) { v.muted = true; v.play().catch(()=>{}); }
          };

          new MutationObserver(() => {
            preventPopups();
            fixPlayer();
            autoplay();
          }).observe(document.documentElement, { childList: true, subtree: true });

          window.addEventListener('load', () => {
            safeLock();
            preventPopups();
            fixPlayer();
            autoplay();
          });
        })();
      </script>
      <style>
        html,body {margin:0;padding:0;background:#000;overflow:hidden;height:100vh;}
        iframe,video,#player,.player {width:100vw!important;height:100vh!important;border:none!important;display:block!important;}
      </style>
    `;

    html = html.replace(/<\/body>/i, `${injection}</body>`);

    // Send final response
    res.status(upstream.status);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("access-control-allow-origin", "*");
    res.setHeader(
      "content-security-policy",
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src *; media-src * data: blob:;"
    );
    res.send(html);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
