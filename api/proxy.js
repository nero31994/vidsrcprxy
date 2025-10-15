export default async function handler(req, res) {
  try {
    const path = req.url.replace(/^\/api\/proxy\//, "") || "";

    const mirrors = [
      "https://vidsrc-embed.ru",
      "https://vidsrc-embed.su",
      "https://vidsrc.to",
    ];

    const mirror = mirrors[Math.floor(Date.now() / 1000) % mirrors.length];
    const upstream = await fetch(`${mirror}/${path}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127 Safari/537.36",
        "Referer": mirror,
        "Origin": mirror,
      },
    });

    let html = await upstream.text();

    // Remove ad-related & obfuscated popup scripts before they run
    html = html
      .replace(/<script[^>]+src="[^"]*(ads|pop|histats)[^"]*"[^>]*><\/script>/gi, "")
      .replace(/<script[^>]*>([\s\S]*?(popup|window\.open|atob|click|redirect)[\s\S]*?)<\/script>/gi, "")
      .replace(/window\.open\s*=\s*function.*?;/gi, "")
      .replace(/on(click|load|beforeunload)\s*=\s*["'][^"']*["']/gi, "");

    // Harden against any later injected scripts
    const injection = `
      <script>
        (() => {
          // Disable future popups and redirects
          const originalOpen = window.open;
          window.open = () => null;
          document.addEventListener('click', e => {
            const a = e.target.closest('a');
            if (a && /ads|click|sponsor|shoppee|redirect/i.test(a.href)) {
              e.preventDefault();
              console.log('Popup link blocked:', a.href);
            }
          }, true);

          new MutationObserver(() => {
            document.querySelectorAll('script').forEach(s=>{
              if(/popup|redirect|atob|shoppee/i.test(s.innerHTML)){
                s.remove();
                console.log('Removed ad script');
              }
            });
          }).observe(document.documentElement,{subtree:true,childList:true});
        })();
      </script>
      <style>
        html,body{margin:0;padding:0;background:#000;overflow:hidden;}
        iframe,video,#player,.player{width:100vw!important;height:100vh!important;border:none!important;}
      </style>
    `;
    html = html.replace(/<\/body>/i, `${injection}</body>`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Security-Policy",
      "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-src *; media-src * data: blob:;"
    );
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
