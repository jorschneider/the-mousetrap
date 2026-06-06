#!/usr/bin/env node
// gen-audio.js — pre-renders the eight Moments via Hume Octave TTS.
// Phase A designs and saves one consistent custom voice per character;
// Phase B renders every line with per-line ACTING INSTRUCTIONS (asides get hushed delivery).
// Output: audio/*.mp3 + audio/manifest.json
// Run: node --env-file=.env.local gen-audio.js   (needs HUME_API_KEY)
// Anchors below must match MOMENTS in app.js — regenerate after changing them.

const fs = require('fs');
const path = require('path');

const KEY = process.env.HUME_API_KEY;
if (!KEY) { console.error('HUME_API_KEY not set. Run: node --env-file=.env.local gen-audio.js'); process.exit(1); }
const API = 'https://api.hume.ai/v0/tts';
const HDRS = { 'X-Hume-Api-Key': KEY, 'Content-Type': 'application/json' };

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

// ---- the casting: voice DESIGN (minted once) + ACTING instructions (every line) ----
const CAST = {
  HAMLET: {
    name: 'mousetrap-hamlet',
    design: 'A young classical stage actor, mid-twenties: light baritone, quick and rough-edged; intelligent, wounded, restless. British RP with modern edges.',
    sample: 'To be, or not to be: that is the question: whether \'tis nobler in the mind to suffer the slings and arrows of outrageous fortune.',
    acting: 'Shakespearean verse, spoken on stage: quick and rough-edged, real doubt running beneath a performance of resolve. Never hammy.',
  },
  CLAUDIUS: {
    name: 'mousetrap-claudius',
    design: 'A king in his fifties: rich, warm, politically polished baritone; effortlessly charming, every word managed. British RP.',
    sample: 'Though yet of Hamlet our dear brother\'s death the memory be green, we have thought fit to take him into our court.',
    acting: 'Shakespearean verse: smooth, warm, kingly; the kindness is the instrument; guilt sealed beneath an unfailingly pleasant surface.',
  },
  GERTRUDE: {
    name: 'mousetrap-gertrude',
    design: 'A queen in her fifties: composed alto, dry and precise, dignified; adult grief held firmly in check. British RP.',
    sample: 'Good Hamlet, cast thy nighted colour off, and let thine eye look like a friend on Denmark.',
    acting: 'Shakespearean verse: composed, adult, dry; precise and dignified, never weepy.',
  },
  OPHELIA: {
    name: 'mousetrap-ophelia',
    design: 'A young woman, early twenties: light, clear, luminous voice; tightly controlled, porous underneath. British RP.',
    sample: 'O, what a noble mind is here o\'erthrown! The courtier\'s, soldier\'s, scholar\'s, eye, tongue, sword.',
    acting: 'Shakespearean verse: clear and light, tightly controlled; grief held, not performed.',
  },
  POLONIUS: {
    name: 'mousetrap-polonius',
    design: 'An old court counsellor in his seventies: thin, dry, flat, deliberate voice; a deadpan operator stating conclusions. British RP.',
    sample: 'Neither a borrower nor a lender be, for loan oft loses both itself and friend.',
    acting: 'Shakespearean verse: flat, deliberate, deadpan; an operator giving orders and calling them advice.',
  },
  HORATIO: {
    name: 'mousetrap-horatio',
    design: 'A young scholar: calm, steady, quietly warm tenor; stillness that reads as devotion. British RP.',
    sample: 'I saw him once; he was a goodly king. He was a man, take him for all in all, I shall not look upon his like again.',
    acting: 'Shakespearean verse: calm, still, quietly warm; restraint that is itself affection. At grief, one controlled crack.',
  },
  GHOST: {
    name: 'mousetrap-ghost',
    design: 'The ghost of a dead king: a deep, hollow, resonant bass whisper with iron in it; slow, urgent, otherworldly but regal.',
    sample: 'I am thy father\'s spirit, doom\'d for a certain term to walk the night, and for the day confined to fast in fires.',
    acting: 'A low whisper with iron in it: slow, hushed, urgent; a dead king racing the sunrise; efficient, never maudlin.',
  },
  ROSENCRANTZ: {
    name: 'mousetrap-rg',
    design: 'A mild, eager young courtier: pleasant, brisk, slightly too smooth tenor; glad to be of use. British RP.',
    sample: 'Both your majesties might, by the sovereign power you have of us, put your dread pleasures more into command than to entreaty.',
    acting: 'Shakespearean verse: pleasant, brisk, eager to serve, slightly too smooth. One actor plays both courtiers in an identical voice — no differentiation, ever.',
  },
};
CAST.GUILDENSTERN = CAST.ROSENCRANTZ; // one actor, one voice, no seam
CAST.ALL = { ...CAST.ROSENCRANTZ, acting: 'Courtiers crying out in alarm, urgent, overlapping, frightened.' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function hume(body) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(API, { method: 'POST', headers: HDRS, body: JSON.stringify(body) });
    } catch (e) { // transient network failure (ECONNRESET etc.)
      if (attempt >= 8) throw e;
      process.stdout.write(` [network error, retrying]`);
      await sleep(8000);
      continue;
    }
    if (res.ok) return res.json();
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429 && attempt < 8) {
      const wait = Math.min(60, 10 * (attempt + 1));
      process.stdout.write(` [rate limited, waiting ${wait}s]`);
      await sleep(wait * 1000);
      continue;
    }
    throw new Error(`Hume ${res.status}: ${detail}`);
  }
}

