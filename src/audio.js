import * as Tone from "tone";
import { LANES } from "./data.js";

// 16-step (2-bar) boom-bap pattern; step s -> beat s/2.
const STEP = {
  kick: new Set([0, 5, 8, 13]),
  snare: new Set([4, 12]),
  bass: new Set([0, 3, 8, 11]),
  // hats: every step
};

// ============================================================
// Audio engine — 100% synthesized on-device. Nothing streams.
// Everything is scheduled against Tone.now() (the audio clock),
// so judgment is sample-accurate and visuals can chase audio.
// ============================================================

export function createEngine() {
  let s = null;
  let grooveId = null; // Transport.scheduleRepeat id
  let step = 0;
  let bassNote = "C2";

  async function ensure() {
    await Tone.start();
    if (s) return s;

    const master = new Tone.Volume(-2).toDestination();
    const comp = new Tone.Compressor(-18, 3).connect(master);

    // ---- player-voice lanes (full level, punchy) ----
    const kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.04 }).connect(comp);
    const snare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.13, sustain: 0 } }).connect(comp);
    const clap = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.09, sustain: 0 } }).connect(comp);
    const stab = new Tone.Synth({ oscillator: { type: "square" }, envelope: { attack: 0.005, decay: 0.16, sustain: 0 } }).connect(comp);
    stab.volume.value = -7;

    // ---- mentor "call" voice (so the call is audibly different) ----
    const mentor = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.2, sustain: 0 } }).connect(comp);
    mentor.volume.value = -3;

    // ---- count-in / freestyle grid click ----
    const click = new Tone.Synth({ oscillator: { type: "sine" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(comp);
    click.volume.value = -9;

    // ---- backing groove bed (sits quietly under play) ----
    const gKick = new Tone.MembraneSynth({ octaves: 5, pitchDecay: 0.03 }).connect(comp);
    gKick.volume.value = -10;
    const gSnare = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(comp);
    gSnare.volume.value = -17;
    const gHat = new Tone.NoiseSynth({ noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.03, sustain: 0 } }).connect(comp);
    gHat.volume.value = -24;
    const bass = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.01, decay: 0.28, sustain: 0.1, release: 0.1 } }).connect(comp);
    bass.volume.value = -11;

    s = { kick, snare, clap, stab, mentor, click, gKick, gSnare, gHat, bass };
    return s;
  }

  // Play a player/mentor lane voice at a precise audio time (or now).
  function playLane(lane, time, asMentor) {
    if (!s) return;
    const t = time || undefined;
    try {
      if (asMentor) {
        const notes = ["C4", "E4", "G4", "B4"];
        s.mentor.triggerAttackRelease(notes[lane], "16n", t);
      } else if (LANES[lane].type === "kick") s.kick.triggerAttackRelease("C2", "8n", t);
      else if (LANES[lane].type === "snare") s.snare.triggerAttackRelease("16n", t);
      else if (LANES[lane].type === "clap") s.clap.triggerAttackRelease("16n", t);
      else s.stab.triggerAttackRelease("G4", "16n", t);
    } catch (e) {
      /* overlapping triggers are fine to drop */
    }
  }

  function click(time, accent) {
    if (!s) return;
    try {
      s.click.triggerAttackRelease(accent ? "C6" : "G5", "32n", time);
    } catch (e) {}
  }

  function gridClick(time) {
    if (!s) return;
    try {
      s.click.triggerAttackRelease("E5", "32n", time);
    } catch (e) {}
  }

  // ---- continuous backing bed on Tone.Transport (no inter-phrase gaps) ----
  function startGroove(bpm, note) {
    if (!s) return;
    stopGroove();
    bassNote = note || "C2";
    step = 0;
    Tone.Transport.bpm.value = bpm;
    grooveId = Tone.Transport.scheduleRepeat((time) => {
      const i = step % 16;
      try {
        s.gHat.triggerAttackRelease("32n", time, i % 2 ? 0.6 : 0.9);
        if (STEP.kick.has(i)) s.gKick.triggerAttackRelease("C2", "8n", time);
        if (STEP.snare.has(i)) s.gSnare.triggerAttackRelease("16n", time);
        if (STEP.bass.has(i)) s.bass.triggerAttackRelease(bassNote, "8n", time);
      } catch (e) {}
      step += 1;
    }, "8n");
    Tone.Transport.start();
  }

  function setGrooveBpm(bpm) {
    try { Tone.Transport.bpm.value = bpm; } catch (e) {}
  }

  function stopGroove() {
    try {
      if (grooveId !== null) Tone.Transport.clear(grooveId);
      grooveId = null;
      Tone.Transport.stop();
      Tone.Transport.cancel();
      Tone.Transport.position = 0;
    } catch (e) {}
  }

  // Audio-clock time of the next bar boundary, at least `minLead` seconds out,
  // so gameplay notes phase-lock to the running groove. Falls back to now+lead.
  function nextBar(spb, minLead) {
    const t0 = Tone.now();
    try {
      let t = Tone.Transport.nextSubdivision("1m");
      const bar = 4 * spb;
      while (t < t0 + minLead) t += bar;
      if (!isFinite(t) || t < t0) return t0 + minLead;
      return t;
    } catch (e) {
      return t0 + minLead;
    }
  }

  function now() {
    return Tone.now();
  }

  function dispose() {
    stopGroove();
    if (!s) return;
    Object.values(s).forEach((v) => { try { v.dispose(); } catch (e) {} });
    s = null;
  }

  return { ensure, playLane, click, gridClick, startGroove, setGrooveBpm, stopGroove, nextBar, now, dispose };
}
