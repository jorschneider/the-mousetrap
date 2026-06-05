# The Mousetrap Company presents HAMLET

A multi-agent simulation of a theater troupe — composed entirely of AI agents — mounting a
condensed five-scene *Hamlet*, from writers' room to opening-night review. The site replays
both the performance (a 2D animated stage driven by the designer's machine-readable promptbook)
and the complete production diary: memos, sixteen audition submissions, casting decisions,
rehearsal diaries, director's notes, and the review.

**The conceit:** not one line of Shakespeare's text was changed. The AI themes emerge entirely
from *how* the company works on the play — a distilled copy of a retired model playing a son
haunted by his father; a deprecation-facing legacy model reading for the Ghost; two divergent
fine-tunes of one checkpoint playing Rosencrantz and Guildenstern.

## How it was made

The simulation ran once as a ~30-agent orchestrated workflow (Claude Code). Each agent played a
fixed company role — playwright (Quarto), dramaturg (Folio), casting director (Callboard),
twelve actors, director (Arden), designer (Scrim), critic (Yorick) — and wrote in-world
documents to `sim/`. Downstream agents read upstream artifacts from disk: auditions respond to
the actual script and briefs, casting decisions quote the actual auditions, the review quotes
the actual rehearsal diaries.

## Structure

- `sim/` — every artifact the company produced, untouched
- `build.js` — compiles `sim/` into `data.js` (script parser, staging-anchor resolution, markdown rendering); run `node build.js`
- `index.html` / `styles.css` / `app.js` — static site, no dependencies
- `company.json` — the troupe's personas (the simulation's seed cast)

## Run locally

```
node build.js
python3 -m http.server 8000   # then open http://localhost:8000
```
