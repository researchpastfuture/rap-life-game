// ============================================================
// RAP LIFE: BELIEVE THE BEAT — game data
// Original IP. No Sony / NanaOn-Sha / Greenblat assets.
// ============================================================

export const cream = "#F4EFE4";
export const ink = "#33301F";
export const navy = "#1B2A4A";
export const red = "#A8332E";
export const green = "#2E5339";
export const gold = "#B8742C";

// Four response lanes — each its own voice, so the player's line is musical.
export const LANES = [
  { key: "A", name: "BOOM", color: "#A8332E", type: "kick" },
  { key: "S", name: "SNAP", color: "#1B2A4A", type: "snare" },
  { key: "D", name: "CLAP", color: "#2E5339", type: "clap" },
  { key: "F", name: "YO!", color: "#B8742C", type: "stab" },
];

// Hit windows (seconds). Judgment runs on the audio clock, always.
export const PERFECT_WIN = 0.12; // ±120ms
export const GOOD_WIN = 0.25; // ±250ms
export const FREESTYLE_WIN = 0.14; // ±140ms of the half-beat grid
export const PHRASE_BEATS = 8; // 2 bars of 4

// Reference groove (the live bed is Transport-driven in audio.js).
export const GROOVE = {
  kick: [0, 2.5, 4, 6.5],
  snare: [2, 6],
  hat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5],
  bass: [0, 1.5, 4, 5.5],
};

// ---------- Season 1 ----------
const SEASON1 = [
  {
    mentor: "Old Man Switchback", emoji: "🛹", color: "#2E5339", bpm: 84, bassNote: "C2", season: 1,
    lesson: "Balance — and getting back up",
    blurb: "Skatepark elder. Boom-bap. Every push is a new push.",
    introLines: [
      "The board don't care what you did last run, kid.",
      "Every push is a brand new push. Stay in the now — and ride.",
    ],
    win: "“See? Every push is a new push.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Kick"},{lane:1,beat:1,word:"push"},{lane:0,beat:2,word:"kick"},{lane:1,beat:3,word:"push"},{lane:2,beat:5,word:"coast"} ] },
      { targets: [ {lane:0,beat:0,word:"Bend"},{lane:1,beat:1,word:"your"},{lane:2,beat:2,word:"knees"},{lane:0,beat:4,word:"find"},{lane:1,beat:5,word:"your"},{lane:3,beat:6,word:"flow"} ] },
      { targets: [ {lane:0,beat:0,word:"Fall"},{lane:1,beat:1,word:"down"},{lane:2,beat:2,word:"get"},{lane:3,beat:3,word:"up"},{lane:0,beat:5,word:"ride"},{lane:1,beat:6,word:"on"} ] },
      { targets: [ {lane:3,beat:0,word:"Stay"},{lane:1,beat:1,word:"in"},{lane:2,beat:2,word:"the"},{lane:0,beat:3,word:"NOW"},{lane:1,beat:5,word:"that's"},{lane:3,beat:6,word:"how"} ] },
    ],
  },
  {
    mentor: "Mama Hibiscus", emoji: "🌺", color: "#A8332E", bpm: 96, bassNote: "A1", season: 1,
    lesson: "Craft, patience, and feeding people",
    blurb: "Food-truck queen. Swing groove. You can't rush a roux or a rhyme.",
    introLines: [
      "Good food is love you can taste, baby.",
      "You can't rush a roux and you can't rush a rhyme. One stir at a time.",
    ],
    win: "“Now that's a plate of love.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Crack"},{lane:1,beat:1,word:"the"},{lane:2,beat:2,word:"egg"},{lane:0,beat:4,word:"whisk"},{lane:3,beat:5,word:"it"},{lane:2,beat:6,word:"smooth"} ] },
      { targets: [ {lane:0,beat:0,word:"Low"},{lane:1,beat:1,word:"and"},{lane:2,beat:2,word:"slow"},{lane:1,beat:4,word:"let"},{lane:0,beat:5,word:"flavor"},{lane:3,beat:6,word:"grow"} ] },
      { targets: [ {lane:3,beat:0,word:"Taste"},{lane:1,beat:1,word:"it"},{lane:0,beat:2,word:"first"},{lane:2,beat:4,word:"then"},{lane:1,beat:5,word:"season"},{lane:3,beat:6,word:"it"} ] },
      { targets: [ {lane:0,beat:0,word:"Plates"},{lane:1,beat:1,word:"of"},{lane:3,beat:2,word:"love"},{lane:2,beat:4,word:"served"},{lane:0,beat:5,word:"hot"},{lane:1,beat:5.5,word:"with"},{lane:3,beat:6,word:"pride"} ] },
    ],
  },
  {
    mentor: "DJ Cricket", emoji: "🦗", color: "#1B2A4A", bpm: 112, bassNote: "E2", season: 1,
    lesson: "Listen first, then speak",
    blurb: "Tiny insect DJ, giant rig. Skittering hats. Two antennae, one mouth.",
    introLines: [
      "Two antennae, one mouth. Use 'em in that ratio.",
      "The pocket's already there — your job is to hear it, then sit in it.",
    ],
    win: "“You heard it before you said it. That's the whole art.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Lis-"},{lane:1,beat:0.5,word:"ten"},{lane:2,beat:1,word:"first"},{lane:1,beat:3,word:"then"},{lane:3,beat:4,word:"speak"},{lane:0,beat:6,word:"truth"} ] },
      { targets: [ {lane:0,beat:0,word:"Two"},{lane:2,beat:1,word:"ears"},{lane:1,beat:2,word:"one"},{lane:3,beat:3,word:"mouth"},{lane:0,beat:5,word:"keep"},{lane:2,beat:6,word:"ra-"},{lane:3,beat:6.5,word:"tio"} ] },
      { targets: [ {lane:3,beat:0,word:"Find"},{lane:1,beat:1,word:"the"},{lane:0,beat:2,word:"pock-"},{lane:2,beat:3,word:"et"},{lane:1,beat:4,word:"sit"},{lane:2,beat:5,word:"in"},{lane:3,beat:6,word:"side"} ] },
      { targets: [ {lane:0,beat:0,word:"Stay"},{lane:1,beat:0.5,word:"in"},{lane:2,beat:1,word:"the"},{lane:3,beat:1.5,word:"NOW"},{lane:1,beat:3,word:"the"},{lane:0,beat:4,word:"beat"},{lane:2,beat:5,word:"won't"},{lane:3,beat:6,word:"wait"} ] },
    ],
  },
];

