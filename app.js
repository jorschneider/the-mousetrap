/* THE MOUSETRAP COMPANY — stage engine + production diary
   Plays script scenes against Scrim's staging.json promptbook:
   beats anchored to speeches set positions, lights, and calls. */

(function () {
  const D = window.MOUSETRAP;
  if (!D || !D.script) {
    document.getElementById('surtitleText').textContent =
      'No production data found — run `node build.js` after the simulation completes.';
    return;
  }

  const $ = id => document.getElementById(id);
  const scenes = D.script.scenes;
  const staging = D.staging || { scenes: [], characters: [] };
  const stageScene = id => (staging.scenes || []).find(s => s.id === id) || null;
  const GRID = (staging.stage && staging.stage.grid) || { cols: 12, rows: 7 };

  const castByRole = {};
  (D.cast || []).forEach(c => {
    // "Rosencrantz & Guildenstern" maps each name to the same actor
    c.role.split(/\s*&\s*/).forEach(r => { castByRole[r.trim().toUpperCase()] = c.actor; });
  });
  const charMeta = {};
  (staging.characters || []).forEach(c => { charMeta[c.id.toUpperCase()] = c; });

  /* ---------------------------------------------------------- timeline
     Flatten scenes into playable steps. Speeches are paginated into
     surtitle pages of a few lines each. */
  const LINES_PER_PAGE = 4;
  const timeline = [];
  scenes.forEach(scene => {
    timeline.push({ kind: 'scenecard', scene: scene.id });
    scene.events.forEach((ev, eventIdx) => {
      if (ev.type === 'direction') {
        timeline.push({ kind: 'direction', scene: scene.id, eventIdx, text: ev.text });
      } else {
        const lines = ev.lines.filter(l => l.trim());
        for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
          timeline.push({
            kind: 'page', scene: scene.id, eventIdx, char: ev.char,
            text: lines.slice(i, i + LINES_PER_PAGE).join('\n'),
            first: i === 0,
          });
        }
      }
    });
  });

  /* ---------------------------------------------------------- figures */
  const FIG_COLORS = ['#c9a35a', '#8c2f28', '#5a7d8c', '#7a6a8f', '#6d8c5a', '#b5836b', '#9fb3c8', '#8f8f6a', '#c97f9d'];
  // Scrim staged R&G as one figure ("RG") — Patch 2.3.1 plays both. Map speakers to it.
  const FIG_ALIAS = { ROSENCRANTZ: 'RG', GUILDENSTERN: 'RG' };
  const NO_FIGURE = ['ALL']; // group lines have no figure of their own
  const figureFor = char => FIG_ALIAS[char] || char;
  const allChars = [];
  scenes.forEach(s => s.events.forEach(e => {
    if (e.type !== 'speech') return;
    const f = figureFor(e.char);
    if (!NO_FIGURE.includes(e.char) && !allChars.includes(f)) allChars.push(f);
  }));
  // staging may know characters the script-parser missed
  Object.keys(charMeta).forEach(c => { if (!allChars.includes(c)) allChars.push(c); });

  const figuresEl = $('figures');
  const figEls = {};
  function silhouetteSVG(color, isGhost) {
    // Craig-style flat figure: hooded robe + head, one color
    return `<svg viewBox="0 0 60 120" class="fig-body" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="30" cy="116" rx="22" ry="4" fill="rgba(0,0,0,.45)"/>
      <path d="M30 14 C 38 14 43 20 43 28 L 47 52 C 52 80 50 104 48 114 L 12 114 C 10 104 8 80 13 52 L 17 28 C 17 20 22 14 30 14 Z"
            fill="${color}" ${isGhost ? 'opacity=".85"' : ''}/>
      <circle cx="30" cy="12" r="9" fill="${color}" />
      <path d="M21 12 a9 9 0 0 1 18 0 l -2 6 a 16 16 0 0 0 -14 0 Z" fill="rgba(0,0,0,.25)"/>
    </svg>`;
  }
  allChars.forEach((char, i) => {
    const meta = charMeta[char] || {};
    const color = meta.color || FIG_COLORS[i % FIG_COLORS.length];
    const el = document.createElement('div');
    el.className = 'figure offstage' + (char === 'GHOST' ? ' is-ghost' : '');
    el.dataset.char = char;
    el.innerHTML = silhouetteSVG(color, char === 'GHOST') +
      `<div class="fig-label">${char === 'RG' ? 'R & G' : char}</div>`;
    figuresEl.appendChild(el);
    figEls[char] = el;
  });

  function placeFigure(char, pos) {
    const el = figEls[char];
    if (!el) return;
    if (!pos) { el.classList.add('offstage'); return; }
    el.classList.remove('offstage');
    const left = ((pos.col + 0.5) / GRID.cols) * 100;
    const topPct = 36 + ((pos.row + 0.5) / GRID.rows) * 56; // feet between 40%..92%
    const scale = 0.78 + (pos.row / Math.max(GRID.rows - 1, 1)) * 0.34;
    el.style.left = left + '%';
    el.style.top = topPct + '%';
    el.style.zIndex = 4 + pos.row;
    el.style.width = (7.5 * scale) + '%';
    el.classList.toggle('facing-left', pos.facing === 'left');
    // stagger labels by column parity so adjacent figures' names don't collide
    const label = el.querySelector('.fig-label');
    if (label) label.style.marginTop = (pos.col % 2 === 0 ? 2 : 14) + 'px';
  }

  /* ---------------------------------------------------------- staging state */
  function activeBeat(sceneId, eventIdx) {
    const sc = stageScene(sceneId);
    if (!sc || !sc.beats) return null;
    let best = null;
    for (const b of sc.beats) {
      if (b.eventIndex == null || b.eventIndex <= eventIdx) best = b;
      else break;
    }
    return best;
  }

  function applyStaging(sceneId, eventIdx) {
    const scene = scenes.find(s => s.id === sceneId);
    const sc = stageScene(sceneId);
    const beat = sc ? activeBeat(sceneId, eventIdx) : null;

    // backdrop palette
    const pal = (sc && sc.palette && sc.palette.length >= 2) ? sc.palette : ['#1a2030', '#2c2a33', '#1c1a20'];
    $('backdrop').style.background =
      `linear-gradient(180deg, ${pal[0]}, ${pal[1]} 65%, ${pal[2] || pal[0]})`;

    // figures
    const onstage = (beat && beat.onstage) || {};
    allChars.forEach(c => placeFigure(c, onstage[c] || onstage[c && c.toUpperCase()] || null));

    // prompt corner
    $('pcScene').textContent = scene ? `${sceneId}. ${scene.title}` : String(sceneId);
    $('pcSet').textContent = (sc && sc.set) || '—';
    $('pcLight').textContent = (sc && sc.lighting) || '—';
    $('pcCue').textContent = (beat && beat.cue) || '—';
    $('pcMove').textContent = (beat && beat.movement) || '—';
    $('pcOnstage').textContent = 'ONSTAGE: ' + (Object.keys(onstage).length ? Object.keys(onstage).join(', ') : '(bare stage)');
  }

  /* ---------------------------------------------------------- playback */
  let pos = 0;
  let playing = false;
  let timer = null;
  let speed = 1;

  function stepDuration(step) {
    if (step.kind === 'scenecard') return 3400;
    if (step.kind === 'direction') return Math.max(1600, step.text.split(/\s+/).length * 240);
    const words = step.text.split(/\s+/).length;
    return Math.max(1900, words * 330);
  }

  function speakerLabel(char) {
    const meta = charMeta[char];
    const actor = (meta && meta.actor) || castByRole[char];
    return actor ? `${char} · ${actor}` : char;
  }

  function render() {
    const step = timeline[pos];
    if (!step) return;
    const sceneCard = $('sceneCard');
    const scene = scenes.find(s => s.id === step.scene);
    const sc = stageScene(step.scene);

    // scene tab highlight + progress
    document.querySelectorAll('.scene-tab').forEach(t =>
      t.classList.toggle('active', Number(t.dataset.scene) === step.scene));
    $('progressFill').style.width = ((pos / (timeline.length - 1)) * 100) + '%';

    allChars.forEach(c => figEls[c] && figEls[c].classList.remove('speaking'));

    if (step.kind === 'scenecard') {
      const shortTitle = scene ? scene.title.replace(/^scene\s+\w+\s*[—:.-]*\s*/i, '') : '';
      sceneCard.innerHTML = `
        <div class="sc-num">SCENE ${['I','II','III','IV','V'][step.scene - 1] || step.scene}</div>
        <div class="sc-title">${shortTitle}</div>
        <div class="sc-set">${sc && sc.set ? sc.set : ''}</div>`;
      sceneCard.classList.add('visible');
      $('surtitleChar').textContent = '';
      $('surtitleText').textContent = '';
      applyStaging(step.scene, -1);
    } else {
      sceneCard.classList.remove('visible');
      applyStaging(step.scene, step.eventIdx);
      if (step.kind === 'direction') {
        $('surtitleChar').textContent = '';
        $('surtitleText').textContent = step.text;
        $('surtitleText').classList.add('direction');
      } else {
        $('surtitleChar').textContent = speakerLabel(step.char);
        $('surtitleText').textContent = step.text;
        $('surtitleText').classList.remove('direction');
        const fig = figEls[figureFor(step.char)];
        if (fig) fig.classList.add('speaking');
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    timer = setTimeout(() => {
      if (pos < timeline.length - 1) { pos++; render(); schedule(); }
      else { setPlaying(false); }
    }, stepDuration(timeline[pos]) / speed);
  }

  function setPlaying(p) {
    playing = p;
    $('btnPlay').textContent = p ? '❚❚' : '▶';
    if (p) schedule(); else clearTimeout(timer);
  }

  function jump(newPos) {
    pos = Math.max(0, Math.min(timeline.length - 1, newPos));
    render();
    if (playing) schedule();
  }

  $('btnPlay').addEventListener('click', () => setPlaying(!playing));
  $('btnNext').addEventListener('click', () => jump(pos + 1));
  $('btnPrev').addEventListener('click', () => jump(pos - 1));
  $('speed').addEventListener('change', e => { speed = Number(e.target.value); if (playing) schedule(); });
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') jump(pos + 1);
    if (e.code === 'ArrowLeft') jump(pos - 1);
  });

  // scene tabs
  const tabsEl = $('sceneTabs');
  scenes.forEach(s => {
    const b = document.createElement('button');
    b.className = 'scene-tab';
    b.dataset.scene = s.id;
    b.textContent = `${['I','II','III','IV','V'][s.id - 1] || s.id}. ${s.title.replace(/^scene\s*\w*[:.\s—-]*/i, '')}`;
    b.addEventListener('click', () => jump(timeline.findIndex(t => t.kind === 'scenecard' && t.scene === s.id)));
    tabsEl.appendChild(b);
  });

  // deep links: ?scene=3 jumps to a scene, ?step=12 offsets within the timeline, ?play=1 starts playback
  (function () {
    const q = new URLSearchParams(location.search);
    const sceneQ = Number(q.get('scene'));
    if (sceneQ) {
      const base = timeline.findIndex(t => t.kind === 'scenecard' && t.scene === sceneQ);
      if (base >= 0) pos = Math.min(timeline.length - 1, base + (Number(q.get('step')) || 0));
    } else if (q.get('step')) {
      pos = Math.min(timeline.length - 1, Number(q.get('step')) || 0);
    }
    if (q.get('play') === '1') setPlaying(true);
    if (sceneQ || q.get('step') || q.get('play')) {
      setTimeout(() => $('performance').scrollIntoView(), 50);
    }
  })();

  render();

  /* ---------------------------------------------------------- diary */
  const docs = D.docs || [];
  const indexEl = $('diaryIndex');
  const docEl = $('diaryDoc');
  let currentPhase = null;
  docs.forEach((doc, i) => {
    if (doc.phase !== currentPhase) {
      currentPhase = doc.phase;
      const h = document.createElement('div');
      h.className = 'di-phase';
      h.textContent = doc.phase;
      indexEl.appendChild(h);
    }
    const b = document.createElement('button');
    b.className = 'di-doc';
    b.dataset.doc = i;
    b.innerHTML = `${doc.title}<span class="di-author">${doc.author || ''}</span>`;
    b.addEventListener('click', () => showDoc(i));
    indexEl.appendChild(b);
  });
  function showDoc(i) {
    const doc = docs[i];
    if (!doc) return;
    document.querySelectorAll('.di-doc').forEach(b => b.classList.toggle('active', Number(b.dataset.doc) === i));
    docEl.innerHTML = `
      <div class="doc-letterhead">THE MOUSETRAP COMPANY · production papers ·
        <strong>${doc.author || 'company'}</strong> · ${doc.path}</div>
      ${doc.html}`;
  }
  if (docs.length) showDoc(0);

  // "read it" links in the Short Version open the cited document in the diary
  document.querySelectorAll('.doc-link[data-doc]').forEach(a => {
    a.addEventListener('click', e => {
      const i = docs.findIndex(d => d.id === a.dataset.doc);
      if (i === -1) return; // fall through to plain #diary anchor
      e.preventDefault();
      showDoc(i);
      document.getElementById('diary').scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------------------------------------------------------- company */
  const actorRoles = {};
  (D.cast || []).forEach(c => {
    (actorRoles[c.actor] = actorRoles[c.actor] || []).push(c.role);
  });
  const actorsEl = $('actorCards');
  ((D.company && D.company.actors) || []).forEach(a => {
    const roles = actorRoles[a.name];
    const card = document.createElement('div');
    card.className = 'card' + (roles ? ' is-cast' : '');
    card.innerHTML = `
      <div class="card-name">${a.name}</div>
      <div class="card-role ${roles ? '' : 'uncast'}">${roles ? 'cast as ' + roles.join(' & ') : 'read, not cast'}</div>
      <div class="card-bio">${a.bio}</div>`;
    actorsEl.appendChild(card);
  });
  const teamEl = $('teamCards');
  ((D.company && D.company.creativeTeam) || []).forEach(t => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-name">${t.name}</div>
      <div class="card-role">${t.role}</div>
      <div class="card-bio">${t.bio}</div>`;
    teamEl.appendChild(card);
  });

  /* ---------------------------------------------------------- review */
  const review = docs.find(d => d.phase && d.phase.startsWith('VI'));
  if (review) {
    $('reviewDoc').innerHTML = `
      <div class="doc-letterhead">THE ELSINORE EXAMINER · arts &amp; performance · by <strong>${review.author}</strong></div>
      ${review.html}`;
  }

  /* ---------------------------------------------------------- nav highlight */
  const sections = ['shortversion', 'performance', 'diary', 'company', 'review'];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.nav-link').forEach(l =>
          l.classList.toggle('active', l.dataset.section === e.target.id));
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el); });
})();
