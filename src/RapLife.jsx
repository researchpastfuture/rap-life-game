import React, { useState, useRef, useEffect, useCallback } from "react";
import { createEngine } from "./audio.js";
import { generateVerse } from "./verseEngine.js";
import { loadBests, saveBests as persistBests, clearBests, bestRating } from "./bests.js";
import {
  LANES, ALL_STAGES, SEASONS, EDDIE_INDEX, PHRASE_BEATS, EDDIE_URL,
  PERFECT_WIN, GOOD_WIN, FREESTYLE_WIN,
  cream, ink, navy, red, green, gold,
  ratingFor, ratingColor,
} from "./data.js";

const EMBED = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("embed") === "1";

// ============================================================
// RAP LIFE: BELIEVE THE BEAT — v0.3
// Scout & the mentors. Original IP, offline, audio-clock judged.
// v0.2: scrolling highway, backing groove, combo/multiplier,
//       adaptive tempo, one-button + no-fail, calibration, verse engine.
// v0.3: continuous Transport groove, Season 2 mentors, Eddie guest
//       stage, replay viewer ("watch your run"), creator mode.
// ============================================================

const HIT_X = 24; // hit-line position, % from left
const LEAD = 1.9; // seconds a note is visible before its hit
const CUSTOM = -1; // sentinel stage index for creator-mode verses

const DEFAULT_SETTINGS = {
  oneButton: false,
  noFail: false,
  adaptive: true,
  haptics: true,
  saveBests: false, // OFF by default — privacy floor; opt-in only
  calibrationOffset: 0,
};