// ---------- Season 2 (spec §3.2 candidates) ----------
const SEASON2 = [
  {
    mentor: "Nadia Nightowl", emoji: "🦉", color: "#3A2E5A", bpm: 88, bassNote: "D2", season: 2,
    lesson: "Patience — the long route still gets there",
    blurb: "Night-bus driver. Patience in traffic is patience in life.",
    introLines: [
      "Red light's just the beat resting, sugar.",
      "The long way 'round still gets you home. Sit in the wait with me.",
    ],
    win: "“Right on time — which is whenever you arrive present.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Red"},{lane:1,beat:1,word:"light"},{lane:2,beat:2,word:"breathe"},{lane:3,beat:4,word:"green"},{lane:0,beat:5,word:"light"},{lane:1,beat:6,word:"go"} ] },
      { targets: [ {lane:0,beat:0,word:"Slow"},{lane:1,beat:1,word:"lane"},{lane:2,beat:2,word:"still"},{lane:3,beat:3,word:"moves"},{lane:0,beat:5,word:"stay"},{lane:1,beat:6,word:"calm"} ] },
      { targets: [ {lane:3,beat:0,word:"Eve-"},{lane:1,beat:1,word:"ry"},{lane:0,beat:2,word:"stop"},{lane:2,beat:3,word:"has"},{lane:1,beat:5,word:"a"},{lane:3,beat:6,word:"point"} ] },
      { targets: [ {lane:0,beat:0,word:"Long"},{lane:1,beat:1,word:"way"},{lane:2,beat:2,word:"round"},{lane:3,beat:3,word:"gets"},{lane:0,beat:5,word:"there"},{lane:2,beat:6,word:"too"} ] },
    ],
  },
  {
    mentor: "Marlo the Manatee", emoji: "🛟", color: "#1E6E6E", bpm: 100, bassNote: "G1", season: 2,
    lesson: "Asking for help is strength",
    blurb: "Gentle lifeguard. Raising your hand is the bravest move.",
    introLines: [
      "Floatin' ain't quittin'. It's how you stay up.",
      "The strongest swimmers know when to wave for the line. So do the strongest rappers.",
    ],
    win: "“You called for the line. That's strength, not weakness.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Raise"},{lane:1,beat:1,word:"your"},{lane:2,beat:2,word:"hand"},{lane:3,beat:4,word:"call"},{lane:0,beat:5,word:"for"},{lane:1,beat:6,word:"help"} ] },
      { targets: [ {lane:3,beat:0,word:"No"},{lane:1,beat:1,word:"shame"},{lane:0,beat:2,word:"in"},{lane:2,beat:4,word:"a"},{lane:1,beat:5,word:"life-"},{lane:3,beat:6,word:"line"} ] },
      { targets: [ {lane:0,beat:0,word:"Float"},{lane:2,beat:1,word:"don't"},{lane:1,beat:2,word:"fight"},{lane:3,beat:3,word:"the"},{lane:0,beat:5,word:"tide"},{lane:2,beat:6,word:"now"} ] },
      { targets: [ {lane:0,beat:0,word:"Strong"},{lane:1,beat:1,word:"is"},{lane:2,beat:2,word:"ask-"},{lane:3,beat:3,word:"ing"},{lane:1,beat:5,word:"to-"},{lane:3,beat:6,word:"geth-"},{lane:0,beat:7,word:"er"} ] },
    ],
  },
  {
    mentor: "Postmaster Pim", emoji: "🐢", color: "#6B4E2E", bpm: 92, bassNote: "C2", season: 2,
    lesson: "Showing up daily beats showing off",
    blurb: "Mail-carrier tortoise. Same route, every day, present every step.",
    introLines: [
      "Slow ain't behind. Slow is still movin'.",
      "I never miss a day. That's the whole trick — show up, then show up again.",
    ],
    win: "“Showed up, stayed present, delivered. Every time.”",
    phrases: [
      { targets: [ {lane:0,beat:0,word:"Step"},{lane:1,beat:1,word:"by"},{lane:2,beat:2,word:"step"},{lane:3,beat:4,word:"I"},{lane:0,beat:5,word:"show"},{lane:1,beat:6,word:"up"} ] },
      { targets: [ {lane:3,beat:0,word:"Slow"},{lane:1,beat:1,word:"and"},{lane:0,beat:2,word:"stead-"},{lane:2,beat:4,word:"y"},{lane:1,beat:5,word:"wins"},{lane:3,beat:6,word:"out"} ] },
      { targets: [ {lane:0,beat:0,word:"Same"},{lane:1,beat:1,word:"time"},{lane:2,beat:2,word:"same"},{lane:3,beat:3,word:"street"},{lane:0,beat:5,word:"eve-"},{lane:2,beat:6,word:"ry"},{lane:1,beat:6.5,word:"day"} ] },
      { targets: [ {lane:0,beat:0,word:"Show-"},{lane:1,beat:1,word:"ing"},{lane:2,beat:2,word:"up"},{lane:3,beat:3,word:"beats"},{lane:0,beat:5,word:"show-"},{lane:1,beat:6,word:"ing"},{lane:3,beat:7,word:"off"} ] },
    ],
  },
];

