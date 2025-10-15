let currentMirrorIndex = 0;

export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    // Mirror rotation
    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc.to",
      "https://vidapi.xyz",
    ];

    // Rotate mirrors sequentially
    const mirror = mirrors[currentMirrorIndex];
    currentMirrorIndex = (currentMirrorIndex + 1) % mirrors.length;

    const upstream = await fetch(`${mirror}/${path}`, {
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

    let html = await upstream.text();

    // --- Remove known ad scripts & histats ---
    html = html
      .replace(/<script[^>]*histats[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[^>]*histats[^>]*>[\s\S]*?<\/iframe>/gi, "")
      .replace(/<script[^>]*adsbygoogle[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<script[^>]*popunder[^>]*>[\s\S]*?<\/script>/gi, "");

    // --- Inject popup/redirect blocker ---
    const injection = `
      <script>
        // Stop popup layers & redirect hijacks
        (() => {
          const originalOpen = window.open;
          window.open = (...args) => {
            console.log("Blocked popup:", args[0]);
            return null;
          };

          const stopRedirect = () => {
            const forbidden = ["onclick", "onbeforeunload", "onunload"];
            forbidden.forEach(ev => window[ev] = null);
            document.addEventListener("click", e => {
              const t = e.target.closest("a,button");
              if (t && /ads|click|sponsor/i.test(t.href || "")) {
                e.preventDefault();
                console.log("Blocked redirect:", t.href);
              }
            }, true);
          };
          stopRedirect();

          // Disable window.location hijack
          Object.defineProperty(window, 'location', {
            value: window.location,
            writable: false,
          });

          console.log("Ad & popup blocker active ✅");
        })();
      </script>
      <style>
        body { background:#000; margin:0; padding:0; overflow:hidden; }
        iframe, video, .player, #player {
          width:100vw!important;
          height:100vh!important;
          border:0;
        }
      </style>
    `;

    html = html.replace(/<\/body>/i, injection + "</body>");

    // --- Response headers ---
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Security-Policy",
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src *; media-src * data: blob:; object-src 'none';"
    );
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
