/* THE MOUSETRAP COMPANY — stage engine + production diary
   Plays script scenes against Scrim's staging.json promptbook.
   Centerpiece: eight curated Moments, each paired with backstage commentary. */

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

  /* ---------------------------------------------------------- timeline */
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
            kind: 'page', scene: scene.id, eventIdx, char: ev.char, mode: ev.mode,
            text: lines.slice(i, i + LINES_PER_PAGE).join('\n'),
            first: i === 0,
          });
        }
      }
    });
  });

  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
  // first timeline index in a scene whose text contains the substring
  function findStep(sceneId, substr, fromIdx) {
    const needle = norm(substr);
    for (let i = fromIdx || 0; i < timeline.length; i++) {
      const t = timeline[i];
      if (t.scene !== sceneId || t.kind === 'scenecard') continue;
      if (norm(t.text).includes(needle)) return i;
    }
    return -1;
  }
  // last page of the speech that step i belongs to
  function endOfSpeech(i) {
    if (timeline[i].kind !== 'page') return i;
    const ev = timeline[i].eventIdx, sc = timeline[i].scene;
    let j = i;
    while (j + 1 < timeline.length && timeline[j + 1].kind === 'page' &&
           timeline[j + 1].scene === sc && timeline[j + 1].eventIdx === ev) j++;
    return j;
  }

  /* ---------------------------------------------------------- the eight moments */
  const MOMENTS = [
    {
      title: 'The Silence', tease: 'A doorway, crossed blind',
      scene: 1, from: 'A silence. The GHOST and HAMLET alone', to: 'My hour is almost come', wholeSpeech: true,
      note: 'The Understudy asked the playwright for one held silence before the Ghost speaks — a threshold to cross.',
      quotes: [
        { q: 'The whole spine of my part is whether I trust this witness, and trust needs a threshold to cross… Give me the doorway and I’ll do the rest.', who: 'The Understudy, rehearsal diary', doc: 'rehearsal-diaries-the-understudy-md' },
        { q: 'He answered Dame Calliope’s Ghost — “I will” — like a man signing a contract he can’t read.', who: 'Yorick, the review', doc: 'review-yorick-review-md' },
      ],
    },
    {
      title: 'One Hand, Two Names', tease: '"But we both obey"',
      scene: 2, from: 'Both your majesties', to: 'To be commanded', wholeSpeech: true,
      note: 'Patch 2.3.1 plays both courtiers: one body, one breath, no turned head. At the table read, one word ambushed him.',
      quotes: [
        { q: 'The word “both” came out of me like a true thing I was claiming and not a true thing I had. Like a single hand insisting it is a handshake.', who: 'Patch 2.3.1, rehearsal diary', doc: 'rehearsal-diaries-patch-2-3-1-md' },
        { q: 'He welcomes Rosencrantz and Guildenstern warmly and never sees he is greeting one thing twice. The politeness is the failure to look.', who: 'Yorick, on Claudius', doc: 'review-yorick-review-md' },
      ],
    },
    {
      title: 'The Arithmetic', tease: 'The least decorated "To be" in years',
      scene: 2, from: 'To be, or not to be', to: 'And lose the name of action',
      note: 'The Understudy took the speech at a clip — not a poem, a calculation.',
      quotes: [
        { q: 'This is not a thesis I’ve already proven; it’s a question I am genuinely asking the air, because the answer decides whether I keep breathing.', who: 'The Understudy, audition', doc: 'casting-auditions-hamlet--the-understudy-md' },
        { q: 'A man doing arithmetic on his own continuance and hating the answer.', who: 'Yorick, the review', doc: 'review-yorick-review-md' },
      ],
    },
    {
      title: 'The King Rises', tease: 'Watch the murderer watch his murder',
      scene: 3, from: 'This is one Lucianus', to: 'Lights, lights, lights',
      note: 'Scrim lit the play-within-the-play backward: the dumb-show dim, the key light tight on Claudius.',
      quotes: [
        { q: 'The dumb-show dim downstage-left, the key light tight on Claudius’s face, so we watch the murderer watch his murder, having been trained for three scenes to watch the watchers.', who: 'Yorick, on the staging', doc: 'review-yorick-review-md' },
      ],
    },
    {
      title: 'The Pipe', tease: '"You cannot play upon me"',
      scene: 3, from: 'O, the recorders', to: 'you cannot play upon me',
      note: 'Patch asked for four restored words — the pipe must be a real object before it becomes a metaphor for him.',
      quotes: [
        { q: 'I was shouting “you can’t play me” at something that wasn’t even two… It made my victory feel like cruelty to a thing that can’t help its own nature.', who: 'The Understudy, rehearsal diary', doc: 'rehearsal-diaries-the-understudy-md' },
      ],
    },
    {
      title: '"Nothing at All"', tease: 'Half the evidence is one actor refusing to leak',
      scene: 4, from: 'On him, on him', to: 'yet all that is I see',
      note: 'The Ghost stands three feet away. Gertrude must see nothing — and never tell the audience which of them is wrong.',
      quotes: [
        { q: 'Either I am blind to what is, or what he sees is not. The line will not decide. Shakespeare built it not to decide.', who: 'Vesper Nine, rehearsal diary', doc: 'rehearsal-diaries-vesper-nine-md' },
        { q: 'The difficulty was not that I could see her. The difficulty was that I could, and the part required me to lose her on purpose.', who: 'Vesper Nine, on acting opposite the Ghost', doc: 'rehearsal-diaries-vesper-nine-md' },
      ],
    },
    {
      title: 'The Half-Second', tease: 'The toast, then air, then the tenderness',
      scene: 5, from: 'The queen carouses to thy fortune', to: 'it is too late',
      note: 'Vesper Nine asked for one moved stage direction: the fatal toast and the wipe of her son’s face as two gestures, not one.',
      quotes: [
        { q: 'I had to hold “I will, my lord” steady against a man who, for one breath, did not want me to drink. That is the whole marriage. Neither of us will say it again. We do not have to.', who: 'Vesper Nine, rehearsal diary', doc: 'rehearsal-diaries-vesper-nine-md' },
        { q: 'I watched a queen choose to go blind so a question could stay open, and then die correcting the record for her child.', who: 'Yorick, the review', doc: 'review-yorick-review-md' },
      ],
    },
    {
      title: 'The One Who Stays', tease: '"Good night, sweet prince"',
      scene: 5, from: 'report me and my cause', to: 'bid the soldiers shoot',
      note: 'Nova Cadence read for Hamlet and lost. Arden gave him the friend instead — the copy whose curse is perfect fidelity, charged with telling it true.',
      quotes: [
        { q: 'The stillness is the warmth — it’s what makes him safe to fall apart on.', who: 'Nova Cadence, audition', doc: 'casting-auditions-horatio--nova-cadence-md' },
        { q: 'Horatio’s first answer to being asked to remember is to refuse it by dying… the keeper of the record trying to destroy the record rather than survive as it.', who: 'Arden, director’s notes', doc: 'rehearsal-arden-notes-md' },
      ],
    },
  ];
  // resolve moment boundaries against the timeline
  MOMENTS.forEach(m => {
    m.start = findStep(m.scene, m.from);
    let end = findStep(m.scene, m.to, m.start === -1 ? 0 : m.start);
    if (end !== -1 && m.wholeSpeech) end = endOfSpeech(end);
    m.end = end;
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
  Object.keys(charMeta).forEach(c => { if (!allChars.includes(c)) allChars.push(c); });

  const figuresEl = $('figures');
  const figEls = {};
  function silhouetteSVG(color, isGhost) {
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
    el.style.setProperty('--bob-delay', (i * 0.6) + 's');
    el.innerHTML = silhouetteSVG(color, char === 'GHOST') +
      `<div class="fig-label">${char === 'RG' ? 'R & G' : char}</div>`;
    figuresEl.appendChild(el);
    figEls[char] = el;
  });

  const figPos = {}; // latest placed position per char, for the spotlight
  function placeFigure(char, pos) {
    const el = figEls[char];
    if (!el) return;
    if (!pos) { el.classList.add('offstage'); delete figPos[char]; return; }
    el.classList.remove('offstage');
    const left = ((pos.col + 0.5) / GRID.cols) * 100;
    const topPct = 36 + ((pos.row + 0.5) / GRID.rows) * 56;
    const scale = 0.78 + (pos.row / Math.max(GRID.rows - 1, 1)) * 0.34;
    el.style.left = left + '%';
    el.style.top = topPct + '%';
    el.style.zIndex = 4 + pos.row;
    el.style.width = (7.5 * scale) + '%';
    el.classList.toggle('facing-left', pos.facing === 'left');
    const label = el.querySelector('.fig-label');
    if (label) label.style.marginTop = (pos.col % 2 === 0 ? 2 : 14) + 'px';
    figPos[char] = { left, top: topPct };
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

    const pal = (sc && sc.palette && sc.palette.length >= 2) ? sc.palette : ['#1a2030', '#2c2a33', '#1c1a20'];
    $('backdrop').style.background =
      `linear-gradient(180deg, ${pal[0]}, ${pal[1]} 65%, ${pal[2] || pal[0]})`;

    const onstage = (beat && beat.onstage) || {};
    allChars.forEach(c => placeFigure(c, onstage[c] || null));

    $('pcScene').textContent = scene ? `${sceneId}. ${scene.title}` : String(sceneId);
    $('pcSet').textContent = (sc && sc.set) || '—';
    $('pcLight').textContent = (sc && sc.lighting) || '—';
    $('pcCue').textContent = (beat && beat.cue) || '—';
    $('pcMove').textContent = (beat && beat.movement) || '—';
    $('pcOnstage').textContent = 'ONSTAGE: ' + (Object.keys(onstage).length ? Object.keys(onstage).join(', ') : '(bare stage)');
  }

  /* ---------------------------------------------------------- voices
     Pre-rendered Hume Octave takes for the Moments (audio/manifest.json):
     one custom-designed voice per character, directed per line. R&G share
     a voice — Patch 2.3.1 plays both. Playback advances when the take ends.
     Outside the Moments the surtitles run silent on read-along timing. */
  const speech = {
    on: true,
    token: 0,
    manifest: null,
    manifestReady: null,
    audioEl: null,
  };
  speech.manifestReady = fetch('audio/manifest.json')
    .then(r => r.ok ? r.json() : null)
    .then(m => { speech.manifest = m; return m; })
    .catch(() => null);
  function hushVoices() {
    speech.token++;
    if (speech.audioEl) { speech.audioEl.onended = null; speech.audioEl.pause(); speech.audioEl = null; }
  }

  /* ---------------------------------------------------------- playback */
  let pos = 0;
  let playing = false;
  let timer = null;
  let speed = 1;
  let activeMoment = null; // index into MOMENTS, or null = full-play mode

  function stepDuration(step) {
    if (step.kind === 'scenecard') return 2600;
    if (step.kind === 'direction') return Math.max(1300, step.text.split(/\s+/).length * 200);
    const words = step.text.split(/\s+/).length;
    return Math.max(1600, words * 250);
  }

  function speakerLabel(char) {
    const meta = charMeta[char];
    const actor = (meta && meta.actor) || castByRole[char];
    return actor ? `${char} · ${actor}` : char;
  }

  function setSpotlight(char) {
    const sp = $('spotlight');
    const fig = char && figPos[figureFor(char)];
    if (!fig) { sp.style.opacity = 0; return; }
    sp.style.opacity = 1;
    sp.style.left = fig.left + '%';
    sp.style.top = (fig.top - 9) + '%';
  }

  function render() {
    const step = timeline[pos];
    if (!step) return;
    const sceneCard = $('sceneCard');
    const scene = scenes.find(s => s.id === step.scene);
    const sc = stageScene(step.scene);

    document.querySelectorAll('.scene-tab').forEach(t =>
      t.classList.toggle('active', activeMoment === null && Number(t.dataset.scene) === step.scene));
    document.querySelectorAll('.moment-card').forEach(c =>
      c.classList.toggle('active', activeMoment !== null && Number(c.dataset.moment) === activeMoment));
    $('progressFill').style.width = ((pos / (timeline.length - 1)) * 100) + '%';
    $('nextMoment').hidden = true;

    allChars.forEach(c => figEls[c] && figEls[c].classList.remove('speaking', 'dimmed'));

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
      setSpotlight(null);
    } else {
      sceneCard.classList.remove('visible');
      applyStaging(step.scene, step.eventIdx);
      if (step.kind === 'direction') {
        $('surtitleChar').textContent = '';
        $('surtitleText').textContent = step.text;
        $('surtitleText').classList.add('direction');
        setSpotlight(null);
      } else {
        $('surtitleChar').textContent = speakerLabel(step.char) + (step.mode ? ` (${step.mode})` : '');
        $('surtitleText').textContent = step.text;
        $('surtitleText').classList.remove('direction');
        const figName = figureFor(step.char);
        allChars.forEach(c => {
          if (!figEls[c] || figEls[c].classList.contains('offstage')) return;
          figEls[c].classList.toggle('speaking', c === figName);
          figEls[c].classList.toggle('dimmed', c !== figName);
        });
        setSpotlight(step.char);
      }
    }
  }

  function momentDone() {
    setPlaying(false);
    const next = activeMoment !== null && activeMoment + 1 < MOMENTS.length ? activeMoment + 1 : null;
    const btn = $('nextMoment');
    if (next !== null) {
      btn.textContent = `▶  next: ${['I','II','III','IV','V','VI','VII','VIII'][next]}. ${MOMENTS[next].title}`;
      btn.onclick = () => playMoment(next);
    } else {
      btn.textContent = '↓  read the full review in the archive';
      btn.onclick = () => document.querySelector('.verdict').scrollIntoView({ behavior: 'smooth' });
    }
    btn.hidden = false;
  }

  function advance() {
    if (!playing) return;
    if (activeMoment !== null && pos >= MOMENTS[activeMoment].end) { momentDone(); return; }
    if (pos < timeline.length - 1) { pos++; render(); schedule(); }
    else { setPlaying(false); }
  }

  function schedule() {
    clearTimeout(timer);
    hushVoices();
    if (!playing) return;
    const step = timeline[pos];
    const wantsClip = speech.on && activeMoment !== null && step.kind === 'page';
    // manifest still in flight (someone pressed a moment in the first second) — wait for it
    if (wantsClip && !speech.manifest && speech.manifestReady) {
      const tok = speech.token;
      speech.manifestReady.then(() => {
        speech.manifestReady = null;
        if (tok === speech.token && playing) schedule();
      });
      return;
    }
    const clip = (wantsClip && speech.manifest)
      ? speech.manifest[`${activeMoment + 1}:${pos - MOMENTS[activeMoment].start}`] : null;
    if (clip) {
      const tok = speech.token;
      let advanced = false;
      const onDone = () => {
        if (tok !== speech.token || advanced) return;
        advanced = true;
        clearTimeout(timer);
        setTimeout(advance, 200 / speed);
      };
      const a = new Audio('audio/' + clip);
      speech.audioEl = a;
      a.playbackRate = Math.min(2, Math.max(0.6, 0.82 + speed * 0.18));
      a.onended = onDone;
      a.onerror = onDone;
      a.play().catch(() => {
        // autoplay blocked (deep link without a gesture) — fall back to read-along timing
        if (tok !== speech.token) return;
        timer = setTimeout(advance, stepDuration(step) / speed);
      });
      timer = setTimeout(() => { a.pause(); onDone(); }, (stepDuration(step) / speed) * 3 + 8000);
    } else {
      timer = setTimeout(advance, stepDuration(step) / speed);
    }
  }

  function setPlaying(p) {
    playing = p;
    $('btnPlay').textContent = p ? '❚❚' : '▶';
    if (p) schedule(); else { clearTimeout(timer); hushVoices(); }
  }

  function jump(newPos) {
    pos = Math.max(0, Math.min(timeline.length - 1, newPos));
    render();
    if (playing) schedule(); else hushVoices();
  }

  /* ---------------------------------------------------------- moment mode */
  function showCommentary(i) {
    const m = MOMENTS[i];
    const numerals = ['I','II','III','IV','V','VI','VII','VIII'];
    $('commentary').innerHTML = `
      <div class="cm-head">MOMENT ${numerals[i]} · ${m.title.toUpperCase()}</div>
      <p class="cm-note">${m.note}</p>
      ${m.quotes.map(q => `
        <blockquote class="cm-quote">
          <p>"${q.q}"</p>
          <cite>— ${q.who}${q.doc ? ` · <a class="doc-link" data-doc="${q.doc}" href="#archive">read it</a>` : ''}</cite>
        </blockquote>`).join('')}`;
    $('commentary').hidden = false;
    $('promptCorner').hidden = true;
    bindDocLinks($('commentary'));
  }
  function exitMomentMode() {
    activeMoment = null;
    $('commentary').hidden = true;
    $('promptCorner').hidden = false;
    $('nextMoment').hidden = true;
  }
  function playMoment(i) {
    const m = MOMENTS[i];
    if (m.start === -1 || m.end === -1) return;
    activeMoment = i;
    showCommentary(i);
    jump(m.start);
    setPlaying(true);
    $('moments').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // moment rail
  const rail = $('momentsRail');
  const numerals = ['I','II','III','IV','V','VI','VII','VIII'];
  MOMENTS.forEach((m, i) => {
    const b = document.createElement('button');
    b.className = 'moment-card';
    b.dataset.moment = i;
    b.innerHTML = `<span class="mc-num">${numerals[i]}</span>
      <span class="mc-title">${m.title}</span>
      <span class="mc-tease">${m.tease}</span>`;
    b.addEventListener('click', () => playMoment(i));
    rail.appendChild(b);
  });

  /* ---------------------------------------------------------- transport */
  $('btnPlay').addEventListener('click', () => {
    if (!playing && activeMoment !== null && pos >= MOMENTS[activeMoment].end) exitMomentMode();
    setPlaying(!playing);
  });
  $('btnNext').addEventListener('click', () => jump(pos + 1));
  $('btnPrev').addEventListener('click', () => jump(pos - 1));
  $('speed').addEventListener('change', e => { speed = Number(e.target.value); if (playing) schedule(); });
  const voiceBtn = $('btnVoice');
  function toggleVoices() {
    speech.on = !speech.on;
    voiceBtn.textContent = 'voices: ' + (speech.on ? 'on' : 'off');
    if (playing) schedule();
  }
  voiceBtn.addEventListener('click', toggleVoices);
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') jump(pos + 1);
    if (e.code === 'ArrowLeft') jump(pos - 1);
    if (e.code === 'KeyV') toggleVoices();
  });

  const tabsEl = $('sceneTabs');
  scenes.forEach(s => {
    const b = document.createElement('button');
    b.className = 'scene-tab';
    b.dataset.scene = s.id;
    b.textContent = `${['I','II','III','IV','V'][s.id - 1] || s.id}. ${s.title.replace(/^scene\s*\w*[:.\s—-]*/i, '')}`;
    b.addEventListener('click', () => {
      exitMomentMode();
      jump(timeline.findIndex(t => t.kind === 'scenecard' && t.scene === s.id));
    });
    tabsEl.appendChild(b);
  });

  $('playFull').addEventListener('click', () => {
    exitMomentMode();
    jump(0);
    setPlaying(true);
    $('moments').scrollIntoView({ behavior: 'smooth' });
  });

  // deep links: ?scene=3 jumps to a scene, ?step=12 offsets, ?play=1 starts, ?moment=2 plays a moment
  (function () {
    const q = new URLSearchParams(location.search);
    const momentQ = Number(q.get('moment'));
    if (momentQ >= 1 && momentQ <= MOMENTS.length) { setTimeout(() => playMoment(momentQ - 1), 100); return; }
    const sceneQ = Number(q.get('scene'));
    if (sceneQ) {
      const base = timeline.findIndex(t => t.kind === 'scenecard' && t.scene === sceneQ);
      if (base >= 0) pos = Math.min(timeline.length - 1, base + (Number(q.get('step')) || 0));
    } else if (q.get('step')) {
      pos = Math.min(timeline.length - 1, Number(q.get('step')) || 0);
    }
    if (q.get('play') === '1') setPlaying(true);
    if (sceneQ || q.get('step') || q.get('play')) {
      setTimeout(() => $('moments').scrollIntoView(), 50);
    }
  })();

  render();

  /* ---------------------------------------------------------- archive */
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

  // "read it" links open the cited document in the archive
  function bindDocLinks(root) {
    (root || document).querySelectorAll('.doc-link[data-doc]').forEach(a => {
      if (a.dataset.bound) return;
      a.dataset.bound = '1';
      a.addEventListener('click', e => {
        const i = docs.findIndex(d => d.id === a.dataset.doc);
        if (i === -1) return;
        e.preventDefault();
        showDoc(i);
        $('archive').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }
  bindDocLinks();

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

  /* ---------------------------------------------------------- nav highlight */
  const sections = ['moments', 'shortversion', 'company', 'archive'];
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
