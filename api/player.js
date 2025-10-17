export default async function handler(req, res) {
  try {
    const target = req.query.url;
    if (!target) return res.status(400).send("Missing ?url= parameter");

    const blockedDomains = [
      "googlesyndication.com",
      "doubleclick.net",
      "adnxs.com",
      "taboola.com",
      "popads.net",
      "exoclick.com",
      "adsterra.com",
      "propellerads.com",
      "shopeeph://",
      "intent://"
    ];

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1.0" />
        <title>NXB Secure Player</title>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            background: #000;
            width: 100%;
            height: 100%;
            overflow: hidden;
          }
          iframe {
            width: 100vw;
            height: 100vh;
            border: none;
          }
          #toastProtect {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 128, 0, 0.8);
            color: #fff;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 100000;
            opacity: 0;
            transition: opacity .3s;
          }
        </style>
      </head>
      <body>
        <iframe id="player" src="${target}" allowfullscreen></iframe>
        <div id="toastProtect"></div>

        <script>
          const showToast = msg => {
            const toast = document.getElementById("toastProtect");
            toast.textContent = msg;
            toast.style.opacity = "1";
            clearTimeout(toast._hide);
            toast._hide = setTimeout(() => toast.style.opacity = "0", 2500);
          };

          // --- AdGuard DNS fallback ---
          async function dnsCheck(hostname) {
            try {
              const url = \`https://dns.adguard.com/dns-query?name=\${hostname}&type=A\`;
              const res = await fetch(url, { headers: { "Accept": "application/dns-json" } });
              const data = await res.json();
              if (data && data.Status !== 0) console.warn("🚫 DNS AdGuard blocked:", hostname);
              return data;
            } catch (err) {
              console.error("DNS query failed:", err);
            }
          }

          // --- MutationObserver for ads ---
          const blocked = ${JSON.stringify(blockedDomains)};
          const observer = new MutationObserver(() => {
            document.querySelectorAll("iframe,script,link,img").forEach(el => {
              const src = el.src || el.href;
              if (src && blocked.some(b => src.includes(b))) {
                el.remove();
                showToast("Blocked ad: " + new URL(src).hostname);
                dnsCheck(new URL(src).hostname);
              }
            });
          });
          observer.observe(document.body, { childList: true, subtree: true });

          // --- Popup and redirect prevention ---
          (function() {
            const open = window.open;
            window.open = function(...args) {
              const u = args[0] || "";
              if (blocked.some(b => u.includes(b))) {
                showToast("Popup blocked");
                console.warn("🚫 Popup blocked:", u);
                return null;
              }
              return open.apply(this, args);
            };
            const assign = window.location.assign;
            window.location.assign = function(url) {
              if (blocked.some(b => url.includes(b))) {
                showToast("Redirect blocked");
                console.warn("🚫 Redirect blocked:", url);
                return;
              }
              assign.call(window.location, url);
            };
          })();

          // --- Click protection ---
          document.addEventListener("click", e => {
            const a = e.target.closest("a");
            if (!a) return;
            const href = a.getAttribute("href");
            if (!href) return;
            if (href.startsWith("intent://") || href.startsWith("shopeeph://")) {
              e.preventDefault();
              e.stopPropagation();
              showToast("Blocked app deep link");
              console.warn("🚫 Deep link blocked:", href);
            }
          }, true);
        </script>
      </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
}
