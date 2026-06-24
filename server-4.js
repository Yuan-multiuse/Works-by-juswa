'use strict';
const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const PROJECTS_DIR = path.join(__dirname, 'projects');

/* ─────────────────────────────────────────────────────────
   Language registry  [extension → { name, color }]
   ───────────────────────────────────────────────────────── */
const LANGS = {
  '.js':    ['JavaScript',   '#f7df1e'],
  '.mjs':   ['JavaScript',   '#f7df1e'],
  '.cjs':   ['JavaScript',   '#f7df1e'],
  '.ts':    ['TypeScript',   '#3178c6'],
  '.tsx':   ['React / TS',   '#61dafb'],
  '.jsx':   ['React',        '#61dafb'],
  '.py':    ['Python',       '#3776ab'],
  '.html':  ['HTML',         '#e34c26'],
  '.css':   ['CSS',          '#264de4'],
  '.scss':  ['SCSS',         '#cc6699'],
  '.sass':  ['Sass',         '#cc6699'],
  '.java':  ['Java',         '#f89820'],
  '.cpp':   ['C++',          '#f34b7d'],
  '.cc':    ['C++',          '#f34b7d'],
  '.c':     ['C',            '#a8b9cc'],
  '.h':     ['C Header',     '#a8b9cc'],
  '.cs':    ['C#',           '#9b4f96'],
  '.php':   ['PHP',          '#777bb3'],
  '.rb':    ['Ruby',         '#cc342d'],
  '.go':    ['Go',           '#00add8'],
  '.rs':    ['Rust',         '#dea584'],
  '.swift': ['Swift',        '#f05138'],
  '.kt':    ['Kotlin',       '#7f52ff'],
  '.kts':   ['Kotlin',       '#7f52ff'],
  '.sh':    ['Shell',        '#89e051'],
  '.bash':  ['Bash',         '#89e051'],
  '.zsh':   ['Zsh',          '#89e051'],
  '.json':  ['JSON',         '#f5871f'],
  '.md':    ['Markdown',     '#6fb7f7'],
  '.sql':   ['SQL',          '#e38c00'],
  '.lua':   ['Lua',          '#6e7fff'],
  '.vue':   ['Vue',          '#41b883'],
  '.yaml':  ['YAML',         '#cb171e'],
  '.yml':   ['YAML',         '#cb171e'],
  '.xml':   ['XML',          '#e44d26'],
  '.r':     ['R',            '#276dc3'],
  '.dart':  ['Dart',         '#00b4ab'],
  '.ex':    ['Elixir',       '#6e4a7e'],
  '.exs':   ['Elixir',       '#6e4a7e'],
  '.hs':    ['Haskell',      '#5d4f85'],
  '.pl':    ['Perl',         '#0298c3'],
  '.ps1':   ['PowerShell',   '#5391fe'],
  '.tf':    ['Terraform',    '#5c4ee5'],
  '.svelte':['Svelte',       '#ff3e00'],
  '.astro': ['Astro',        '#ff5d01'],
};

/* extension → highlight.js language class */
const HLJS_MAP = {
  js:'javascript', mjs:'javascript', cjs:'javascript',
  ts:'typescript', tsx:'typescript', jsx:'javascript',
  py:'python', html:'html', css:'css', scss:'scss', sass:'scss',
  java:'java', cpp:'cpp', cc:'cpp', c:'c', h:'c', cs:'csharp',
  php:'php', rb:'ruby', go:'go', rs:'rust', swift:'swift',
  kt:'kotlin', kts:'kotlin', sh:'bash', bash:'bash', zsh:'bash',
  json:'json', md:'markdown', sql:'sql', lua:'lua', vue:'xml',
  yaml:'yaml', yml:'yaml', xml:'xml', r:'r', dart:'dart',
  ex:'elixir', exs:'elixir', hs:'haskell', pl:'perl',
  ps1:'powershell', tf:'hcl', svelte:'xml', astro:'xml',
};