async function listCustomVoices() {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${API}/voices?provider=CUSTOM_VOICE&page_size=100`, { headers: HDRS });
    if (res.ok) {
      const d = await res.json();
      return (d.voices_page || []).map(v => v.name.toLowerCase());
    }
    await sleep(10000);
  }
  throw new Error('could not list custom voices');
}

async function ensureVoices() {
  const existing = await listCustomVoices();
  const wanted = [...new Set(Object.values(CAST).map(c => c.name))];
  for (const name of wanted) {
    if (existing.includes(name)) { console.log(`  voice ${name}: exists`); continue; }
    const c = Object.values(CAST).find(c => c.name === name);
    process.stdout.write(`  voice ${name}: designing...`);
    const gen = await hume({
      // voice DESIGN requires the description parameter, which only Octave 1 accepts;
      // the minted voices are compatible with Octave 2 at render time
      utterances: [{ text: c.sample, description: c.design }],
      format: { type: 'mp3' }, num_generations: 1, version: '1',
    });
    const genId = gen.generations[0].generation_id;
    const save = await fetch(`${API}/voices`, {
      method: 'POST', headers: HDRS,
      body: JSON.stringify({ generation_id: genId, name }),
    });
    if (!save.ok) {
      const detail = await save.text();
      if (/already exists/i.test(detail)) { console.log(' already minted'); continue; }
      throw new Error(`save voice ${name}: ${save.status} ${detail.slice(0, 200)}`);
    }
    console.log(' minted');
  }
}

async function tts(text, cast, mode, file) {
  // Octave 2 rejects the description parameter — delivery comes from the
  // designed voice + the text itself. (cast.acting is kept above as the
  // casting record and for any future model that takes direction again.)
  const d = await hume({
    utterances: [{
      text,
      voice: { name: cast.name, provider: 'CUSTOM_VOICE' },
    }],
    format: { type: 'mp3' }, num_generations: 1, version: '2',
  });
  fs.writeFileSync(file, Buffer.from(d.generations[0].audio, 'base64'));
}

(async () => {
  console.log('Phase A — the voice casting:');
  await ensureVoices();

  console.log('Phase B — the takes:');
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
      process.stdout.write(`  m${mi + 1} ${step.char.padEnd(13)}${step.mode ? ' (' + step.mode + ')' : ''} ${text.slice(0, 46)}...`);
      await tts(text, CAST[step.char], step.mode, f);
      made++;
      console.log(` ok (${Math.round(fs.statSync(f).size / 1024)} KB)`);
      await sleep(1500); // stay under the per-minute quota
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
  console.log(`\n${made} takes rendered, ${skipped} already existed, ${Object.keys(manifest).length} in manifest, ~${chars} chars sent.`);
})();
