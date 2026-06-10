// ============================================================
// Serverless verse writer for RAP LIFE: Believe the Beat (spec §6, §11).
// Runs on Vercel. The Anthropic key lives ONLY here. The request body
// carries mentor/lesson/bpm/junior + an optional family access code;
// ZERO player data is ever sent upstream (spec §9 privacy floor).
//
// Pipeline (same discipline as World Chase's case writer):
//   1. draft   — one Claude call producing the verse JSON (strict contract).
//   2. validate — structural + §5 rules (lanes, beats, per-lane gap floor).
//   3. repair  — if malformed, send the problems back for a corrected pass
//                (up to two attempts). On failure the CLIENT falls back to
//                the handcrafted pack, so play never breaks.
//
// Env (RAPLIFE_ prefix, no name drift):
//   RAPLIFE_ANTHROPIC_KEY   (required)  Anthropic API key
//   RAPLIFE_MODEL           (optional)  defaults to claude-sonnet-4-6
//   RAPLIFE_ACCESS_CODES    (optional)  comma-separated family access codes
//                                       (the Aegis family-login gate, spec §11).
// ============================================================

const PHRASE_BEATS = 8;
const LANE_COUNT = 4;
const MIN_SAME_LANE_GAP = 0.16; // seconds

function buildPrompt(mentor, lesson, bpm, junior) {
  const reading = junior
    ? "Write at a 7-11 reading level: short, kind, clear words a kid can rap out loud."
    : "Write for ages 12+: a little denser wordplay and internal rhyme, still clean and clear.";

  return `You are the verse-writer for "RAP LIFE: Believe the Beat," a call-and-response rhythm rap game. The mentor "${mentor}" teaches the lesson "${lesson}" at ${bpm} BPM over a 2-bar (8-beat) groove. Write FOUR short rap phrases the mentor performs and the player raps back.

RULES (mandatory):
- Respond with ONLY valid JSON. No markdown fences, no preamble, no trailing text.
- Output exactly 4 phrases. Each phrase is one rhyming line of 4-7 words in the mentor's voice about the lesson; the four lines should read as one coherent verse.
- Each word is a target {lane, beat, word}; put the word's stressed syllable on its beat.
  - lane is an integer 0-3 (0=BOOM kick, 1=SNAP snare, 2=CLAP, 3=YO! stab). Use all four lanes across the verse so the response is musical.
  - beat is a number 0 to 7.5 within the 8-beat bar; halves (x.5) are allowed for syncopation.
  - keep SAME-lane hits at least ~0.45s apart at this BPM (human-playable); different lanes may be closer.
- CONTENT (hard): no brand names, no real people, no innuendo, no put-downs or insults — the mentor teases only itself, never the player. Non-violent. The phrase "Stay in the now" may appear AT MOST once across all four phrases.
- ${reading}

JSON SCHEMA (match exactly):
{
  "mentor": "${mentor}", "bpm": ${bpm}, "lesson": "${lesson}",
  "phrases": [
    { "targets": [ {"lane": 0, "beat": 0, "word": "Kick"}, {"lane": 1, "beat": 1, "word": "push"} ] }
  ]
}
Return 4 entries in "phrases".`;
}