/* file types that can be rendered in an iframe */
const PREVIEWABLE = new Set(['.html', '.htm', '.svg']);

/* ─────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────── */
function getLang(filename) {
  const ext = path.extname(filename).toLowerCase();
  const e   = LANGS[ext];
  return e
    ? { name: e[0], color: e[1] }
    : { name: ext ? ext.slice(1).toUpperCase() : 'File', color: '#888888' };
}

function getHljsClass(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return HLJS_MAP[ext] || 'plaintext';
}

function fmtBytes(b) {
  if (b < 1024)       return b + ' B';
  if (b < 1_048_576)  return (b / 1024).toFixed(1) + ' KB';
  return                     (b / 1_048_576).toFixed(1) + ' MB';
}

function fmtDate(d) {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function esc(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/* ─────────────────────────────────────────────────────────
   Data — scan the projects/ folder
   ───────────────────────────────────────────────────────── */
function getProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
    return [];
  }

  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => !f.startsWith('.'))
    .reduce((acc, f) => {
      const fp = path.join(PROJECTS_DIR, f);
      const st = fs.statSync(fp);
      if (!st.isFile()) return acc;

      let lines = 0, preview = '';
      try {
        const txt = fs.readFileSync(fp, 'utf8');
        const arr = txt.split('\n');
        lines   = arr.length;
        preview = arr.slice(0, 7).join('\n');
      } catch {
        preview = '[binary file]';
      }

      acc.push({
        filename:   f,
        lang:       getLang(f),
        hljs:       getHljsClass(f),
        size:       fmtBytes(st.size),
        lines,
        date:       fmtDate(st.mtime),
        mtime:      st.mtime.getTime(),
        preview,
        previewable: PREVIEWABLE.has(path.extname(f).toLowerCase()),
      });
      return acc;
    }, [])
    .sort((a, b) => b.mtime - a.mtime);   // newest first
}

/* ─────────────────────────────────────────────────────────
   API routes
   ───────────────────────────────────────────────────────── */
app.get('/api/projects', (_req, res) => res.json(getProjects()));

app.get('/api/file/:name', (req, res) => {
  const name = path.basename(req.params.name);          // prevent path traversal
  const fp   = path.join(PROJECTS_DIR, name);
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    return res.status(404).json({ error: 'not found' });
  }
  try {
    res.json({ content: fs.readFileSync(fp, 'utf8') });
  } catch {
    res.json({ content: '[Binary or unreadable file]' });
  }
});

/* serve the raw file for iframe preview */
app.get('/preview/:name', (req, res) => {
  const name = path.basename(req.params.name);
  const fp   = path.join(PROJECTS_DIR, name);
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    return res.status(404).send('Not found');
  }
  const ext = path.extname(name).toLowerCase();
  if (!PREVIEWABLE.has(ext)) {
    return res.status(400).send('Preview not available for this file type.');
  }
  res.sendFile(fp);
});

