#!/usr/bin/env node
// gen-audio.js — pre-renders TTS audio for the eight Moments via ElevenLabs (eleven_multilingual_v2).
// Each character is cast to a premade voice with per-role expressiveness settings.
// Output: audio/*.mp3 + audio/manifest.json
// Run: node --env-file=<path-to-env-with-ELEVENLABS_API_KEY> gen-audio.js
// Anchors below must match MOMENTS in app.js — regenerate after changing them.

const fs = require('fs');
const path = require('path');

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('ELEVENLABS_API_KEY not set. Run: node --env-file=<env file> gen-audio.js'); process.exit(1); }

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

// ---- the voice casting (ElevenLabs premade voices; IDs are universal) ----
// voice_settings: lower stability = more volatile; style = expressiveness boost
const CAST = {
  HAMLET:       { voice: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',  settings: { stability: 0.35, similarity_boost: 0.8, style: 0.6,  use_speaker_boost: true } }, // intense, rough-edged
  CLAUDIUS:     { voice: 'JBFqnCBsd6RMkjVDRZzb', name: 'George',  settings: { stability: 0.6,  similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }, // warm, smooth, political
  GERTRUDE:     { voice: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', settings: { stability: 0.55, similarity_boost: 0.8, style: 0.4,  use_speaker_boost: true } }, // composed, adult
  OPHELIA:      { voice: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily',    settings: { stability: 0.45, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true } }, // light, held-together
  POLONIUS:     { voice: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',  settings: { stability: 0.7,  similarity_boost: 0.8, style: 0.2,  use_speaker_boost: true } }, // flat operator
  HORATIO:      { voice: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam',    settings: { stability: 0.65, similarity_boost: 0.8, style: 0.3,  use_speaker_boost: true } }, // still, warm
  GHOST:        { voice: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   settings: { stability: 0.3,  similarity_boost: 0.8, style: 0.8,  use_speaker_boost: true } }, // deep, maximal drama
  ROSENCRANTZ:  { voice: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', settings: { stability: 0.6,  similarity_boost: 0.8, style: 0.4,  use_speaker_boost: true } }, // pleasant, too smooth —
  GUILDENSTERN: { voice: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', settings: { stability: 0.6,  similarity_boost: 0.8, style: 0.4,  use_speaker_boost: true } }, // — same actor, no seam
  ALL:          { voice: 'nPczCjzI2devNBz1zQrb', name: 'Brian',   settings: { stability: 0.3,  similarity_boost: 0.7, style: 0.7,  use_speaker_boost: true } },
};

async function tts(text, cast, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${cast.voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: cast.settings,
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