// ---------- §5 structural + rule validation ----------
function verseProblems(v, bpm) {
  const problems = [];
  const spb = 60 / bpm;
  if (!v || typeof v !== "object") return ["response was not a JSON object"];
  if (!Array.isArray(v.phrases) || v.phrases.length !== 4)
    problems.push("phrases must have exactly 4 entries");
  if (Array.isArray(v.phrases)) {
    v.phrases.forEach((p, i) => {
      const at = `phrase[${i}]`;
      if (!p || !Array.isArray(p.targets)) { problems.push(`${at}: missing targets array`); return; }
      const t = p.targets;
      if (t.length < 3 || t.length > 9) problems.push(`${at}: needs 3-9 targets`);
      const seen = new Set();
      t.forEach((tg, j) => {
        const w = `${at}.target[${j}]`;
        if (!tg || !Number.isInteger(tg.lane) || tg.lane < 0 || tg.lane >= LANE_COUNT)
          problems.push(`${w}: lane must be an integer 0-${LANE_COUNT - 1}`);
        if (!tg || typeof tg.beat !== "number" || tg.beat < 0 || tg.beat > PHRASE_BEATS - 0.5)
          problems.push(`${w}: beat must be 0-${PHRASE_BEATS - 0.5}`);
        if (!tg || !tg.word || typeof tg.word !== "string")
          problems.push(`${w}: word must be a non-empty string`);
        const key = `${tg && tg.lane}@${tg && tg.beat}`;
        if (seen.has(key)) problems.push(`${w}: duplicate lane/beat`);
        seen.add(key);
      });
      const byLane = {};
      t.forEach((tg) => {
        if (tg && typeof tg.beat === "number" && Number.isInteger(tg.lane))
          (byLane[tg.lane] = byLane[tg.lane] || []).push(tg.beat);
      });
      Object.entries(byLane).forEach(([lane, beats]) => {
        const s = [...beats].sort((a, b) => a - b);
        for (let k = 1; k < s.length; k++) {
          if ((s[k] - s[k - 1]) * spb < MIN_SAME_LANE_GAP)
            problems.push(`${at}: lane ${lane} has hits closer than ${Math.round(MIN_SAME_LANE_GAP * 1000)}ms apart`);
        }
      });
    });
  }
  return problems;
}

function extractJson(text) {
  const clean = String(text).replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  return JSON.parse(slice);
}

async function callAnthropic(prompt, model, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function repairPrompt(draftText, problems) {
  return `The following verse JSON for "RAP LIFE" has problems that must be fixed:
${problems.map((p) => `- ${p}`).join("\n")}

Return a corrected version as JSON ONLY (no markdown, no commentary). Keep whatever is already valid; fix only what is listed and anything required to keep the schema consistent (exactly 4 phrases; every target has integer lane 0-3, a numeric beat 0-7.5, and a word; same-lane hits stay ~0.45s apart).

CURRENT DRAFT:
${draftText}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const apiKey = process.env.RAPLIFE_ANTHROPIC_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Verse writer not configured (RAPLIFE_ANTHROPIC_KEY unset)" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  // Family-login gate (Aegis pattern, spec §11). Open if no codes configured.
  const codes = (process.env.RAPLIFE_ACCESS_CODES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (codes.length) {
    const supplied = String(body.accessCode || "").trim();
    if (!codes.includes(supplied)) {
      res.status(401).json({ error: "Valid family access code required." });
      return;
    }
  }

  const model = process.env.RAPLIFE_MODEL || "claude-sonnet-4-6";
  const mentor = String(body.mentor || "the mentor").slice(0, 80);
  const lesson = String(body.lesson || "staying present").slice(0, 120);
  const bpm = Number(body.bpm) || 90;
  const junior = !!body.junior;

  const prompt = buildPrompt(mentor, lesson, bpm, junior);

  try {
    // Pass 1: draft.
    let draftText = await callAnthropic(prompt, model, apiKey);
    let parsed;
    try { parsed = extractJson(draftText); } catch { parsed = null; }
    let problems = parsed ? verseProblems(parsed, bpm) : ["draft did not parse as JSON"];

    // Pass 2: repair (up to two attempts).
    let attempts = 0;
    while (problems.length && attempts < 2) {
      attempts += 1;
      draftText = await callAnthropic(repairPrompt(draftText, problems), model, apiKey);
      try { parsed = extractJson(draftText); } catch { parsed = null; }
      problems = parsed ? verseProblems(parsed, bpm) : ["repair did not parse as JSON"];
    }

    if (!parsed || problems.length) {
      res.status(502).json({ error: "Verse writer could not produce a valid verse", problems });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(parsed);
  } catch (e) {
    res.status(502).json({ error: String(e && e.message) });
  }
}