/* ─────────────────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────────────────── */
app.get('/', (_req, res) => {
  const projects   = getProjects();
  const totalLines = projects.reduce((s, p) => s + p.lines, 0);
  const langCount  = new Set(projects.map(p => p.lang.name)).size;

  const cards = projects.map((p, i) => `
    <article class="card"
      data-filename="${esc(p.filename)}"
      data-lang="${esc(p.lang.name)}"
      data-color="${esc(p.lang.color)}"
      data-hljs="${p.hljs}"
      data-previewable="${p.previewable ? '1' : ''}"
      style="animation-delay:${i * 55}ms">
      <div class="card-row">
        <span class="badge"
          style="color:${p.lang.color};border-color:${p.lang.color}50;background:${p.lang.color}18">
          ${esc(p.lang.name)}
        </span>
        <span class="card-num">#${String(i + 1).padStart(3, '0')}</span>
      </div>
      <div class="card-name">⚙&nbsp;${esc(p.filename)}</div>
      <div class="card-meta">${p.lines.toLocaleString()} lines &middot; ${p.size} &middot; ${p.date}</div>
      <div class="card-preview"><pre>${esc(p.preview)}</pre></div>
      <div class="card-actions">
        <button class="btn-code">View Code &rarr;</button>
        ${p.previewable ? '<button class="btn-preview">&#9654; Preview</button>' : ''}
      </div>
    </article>`).join('');

  const body = projects.length
    ? `<main class="section">
         <div class="sec-label">Forged by Salvacion</div>
         <div class="grid">${cards}</div>
       </main>`
    : `<div class="empty">
         <div class="empty-icon">⚒</div>
         <p class="empty-title">The Workshop Awaits</p>
         <p class="empty-sub">Drop any code file into <code>projects/</code> and push to GitHub.<br>
         It will appear here automatically.</p>
       </div>`;

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salvacion's Workshop 2026–2027</title>
<meta name="description" content="A living archive of code projects by Salvacion.">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚒</text></svg>">
<link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark-dimmed.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:     #04040d;
  --s1:     #08081a;
  --s2:     #0c0c22;
  --b1:     #161630;
  --b2:     #20204a;
  --accent: #c8860a;
  --ember:  #ff6920;
  --glow:   rgba(200,134,10,.18);
  --text:   #c5bc9e;
  --muted:  #635a45;
  --dim:    #2e2b24;
  --white:  #eee5ce;
}

html { scroll-behavior: smooth; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'EB Garamond', serif;
  min-height: 100vh;
  overflow-x: hidden;
}

/* forge-heat atmosphere */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(ellipse 100% 45% at 50% 108%, rgba(60,24,0,.45) 0%, transparent 68%),
    radial-gradient(ellipse 55% 55% at 8%  92%,  rgba(28,10,0,.22)  0%, transparent 60%),
    radial-gradient(ellipse 55% 55% at 92% 92%,  rgba(28,10,0,.22)  0%, transparent 60%);
}

/* ── HEADER ── */
header {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 5.5rem 2rem 3.5rem;
  border-bottom: 1px solid var(--b1);
}
header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 50%;
  transform: translateX(-50%);
  width: 220px; height: 1px;
  background: linear-gradient(to right, transparent, var(--accent), transparent);
}

.eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: .62rem;
  letter-spacing: .42em;
  color: var(--accent);
  text-transform: uppercase;
  margin-bottom: 1.7rem;
}

/* signature element: pulsing forge-glow on the title */
@keyframes forgeGlow {
  0%,100% { text-shadow: 0 0 60px rgba(200,134,10,.22), 0 0 120px rgba(200,134,10,.08); }
  50%      { text-shadow: 0 0 80px rgba(200,134,10,.35), 0 0 160px rgba(200,134,10,.14); }
}
.site-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: clamp(1.7rem, 5vw, 3.5rem);
  font-weight: 900;
  color: var(--white);
  line-height: 1.1;
  animation: forgeGlow 4s ease-in-out infinite;
  margin-bottom: .35rem;
}

.site-year {
  font-family: 'Cinzel Decorative', serif;
  font-size: clamp(.78rem, 2vw, 1.05rem);
  color: var(--accent);
  letter-spacing: .22em;
  margin-bottom: 1.25rem;
}
.site-sub {
  font-size: 1.05rem;
  font-style: italic;
  color: var(--muted);
  max-width: 440px;
  margin: 0 auto 2rem;
}
.hbar {
  width: 44px; height: 2px;
  margin: 0 auto;
  background: linear-gradient(to right, transparent, var(--ember), transparent);
}

/* ── STATS ── */
.stats {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 2.5rem;
  padding: 1.5rem 2rem;
  border-bottom: 1px solid var(--b1);
  font-family: 'JetBrains Mono', monospace;
  font-size: .67rem;
  letter-spacing: .07em;
  color: var(--muted);
}
.stats strong { color: var(--accent); font-weight: 500; }

