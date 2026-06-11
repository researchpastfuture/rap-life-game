# RAP LIFE: Believe the Beat — v1.0

**▶ Live: https://rap-life-game.vercel.app** · embeddable on eddieraplife.com (see
[EMBED.md](EMBED.md))

A call-and-response rhythm rap game in the PaRappa lineage, rebuilt with original IP,
transparent timing, and a thesis: **rhythm games are mindfulness machines.** Scout the
raccoon learns life lessons from three mentors by rapping them back on beat. The mantra —
**"Stay in the now!"** — is the whole game.

> Born Between Generals, LLC · Original IP throughout. No Sony / NanaOn-Sha / Greenblat
> assets used or referenced.

## Run it

```powershell
cd C:\Users\Kristen\rap-life-game
npm install
npm run dev
```

Vite opens `http://localhost:5173`. **Turn sound on** — all audio is synthesized in your
browser (Tone.js); nothing streams and nothing is stored.

## How to play

A mentor raps a line; notes slide left toward the **hit-line**. When a note crosses it,
hit its lane — **A / S / D / F** (or tap the pads). Every press is judged
**PERFECT (±120ms) / GOOD (±250ms) / MISS** on the audio clock. Chain hits for a combo
multiplier (up to ×4). Each stage ends with a **freestyle bar** — hit any pad on the
travelling pulse. Clear a season's three mentors for Scout's finale showcase.

**Six mentors across two seasons**, plus a bonus **Eddie Rap Life guest stage** and a
**Creator mode** — all from the 🎚 Choose a mentor roster. After any stage, hit
**▶ Watch your run** to replay exactly how you played it.

## What's better than the v0.1 prototype

| v0.1 | v0.2 (this build) |
|---|---|
| Static icons + a sweeping playhead | **Scrolling note highway** — notes *approach* the hit-line, so timing is learnable, not guessed |
| Bare hits over a count-in | **Backing groove** per mentor (kick/snare/hat/bass) scheduled on the audio clock — your response is musical |
| Flat scoring | **Combo + multiplier** (×1→×4), best-combo tracking, juicier flow meter |
| Fixed difficulty | **Adaptive tempo** — eases 6% after two rough phrases, recovers when you lock back in |
| Keyboard/touch only | **One-button mode** (all notes → one lane) and **No-fail (Junior) mode** |
| No timing fix for input lag | **Latency calibration** — tap-along test computes your personal offset, applied to every judgment |
| Fixed six lines forever | **Generative verse engine** — a mentor can write you a brand-new verse on demand (single Claude call, strict JSON, validated, handcrafted fallback) |
| Per-phrase groove with gaps | **Continuous `Tone.Transport` groove** — a seamless bed across the whole stage; phrase starts bar-align to it so notes and beat lock |
| Three mentors | **Six mentors / two seasons** + an **Eddie Rap Life guest stage** + a mentor roster |
| Watch, don't review | **Replay viewer** — re-performs your run on the audio clock; tiles colored by grade, dots where you actually tapped |
| Consume only | **Creator mode** — write your own lines, the engine sets them on the grid, you rap them ("be on the screen, don't just watch it") |
| Single in-canvas file | Real Vite project; **fully offline** (no CDNs, system fonts only) |

## Generative verse engine (spec §6)

From any mentor's intro screen, hit **🎲 Fresh verse** and the mentor writes a new
four-phrase verse on demand. Same discipline as World Chase's case writer:

1. **Serverless writer** (`api/generate-verse.js`) makes one Claude call with a strict
   JSON-only contract. The Anthropic key lives only on the server — the browser never
   sees it, and zero player data is ever sent upstream.
2. **Validation** (`src/verseEngine.js`) checks the §5 schema client-side: exactly 4
   phrases, integer lanes 0-3, beats within the 8-beat bar, no duplicate hits, and a
   per-lane playability floor.
