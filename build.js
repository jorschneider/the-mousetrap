#!/usr/bin/env node
// build.js — compiles ~/the-mousetrap/sim artifacts into data.js for the site.
// No dependencies. Run: node build.js

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SIM = path.join(ROOT, 'sim');

const read = p => fs.readFileSync(p, 'utf8');
const exists = p => fs.existsSync(p);

// ---------------------------------------------------------------- markdown → html (minimal)
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function inlineMd(s) {
  return escapeHtml(s)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null; // 'ul' | 'ol'
  let inQuote = false;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeQuote = () => { if (inQuote) { out.push('</blockquote>'); inQuote = false; } };
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) { closeList(); closeQuote(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)/))) {
      closeList(); closeQuote();
      const lvl = Math.min(m[1].length + 1, 5); // shift down: doc titles render as h2+
      out.push(`<h${lvl}>${inlineMd(m[2])}</h${lvl}>`);
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      closeList(); closeQuote();
      out.push('<hr>');
    } else if ((m = line.match(/^>\s?(.*)/))) {
      closeList();
      if (!inQuote) { out.push('<blockquote>'); inQuote = true; }
      out.push(`<p>${inlineMd(m[1])}</p>`);
    } else if ((m = line.match(/^\s*[-*+]\s+(.*)/))) {
      closeQuote();
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inlineMd(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) {
      closeQuote();
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inlineMd(m[1])}</li>`);
    } else {
      closeList(); closeQuote();
      out.push(`<p>${inlineMd(line)}</p>`);
    }
  }
  closeList(); closeQuote();
  return out.join('\n');
}

// ---------------------------------------------------------------- script parsing
// Format: scenes under markdown headers containing "scene"; speakers as ALL-CAPS
// lines (possibly bolded); stage directions in *italics* or [brackets];
// [Q: ...] margin notes attach to the preceding element.
const KNOWN_CHARS = ['HAMLET', 'CLAUDIUS', 'GERTRUDE', 'OPHELIA', 'POLONIUS', 'HORATIO', 'GHOST', 'ROSENCRANTZ', 'GUILDENSTERN'];

function normalizeSpeaker(s) {
  return s.replace(/[*_:.]/g, '').trim().toUpperCase();
}
function isSpeakerLine(line) {
  let stripped = line.replace(/[*_:.]/g, '').trim();
  if (!stripped || stripped.length > 60) return null;
  // peel a trailing parenthetical delivery note: CLAUDIUS (aside), HAMLET (to Horatio)
  let paren = null;
  const pm = stripped.match(/^(.*?)\s*\((.+?)\)$/);
  if (pm) { stripped = pm[1].trim(); paren = pm[2].trim(); }
  if (!stripped || stripped.length > 40) return null;
  if (stripped !== stripped.toUpperCase()) return null; // name must already be all-caps
  const t = stripped.toUpperCase();
  // known characters, or "PLAYER KING"-style caps lines of 1-4 words
  if (KNOWN_CHARS.includes(t)) return { name: t, paren };
  if (/^[A-Z][A-Z &.'\-]+$/.test(t) && t.split(/\s+/).length <= 4) return { name: t, paren };
  return null;
}

function parseScript(md) {
  const lines = md.split('\n');
  const scenes = [];
  let scene = null;
  let speech = null;
  let title = 'HAMLET';

  const pushSpeech = () => {
    if (speech && speech.lines.length) scene.events.push(speech);
    speech = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    let m;

    // scene header
    if ((m = trimmed.match(/^#{1,4}\s*(.*scene.*)$/i)) || (m = trimmed.match(/^#{1,4}\s*((?:SCENE|Scene)\b.*)$/))) {
      pushSpeech();
      scene = { id: scenes.length + 1, title: m[1].replace(/[#*]/g, '').trim(), events: [] };
      scenes.push(scene);
      continue;
    }
    // top-level title (first h1 before any scene)
    if (!scene && (m = trimmed.match(/^#\s+(.*)/))) { title = m[1].replace(/[*]/g, '').trim(); continue; }
    if (!scene) continue; // skip front matter (title page, dramatis personae)

    if (!trimmed) { continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { pushSpeech(); continue; } // horizontal rule

    // margin note [Q: ...]
    if ((m = trimmed.match(/^\[Q:\s*(.*?)\]?$/i))) {
      const note = m[1].replace(/\]$/, '');
      const target = speech || scene.events[scene.events.length - 1];
      if (target) (target.notes = target.notes || []).push(note);
      continue;
    }
    // stage direction: fully italic or bracketed
    if (/^\*[^*].*\*$/.test(trimmed) || /^_[^_].*_$/.test(trimmed) || /^\[.*\]$/.test(trimmed) || /^\(.*\)$/.test(trimmed)) {
      pushSpeech();
      const text = trimmed.replace(/^\*|\*$/g, '').replace(/^_|_$/g, '').replace(/^\[|\]$/g, '').replace(/^\(|\)$/g, '').trim();
      if (text) scene.events.push({ type: 'direction', text });
      continue;
    }
    // speaker
    const speaker = isSpeakerLine(trimmed);
    if (speaker) {
      pushSpeech();
      speech = { type: 'speech', char: speaker.name, lines: [] };
      if (speaker.paren) speech.mode = speaker.paren; // (aside), (to Horatio), (behind)
      continue;
    }
    // dialogue line (or stray prose)
    if (speech) {
      // inline direction inside a speech, e.g. *He rises.*
      speech.lines.push(trimmed.replace(/^\s*[-–]\s*/, ''));
    } else {
      // prose outside a speech — treat as direction
      scene.events.push({ type: 'direction', text: trimmed.replace(/[*_]/g, '') });
    }
  }
  pushSpeech();
  return { title, scenes };
}

// ---------------------------------------------------------------- staging anchor resolution
function normAnchor(s) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}
function resolveStaging(staging, scenes) {
  const warnings = [];
  if (!staging) return { staging: null, warnings: ['no staging.json'] };
  for (const sc of staging.scenes || []) {
    const scene = scenes.find(s => s.id === sc.id) || scenes[(sc.id || 1) - 1];
    if (!scene) { warnings.push(`staging scene ${sc.id}: no matching script scene`); continue; }
    let cursor = 0;
    for (const beat of sc.beats || []) {
      const anchor = normAnchor(beat.anchor || '');
      let found = -1;
      if (anchor) {
        for (let i = cursor; i < scene.events.length; i++) {
          const ev = scene.events[i];
          const text = ev.type === 'speech' ? ev.lines.join(' ') : ev.text;
          if (normAnchor(text).startsWith(anchor) || normAnchor(text).includes(anchor)) { found = i; break; }
        }
        // fall back: search from the top of the scene (out-of-order anchor)
        if (found === -1) {
          for (let i = 0; i < scene.events.length; i++) {
            const ev = scene.events[i];
            const text = ev.type === 'speech' ? ev.lines.join(' ') : ev.text;
            if (normAnchor(text).startsWith(anchor)) { found = i; break; }
          }
        }
      }
      if (found === -1) {
        warnings.push(`scene ${sc.id} beat ${beat.id}: anchor not found: "${beat.anchor}"`);
        beat.eventIndex = cursor; // fire where the cursor is — keeps order sane
      } else {
        beat.eventIndex = found;
        cursor = found;
      }
    }
  }
  return { staging, warnings };
}

// ---------------------------------------------------------------- document manifest
const DOC_ORDER = [
  { glob: 'memos/01-quarto-intent.md', phase: 'I. The Writers’ Room', author: 'Quarto', title: 'The Adapter’s Note' },
  { glob: 'memos/02-folio-response.md', phase: 'I. The Writers’ Room', author: 'Folio', title: 'The Dramaturg Responds' },
  { glob: 'casting/briefs.md', phase: 'II. The Auditions', author: 'Callboard', title: 'Role Briefs' },
  { glob: 'casting/auditions/*.md', phase: 'II. The Auditions', author: null, title: null },
  { glob: 'casting/decisions.md', phase: 'III. The Casting', author: 'Arden', title: 'Casting Decisions' },
  { glob: 'rehearsal/diaries/*.md', phase: 'IV. The Rehearsal', author: null, title: null },
  { glob: 'rehearsal/arden-notes.md', phase: 'IV. The Rehearsal', author: 'Arden', title: 'Director’s Notes After the Table Read' },
  { glob: 'memos/03-quarto-v2-changelog.md', phase: 'IV. The Rehearsal', author: 'Quarto', title: 'The Revision Changelog' },
  { glob: 'design-notes.md', phase: 'V. The Staging', author: 'Scrim', title: 'Design Notes' },
  { glob: 'review/yorick-review.md', phase: 'VI. Opening Night', author: 'Yorick', title: 'The Review' },
];

const TITLECASE = s => s.replace(/\b\w/g, c => c.toUpperCase());

function prettyFromFilename(file, kind) {
  const base = path.basename(file, '.md');
  if (kind === 'audition') {
    const [role, actor] = base.split('--');
    return {
      author: TITLECASE((actor || '').replace(/-/g, ' ')),
      title: `Audition: ${TITLECASE((role || '').replace(/-/g, ' '))}`,
    };
  }
  return { author: TITLECASE(base.replace(/-/g, ' ')), title: `Rehearsal Diary: ${TITLECASE(base.replace(/-/g, ' '))}` };
}

function collectDocs() {
  const docs = [];
  for (const spec of DOC_ORDER) {
    if (spec.glob.includes('*')) {
      const dir = path.join(SIM, path.dirname(spec.glob));
      if (!exists(dir)) continue;
      const kind = spec.glob.includes('auditions') ? 'audition' : 'diary';
      for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()) {
        const meta = prettyFromFilename(f, kind);
        docs.push({
          id: `${path.dirname(spec.glob)}/${f}`.replace(/[\/.]/g, '-'),
          phase: spec.phase, author: meta.author, title: meta.title,
          path: path.join(path.dirname(spec.glob), f),
          html: mdToHtml(read(path.join(dir, f))),
        });
      }
    } else {
      const p = path.join(SIM, spec.glob);
      if (!exists(p)) { console.warn(`  [warn] missing doc: ${spec.glob}`); continue; }
      docs.push({
        id: spec.glob.replace(/[\/.]/g, '-'),
        phase: spec.phase, author: spec.author, title: spec.title,
        path: spec.glob,
        html: mdToHtml(read(p)),
      });
    }
  }
  return docs;
}

// ---------------------------------------------------------------- main
function main() {
  const scriptPath = exists(path.join(SIM, 'script-v2.md')) ? path.join(SIM, 'script-v2.md') : path.join(SIM, 'script-v1.md');
  if (!exists(scriptPath)) { console.error('No script found in sim/. Run the simulation first.'); process.exit(1); }
  console.log(`Parsing ${path.basename(scriptPath)} ...`);
  const script = parseScript(read(scriptPath));
  console.log(`  ${script.scenes.length} scenes, ${script.scenes.reduce((n, s) => n + s.events.length, 0)} events`);
  for (const s of script.scenes) {
    const speeches = s.events.filter(e => e.type === 'speech').length;
    console.log(`  scene ${s.id} "${s.title}": ${speeches} speeches, ${s.events.length - speeches} directions`);
  }

  let staging = null;
  if (exists(path.join(SIM, 'staging.json'))) {
    staging = JSON.parse(read(path.join(SIM, 'staging.json')));
  }
  const resolved = resolveStaging(staging, script.scenes);
  for (const w of resolved.warnings) console.warn(`  [staging] ${w}`);

  const docs = collectDocs();
  console.log(`  ${docs.length} diary documents`);

  const company = JSON.parse(read(path.join(ROOT, 'company.json')));
  const cast = exists(path.join(SIM, 'cast.json')) ? JSON.parse(read(path.join(SIM, 'cast.json'))) : [];

  const data = { script, staging: resolved.staging, docs, company, cast };
  fs.writeFileSync(path.join(ROOT, 'data.js'), 'window.MOUSETRAP = ' + JSON.stringify(data) + ';\n');
  const kb = Math.round(fs.statSync(path.join(ROOT, 'data.js')).size / 1024);
  console.log(`Wrote data.js (${kb} KB)`);
  if (resolved.warnings.length) console.log(`${resolved.warnings.length} staging warnings — review above.`);
}

main();