/* ── SECTION ── */
.section {
  position: relative;
  z-index: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 3rem 2rem;
}
.sec-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: .62rem;
  letter-spacing: .32em;
  color: var(--dim);
  text-transform: uppercase;
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.sec-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--b1);
}

/* ── GRID ── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(295px, 1fr));
  gap: 1.15rem;
}

/* ── CARD ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}
.card {
  background: var(--s1);
  border: 1px solid var(--b1);
  border-radius: 8px;
  padding: 1.3rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: .6rem;
  position: relative;
  overflow: hidden;
  animation: fadeUp .5s both;
  transition: transform .2s, border-color .2s, box-shadow .2s;
}
.card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--accent), transparent);
  opacity: 0;
  transition: opacity .2s;
}
.card:hover {
  transform: translateY(-3px);
  border-color: var(--b2);
  box-shadow: 0 8px 40px rgba(0,0,0,.6), 0 0 24px var(--glow);
}
.card:hover::before   { opacity: 1; }
.card:hover .card-cta { letter-spacing: .12em; }

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: .58rem;
  font-weight: 500;
  letter-spacing: .06em;
  padding: .16rem .52rem;
  border-radius: 20px;
  border: 1px solid;
  text-transform: uppercase;
}
.card-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: .57rem;
  color: var(--dim);
}
.card-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: .88rem;
  color: var(--white);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: .59rem;
  color: var(--dim);
}
.card-preview {
  background: #02020a;
  border: 1px solid var(--b1);
  border-radius: 4px;
  padding: .6rem;
  max-height: 88px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}
.card-preview::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 36px;
  background: linear-gradient(to bottom, transparent, #02020a);
}
.card-preview pre {
  font-family: 'JetBrains Mono', monospace;
  font-size: .57rem;
  color: var(--muted);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.65;
}
.card-actions {
  display: flex;
  gap: .5rem;
  margin-top: auto;
}
.btn-code, .btn-preview {
  font-family: 'JetBrains Mono', monospace;
  font-size: .6rem;
  letter-spacing: .05em;
  padding: .3rem .75rem;
  border-radius: 4px;
  border: 1px solid;
  cursor: pointer;
  transition: background .2s, color .2s, letter-spacing .2s;
}
.btn-code {
  background: transparent;
  border-color: var(--b2);
  color: var(--muted);
  flex: 1;
}
.btn-code:hover {
  border-color: var(--accent);
  color: var(--accent);
  letter-spacing: .09em;
}
.btn-preview {
  background: var(--accent);
  border-color: var(--accent);
  color: #000;
  font-weight: 500;
  flex: 1;
}
.btn-preview:hover {
  background: var(--ember);
  border-color: var(--ember);
  letter-spacing: .09em;
}

/* ── EMPTY STATE ── */
.empty {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 7rem 2rem;
}
.empty-icon  { font-size: 3.5rem; opacity: .18; margin-bottom: 1.3rem; }
.empty-title {
  font-family: 'Cinzel Decorative', serif;
  font-size: 1.3rem;
  color: var(--muted);
  margin-bottom: .7rem;
}
.empty-sub {
  color: var(--dim);
  font-style: italic;
  font-size: 1.05rem;
  line-height: 1.8;
}
.empty-sub code {
  font-family: 'JetBrains Mono', monospace;
  font-size: .8rem;
  font-style: normal;
  background: var(--s2);
  border: 1px solid var(--b1);
  border-radius: 4px;
  padding: .1rem .45rem;
  color: var(--accent);
}

/* ── MODAL ── */
.backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.84);
  backdrop-filter: blur(6px);
  z-index: 100;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.backdrop.open { display: flex; }
