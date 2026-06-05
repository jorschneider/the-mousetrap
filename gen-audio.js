#!/usr/bin/env node
// gen-audio.js — pre-renders TTS audio for the eight Moments via OpenAI gpt-4o-mini-tts.
// Each character is voice-cast and given delivery direction. Output: audio/*.mp3 + audio/manifest.json
// Run: node --env-file=<path-to-env-with-OPENAI_API_KEY> gen-audio.js
// Anchors below must match MOMENTS in app.js — regenerate after changing them.

const fs = require('fs');
const path = require('path');

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY not set. Run: node --env-file=<env file> gen-audio.js'); process.exit(1); }

const OUT = path.join(__dirname, 'audio');
fs.mkdirSync(OUT, { recursive: true });

// ---- rebuild the timeline exactly as app.js does ----
global.window = {};
eval(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8'));
const M = window.MOUSETRAP;

const LINES_PER_PAGE = 4;
const timeline = [];
M.script.scenes.forEach(scene => {
  timeline.push({ kind: 'scenecard', scene: scene.id });
  scene.events.forEach((ev, eventIdx) => {
    if (ev.type === 'direction') {
      timeline.push({ kind: 'direction', scene: scene.id, eventIdx, text: ev.text });
    } else {
      const lines = ev.lines.filter(l => l.trim());
      for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
        timeline.push({ kind: 'page', scene: scene.id, eventIdx, char: ev.char, mode: ev.mode,
          text: lines.slice(i, i + LINES_PER_PAGE).join('\n') });
      }
    }
  });
});
const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
function findStep(sceneId, substr, fromIdx) {
  const needle = norm(substr);
  for (let i = fromIdx || 0; i < timeline.length; i++) {
    const t = timeline[i];
    if (t.scene !== sceneId || t.kind === 'scenecard') continue;
    if (norm(t.text).includes(needle)) return i;
  }
  return -1;
}
function endOfSpeech(i) {
  if (timeline[i].kind !== 'page') return i;
  const ev = timeline[i].eventIdx, sc = timeline[i].scene;
  let j = i;
  while (j + 1 < timeline.length && timeline[j + 1].kind === 'page' &&
         timeline[j + 1].scene === sc && timeline[j + 1].eventIdx === ev) j++;
  return j;
}

// ---- the eight moments (anchors mirror app.js) ----
const MOMENTS = [
  { scene: 1, from: 'A silence. The GHOST and HAMLET alone', to: 'My hour is almost come', wholeSpeech: true },
  { scene: 2, from: 'Both your majesties', to: 'To be commanded', wholeSpeech: true },
  { scene: 2, from: 'To be, or not to be', to: 'And lose the name of action' },
  { scene: 3, from: 'This is one Lucianus', to: 'Lights, lights, lights' },
  { scene: 3, from: 'O, the recorders', to: 'you cannot play upon me' },
  { scene: 4, from: 'On him, on him', to: 'yet all that is I see' },
  { scene: 5, from: 'The queen carouses to thy fortune', to: 'it is too late' },
  { scene: 5, from: 'report me and my cause', to: 'bid the soldiers shoot' },
];
MOMENTS.forEach(m => {
  m.start = findStep(m.scene, m.from);
  let end = findStep(m.scene, m.to, m.start === -1 ? 0 : m.start);
  if (end !== -1 && m.wholeSpeech) end = endOfSpeech(end);
  m.end = end;
});

// ---- the voice casting ----
const CAST = {
  HAMLET:       { voice: 'ballad',  instructions: 'A young stage actor playing Hamlet: quick, rough-edged, intelligent; real doubt running under a performance of resolve. Shakespearean verse, theatrical but never hammy.' },
  CLAUDIUS:     { voice: 'onyx',    instructions: 'A king whose warmth is the instrument: smooth, kind-sounding, politically polished; guilt sealed beneath an unfailingly pleasant surface. Shakespearean verse.' },
  GERTRUDE:     { voice: 'sage',    instructions: 'A queen: composed, adult, dry grief; precise and dignified, never weepy. Shakespearean verse.' },
  OPHELIA:      { voice: 'shimmer', instructions: 'A young woman holding herself together: clear, light, tightly controlled; grief held, not performed. Shakespearean verse.' },
  POLONIUS:     { voice: 'ash',     instructions: 'An old court counsellor and surveillance man: flat, deliberate, deadpan; an operator stating conclusions. Shakespearean verse.' },
  HORATIO:      { voice: 'echo',    instructions: 'The loyal friend: calm, still, quietly warm; restraint that is itself affection. At grief, one controlled crack. Shakespearean verse.' },
  GHOST:        { voice: 'fable',   instructions: 'The ghost of a dead king racing the dawn: slow, hushed, urgent; a low whisper with iron in it; efficient, never maudlin. Shakespearean verse.' },
  ROSENCRANTZ:  { voice: 'verse',   instructions: 'An eager, mild courtier glad to be of use; pleasant, brisk, slightly too smooth. One actor plays both Rosencrantz and Guildenstern in an identical voice — no differentiation.' },
  GUILDENSTERN: { voice: 'verse',   instructions: 'An eager, mild courtier glad to be of use; pleasant, brisk, slightly too smooth. One actor plays both Rosencrantz and Guildenstern in an identical voice — no differentiation.' },
  ALL:          { voice: 'alloy',   instructions: 'Courtiers crying out in alarm, urgent and overlapping.' },
};

async function tts(text, cast, file) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: cast.voice,
      input: text,
      instructions: cast.instructions,
      response_format: 'mp3',
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

(async () => {
  const manifest = {};
  let made = 0, skipped = 0, chars = 0;
  for (let mi = 0; mi < MOMENTS.length; mi++) {
    const m = MOMENTS[mi];
    if (m.start === -1 || m.end === -1) { console.error(`moment ${mi + 1}: anchors unresolved, skipping`); continue; }
    for (let p = m.start; p <= m.end; p++) {
      const step = timeline[p];
      if (step.kind !== 'page' || !CAST[step.char]) continue;
      const offset = p - m.start;
      const name = `m${mi + 1}-${offset}.mp3`;
      manifest[`${mi + 1}:${offset}`] = name;
      const f = path.join(OUT, name);
      if (fs.existsSync(f)) { skipped++; continue; } // resumable
      const text = step.text.replace(/\n/g, ' ');
      chars += text.length;
      process.stdout.write(`  m${mi + 1} ${step.char.padEnd(13)} ${text.slice(0, 50)}...`);
      await tts(text, CAST[step.char], f);
      made++;
      console.log(` ok (${Math.round(fs.statSync(f).size / 1024)} KB)`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`\n${made} clips generated, ${skipped} already existed, ${Object.keys(manifest).length} in manifest, ~${chars} chars sent.`);
})();
