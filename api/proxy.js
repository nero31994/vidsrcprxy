let currentMirrorIndex = 0;

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Rotating mirrors
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc-embed.su",
      "https://vidapi.xyz"
    ];

    // Cycle mirrors each request
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
      res.status(upstream.status).send(Buffer.from(buf));
      return;
    }

    let html = await upstream.text();

    // Inject safe ad-block, popup-block and overlay protection
    const injection = `
      <script>
        (() => {
          const blocked = /intent:|market:|histats|sponsor|pop|redirect|ads/i;

          // 🧩 Prevent popup, intent and ad redirects
          window.open = () => null;
          document.addEventListener('click', e => {
            const t = e.target.closest('a,button');
            if (t && t.href && blocked.test(t.href)) {
              e.preventDefault(); e.stopImmediatePropagation();
              console.log('🚫 Blocked redirect:', t.href);
            }
          }, true);

          // 🧠 Remove dynamically inserted ad links
          new MutationObserver(mutations => {
            mutations.forEach(m => m.addedNodes.forEach(n => {
              if (n.nodeType === 1) {
                n.querySelectorAll('a[href]').forEach(a => {
                  if (blocked.test(a.href)) a.removeAttribute('href');
                });
              }
            }));
          }).observe(document.documentElement, { childList: true, subtree: true });

          // 🧱 Safe tap overlay (convert accidental ad clicks into pause/play)
          const createSafeOverlay = () => {
            let overlay = document.getElementById('safeTapOverlay');
            if (!overlay) {
              overlay = document.createElement('div');
              overlay.id = 'safeTapOverlay';
              Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '999999',
                background: 'transparent',
                cursor: 'pointer'
              });
              overlay.addEventListener('click', () => {
                const v = document.querySelector('video');
                if (v) {
                  if (v.paused) v.play();
                  else v.pause();
                }
              });
              document.body.appendChild(overlay);
            }
          };

          // 🎥 Keep player fullscreen and restore if replaced
          const restorePlayer = () => {
            const validSelectors = ['iframe', 'video', '#player', '.player'];
            let player = document.querySelector(validSelectors.join(','));
            if (!player) {
              console.log('🎬 Restoring player...');
              const iframes = document.querySelectorAll('iframe');
              for (const frame of iframes) {
                if (!blocked.test(frame.src)) {
                  frame.style = 'width:100vw;height:100vh;position:fixed;top:0;left:0;z-index:9999;border:none;';
                  document.body.innerHTML = '';
                  document.body.appendChild(frame);
                  createSafeOverlay();
                  return;
                }
              }
            } else {
              Object.assign(player.style, {
                width: '100vw',
                height: '100vh',
                position: 'fixed',
                top: '0',
                left: '0',
                zIndex: '9999'
              });
              createSafeOverlay();
            }
          };

          new MutationObserver(() => restorePlayer())
            .observe(document.body, { childList: true, subtree: true });
          window.addEventListener('load', restorePlayer);

          // 🧹 Prevent JS redirects (location.replace/assign)
          const stopRedirects = () => {
            ['assign','replace'].forEach(fn => {
              try {
                const orig = window.location[fn].bind(window.location);
                window.location[fn] = (url) => {
                  if (url && blocked.test(url)) {
                    console.log('🚫 Blocked JS redirect:', url);
                    return;
                  }
                  return orig(url);
                };
              } catch {}
            });
          };
          stopRedirects();
        })();
      </script>
      <style>
        html,body {
          margin:0; padding:0; background:#000; overflow:hidden; height:100vh;
        }
        iframe, video, #player, .player {
          width:100vw !important;
          height:100vh !important;
          border:none !important;
          display:block !important;
        }
      </style>
    `;
    html = html.replace(/<\/body>/i, \`\${injection}</body>\`);

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