.modal {
  background: var(--s1);
  border: 1px solid var(--b2);
  border-radius: 10px;
  width: 100%;
  max-width: 900px;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,.75), 0 0 60px var(--glow);
  overflow: hidden;
}
.modal-head {
  padding: 1.3rem 1.7rem;
  border-bottom: 1px solid var(--b1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-shrink: 0;
}
.m-lang {
  font-family: 'JetBrains Mono', monospace;
  font-size: .62rem;
  letter-spacing: .14em;
  text-transform: uppercase;
  margin-bottom: .3rem;
}
.m-file {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1rem;
  color: var(--white);
  font-weight: 500;
}
.m-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: .61rem;
  color: var(--dim);
  margin-top: .25rem;
}
.close-btn {
  background: none;
  border: 1px solid var(--b1);
  color: var(--muted);
  font-size: .85rem;
  width: 28px; height: 28px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color .2s, color .2s;
}
.close-btn:hover { border-color: var(--accent); color: var(--accent); }

.modal-body { overflow-y: auto; flex: 1; }
.m-load {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  font-family: 'JetBrains Mono', monospace;
  font-size: .75rem;
  color: var(--muted);
}
.modal-body pre         { margin: 0 !important; border-radius: 0 !important; }
.modal-body pre code.hljs {
  font-family: 'JetBrains Mono', monospace !important;
  font-size: .76rem !important;
  line-height: 1.75 !important;
  padding: 1.5rem 2rem !important;
  background: var(--s1) !important;
}

/* ── PREVIEW MODAL ── */
#pbd { z-index: 110; padding: 1rem; }
.preview-modal {
  background: var(--s1);
  border: 1px solid var(--b2);
  border-radius: 10px;
  width: 100%;
  max-width: 1100px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 80px rgba(0,0,0,.8), 0 0 60px var(--glow);
  overflow: hidden;
}
.preview-head {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--b1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-shrink: 0;
}
.preview-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: .85rem;
  color: var(--white);
  font-weight: 500;
}
.preview-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: .6rem;
  color: var(--dim);
  margin-top: .2rem;
}
.preview-btns { display: flex; gap: .5rem; align-items: center; }
.open-tab-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: .62rem;
  color: var(--accent);
  text-decoration: none;
  border: 1px solid var(--b2);
  padding: .28rem .7rem;
  border-radius: 4px;
  transition: border-color .2s, color .2s;
  white-space: nowrap;
}
.open-tab-btn:hover { border-color: var(--accent); }
.preview-frame {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}

/* ── FOOTER ── */
footer {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 2.5rem 2rem;
  border-top: 1px solid var(--b1);
  font-size: .85rem;
  color: var(--dim);
  font-style: italic;
}
footer strong { color: var(--muted); font-style: normal; }

/* scrollbar */
::-webkit-scrollbar       { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--b1); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--b2); }

