// ============================================================
// Pre-render mentor voices with ElevenLabs → public/voices/*.mp3
// Run:  npm run voices            (skips clips that already exist)
//       npm run voices -- --force (regenerate everything)
//
// Reads ELEVENLABS_API_KEY from .env.local (loaded via node --env-file).
// The key is never printed. Output mp3s + manifest.json are committed so
// Vercel ships them; the deployed game plays them on the audio clock and
// falls back to on-device Web Speech when a clip is missing.
// ============================================================
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { ALL_STAGES, NARRATOR_VOICE } from "../src/data.js";

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error("ELEVENLABS_API_KEY is not set. Put it in .env.local, then run:  npm run voices");
  process.exit(1);
}
const FORCE = process.argv.includes("--force");
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const OUT = path.resolve("public/voices");

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const clean = (s) => String(s || "").replace(/[“”"]/g, "").replace(/-\s+/g, "").trim();

async function listVoices() {
  const r = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": KEY } });
  if (!r.ok) throw new Error(`voices list ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).voices || [];
}

async function tts(voiceId, text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  });
  if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return Buffer.from(await r.arrayBuffer());
}

function linesFor(stage) {
  const items = [["intro", clean(stage.introLines.join(" "))]];
  stage.phrases.forEach((p, i) => items.push([`phrase${i}`, clean(p.targets.map((t) => t.word).join(" "))]));
  items.push(["win", clean(stage.win)]);
  items.push(["encourage", "You drifted out of the now. Breathe in, the beat's coming back around."]);
  items.push(["free", "Freestyle! Make it yours, stay in the now!"]);
  return items;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const voices = await listVoices();
  if (!voices.length) throw new Error("No ElevenLabs voices on this account.");
  console.log(`Using ${voices.length} available voices, model ${MODEL}.`);
  const pick = (i) => voices[(i || 0) % voices.length];

  const manifest = {};
  let made = 0, skipped = 0;

  for (const stage of ALL_STAGES) {
    const sl = slug(stage.mentor);
    const v = pick(stage.voice && stage.voice.voiceIndex);
    await mkdir(path.join(OUT, sl), { recursive: true });
    for (const [key, text] of linesFor(stage)) {
      if (!text) continue;
      const rel = `voices/${sl}/${key}.mp3`;
      const abs = path.join(OUT, sl, `${key}.mp3`);
      manifest[`${sl}.${key}`] = "/" + rel;
      if (!FORCE && existsSync(abs)) { skipped++; continue; }
      await writeFile(abs, await tts(v.voice_id, text));
      made++;
      console.log(`  ✓ ${stage.mentor} → ${key}  (${v.name})`);
    }
  }

  const nv = pick(NARRATOR_VOICE.voiceIndex);
  await mkdir(path.join(OUT, "narrator"), { recursive: true });
  for (const [key, text] of [
    ["title", "Rap Life. Believe the beat. Stay in the now!"],
    ["finale", "That's the showcase! Many lessons, one skill. Stay in the now."],
  ]) {
    const rel = `voices/narrator/${key}.mp3`;
    const abs = path.join(OUT, "narrator", `${key}.mp3`);
    manifest[`narrator.${key}`] = "/" + rel;
    if (!FORCE && existsSync(abs)) { skipped++; continue; }
    await writeFile(abs, await tts(nv.voice_id, text));
    made++;
    console.log(`  ✓ narrator → ${key}  (${nv.name})`);
  }

  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${made} generated, ${skipped} skipped. ${Object.keys(manifest).length} clips in manifest.`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