3. **Repair + fallback** — the writer self-corrects up to twice; if anything is still off
   (or the writer isn't configured), the game silently rents the **handcrafted pack**, so
   play never breaks. Under plain `npm run dev` there's no server, so you'll see
   "verse writer offline" and the handcrafted verse — that's the fallback working.

To actually generate (locally):

```powershell
npm i -g vercel          # once
copy .env.example .env.local   # then put your key in RAPLIFE_ANTHROPIC_KEY
vercel dev               # serves the app + /api/generate-verse together
```

Env vars (server-only, `RAPLIFE_` prefix): `RAPLIFE_ANTHROPIC_KEY` (required),
`RAPLIFE_MODEL` (defaults `claude-sonnet-4-6`), `RAPLIFE_ACCESS_CODES` (optional family
login gate — the Aegis pattern).

## Architecture notes (per the master spec)

- **Design law:** judgment uses the *audio* clock (`Tone.now()`); visuals chase audio,
  never the reverse. The note highway position is computed each frame from the audio time.
- **Privacy by design:** no accounts, no telemetry, no third-party SDKs, no network calls.
  Scores live in memory for the session only.
- **Tone:** non-violent, no put-downs. Failure text is direction: *"You drifted out of the
  now. Breathe in — the beat's coming back around."*

## Roadmap (from the spec)

- **v0.2 done:** scrolling highway, backing groove, combo/multiplier, adaptive tempo,
  one-button + no-fail modes, latency calibration, generative verse engine.
- **v0.3 done:** continuous `Tone.Transport` groove, Season 2 mentors, Eddie Rap Life
  guest stage (placeholder bars), replay viewer, creator mode.
- **v1.0 done:** deployed to Vercel with GitHub auto-deploy; mobile-responsive highway +
  haptics (`navigator.vibrate`); opt-in local personal bests (off by default — privacy
  floor); eddieraplife.com embed mode (`?embed=1`) with catalog link-back and a
  domain-locked frame-ancestors CSP.
- **Voices + animation:** every mentor has a distinct **spoken voice** that talks the
  intro, raps each line as the notes scroll, hypes the freestyle, and reacts on the rating
  screen; talking/bobbing mentor avatars, drifting note backdrops, card entrances, a
  wobbling logo, and rating sticker-bursts throughout. Both have Settings toggles and
  respect `prefers-reduced-motion`.

### Studio voices (ElevenLabs, optional)

By default voices use the browser's on-device Web Speech (zero assets, offline). For
studio-quality character voices, pre-render them with ElevenLabs:

```powershell
# 1. put ELEVENLABS_API_KEY in .env.local (git-ignored)
npm run voices            # generates public/voices/*.mp3 + manifest.json (commit them)
npm run voices -- --force # regenerate everything
```

The game loads `/voices/manifest.json` at startup and plays the matching clip **on the
audio clock** (so the mentor raps on the bar), layered over the synth. Anything missing —
generated verses, creator-mode lines, or no manifest at all — falls back to Web Speech.
The key stays in `.env.local`; only the generated mp3s are committed.
- **Still blocked on you:** replace Eddie's placeholder bars with the real licensed track
  (needs the signed Rap Royalty Life agreement); enable live verse generation by setting
  `RAPLIFE_ANTHROPIC_KEY` in Vercel; optionally turn on the `RAPLIFE_ACCESS_CODES` family
  gate.

## File map

```
api/
  generate-verse.js   serverless Claude verse writer (key stays server-side)
src/
  data.js       lanes, 6 mentors + Eddie guest, phrases, seasons, rating thresholds
  audio.js      Tone.js engine — synths + continuous Transport groove, all on the audio clock
  verseEngine.js  prompt parity, §5 validation, fallback pack, client call
  RapLife.jsx   game loop + screens (title, roster, settings, calibrate, creator,
                intro, play, rating, finale, replay), note highway, scoring
  styles.css    flat marker-and-sticker look, offline (system fonts)
```