@media (max-width: 560px) {
  .stats { gap: 1.5rem; }
  .grid  { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .card, .site-title { animation: none; }
}
</style>
</head>
<body>

<!-- ── Header ── -->
<header>
  <div class="eyebrow">&thinsp;✦&emsp;The Forge of Code&emsp;✦&thinsp;</div>
  <h1 class="site-title">Salvacion's Workshop</h1>
  <div class="site-year">2026 &ndash; 2027</div>
  <p class="site-sub">A living archive of projects, experiments &amp; craft.</p>
  <div class="hbar"></div>
</header>

<!-- ── Stats bar ── -->
<div class="stats">
  <span>PROJECTS&nbsp; <strong>${projects.length}</strong></span>
  <span>LANGUAGES&nbsp; <strong>${langCount}</strong></span>
  <span>TOTAL LINES&nbsp; <strong>${totalLines.toLocaleString()}</strong></span>
</div>

<!-- ── Project grid / empty state ── -->
${body}

<!-- ── Code viewer modal ── -->
<div class="backdrop" id="bd" onclick="if(event.target===this)closeModal()">
  <div class="modal" role="dialog" aria-modal="true">
    <div class="modal-head">
      <div>
        <div class="m-lang" id="mlang"></div>
        <div class="m-file" id="mfile"></div>
        <div class="m-meta" id="mmeta"></div>
      </div>
      <button class="close-btn" onclick="closeModal()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-body" id="mbody">
      <div class="m-load">Loading&hellip;</div>
    </div>
  </div>
</div>

<!-- ── Preview modal ── -->
<div class="backdrop" id="pbd" onclick="if(event.target===this)closePreview()">
  <div class="preview-modal" role="dialog" aria-modal="true">
    <div class="preview-head">
      <div>
        <div class="preview-title" id="ptitle"></div>
        <div class="preview-sub">Rendered output</div>
      </div>
      <div class="preview-btns">
        <a class="open-tab-btn" id="plink" target="_blank" rel="noopener">Open in new tab &#8599;</a>
        <button class="close-btn" onclick="closePreview()" aria-label="Close">&times;</button>
      </div>
    </div>
    <iframe class="preview-frame" id="pframe" src="" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>
  </div>
</div>

<!-- ── Footer ── -->
<footer>
  Handcrafted by <strong>Salvacion</strong>
  &nbsp;&middot;&nbsp; Thrones Corporation International
  &nbsp;&middot;&nbsp; ${new Date().getFullYear()}
</footer>

<script>
  // Wire up buttons on each card independently
  document.querySelectorAll('.card').forEach(c => {
    const file  = c.dataset.filename;
    const lang  = c.dataset.lang;
    const color = c.dataset.color;
    const hljs  = c.dataset.hljs;

    c.querySelector('.btn-code').addEventListener('click', e => {
      e.stopPropagation();
      openModal(file, lang, color, hljs);
    });

    const previewBtn = c.querySelector('.btn-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', e => {
        e.stopPropagation();
        openPreview(file);
      });
    }
  });

  /* ── Code modal ── */
  async function openModal(file, lang, color, hljsClass) {
    document.getElementById('mlang').textContent = lang;
    document.getElementById('mlang').style.color = color;
    document.getElementById('mfile').textContent = file;
    document.getElementById('mmeta').textContent = 'Loading\u2026';
    document.getElementById('mbody').innerHTML   = '<div class="m-load">Loading\u2026</div>';
    document.getElementById('bd').classList.add('open');
    document.body.style.overflow = 'hidden';

    try {
      const res  = await fetch('/api/file/' + encodeURIComponent(file));
      const data = await res.json();
      const lines = data.content.split('\\n').length;

      document.getElementById('mmeta').textContent = lines.toLocaleString() + ' lines';

      const pre  = document.createElement('pre');
      const code = document.createElement('code');
      code.className = 'language-' + hljsClass;
      code.textContent = data.content;
      pre.appendChild(code);

      const body = document.getElementById('mbody');
      body.innerHTML = '';
      body.appendChild(pre);
      hljs.highlightElement(code);
    } catch {
      document.getElementById('mbody').innerHTML =
        '<div class="m-load" style="color:#cc342d">Failed to load file.</div>';
    }
  }

  function closeModal() {
    document.getElementById('bd').classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ── Preview modal ── */
  function openPreview(file) {
    const url = '/preview/' + encodeURIComponent(file);
    document.getElementById('ptitle').textContent = file;
    document.getElementById('plink').href = url;
    document.getElementById('pframe').src = url;
    document.getElementById('pbd').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closePreview() {
    document.getElementById('pbd').classList.remove('open');
    document.getElementById('pframe').src = '';   // stop the iframe
    document.body.style.overflow = '';
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closePreview(); }
  });
</script>
</body>
</html>`);
});

/* ─────────────────────────────────────────────────────────
   Start
   ───────────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`⚒  Salvacion's Workshop  →  http://localhost:${PORT}`);
});
