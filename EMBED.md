# Embedding RAP LIFE on eddieraplife.com

The live build is designed to drop straight into a page on **eddieraplife.com** as an
iframe. Add `?embed=1` to the URL and the game shows a small "🎵 eddieraplife.com ↗"
link-back in the corner and trims its outer padding to fit the frame (spec §10).

## Responsive iframe snippet

Paste this where you want the game (it stays 900×720-ish and scales down on phones):

```html
<div style="position:relative;width:100%;max-width:900px;margin:0 auto;aspect-ratio:9/7;">
  <iframe
    src="https://rap-life-game.vercel.app/?embed=1"
    title="RAP LIFE: Believe the Beat"
    allow="autoplay; fullscreen"
    loading="lazy"
    style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25)">
  </iframe>
</div>
```

## Notes

- **Sound:** browsers require a user gesture before audio starts, so the player taps
  "Start" inside the frame and audio begins then — the `allow="autoplay"` hint just keeps
  the browser from blocking it afterward.
- **Framing is locked to your domain.** `vercel.json` sets
  `Content-Security-Policy: frame-ancestors 'self' https://eddieraplife.com
  https://*.eddieraplife.com https://*.vercel.app`, so only eddieraplife.com (and the
  Vercel previews) can embed it. To allow another site, add its origin to that list and
  redeploy.
- **Link-back:** the title screen and the Eddie guest stage both link to
  `https://eddieraplife.com`, so the game points fans at the catalog (spec §10 cross-promo).
- **WordPress:** if the site is WordPress, use a Custom HTML block (not the visual editor)
  for the snippet, or the iframe tag gets stripped.
