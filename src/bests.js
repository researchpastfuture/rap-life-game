// ============================================================
// Personal bests — OPT-IN local storage only (spec §9 privacy floor).
// Nothing is read or written unless the player turns on "Save best scores"
// in Settings. Lives in localStorage on this device; never networked.
// ============================================================

const KEY = "raplife.bests.v1";

export function loadBests() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
export function saveBests(b) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch (e) {}
}
export function clearBests() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

const RANK = { LOST: 0, SHAKY: 1, SOLID: 2, BLAZING: 3 };
export function bestRating(a, b) {
  if (!a) return b;
  return RANK[b] >= RANK[a] ? b : a;
}
