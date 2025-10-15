export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Mirrors to rotate
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc-embed.su",
      "https://vidsrc.to",
      "https://vidsrc.pro"
    ];

    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 Chrome/127.0 Mobile Safari/537.36"
    ];

    const referers = [
      "https://vidsrc.to/",
      "https://vidsrc-embed.ru/",
      "https://vidsrc-embed.su/",
      "https://google.com/"
    ];

    // Randomize each request
    const mirror = mirrors[Math.floor(Math.random() * mirrors.length)];
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const referer = referers[Math.floor(Math.random() * referers.length)];

    const upstream = await fetch(`${mirror}/${path}`, {
      headers: {
        "User-Agent": userAgent,
        "Referer": referer
      }
    });

    if (!upstream.ok) throw new Error(`Upstream request failed: ${upstream.status}`);

    const contentType = upstream.headers.get("content-type") || "";

    // Non-HTML → passthrough
    if (!contentType.includes("text/html")) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("content-type", contentType);
      return res.status(upstream.status).send(buffer);
    }

    // HTML content → filter ads
    let html = await upstream.text();

    // Remove base64 & popup scripts early
    html = html
      .replace(/window\.open\s*\(.*?\);?/gi, "")
      .replace(/eval\(atob\(.*?\)\);?/gi, "")
      .replace(/onbeforeunload=.*?['"]/gi, "")
      .replace(/<script[^>]+src=["'].*?(ad|pop|click|banner).*?["'][^>]*><\/script>/gi, "")
      .replace(/<script[^>]*>[^<]*(popup|ads|redirect|atob)[^<]*<\/script>/gi, "");

    // Inject stronger anti-ad protection
    const injection = `
      <script>
        (() => {
          const neutralize = () => {
            // Prevent popups, click hijacks
            window.open = () => null;
            document.querySelectorAll("a, button").forEach(el => {
              if (/ad|sponsor|click|redirect|pop/i.test(el.href || "")) {
                el.removeAttribute("href");
                el.onclick = null;
              }
            });
            // Kill ad scripts added after load
            document.querySelectorAll("script").forEach(s => {
              if (/ads?|popunder|redirect|atob|base64/i.test(s.innerHTML)) s.remove();
            });
            document.querySelectorAll("iframe").forEach(f => {
              if (/ads?|banner|pop/i.test(f.src)) f.remove();
            });
          };

          // Observe DOM for new ad injections
          new MutationObserver(neutralize)
            .observe(document.documentElement, { childList: true, subtree: true });
          window.addEventListener("load", neutralize);
          document.addEventListener("click", neutralize, true);

          // Fullscreen player fix
          const fixPlayer = () => {
            const p = document.querySelector("iframe, video, #player, .player");
            if (p) Object.assign(p.style, {
              width: "100vw",
              height: "100vh",
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 9999
            });
          };
          new MutationObserver(fixPlayer).observe(document.body, { childList: true, subtree: true });
          window.addEventListener("load", fixPlayer);
        })();
      </script>
      <style>
        html,body {
          margin:0; padding:0;
          background:#000;
          overflow:hidden;
          height:100vh;
        }
        iframe,video,#player,.player {
          width:100vw!important;
          height:100vh!important;
          border:none!important;
          display:block!important;
        }
      </style>
    `;

    html = html.replace(/<\/body>/i, `${injection}</body>`);

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
