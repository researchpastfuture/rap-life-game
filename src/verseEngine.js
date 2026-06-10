// ============================================================
// RAP LIFE — verse engine (spec §6).
// Generation prompt (parity reference), §5 schema validation, the
// offline fallback pack, and the client call. Same discipline as
// World Chase's case engine: generate strict JSON, validate hard,
// fall back to handcrafted verses if anything is off.
//
// The Anthropic key NEVER ships to the browser — the live writer is
// api/generate-verse.js. This module only asks and verifies.
// ============================================================

import { LANES, PHRASE_BEATS, STAGES } from "./data.js";

export const VERSE_ENDPOINT = "/api/generate-verse";

// Same-lane hits closer than this are unplayable; the prompt asks for ~0.45s
// spacing per the spec, but we validate against a tolerant floor so musical
// syncopation (and the handcrafted pack) isn't rejected.
const MIN_SAME_LANE_GAP = 0.16; // seconds

// ---------- Generation prompt (kept client-side for reference/parity; the
// live writer lives in api/generate-verse.js so the key never ships). ----------
export function buildVersePrompt(stage, junior) {
  const reading = junior
    ? "Write at a 7-11 reading level: short, kind, clear words a kid can rap out loud."
    : "Write for ages 12+: a little denser wordplay and internal rhyme, still clean and clear.";
  return `You are the verse-writer for "RAP LIFE: Believe the Beat," a call-and-response rhythm rap game. The mentor "${stage.mentor}" teaches the lesson "${stage.lesson}" at ${stage.bpm} BPM over a 2-bar (8-beat) groove. Write FOUR short rap phrases the mentor performs and the player raps back.

RULES (mandatory):
- Respond with ONLY valid JSON. No markdown fences, no preamble.
- Output exactly 4 phrases. Each phrase is one rhyming line of 4-7 words in the mentor's voice about the lesson; the four lines should read as one coherent verse.
- Each word is a target {lane, beat, word}; put the word's stressed syllable on its beat.
  - lane is 0-3 (0=BOOM kick, 1=SNAP snare, 2=CLAP, 3=YO! stab). Use all four lanes across the verse so the response is musical.
  - beat is 0 to 7.5 within the 8-beat bar; halves (x.5) allowed for syncopation.
  - keep SAME-lane hits ~0.45s apart at this BPM (human-playable); different lanes may be closer.
- CONTENT (hard): no brand names, no real people, no innuendo, no put-downs — the mentor teases only itself, never the player. Non-violent. "Stay in the now" may appear AT MOST once across all four phrases.
- ${reading}`;
}

// ---------- §5 schema validation ----------
export function validateVerseDetailed(phrases, bpm) {
  const errors = [];
  const spb = 60 / bpm;
  const fail = (m) => errors.push(m);

  if (!Array.isArray(phrases) || phrases.length !== 4) {
    return { ok: false, errors: ["verse must have exactly 4 phrases"] };
  }

  phrases.forEach((p, i) => {
    const at = `phrase[${i}]`;
    if (!p || !Array.isArray(p.targets)) { fail(`${at}: missing targets array`); return; }
    const t = p.targets;
    if (t.length < 3 || t.length > 9) fail(`${at}: needs 3-9 targets (got ${t.length})`);

    const seen = new Set();
    t.forEach((tg, j) => {
      const w = `${at}.target[${j}]`;
      if (!tg || !Number.isInteger(tg.lane) || tg.lane < 0 || tg.lane >= LANES.length)
        fail(`${w}: lane must be an integer 0-${LANES.length - 1}`);
      if (!tg || typeof tg.beat !== "number" || tg.beat < 0 || tg.beat > PHRASE_BEATS - 0.5)
        fail(`${w}: beat must be a number 0-${PHRASE_BEATS - 0.5}`);
      if (!tg || !tg.word || typeof tg.word !== "string")
        fail(`${w}: word must be a non-empty string`);
      const key = `${tg && tg.lane}@${tg && tg.beat}`;
      if (seen.has(key)) fail(`${w}: duplicate lane/beat`);
      seen.add(key);
    });

    // per-lane playability floor
    const byLane = {};
    t.forEach((tg) => {
      if (tg && typeof tg.beat === "number" && Number.isInteger(tg.lane))
        (byLane[tg.lane] = byLane[tg.lane] || []).push(tg.beat);
    });
    Object.entries(byLane).forEach(([lane, beats]) => {
      const s = [...beats].sort((a, b) => a - b);
      for (let k = 1; k < s.length; k++) {
        if ((s[k] - s[k - 1]) * spb < MIN_SAME_LANE_GAP)
          fail(`${at}: lane ${lane} has hits closer than ${Math.round(MIN_SAME_LANE_GAP * 1000)}ms`);
      }
    });
  });

  return { ok: errors.length === 0, errors };
}

export function validateVerse(phrases, bpm) {
  return validateVerseDetailed(phrases, bpm).ok;
}

// Sort each phrase's targets left-to-right so the lyric reads in order.
export function sortVerse(phrases) {
  return phrases.map((p) => ({ ...p, targets: [...p.targets].sort((a, b) => a.beat - b.beat) }));
}

// ---------- Offline fallback pack (spec §6 / §9) ----------
// The handcrafted phrases that ship in data.js ARE the fallback verses.
export function fallbackPhrases(stage) {
  return stage.phrases;
}

// ---------- Client call ----------
// Returns { source: "generated" | "fallback", phrases, error? }.
// Never throws — a flaky/absent writer just yields the handcrafted pack.
export async function generateVerse(stage, opts = {}) {
  const fallback = { source: "fallback", phrases: fallbackPhrases(stage) };
  try {
    const res = await fetch(VERSE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mentor: stage.mentor,
        lesson: stage.lesson,
        bpm: stage.bpm,
        junior: !!opts.junior,
        accessCode: opts.accessCode || "",
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      return { ...fallback, error: e.error || `verse writer HTTP ${res.status}` };
    }
    const data = await res.json();
    const phrases = data && data.phrases;
    const v = validateVerseDetailed(phrases, stage.bpm);
    if (!v.ok) return { ...fallback, error: "validation: " + v.errors.slice(0, 3).join("; ") };
    return { source: "generated", phrases: sortVerse(phrases) };
  } catch (e) {
    return { ...fallback, error: String((e && e.message) || e) };
  }
}
