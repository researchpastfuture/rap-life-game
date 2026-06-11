// ============================================================
// Character voices — browser SpeechSynthesis (Web Speech API).
// Real spoken voices with ZERO audio assets and no network: the OS
// voices render on-device, so the "nothing leaves the device" floor
// holds. Each mentor gets a distinct pitch/rate + a system voice.
// ============================================================

let enabled = true;
let voices = [];
const listeners = new Set(); // speaking-state subscribers (for talk animation)

function supported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function loadVoices() {
  if (!supported()) return;
  try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
}

export function initVoice() {
  if (!supported()) return;
  loadVoices();
  try { window.speechSynthesis.onvoiceschanged = loadVoices; } catch (e) {}
}

export function setVoiceEnabled(v) {
  enabled = v;
  if (!v) cancelVoice();
}
export function isVoiceEnabled() { return enabled; }

export function cancelVoice() {
  if (!supported()) return;
  try { window.speechSynthesis.cancel(); } catch (e) {}
  emit(false);
}

export function onSpeakingChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emit(state) { listeners.forEach((cb) => { try { cb(state); } catch (e) {} }); }

// Deterministically map a profile to one of the available English voices,
// so each mentor sounds like a different person even on the same machine.
function pickVoice(idx) {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  if (!pool.length) return null;
  return pool[idx % pool.length];
}

// Speak a line. profile = { pitch, rate, voiceIndex, volume }.
export function say(text, profile = {}, opts = {}) {
  if (!enabled || !supported() || !text) return;
  try {
    if (opts.interrupt) window.speechSynthesis.cancel();
    if (!voices.length) loadVoices();
    const u = new SpeechSynthesisUtterance(String(text));
    u.pitch = profile.pitch != null ? profile.pitch : 1;
    u.rate = profile.rate != null ? profile.rate : 1;
    u.volume = profile.volume != null ? profile.volume : 1;
    const v = pickVoice(profile.voiceIndex || 0);
    if (v) u.voice = v;
    u.onstart = () => emit(true);
    u.onend = () => emit(false);
    u.onerror = () => emit(false);
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
