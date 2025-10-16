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
    if (!contentType.includes("text/html")) {
      const buf = await upstream.arrayBuffer();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.status(upstream.status).send(Buffer.from(buf));
      return;
    }

    let html = await upstream.text();

    // 🔒 Inject advanced anti-ad / anti-intent script
    const injection = `
      <script>
        (() => {
          // Disable popup/redirect attempts
          window.open = () => null;
          const blockedProtocols = /^(intent|market):/i;

          // Intercept all click events (including video tap)
          document.addEventListener('click', e => {
            const target = e.target.closest('a, button, div, span');
            if (target) {
              const href = target.getAttribute('href');
              if (href && blockedProtocols.test(href)) {
                e.stopImmediatePropagation();
                e.preventDefault();
                console.log('🚫 Intent redirect blocked:', href);
                return false;
              }
            }
          }, true);

          // Prevent dynamically added intent links
          new MutationObserver(mutations => {
            mutations.forEach(m => {
              m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                  const links = node.querySelectorAll('a[href]');
                  links.forEach(a => {
                    if (blockedProtocols.test(a.href)) {
                      a.removeAttribute('href');
                      console.log('Removed intent link:', a);
                    }
                  });
                }
              });
            });
          }).observe(document.documentElement, { childList: true, subtree: true });

          // Block location redirects
          ['assign','replace'].forEach(fn => {
            try {
              window.location[fn] = new Proxy(window.location[fn], {
                apply(t, thisArg, args) {
                  if (args[0] && blockedProtocols.test(args[0])) {
                    console.log('🚫 Redirect blocked:', args[0]);
                    return;
                  }
                  return Reflect.apply(t, thisArg, args);
                }
              });
            } catch(e){}
          });

          // Make sure player stays full and centered
          const fixPlayer = () => {
            const p = document.querySelector('iframe, video, #player, .player');
            if (p) Object.assign(p.style, {
              width: '100vw',
              height: '100vh',
              position: 'fixed',
              top: '0',
              left: '0',
              zIndex: '9999'
            });
          };
          new MutationObserver(fixPlayer).observe(document.body, { childList: true, subtree: true });
          window.addEventListener('load', fixPlayer);
        })();
      </script>
      <style>
        html,body{margin:0;padding:0;background:#000;overflow:hidden;height:100vh;}
        iframe,video,#player,.player{width:100vw!important;height:100vh!important;border:none!important;}
      </style>
    `;

    html = html.replace(/<\/body>/i, `${injection}</body>`);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Content-Security-Policy",
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src *; media-src * data: blob:;"
    );
    res.status(upstream.status).send(html);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