// ---------- Eddie Rap Life guest stage (spec §10) ----------
// PLACEHOLDER original bars — NOT Eddie's actual lyrics. Real lines are gated
// on a signed artist agreement through Rap Royalty Life.
const EDDIE = {
  mentor: "Eddie Rap Life", emoji: "🎤", color: "#A8332E", bpm: 100, bassNote: "A1",
  season: 0, guest: true,
  lesson: "Skater Island showcase (guest)",
  blurb: "Guest performance. Skater Island heritage, all positivity.",
  introLines: [
    "Guest set! Placeholder bars 'til the ink's dry on the deal.",
    "Skater Island in the house — hands up, stay in the now, and ride with me.",
  ],
  win: "“That's the guest spot. Catch the real bars on the record.”",
  note: "Demo guest stage. Final Eddie Rap Life bars + licensed instrumental are gated on a signed agreement (Rap Royalty Life). These lines are original placeholders.",
  phrases: [
    { targets: [ {lane:0,beat:0,word:"Push"},{lane:1,beat:1,word:"off"},{lane:2,beat:2,word:"the"},{lane:3,beat:3,word:"curb"},{lane:0,beat:5,word:"feel"},{lane:1,beat:6,word:"free"} ] },
    { targets: [ {lane:3,beat:0,word:"Is-"},{lane:1,beat:1,word:"land"},{lane:0,beat:2,word:"in"},{lane:2,beat:4,word:"my"},{lane:1,beat:5,word:"heart"},{lane:3,beat:6,word:"now"} ] },
    { targets: [ {lane:0,beat:0,word:"Hands"},{lane:1,beat:1,word:"up"},{lane:2,beat:2,word:"for"},{lane:3,beat:4,word:"the"},{lane:0,beat:5,word:"home"},{lane:2,beat:6,word:"team"} ] },
    { targets: [ {lane:3,beat:0,word:"Stay"},{lane:1,beat:1,word:"in"},{lane:2,beat:2,word:"the"},{lane:0,beat:3,word:"NOW"},{lane:1,beat:5,word:"and"},{lane:3,beat:6,word:"ride"} ] },
  ],
};

// Flat, index-addressable list the engine uses everywhere.
export const ALL_STAGES = [...SEASON1, ...SEASON2, EDDIE];
export const EDDIE_INDEX = ALL_STAGES.indexOf(EDDIE);

export const SEASONS = [
  { n: 1, title: "Season 1", idxs: [0, 1, 2] },
  { n: 2, title: "Season 2", idxs: [3, 4, 5] },
];

// Legacy alias (Season 1 only) so older imports still resolve.
export const STAGES = SEASON1;

export function ratingFor(acc) {
  return acc >= 0.9 ? "BLAZING" : acc >= 0.65 ? "SOLID" : acc >= 0.4 ? "SHAKY" : "LOST";
}
export function ratingColor(r) {
  return r === "BLAZING" ? gold : r === "SOLID" ? green : r === "SHAKY" ? "#B8860B" : red;
}