export default function RapLife() {
  const [screen, setScreen] = useState("title"); // title|roster|settings|calibrate|creator|intro|play|rating|finale|replay
  const [stageIdx, setStageIdx] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle|call|response|freestyle
  const [flow, setFlow] = useState(70);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [judgment, setJudgment] = useState(null);
  const [targetStates, setTargetStates] = useState([]);
  const [freestyleHits, setFreestyleHits] = useState(0);
  const [stageStats, setStageStats] = useState({ perfect: 0, good: 0, miss: 0 });
  const [ratings, setRatings] = useState([]);
  const [audioNow, setAudioNow] = useState(0);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tempoScale, setTempoScale] = useState(1);
  const [laneFlash, setLaneFlash] = useState([0, 0, 0, 0]);
  const [verseStatus, setVerseStatus] = useState("idle");
  const [verseErr, setVerseErr] = useState(null);
  const [bests, setBests] = useState({}); // opt-in personal bests, keyed by mentor
  const [isPB, setIsPB] = useState(false);
  const bestsRef = useRef({});

  // ---- refs: the audio-clock world ----
  const eng = useRef(null);
  if (!eng.current) eng.current = createEngine();
  const phaseRef = useRef("idle");
  const contentStartRef = useRef(0);
  const endTimeRef = useRef(0);
  const spbRef = useRef(60 / 84);
  const targetsRef = useRef([]);
  const rafRef = useRef(null);
  const stageIdxRef = useRef(0);
  const phraseIdxRef = useRef(0);
  const fsHitTimesRef = useRef([]);
  const advancingRef = useRef(false);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const tempoScaleRef = useRef(1);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const failStreakRef = useRef(0);
  const laneFlashRef = useRef([0, 0, 0, 0]);

  // generated verses + creator stage
  const versesRef = useRef({});
  const customStageRef = useRef(null); // { stage, phrases }
  const getStage = (idx) => (idx === CUSTOM ? (customStageRef.current && customStageRef.current.stage) : ALL_STAGES[idx]);
  const phrasesFor = (idx) =>
    idx === CUSTOM ? (customStageRef.current && customStageRef.current.phrases)
      : (versesRef.current[idx] || ALL_STAGES[idx].phrases);

  // recording for the replay viewer
  const recordRef = useRef({ stageIdx: 0, items: [] });
  const recCurRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  // load saved bests on mount only if the player has opted in
  useEffect(() => {
    if (settingsRef.current.saveBests) { const b = loadBests(); bestsRef.current = b; setBests(b); }
  }, []);

  const toggleSaveBests = () => {
    setSettings((s) => {
      const on = !s.saveBests;
      if (on) { const b = loadBests(); bestsRef.current = b; setBests(b); }
      else { clearBests(); bestsRef.current = {}; setBests({}); }
      return { ...s, saveBests: on };
    });
  };

  // ---------- helpers ----------
  const effBpm = () => getStage(stageIdxRef.current).bpm * tempoScaleRef.current;

  const mapTargets = (targets) =>
    targets.map((t) => ({ ...t, lane: settingsRef.current.oneButton ? 0 : t.lane, hit: null }));

  const activeLanes = () => (settings.oneButton ? [LANES[0]] : LANES);

  const flashLane = (lane) => {
    const t = eng.current.now();
    laneFlashRef.current[lane] = t;
    setLaneFlash((arr) => { const c = [...arr]; c[lane] = t; return c; });
  };
  const flashJudgment = (text, color) => setJudgment({ text, color, key: Math.random() });
  const buzz = (pattern) => {
    if (settingsRef.current.haptics && typeof navigator !== "undefined" && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  };

  const bumpCombo = () => {
    const c = comboRef.current + 1;
    comboRef.current = c;
    if (c > maxComboRef.current) maxComboRef.current = c;
    setCombo(c);
    setMaxCombo((m) => Math.max(m, c));
    return c;
  };
  const breakCombo = () => { comboRef.current = 0; setCombo(0); };
  const multiplier = (c) => Math.min(4, 1 + Math.floor(c / 8) * 0.5);

  // ---------- phrase engine ----------
  const startPhrase = (kind) => {
    const stage = getStage(stageIdxRef.current);
    const spb = 60 / effBpm();
    spbRef.current = spb;
    advancingRef.current = false;
    eng.current.setGrooveBpm(effBpm());

    // align content to the next groove bar so the bed and the notes lock
    const contentStart = eng.current.nextBar(spb, 4 * spb + 0.2);
    contentStartRef.current = contentStart;

    // 4-click count-in in the bar before content
    for (let i = 0; i < 4; i++) eng.current.click(contentStart - (4 - i) * spb, i === 3);

    let maxBeat = PHRASE_BEATS - 1;

    if (kind === "call" || kind === "response") {
      const targets = mapTargets(phrasesFor(stageIdxRef.current)[phraseIdxRef.current].targets);
      targetsRef.current = targets;
      maxBeat = targets.reduce((m, t) => Math.max(m, t.beat), 0);
      if (kind === "call") {
        targets.forEach((tg) => eng.current.playLane(tg.lane, contentStart + tg.beat * spb, true));
      } else {
        setTargetStates(targets.map(() => "pending"));
        // open a fresh recording item for this phrase
        recCurRef.current = {
          kind: "response",
          targets: targets.map((t) => ({ lane: t.lane, beat: t.beat, word: t.word, grade: null })),
          hits: [], maxBeat,
        };
        recordRef.current.items.push(recCurRef.current);
      }
    } else if (kind === "freestyle") {
      targetsRef.current = [];
      fsHitTimesRef.current = [];
      setFreestyleHits(0);
      maxBeat = PHRASE_BEATS;
      for (let b = 0; b < PHRASE_BEATS; b++) eng.current.gridClick(contentStart + b * spb);
      recCurRef.current = { kind: "freestyle", targets: [], hits: [], maxBeat: PHRASE_BEATS };
      recordRef.current.items.push(recCurRef.current);
    }

    const tail = kind === "call" ? 1.0 : kind === "freestyle" ? 0.3 : 0.55;
    endTimeRef.current = contentStart + (kind === "freestyle" ? PHRASE_BEATS : maxBeat) * spb + tail;

    setPhase(kind);
    phaseRef.current = kind;

    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const t = eng.current.now();
      setAudioNow(t);
      if (t >= endTimeRef.current) { endPhrase(kind); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const endPhrase = (kind) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    cancelAnimationFrame(rafRef.current);

    if (kind === "call") { startPhrase("response"); return; }

    if (kind === "response") {
      let misses = 0;
      const states = targetsRef.current.map((t) => (t.hit ? t.hit : "miss"));
      targetsRef.current.forEach((t) => { if (!t.hit) misses++; });
      setTargetStates(states);
      // stamp grades into the recording
      if (recCurRef.current) {
        recCurRef.current.targets.forEach((rt, i) => { rt.grade = targetsRef.current[i] ? (targetsRef.current[i].hit || "miss") : "miss"; });
      }
      if (misses > 0) {
        breakCombo();
        setFlow((f) => Math.max(0, f - 6 * misses));
        setStageStats((s) => ({ ...s, miss: s.miss + misses }));
      }

      if (settingsRef.current.adaptive) {
        const total = targetsRef.current.length || 1;
        const got = targetsRef.current.filter((t) => t.hit).length;
        const acc = got / total;
        if (acc < 0.5) {
          failStreakRef.current += 1;
          if (failStreakRef.current >= 2) {
            tempoScaleRef.current = Math.max(0.7, tempoScaleRef.current - 0.06);
            setTempoScale(tempoScaleRef.current);
            failStreakRef.current = 0;
          }
        } else {
          failStreakRef.current = 0;
          if (tempoScaleRef.current < 1) {
            tempoScaleRef.current = Math.min(1, tempoScaleRef.current + 0.06);
            setTempoScale(tempoScaleRef.current);
          }
        }
      }

      const nextPhrase = phraseIdxRef.current + 1;
      if (nextPhrase < phrasesFor(stageIdxRef.current).length) {
        setPhraseIdx(nextPhrase);
        phraseIdxRef.current = nextPhrase;
        setTimeout(() => startPhrase("call"), 350);
      } else {
        setTimeout(() => startPhrase("freestyle"), 350);
      }
      return;
    }

    if (kind === "freestyle") {
      setPhase("idle");
      phaseRef.current = "idle";
      eng.current.stopGroove();
      setTimeout(() => finishStage(), 450);
    }
  };

  const finishStage = () => {
    setStageStats((stats) => {
      const stage = getStage(stageIdxRef.current);
      const totalTargets = phrasesFor(stageIdxRef.current).reduce((a, p) => a + p.targets.length, 0);
      const acc = totalTargets ? (stats.perfect + stats.good * 0.5) / totalTargets : 0;
      const rating = ratingFor(acc);
      const accPct = Math.round(acc * 100);
      setRatings((r) => [
        ...r,
        { mentor: stage.mentor, emoji: stage.emoji, rating, accuracy: accPct, maxCombo: maxComboRef.current },
      ]);

      // opt-in personal bests (local only)
      let pb = false;
      if (settingsRef.current.saveBests && stageIdxRef.current !== CUSTOM) {
        const prev = bestsRef.current[stage.mentor];
        if (!prev || accPct > prev.accuracy) pb = true;
        const merged = {
          accuracy: Math.max(prev ? prev.accuracy : 0, accPct),
          rating: bestRating(prev ? prev.rating : null, rating),
          maxCombo: Math.max(prev ? prev.maxCombo || 0 : 0, maxComboRef.current),
        };
        const nb = { ...bestsRef.current, [stage.mentor]: merged };
        bestsRef.current = nb; setBests(nb); persistBests(nb);
      }
      setIsPB(pb);
      setScreen("rating");
      return stats;
    });
  };

  // ---------- input ----------
  const hitLane = (rawLane) => {
    const ph = phaseRef.current;
    if (ph !== "response" && ph !== "freestyle") return;
    const lane = settingsRef.current.oneButton ? 0 : rawLane;
    flashLane(lane);
    eng.current.playLane(lane, null, false);

    const tNow = eng.current.now() - contentStartRef.current - settingsRef.current.calibrationOffset;

    if (ph === "response") {
      let bestIdx = -1, bestDiff = Infinity;
      targetsRef.current.forEach((t, i) => {
        if (t.hit || t.lane !== lane) return;
        const diff = Math.abs(t.beat * spbRef.current - tNow);
        if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
      });
      if (bestIdx >= 0 && bestDiff <= GOOD_WIN) {
        const grade = bestDiff <= PERFECT_WIN ? "perfect" : "good";
        targetsRef.current[bestIdx].hit = grade;
        setTargetStates((s) => { const c = [...s]; c[bestIdx] = grade; return c; });
        const c = bumpCombo();
        const mult = multiplier(c);
        if (grade === "perfect") {
          setScore((x) => x + Math.round(100 * mult));
          setFlow((f) => Math.min(100, f + 4));
          setStageStats((s) => ({ ...s, perfect: s.perfect + 1 }));
          flashJudgment("PERFECT", green);
          buzz(18);
        } else {
          setScore((x) => x + Math.round(50 * mult));
          setFlow((f) => Math.min(100, f + 2));
          setStageStats((s) => ({ ...s, good: s.good + 1 }));
          flashJudgment("GOOD", gold);
          buzz(11);
        }
        if (recCurRef.current) recCurRef.current.hits.push({ lane, t: tNow, grade });
      } else {
        breakCombo();
        flashJudgment("MISS", red);
        buzz([8, 26, 8]);
        setFlow((f) => Math.max(0, f - 6));
        setStageStats((s) => ({ ...s, miss: s.miss + 1 }));
        if (recCurRef.current) recCurRef.current.hits.push({ lane, t: tNow, grade: "miss" });
      }
    } else if (ph === "freestyle") {
      if (tNow < -0.1 || tNow > PHRASE_BEATS * spbRef.current + 0.1) return;
      const grid = spbRef.current / 2;
      const nearest = Math.round(tNow / grid) * grid;
      if (Math.abs(tNow - nearest) <= FREESTYLE_WIN) {
        if (!fsHitTimesRef.current.some((g) => Math.abs(g - nearest) < grid / 2)) {
          fsHitTimesRef.current.push(nearest);
          const c = bumpCombo();
          setScore((x) => x + Math.round(50 * multiplier(c)));
          setFreestyleHits((h) => h + 1);
          flashJudgment("FREESTYLE!", navy);
          buzz(13);
          if (recCurRef.current) recCurRef.current.hits.push({ lane, t: tNow, grade: "free" });
        }
      }
    }
  };

  useEffect(() => {
    const handler = (e) => {
      if (e.repeat) return;
      const idx = LANES.findIndex((l) => l.key.toLowerCase() === e.key.toLowerCase());
      if (idx >= 0) { e.preventDefault(); hitLane(idx); }
      else if (e.key === " " && settingsRef.current.oneButton) { e.preventDefault(); hitLane(0); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => () => { cancelAnimationFrame(rafRef.current); eng.current.stopGroove(); }, []);
  useEffect(() => { if (EMBED && typeof document !== "undefined") document.body.classList.add("embed"); }, []);

  // ---------- flow rank ----------
  const flowRank = flow >= 85 ? "BLAZING" : flow >= 60 ? "SOLID" : flow >= 35 ? "SHAKY" : "LOST";
  const flowColor = flow >= 85 ? gold : flow >= 60 ? green : flow >= 35 ? "#B8860B" : red;

  // ---------- navigation ----------
  const beginStage = async (idx) => {
    await eng.current.ensure();
    setStageIdx(idx); stageIdxRef.current = idx;
    setPhraseIdx(0); phraseIdxRef.current = 0;
    setFlow(70);
    setStageStats({ perfect: 0, good: 0, miss: 0 });
    setFreestyleHits(0);
    comboRef.current = 0; maxComboRef.current = 0; setCombo(0); setMaxCombo(0);
    tempoScaleRef.current = 1; setTempoScale(1);
    failStreakRef.current = 0;
    recordRef.current = { stageIdx: idx, items: [] };
    recCurRef.current = null;
    setVerseStatus(versesRef.current[idx] ? "fresh" : "idle");
    setVerseErr(null);
    eng.current.startGroove(getStage(idx).bpm, getStage(idx).bassNote);
    setScreen("intro");
  };

  // fresh run from the roster (resets the cumulative run)
  const startRun = (idx) => { setScore(0); setRatings([]); beginStage(idx); };

  const launchPlay = () => {
    setScreen("play");
    setTimeout(() => startPhrase("call"), 350);
  };

  const quitToMenu = () => {
    cancelAnimationFrame(rafRef.current);
    advancingRef.current = true;
    phaseRef.current = "idle";
    setPhase("idle");
    eng.current.stopGroove();
    setScreen("roster");
  };

  const restartGame = () => {
    setScore(0); setRatings([]); setFreestyleHits(0);
    comboRef.current = 0; maxComboRef.current = 0; setCombo(0); setMaxCombo(0);
    eng.current.stopGroove();
    setScreen("title");
  };

  const rerunStage = (idx) => { setRatings((r) => r.slice(0, -1)); beginStage(idx); };

  // ---------- generative verse engine (spec §6) ----------
  const genVerse = async (idx) => {
    if (idx === CUSTOM || verseStatus === "generating") return;
    setVerseStatus("generating"); setVerseErr(null);
    const result = await generateVerse(ALL_STAGES[idx], { junior: settingsRef.current.noFail });
    if (result.source === "generated") {
      versesRef.current[idx] = result.phrases;
      setVerseStatus("fresh");
    } else {
      delete versesRef.current[idx];
      setVerseStatus("offline");
      setVerseErr(result.error || null);
    }
  };
  const useHandcrafted = (idx) => { delete versesRef.current[idx]; setVerseStatus("idle"); setVerseErr(null); };

  // ---------- creator mode ----------
  const playCustom = (stage, phrases) => {
    customStageRef.current = { stage, phrases };
    setScore(0); setRatings([]);
    beginStage(CUSTOM);
  };

  // =====================================================================
  const ctx = {
    screen, setScreen, stageIdx, phraseIdx, phase, flow, flowRank, flowColor,
    score, combo, maxCombo, multiplier, judgment, targetStates, freestyleHits,
    stageStats, ratings, audioNow, settings, setSettings, tempoScale, laneFlash,
    beginStage, startRun, launchPlay, quitToMenu, restartGame, rerunStage, hitLane, flashLane,
    eng, contentStartRef, spbRef, targetsRef, activeLanes,
    phrasesFor, getStage, verseStatus, verseErr, genVerse, useHandcrafted,
    playCustom, record: recordRef.current, isCustom: stageIdx === CUSTOM,
    bests, isPB, toggleSaveBests,
  };

  const view =
    screen === "title" ? <TitleScreen {...ctx} />
    : screen === "roster" ? <RosterScreen {...ctx} />
    : screen === "settings" ? <SettingsScreen {...ctx} />
    : screen === "calibrate" ? <CalibrateScreen {...ctx} />
    : screen === "creator" ? <CreatorScreen {...ctx} />
    : screen === "intro" ? <IntroScreen {...ctx} />
    : screen === "play" ? <PlayScreen {...ctx} />
    : screen === "rating" ? <RatingScreen {...ctx} />
    : screen === "finale" ? <FinaleScreen {...ctx} />
    : screen === "replay" ? <ReplayScreen {...ctx} />
    : null;

  return (<>{view}<EmbedBar /></>);
}

// ---------------------------------------------------------------------
const Center = ({ bg, children }) => (
  <div className="paper" style={{ minHeight: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: bg }}>
    {children}
  </div>
);
const Card = ({ children, style }) => (
  <div className="sticker" style={{ maxWidth: 640, width: "100%", padding: 32, background: cream, ...style }}>{children}</div>
);
const Btn = ({ onClick, children, bg = red, color = cream, style, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="marker" style={{ padding: "14px 24px", borderRadius: 12, fontSize: 16, background: disabled ? "#C9C2AF" : bg, color, border: `3px solid ${ink}`, boxShadow: `0 5px 0 ${ink}`, ...style }}>{children}</button>
);
const CatalogLink = ({ style }) => (
  <a href={EDDIE_URL} target="_blank" rel="noopener noreferrer" className="marker"
    style={{ display: "inline-block", fontSize: 12, color: red, textDecoration: "none", borderBottom: `2px solid ${red}`, paddingBottom: 1, ...style }}>
    More from Eddie Rap Life ↗
  </a>
);
// Floating link-back shown when the game is embedded on eddieraplife.com.
const EmbedBar = () => (!EMBED ? null : (
  <a href={EDDIE_URL} target="_blank" rel="noopener noreferrer" className="marker"
    style={{ position: "fixed", top: 8, right: 8, zIndex: 50, fontSize: 11, background: cream, color: navy, border: `2px solid ${ink}`, borderRadius: 8, padding: "4px 8px", textDecoration: "none", boxShadow: `0 2px 0 ${ink}` }}>
    🎵 eddieraplife.com ↗
  </a>
));

// ---------------------------------------------------------------------
function TitleScreen({ startRun, setScreen }) {
  return (
    <Center bg={navy}>
      <Card style={{ textAlign: "center" }}>
        <div className="marker" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 3, color: red, marginBottom: 8 }}>
          An Eddie Rap Life × Born Between Generals joint · prototype
        </div>
        <h1 className="marker" style={{ fontSize: 64, lineHeight: 1, margin: 0, color: navy, transform: "rotate(-2deg)" }}>RAP LIFE</h1>
        <div className="serif" style={{ fontSize: 22, color: red, marginBottom: 18 }}>Believe the Beat</div>
        <p style={{ fontSize: 14, color: ink, margin: "0 auto 6px", maxWidth: 470 }}>
          Scout the raccoon wants to rap — but flow isn't talent, it's <b>presence</b>. Six mentors, six life lessons, one rule:
        </p>
        <div className="serif" style={{ fontSize: 24, fontWeight: 700, color: navy, margin: "10px 0 18px" }}>“Stay in the now!”</div>
        <div style={{ background: "#FBF8F0", borderRadius: 10, padding: 14, fontSize: 13, textAlign: "left", color: ink, border: `2px solid #E5DECB`, marginBottom: 18 }}>
          <b>How to play:</b> a mentor raps a line — notes <b>slide toward the hit-line</b> on the left. When a note crosses it, hit its lane:{" "}
          <b>A · S · D · F</b> (or tap the pads). Every press is judged{" "}
          <span style={{ color: green, fontWeight: 700 }}>PERFECT</span> /{" "}
          <span style={{ color: gold, fontWeight: 700 }}>GOOD</span> /{" "}
          <span style={{ color: red, fontWeight: 700 }}>MISS</span>. Chain hits for a combo multiplier. Each stage ends with a <b>freestyle bar</b>. 🔊 Sound on!
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => startRun(0)}>▶ Quick start</Btn>
          <Btn onClick={() => setScreen("roster")} bg={green}>🎚 Choose a mentor</Btn>
          <Btn onClick={() => setScreen("settings")} bg={cream} color={navy}>⚙ Settings</Btn>
        </div>
        <div style={{ marginTop: 16 }}><CatalogLink /></div>
        <div style={{ marginTop: 14, fontSize: 11, color: "#6B6456" }}>
          All sound is made on your device. Nothing you do here is tracked or stored.
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function RosterScreen({ startRun, setScreen, bests }) {
  const Card2 = ({ stage, idx, onClick }) => {
    const best = bests && bests[stage.mentor];
    return (
      <button onClick={onClick} className="sticker" style={{ textAlign: "left", padding: 14, background: cream, display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
        <div style={{ fontSize: 40, width: 52, textAlign: "center" }}>{stage.emoji}</div>
        <div style={{ flex: 1 }}>
          <div className="marker" style={{ fontSize: 16, color: navy }}>{stage.mentor}
            {best && <span className="marker" style={{ fontSize: 11, color: ratingColor(best.rating), marginLeft: 8 }}>★ {best.rating} · {best.accuracy}%</span>}
          </div>
          <div style={{ fontSize: 11, color: red, textTransform: "uppercase", letterSpacing: 1 }}>{stage.lesson} · {stage.bpm} BPM</div>
          <div style={{ fontSize: 12, color: ink, marginTop: 2 }}>{stage.blurb}</div>
        </div>
        <div className="marker" style={{ fontSize: 22, color: green }}>▶</div>
      </button>
    );
  };
  return (
    <Center bg={green}>
      <Card style={{ maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="marker" style={{ fontSize: 28, color: navy, margin: 0 }}>Choose a mentor</h2>
          <button onClick={() => setScreen("title")} style={{ fontSize: 12, background: cream, border: `2px solid ${ink}`, borderRadius: 8, padding: "6px 10px", color: navy }}>← Title</button>
        </div>
        {SEASONS.map((season) => (
          <div key={season.n} style={{ marginTop: 16 }}>
            <div className="marker" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: red, marginBottom: 8 }}>{season.title}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {season.idxs.map((idx) => (
                <Card2 key={idx} stage={ALL_STAGES[idx]} idx={idx} onClick={() => startRun(idx)} />
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 16 }}>
          <div className="marker" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: red, marginBottom: 8 }}>Bonus</div>
          <div style={{ display: "grid", gap: 10 }}>
            <Card2 stage={ALL_STAGES[EDDIE_INDEX]} idx={EDDIE_INDEX} onClick={() => startRun(EDDIE_INDEX)} />
            <button onClick={() => setScreen("creator")} className="sticker" style={{ textAlign: "left", padding: 14, background: "#FBF8F0", display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
              <div style={{ fontSize: 40, width: 52, textAlign: "center" }}>✍️</div>
              <div style={{ flex: 1 }}>
                <div className="marker" style={{ fontSize: 16, color: navy }}>Creator mode</div>
                <div style={{ fontSize: 12, color: ink, marginTop: 2 }}>Write your own verse — the engine sets it on the grid and you rap it.</div>
              </div>
              <div className="marker" style={{ fontSize: 22, color: green }}>▶</div>
            </button>
          </div>
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function SettingsScreen({ settings, setSettings, setScreen, toggleSaveBests }) {
  const Toggle = ({ label, desc, on, onClick }) => (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "center", background: on ? "#EAF2EA" : "#FBF8F0", border: `2px solid ${on ? green : "#E5DECB"}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ width: 46, height: 26, borderRadius: 13, background: on ? green : "#C9C2AF", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: cream, transition: "left 120ms" }} />
      </div>
      <div>
        <div className="marker" style={{ fontSize: 14, color: navy }}>{label}</div>
        <div style={{ fontSize: 12, color: ink }}>{desc}</div>
      </div>
    </button>
  );
  const set = (k) => setSettings((s) => ({ ...s, [k]: !s[k] }));
  return (
    <Center bg={green}>
      <Card>
        <h2 className="marker" style={{ fontSize: 30, color: navy, marginTop: 0 }}>Settings &amp; Access</h2>
        <Toggle label="One-button mode" desc="Every note collapses to one lane — rhythm is the whole game. Full scoring." on={settings.oneButton} onClick={() => set("oneButton")} />
        <Toggle label="No-fail mode (Junior)" desc="LOST never ends a stage. The mentor just re-teaches." on={settings.noFail} onClick={() => set("noFail")} />
        <Toggle label="Adaptive tempo" desc="Eases 6% after two rough phrases, recovers when you lock back in." on={settings.adaptive} onClick={() => set("adaptive")} />
        <Toggle label="Haptics" desc="Buzz on every hit (phones that support vibration). Off on desktop/iOS." on={settings.haptics} onClick={() => set("haptics")} />
        <Toggle label="Save best scores (this device)" desc="Opt-in. Stores your best rating per mentor in this browser only — never networked. Off keeps the no-storage floor." on={settings.saveBests} onClick={toggleSaveBests} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FBF8F0", border: "2px solid #E5DECB", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <div>
            <div className="marker" style={{ fontSize: 14, color: navy }}>Latency calibration</div>
            <div style={{ fontSize: 12, color: ink }}>Current offset: <b>{Math.round(settings.calibrationOffset * 1000)} ms</b></div>
          </div>
          <Btn onClick={() => setScreen("calibrate")} bg={navy} style={{ padding: "10px 16px", fontSize: 13 }}>Calibrate →</Btn>
        </div>
        <Btn onClick={() => setScreen("title")} bg={red}>← Back</Btn>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function CalibrateScreen({ eng, setSettings, setScreen }) {
  const [tapsLeft, setTapsLeft] = useState(8);
  const [offsetMs, setOffsetMs] = useState(null);
  const [running, setRunning] = useState(false);
  const clickTimesRef = useRef([]);
  const samplesRef = useRef([]);
  const rafRef = useRef(null);
  const [pulse, setPulse] = useState(0);
  const calSpb = 0.6;

  const stop = useCallback(() => { setRunning(false); cancelAnimationFrame(rafRef.current); }, []);

  const start = async () => {
    await eng.current.ensure();
    const now = eng.current.now() + 0.3;
    const times = [];
    for (let i = 0; i < 64; i++) { const t = now + i * calSpb; times.push(t); eng.current.click(t, i % 4 === 0); }
    clickTimesRef.current = times;
    samplesRef.current = [];
    setTapsLeft(8); setOffsetMs(null); setRunning(true);
    const loop = () => {
      const t = eng.current.now();
      const phaseFrac = ((t - now) / calSpb) % 1;
      setPulse(1 - Math.min(1, Math.abs(phaseFrac - Math.round(phaseFrac)) * 6));
      if (t > now + 64 * calSpb) { stop(); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const tap = () => {
    if (!running) return;
    const t = eng.current.now();
    let nearest = clickTimesRef.current[0], best = Infinity;
    for (const ct of clickTimesRef.current) { const d = Math.abs(ct - t); if (d < best) { best = d; nearest = ct; } }
    samplesRef.current.push(t - nearest);
    setTapsLeft(Math.max(0, 8 - samplesRef.current.length));
    if (samplesRef.current.length >= 8) {
      const sorted = [...samplesRef.current].sort((a, b) => a - b);
      setOffsetMs(Math.round(sorted[Math.floor(sorted.length / 2)] * 1000));
      stop();
    }
  };

  useEffect(() => {
    const h = (e) => { if (e.key === " ") { e.preventDefault(); tap(); } };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const apply = () => {
    if (offsetMs != null) setSettings((s) => ({ ...s, calibrationOffset: offsetMs / 1000 }));
    setScreen("settings");
  };

  return (
    <Center bg={navy}>
      <Card style={{ textAlign: "center" }}>
        <h2 className="marker" style={{ fontSize: 28, color: navy, marginTop: 0 }}>Latency calibration</h2>
        <p style={{ fontSize: 13, color: ink }}>Tap <b>SPACE</b> (or the pad) right on the beat, eight times. We'll find your personal offset and apply it to every judgment — nothing leaves the device.</p>
        <button onClick={tap} onPointerDown={(e) => { e.preventDefault(); tap(); }} className="pad"
          style={{ width: 180, height: 180, borderRadius: "50%", margin: "16px auto", display: "block", border: `4px solid ${ink}`, background: red, color: cream, transform: `scale(${1 + (running ? pulse * 0.08 : 0)})`, boxShadow: `0 6px 0 ${ink}` }}>
          <div className="marker" style={{ fontSize: 22 }}>{running ? "TAP!" : "READY"}</div>
          <div style={{ fontSize: 12 }}>{running ? `${tapsLeft} left` : "press start"}</div>
        </button>
        {offsetMs != null && (
          <div className="pop" style={{ fontSize: 14, color: ink, marginBottom: 10 }}>
            Your offset: <b style={{ color: med0(offsetMs) }}>{offsetMs} ms</b> {offsetMs > 0 ? "(you hit a touch late)" : offsetMs < 0 ? "(you hit a touch early)" : "(dead on)"}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {!running && <Btn onClick={start} bg={green}>{offsetMs == null ? "Start" : "Try again"}</Btn>}
          {offsetMs != null && <Btn onClick={apply} bg={navy}>Use {offsetMs} ms</Btn>}
          <Btn onClick={() => { stop(); setScreen("settings"); }} bg={cream} color={navy}>Cancel</Btn>
        </div>
      </Card>
    </Center>
  );
}
const med0 = (ms) => (Math.abs(ms) < 40 ? green : Math.abs(ms) < 90 ? gold : red);

// ---------------------------------------------------------------------
// Creator mode — the player writes lines; the engine sets them on the grid.
function autoPlace(lines, mentorIdx) {
  const phrases = [];
  for (const raw of lines) {
    const words = raw.trim().split(/\s+/).filter(Boolean).slice(0, 7);
    if (words.length < 1) continue;
    const n = words.length;
    const span = 7; // place across beats 0..7
    const targets = words.map((word, i) => {
      const beat = n === 1 ? 0 : Math.min(7.5, Math.round((i * (span / (n - 1))) * 2) / 2);
      const lane = i % 4; // cycling lanes => adjacent words never share a lane
      return { lane, beat, word };
    });
    phrases.push({ targets });
    if (phrases.length >= 4) break;
  }
  return phrases;
}

function CreatorScreen({ playCustom, setScreen, getStage }) {
  const [text, setText] = useState("Push off the curb feel free\nIsland in my heart now\nHands up for the home team\nStay in the now and ride");
  const [mentorIdx, setMentorIdx] = useState(0);
  const [err, setErr] = useState(null);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4);
  const usable = lines.filter((l) => l.split(/\s+/).filter(Boolean).length >= 2);

  const build = () => {
    if (usable.length < 1) { setErr("Write at least one line of 2+ words."); return; }
    const base = ALL_STAGES[mentorIdx];
    const phrases = autoPlace(lines, mentorIdx);
    if (!phrases.length) { setErr("Couldn't place those words — add a few more."); return; }
    const stage = {
      mentor: "Your verse", emoji: "✍️", color: "#5A3E6B", bpm: base.bpm, bassNote: base.bassNote, season: 0, custom: true,
      lesson: `on ${base.mentor}'s beat`,
      introLines: ["You wrote it — now rap it back on the beat.", "The engine set your words on the grid. Stay in the now!"],
      win: "“You made it AND played it. That's the whole point.”",
    };
    setErr(null);
    playCustom(stage, phrases);
  };

  return (
    <Center bg="#5A3E6B">
      <Card>
        <h2 className="marker" style={{ fontSize: 28, color: navy, marginTop: 0 }}>Creator mode</h2>
        <p style={{ fontSize: 13, color: ink }}>Write up to 4 short lines (2-7 words each). The engine drops each word on the beat grid and you rap it back.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: `2px solid ${ink}`, fontFamily: "inherit", fontSize: 15, color: ink, resize: "vertical", background: "#FBF8F0" }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "12px 0", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: ink }}>Beat:</span>
          <select value={mentorIdx} onChange={(e) => setMentorIdx(Number(e.target.value))}
            style={{ padding: "8px 10px", borderRadius: 8, border: `2px solid ${ink}`, fontFamily: "inherit", fontSize: 14, background: cream, color: navy }}>
            {ALL_STAGES.filter((s) => !s.guest).map((s, i) => (
              <option key={i} value={i}>{s.emoji} {s.mentor} · {s.bpm} BPM</option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: ink, opacity: 0.7 }}>{usable.length} line{usable.length === 1 ? "" : "s"} ready</span>
        </div>
        {err && <div className="shake" style={{ color: red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn onClick={build} bg={green}>🎤 Set it &amp; rap it</Btn>
          <Btn onClick={() => setScreen("roster")} bg={cream} color={navy}>← Back</Btn>
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function IntroScreen({ stageIdx, isCustom, getStage, launchPlay, verseStatus, verseErr, genVerse, useHandcrafted }) {
  const stage = getStage(stageIdx);
  const generating = verseStatus === "generating";
  const canGenerate = !isCustom && !stage.guest && !stage.custom;
  return (
    <Center bg={stage.color}>
      <Card>
        <div style={{ fontSize: 64, textAlign: "center", marginBottom: 6 }}>{stage.emoji}</div>
        <h2 className="marker" style={{ fontSize: 32, textAlign: "center", margin: 0, color: navy }}>{stage.mentor}</h2>
        <div className="marker" style={{ textAlign: "center", fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: red, margin: "6px 0 16px" }}>
          {stage.guest ? "Guest set" : stage.custom ? "Your verse" : `Lesson: ${stage.lesson}`} · {stage.bpm} BPM
        </div>
        {stage.introLines.map((l, i) => (
          <p key={i} className="serif" style={{ textAlign: "center", fontStyle: "italic", color: ink, margin: "0 0 8px" }}>“{l}”</p>
        ))}
        {stage.note && (
          <div style={{ fontSize: 11, color: ink, opacity: 0.75, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>{stage.note}</div>
        )}
        {stage.guest && <div style={{ textAlign: "center", marginTop: 10 }}><CatalogLink /></div>}

        {canGenerate && (
          <div style={{ background: "#FBF8F0", border: "2px solid #E5DECB", borderRadius: 10, padding: 12, margin: "16px 0 0", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: ink, marginBottom: 8 }}>
              {verseStatus === "fresh"
                ? <span><b style={{ color: green }}>✦ Freshly written verse loaded.</b> {stage.mentor} wrote you a new one.</span>
                : verseStatus === "offline"
                ? <span><b style={{ color: gold }}>Verse writer offline</b> — rapping the handcrafted pack.{verseErr ? <span style={{ opacity: 0.7 }}> ({verseErr})</span> : null}</span>
                : generating ? <span>✍️ {stage.mentor} is writing a new verse…</span>
                : <span>Rap the handcrafted verse, or have {stage.mentor} write a brand-new one.</span>}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => genVerse(stageIdx)} disabled={generating} className="marker"
                style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, background: generating ? "#C9C2AF" : green, color: cream, border: `2px solid ${ink}`, boxShadow: `0 3px 0 ${ink}` }}>
                {generating ? "writing…" : verseStatus === "fresh" ? "🎲 Another verse" : "🎲 Fresh verse"}
              </button>
              {verseStatus === "fresh" && (
                <button onClick={() => useHandcrafted(stageIdx)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13, background: cream, color: navy, border: `2px solid ${ink}` }}>use handcrafted</button>
              )}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <Btn onClick={launchPlay} bg={navy} disabled={generating}>Let's go — count me in 🎤</Btn>
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function PlayScreen(ctx) {
  const {
    stageIdx, phraseIdx, phase, flow, flowRank, flowColor, score, combo, multiplier,
    judgment, targetStates, freestyleHits, audioNow, settings, tempoScale, laneFlash,
    hitLane, quitToMenu, contentStartRef, spbRef, targetsRef, activeLanes, phrasesFor, getStage,
  } = ctx;

  const stage = getStage(stageIdx);
  const phraseCount = phrasesFor(stageIdx).length;
  const isCall = phase === "call";
  const isFree = phase === "freestyle";
  const lanes = activeLanes();
  const laneH = 100 / lanes.length;
  const counting = audioNow < contentStartRef.current;
  const mult = multiplier(combo);
  const rowOf = (lane) => (settings.oneButton ? 0 : lane);
  const targets = isFree ? [] : targetsRef.current || [];
  const lyric = targets.map((t) => t.word).join(" ");
  const spb = spbRef.current;
  const noteX = (beat) => { const tt = contentStartRef.current + beat * spb; return HIT_X + (100 - HIT_X) * ((tt - audioNow) / LEAD); };
  const fsBeatNow = isFree ? (audioNow - contentStartRef.current) / spb : 0;

  return (
    <div className="paper" style={{ minHeight: "100%", padding: 16, background: stage.color }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="sticker" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: navy, color: cream, marginBottom: 14 }}>
          <div className="marker" style={{ fontSize: 15 }}>
            {stage.emoji} {stage.mentor}
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>phrase {Math.min(phraseIdx + 1, phraseCount)}/{phraseCount}</span>
            <button onClick={quitToMenu} style={{ marginLeft: 12, fontSize: 11, background: "transparent", color: "#9FB0CC", border: "1px solid #3A4A6A", borderRadius: 6, padding: "2px 8px" }}>quit</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 13 }}>Score <b>{score}</b></div>
            {combo > 1 && <div className="marker pop" key={combo} style={{ fontSize: 14, color: gold }}>{combo}× <span style={{ fontSize: 11, opacity: 0.85 }}>(×{mult})</span></div>}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 110, height: 12, borderRadius: 6, overflow: "hidden", background: "#0E1730" }}>
                <div style={{ height: 12, width: `${flow}%`, background: flowColor, transition: "width 200ms" }} />
              </div>
              <div className="marker" style={{ fontSize: 12, color: flowColor === red ? "#F0B9B6" : cream }}>{flowRank}</div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <span className="marker" style={{ display: "inline-block", padding: "5px 18px", borderRadius: 999, fontSize: 13, textTransform: "uppercase", letterSpacing: 2, background: cream, color: isCall ? red : navy, border: `2px solid ${ink}` }}>
            {counting ? "🎵 Count-in…" : isCall ? `${stage.mentor}'s line — watch the notes` : isFree ? "FREESTYLE — your rhythm, hit the pulse" : "YOUR LINE — rap it back!"}
          </span>
          {tempoScale < 1 && <div style={{ fontSize: 11, color: cream, opacity: 0.85, marginTop: 4 }}>tempo eased to {Math.round(tempoScale * 100)}% — lock back in and it speeds up</div>}
        </div>

        <div className="serif" style={{ textAlign: "center", fontSize: 20, fontWeight: 700, color: cream, marginBottom: 10, minHeight: 26 }}>
          {isFree ? (freestyleHits > 0 ? `🔥 ${freestyleHits} on-beat hits` : "Hit any pad on the travelling pulse — +50 each") : `“${lyric}”`}
        </div>

        <div className="sticker highway" style={{ position: "relative", background: cream, height: 240, overflow: "hidden", marginBottom: 14 }}>
          {lanes.map((l, li) => (
            <div key={li} style={{ position: "absolute", left: 0, right: 0, top: `${li * laneH}%`, height: `${laneH}%`, borderBottom: "1px solid #EFEADB", background: li % 2 ? "rgba(0,0,0,0.015)" : "transparent" }}>
              <div className="marker" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: l.color, opacity: 0.5 }}>{l.key} · {l.name}</div>
              {audioNow - laneFlash[li] < 0.13 && <div style={{ position: "absolute", inset: 0, background: l.color, opacity: 0.18 }} />}
            </div>
          ))}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${HIT_X}%`, width: 4, background: red, boxShadow: "0 0 12px rgba(168,51,46,0.8)", animation: "hitline 1s infinite" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(${HIT_X}% - 26px)`, width: 26, background: "linear-gradient(90deg, transparent, rgba(168,51,46,0.10))" }} />
          {targets.map((t, i) => {
            const x = noteX(t.beat);
            if (x < -8 || x > 108) return null;
            const st = isCall ? "call" : targetStates[i] || "pending";
            const lit = isCall && audioNow >= contentStartRef.current + t.beat * spb - 0.04 && audioNow < contentStartRef.current + t.beat * spb + 0.22;
            const laneColor = LANES[t.lane] ? LANES[t.lane].color : navy;
            const bg = st === "perfect" ? green : st === "good" ? gold : st === "miss" ? "#C9C2AF" : laneColor;
            const row = rowOf(t.lane);
            return (
              <div key={i} className={st === "perfect" || st === "good" ? "pop" : ""} title={t.word}
                style={{ position: "absolute", left: `calc(${x}% - 22px)`, top: `calc(${row * laneH}% + ${laneH * 0.5}% - 22px)`, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: cream, background: bg, border: `3px solid ${ink}`, boxShadow: lit ? `0 0 0 5px rgba(184,116,44,0.6)` : st === "miss" ? "none" : `0 3px 0 ${ink}`, opacity: st === "miss" ? 0.5 : 1, transform: lit ? "scale(1.18)" : "scale(1)", transition: "transform 80ms" }}>
                {t.word.slice(0, 5)}
              </div>
            );
          })}
          {isFree && Array.from({ length: PHRASE_BEATS * 2 + 1 }).map((_, g) => {
            const beat = g / 2; const x = noteX(beat);
            if (x < -4 || x > 104) return null;
            const near = Math.abs(beat - Math.round(fsBeatNow * 2) / 2) < 0.01 && Math.abs(fsBeatNow - beat) < 0.18;
            return <div key={g} style={{ position: "absolute", left: `calc(${x}% - ${near ? 9 : 5}px)`, top: "50%", transform: "translateY(-50%)", width: near ? 18 : 10, height: near ? 18 : 10, borderRadius: "50%", background: navy, opacity: near ? 0.95 : 0.4, border: near ? `2px solid ${gold}` : "none" }} />;
          })}
          {judgment && (
            <div key={judgment.key} className="judge" style={{ position: "absolute", left: `${HIT_X}%`, top: "38%" }}>
              <div className="marker" style={{ fontSize: 38, color: judgment.color, textShadow: "0 2px 0 rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>{judgment.text}</div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${lanes.length}, 1fr)`, gap: 12 }}>
          {lanes.map((l, i) => (
            <button key={i} className="pad" onPointerDown={(e) => { e.preventDefault(); hitLane(i); }}
              style={{ borderRadius: 14, padding: "22px 0", background: l.color, color: cream, userSelect: "none", touchAction: "manipulation", border: `3px solid ${ink}`, boxShadow: `0 5px 0 ${ink}` }}>
              <div className="marker" style={{ fontSize: 22 }}>{settings.oneButton ? "TAP" : l.key}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{l.name}</div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: cream, opacity: 0.8, marginTop: 12 }}>PERFECT ±120ms · GOOD ±250ms — judged on the audio clock, always.</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
function RatingScreen({ ratings, stageStats, freestyleHits, stageIdx, isCustom, settings, getStage, beginStage, rerunStage, setScreen, record, isPB }) {
  const last = ratings[ratings.length - 1];
  const stage = getStage(stageIdx);
  const lost = last && last.rating === "LOST" && !settings.noFail;
  const oneOff = isCustom || stage.guest;
  const nextIdx = stageIdx + 1;
  const nextStage = !oneOff && nextIdx < ALL_STAGES.length && ALL_STAGES[nextIdx] && ALL_STAGES[nextIdx].season === stage.season && !ALL_STAGES[nextIdx].guest ? nextIdx : null;
  const hasRun = record && record.items && record.items.length > 0;

  return (
    <Center bg={navy}>
      <Card style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 6 }}>{stage.emoji}</div>
        <div className="marker" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 2, color: red }}>Stage rating</div>
        <div className="marker pop" style={{ fontSize: 56, color: last ? ratingColor(last.rating) : ink, lineHeight: 1.1 }}>{last ? last.rating : ""}</div>
        <div style={{ fontSize: 13, color: ink, marginBottom: 6 }}>
          Accuracy {last ? last.accuracy : 0}% · {stageStats.perfect} perfect · {stageStats.good} good · {stageStats.miss} missed · {freestyleHits} freestyle
        </div>
        {last && last.maxCombo >= 4 && <div className="marker" style={{ fontSize: 13, color: gold, marginBottom: 6 }}>best combo: {last.maxCombo}×</div>}
        {isPB && <div className="marker pop" style={{ fontSize: 15, color: green, marginBottom: 6 }}>★ New personal best!</div>}
        <p className="serif" style={{ fontSize: 14, fontStyle: "italic", color: ink, margin: "10px 0 22px" }}>
          {lost ? `“You drifted out of the now. Breathe in — the beat's coming back around.” Run it again.` : `${stage.win} — ${stage.mentor}`}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {hasRun && <Btn onClick={() => setScreen("replay")} bg={cream} color={navy}>▶ Watch your run</Btn>}
          {lost && <Btn onClick={() => rerunStage(stageIdx)} bg={red}>Run it again</Btn>}
          {!lost && nextStage != null && <Btn onClick={() => beginStage(nextStage)} bg={red}>Next: {ALL_STAGES[nextStage].emoji} {ALL_STAGES[nextStage].mentor} →</Btn>}
          {!lost && nextStage == null && !oneOff && <Btn onClick={() => setScreen("finale")} bg={red}>Season finale →</Btn>}
          <Btn onClick={() => setScreen("roster")} bg={green}>Roster</Btn>
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
function FinaleScreen({ ratings, score, restartGame, setScreen }) {
  const totalCombo = ratings.reduce((m, r) => Math.max(m, r.maxCombo || 0), 0);
  return (
    <Center bg={navy}>
      <Card style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52, marginBottom: 6 }}>🦝🎤</div>
        <h2 className="marker" style={{ fontSize: 30, color: navy, margin: 0 }}>Scout's showcase</h2>
        <div style={{ fontSize: 14, color: ink, margin: "6px 0 18px" }}>Total score: <b>{score}</b> · best combo <b>{totalCombo}×</b></div>
        <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
          {ratings.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: 10, padding: "10px 14px", background: "#FBF8F0", border: "2px solid #E5DECB" }}>
              <div className="marker" style={{ fontSize: 14, color: navy }}>{r.emoji} {r.mentor}</div>
              <div className="marker" style={{ fontSize: 14, color: ratingColor(r.rating) }}>{r.rating} · {r.accuracy}%</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 10, padding: 16, fontSize: 13, textAlign: "left", background: "#FBF8F0", color: ink, border: "2px solid #E5DECB", marginBottom: 20 }}>
          <b style={{ color: navy }}>What the mentors taught:</b>
          <div style={{ marginTop: 6 }}>• You can't hit a beat while replaying the last miss — flow only lives in the present.</div>
          <div>• Balance, patience, listening, asking, showing up: many lessons, one skill. <b>Stay in the now.</b></div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Btn onClick={() => setScreen("roster")} bg={green}>More mentors</Btn>
          <Btn onClick={restartGame}>Back to the top 🔁</Btn>
        </div>
      </Card>
    </Center>
  );
}

// ---------------------------------------------------------------------
// Replay viewer — re-performs the run you just played, on the audio clock.
function ReplayScreen({ record, getStage, eng, setScreen }) {
  const stage = getStage(record.stageIdx);
  const spb = 60 / stage.bpm;
  const items = record.items || [];
  const [itemIdx, setItemIdx] = useState(0);
  const [audioNow, setAudioNow] = useState(0);
  const csRef = useRef(0);
  const rafRef = useRef(null);
  const flashRef = useRef([0, 0, 0, 0]);
  const idxRef = useRef(0);

  const startItem = (i) => {
    const item = items[i];
    if (!item) return;
    const cs = eng.current.now() + 0.5;
    csRef.current = cs;
    flashRef.current = [0, 0, 0, 0];
    // re-perform the recorded presses (audio + scheduled flashes)
    item.hits.forEach((h) => {
      eng.current.playLane(h.lane, cs + h.t, false);
    });
    const end = cs + (item.maxBeat + 1.2) * spb;
    cancelAnimationFrame(rafRef.current);
    const loop = () => {
      const t = eng.current.now();
      setAudioNow(t);
      // light lanes as their recorded hits cross
      item.hits.forEach((h) => { if (Math.abs(t - (cs + h.t)) < 0.05) flashRef.current[h.lane] = t; });
      if (t >= end) {
        if (i + 1 < items.length) { idxRef.current = i + 1; setItemIdx(i + 1); startItem(i + 1); }
        else { cancelAnimationFrame(rafRef.current); }
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    let alive = true;
    (async () => { await eng.current.ensure(); if (alive) startItem(0); })();
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, []);

  const item = items[itemIdx] || { targets: [], hits: [], maxBeat: PHRASE_BEATS };
  const laneH = 100 / LANES.length;
  const noteX = (beat) => { const tt = csRef.current + beat * spb; return HIT_X + (100 - HIT_X) * ((tt - audioNow) / LEAD); };

  return (
    <div className="paper" style={{ minHeight: "100%", padding: 16, background: stage.color }}>
      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="sticker" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: navy, color: cream, marginBottom: 14 }}>
          <div className="marker" style={{ fontSize: 15 }}>▶ Replay — {stage.emoji} {stage.mentor}
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>{item.kind === "freestyle" ? "freestyle bar" : `phrase ${itemIdx + 1}/${items.length}`}</span>
          </div>
          <button onClick={() => { cancelAnimationFrame(rafRef.current); setScreen("rating"); }} style={{ fontSize: 12, background: "transparent", color: "#9FB0CC", border: "1px solid #3A4A6A", borderRadius: 6, padding: "4px 10px" }}>exit</button>
        </div>

        <div className="sticker highway" style={{ position: "relative", background: cream, height: 240, overflow: "hidden", marginBottom: 14 }}>
          {LANES.map((l, li) => (
            <div key={li} style={{ position: "absolute", left: 0, right: 0, top: `${li * laneH}%`, height: `${laneH}%`, borderBottom: "1px solid #EFEADB" }}>
              <div className="marker" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: l.color, opacity: 0.5 }}>{l.key} · {l.name}</div>
              {audioNow - flashRef.current[li] < 0.13 && <div style={{ position: "absolute", inset: 0, background: l.color, opacity: 0.2 }} />}
            </div>
          ))}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${HIT_X}%`, width: 4, background: red, boxShadow: "0 0 12px rgba(168,51,46,0.8)" }} />
          {item.targets.map((t, i) => {
            const x = noteX(t.beat);
            if (x < -8 || x > 108) return null;
            const bg = t.grade === "perfect" ? green : t.grade === "good" ? gold : t.grade === "miss" ? "#C9C2AF" : LANES[t.lane].color;
            return (
              <div key={i} style={{ position: "absolute", left: `calc(${x}% - 22px)`, top: `calc(${t.lane * laneH}% + ${laneH * 0.5}% - 22px)`, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, color: cream, background: bg, border: `3px solid ${ink}`, opacity: t.grade === "miss" ? 0.5 : 1 }}>
                {t.word.slice(0, 5)}
              </div>
            );
          })}
          {/* player's actual presses, as marks on the line */}
          {item.hits.map((h, i) => {
            const x = noteX(h.t / spb);
            if (x < -4 || x > 104) return null;
            const col = h.grade === "perfect" ? green : h.grade === "good" ? gold : h.grade === "free" ? navy : red;
            return <div key={`h${i}`} style={{ position: "absolute", left: `calc(${x}% - 4px)`, top: `calc(${h.lane * laneH}% + ${laneH * 0.5}% - 4px)`, width: 8, height: 8, borderRadius: "50%", background: col, border: `2px solid ${cream}` }} />;
          })}
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: cream, opacity: 0.85 }}>
          Tiles are the target words (colored by your grade); dots are exactly where you tapped. Watch your timing live.
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Btn onClick={() => { cancelAnimationFrame(rafRef.current); setScreen("rating"); }} bg={cream} color={navy}>Done</Btn>
        </div>
      </div>
    </div>
  );
}
