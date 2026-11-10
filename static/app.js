/* Portable Notes 3.0.0 "Nebula" - application script (vanilla JS)
   Sections: 0 utilities | 1 markdown | 2 dialogs | 3 notes | 4 open/save | 5 view modes
   6 toolbar | 7 find/history | 7b orphans/diff | 7c views | 7d board/graph/tags/trash
   7e quick capture/templates/import/slash | 8 task intelligence | 9 palette/bindings/init
   E2E-pinned tokens (keep intact): oninput=schedule, findReplace, showHistory,
   commandSearch, pn-saved-searches, addEventListener('keydown', $('#new')-style handlers. */



/* ── 0 · Utilities & state ──────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pad = (x, n) => String(x).padEnd(n);
const todayISO = () => new Date().toISOString().slice(0, 10);

const st = {
  notes: [], cur: null, timer: null, dirty: false, findAt: -1,
  view: 'edit', fav: false, viewName: 'notes', tagFilter: null,
  sort: localStorage.getItem('pn-sort') || 'updated',
  folders: JSON.parse(localStorage.getItem('pn-folders') || '{}'),
  tabs: JSON.parse(localStorage.getItem('pn-tabs') || '[]'),
};

const api = async (p, o = {}) => {
  const r = await fetch(p, { headers: { 'Content-Type': 'application/json' }, ...o });
  const d = o.raw ? r : await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || 'Request failed (' + r.status + ')');
  return d;
};

function setState(msg, kind) {
  const el = $('#state');
  el.textContent = msg;
  el.classList.remove('is-ready', 'is-unsaved', 'is-saving', 'is-saved', 'is-error');
  el.classList.add('is-' + (kind || 'ready'));
}

function toast(x) {
  const el = $('#toast');
  el.textContent = x; el.classList.add('show');
  clearTimeout(st.toastTimer);
  st.toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

/* ── 1 · Markdown renderer ──────────────────────────────────────────── */
function inline(x) {
  x = esc(x);
  x = x.replace(/`([^`]+)`/g, (_, c) => '<code>' + c + '</code>');
  x = x.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/(^|[\s(])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>');
  x = x.replace(/~~(.+?)~~/g, '<s>$1</s>');
  x = x.replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_, t, l) => '<span class="wikilink" data-title="' + t + '">[[' + (l || t) + ']]</span>');
  x = x.replace(/\bhttps?:\/\/[^\s<>"]+/g, u => '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>');
  return x;
}

function md(src = '') {
  const lines = src.split('\n');
  let out = [], hid = 0, cbi = 0, i = 0;
  while (i < lines.length) {
    let ln = lines[i];

    // fenced code block
    if (/^\s*```/.test(ln)) {
      const buf = []; i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push('<pre><code>' + buf.map(esc).join('\n') + '</code></pre>');
      continue;
    }
    // heading (kept as anchor + line index for outline jumps)
    const h = /^(#{1,3})\s+(.*)$/.exec(ln);
    if (h) {
      const id = 'h' + (hid++);
      out.push('<h' + h[1].length + ' id="' + id + '" class="h-anchor" data-line="' + i + '">' + inline(h[2]) + '</h' + h[1].length + '>');
      i++; continue;
    }
    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }
    // blockquote run
    if (/^\s*>\s?/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(inline(lines[i].replace(/^\s*>\s?/, ''))), i++;
      out.push('<blockquote><p>' + buf.join('<br>') + '</p></blockquote>');
      continue;
    }
    // table
    if (/^\s*\|/.test(ln) && i + 1 < lines.length && /^\s*\|?[\s\-|:]+\|?\s*$/.test(lines[i + 1])) {
      const cells = row => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => inline(c.trim()));
      const thead = cells(ln), rows = []; i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<table><thead><tr>' + thead.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>');
      continue;
    }
    // list run (bullets, ordered, tasks) with two-space indent nesting
    if (/^\s*(?:[-*]|\d+\.)\s/.test(ln)) {
      const buf = [];
      while (i < lines.length && /^\s*(?:[-*]|\d+\.)\s/.test(lines[i])) buf.push(lines[i++]);
      out.push(buf.map((L, idx) => {
        const m = L.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        const ind = Math.floor(m[1].length / 2) * 18;
        const task = /^\[([ xX])\]\s+(.*)$/.exec(m[3]);
        if (task) {
          const done = task[1].toLowerCase() === 'x';
          return '<div class="trow" style="padding-left:' + ind + 'px"><label class="task ' + (done ? 'done' : '') + '">' +
            '<input type="checkbox" data-ck="' + (cbi++) + '" ' + (done ? 'checked' : '') + '><span>' + inline(task[2]) + '</span></label></div>';
        }
        const marker = /\d/.test(m[2]) ? m[2] + '. ' : '• ';
        return '<div style="padding-left:' + ind + 'px;margin:.18em 0">' + marker + '<span>' + inline(m[3]) + '</span></div>';
      }).join(''));
      continue;
    }
    // paragraph / blank line
    if (ln.trim() === '') { out.push(''); i++; continue; }
    out.push('<p>' + inline(ln) + '</p>');
    i++;
  }
  return out.filter(Boolean).join('\n');
}

/* ── 2 · Dialog helpers: ask() and report() ─────────────────────────── */
let askRes = null;
function ask({ title = 'Input', label = '', placeholder = '', value = '', ok = 'OK', danger = false, field = true } = {}) {
  return new Promise(res => {
    const d = $('#askDialog'), inp = $('#askInput'), okBtn = $('#askOk'), lab = $('#askLabel');
    askRes = res;
    $('#askTitle').textContent = title;
    lab.hidden = !label; lab.textContent = label;
    inp.hidden = !field; inp.value = value; inp.placeholder = placeholder;
    okBtn.textContent = ok;
    okBtn.className = 'btn ' + (danger ? 'danger' : 'primary');
    d.showModal();
    (field ? inp : okBtn).focus();
    if (field && value) inp.select();
  });
}
function settleAsk(v) {
  const r = askRes; askRes = null;
  $('#askDialog').close();
  if (r) r(v);
}
$('#askOk').onclick = () => settleAsk($('#askInput').hidden ? true : $('#askInput').value);
$('#askCancel').onclick = () => settleAsk(null);
$('#askInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); settleAsk($('#askInput').value); } };
$('#askDialog').addEventListener('close', () => { const r = askRes; askRes = null; if (r) r(null); });

function report(title, text) {
  $('#reportTitle').textContent = title;
  $('#reportBody').textContent = text || '(nothing to report)';
  $('#reportDialog').showModal();
  $('#reportBody').scrollTop = 0;
}
$('#reportCopy').onclick = () => navigator.clipboard.writeText($('#reportBody').textContent)
  .then(() => toast('Copied to clipboard')).catch(() => toast('Clipboard unavailable'));
$('#reportClose').onclick = () => $('#reportDialog').close();
$('#findClose').onclick = () => $('#findDialog').close();
$('#historyClose').onclick = () => $('#historyDialog').close();

/* ── 3 · Notes: load, render, tree, tabs ────────────────────────────── */
async function load() {
  const q = encodeURIComponent($('#q').value);
  st.notes = st.fav ? await api('/api/notes?q=' + q + '&favorite=1') : await api('/api/search?q=' + q);
  render(); tree();
  if (!st.cur && st.notes[0]) open(st.notes[0].path);
}

function fmtAgo(s) {
  if (!s) return '';
  const d = new Date(s), diff = (Date.now() - d) / 1000;
  if (!isFinite(diff) || diff < 0) return '';
  if (diff < 90) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
  if (diff < 604800) return Math.floor(diff / 86400) + ' d ago';
  return d.toISOString().slice(0, 10);
}

function noteCard(n) {
  return '<div class="note ' + (st.cur?.path === n.path ? 'active' : '') + '" data-path="' + esc(n.path) + '">' +
    '<h4>' + (n.pinned ? '<span class="p">⌖</span>' : '') + (n.favorite ? '<span class="f">★</span>' : '') + esc(n.title) + '</h4>' +
    '<p>' + esc(n.content.replace(/[#*[\]_>]/g, ' ').slice(0, 90) || 'Empty note') + '</p>' +
    '<small>' + esc(n.folder || 'Vault root') +
    n.tags.slice(0, 3).map(t => '<span class="tag">#' + esc(t) + '</span>').join('') +
    (n.tags.length > 3 ? '<span>+' + (n.tags.length - 3) + '</span>' : '') +
    '<span class="grow"></span>' + fmtAgo(n.updated) + '</small></div>';
}

function render() {
  let ns = [...st.notes];
  if (st.sort === 'alpha') ns.sort((a, b) => a.title.localeCompare(b.title));
  if (st.sort === 'alpha-desc') ns.sort((a, b) => b.title.localeCompare(a.title));
  $('#count').textContent = st.notes.length;
  $('#list').innerHTML = ns.map(noteCard).join('') ||
    '<div class="empty">No notes found</div>';
  $$('#list .note').forEach(x => x.onclick = () => { setView('notes'); open(x.dataset.path); });
}

async function tree() {
  const d = await api('/api/tree');
  $('#vaultPath').textContent = d.vault;
  const notes = d.items.filter(x => x.type === 'note');
  const folders = d.items.filter(x => x.type === 'folder');
  const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
  const byDir = {};
  notes.forEach(n => { (byDir[dirOf(n.path)] ??= []).push(n); });

  const row = (n, depth) =>
    '<div class="treeitem note" data-path="' + esc(n.path) + '" style="padding-left:' + (6 + depth * 13) + 'px">' +
    '<span class="chev">·</span>' + esc(n.name.replace(/\.md$/i, '')) + '</div>';
  const branch = (fpath, depth) => {
    const f = folders.find(x => x.path === fpath);
    if (!f) return '';
    const open = st.folders[fpath] ?? true;
    let html = '<div class="treeitem folder ' + (open ? 'open' : '') + '" data-folder="' + esc(fpath) +
      '" style="padding-left:' + (6 + depth * 13) + 'px"><span class="chev">▸</span>' + esc(f.name) + '</div>';
    if (open) {
      (byDir[fpath] || []).forEach(n => html += row(n, depth + 1));
      folders.filter(x => dirOf(x.path) === fpath).forEach(sf => html += branch(sf.path, depth + 1));
    }
    return html;
  };
  let html = (byDir[''] || []).map(n => row(n, 0)).join('');
  folders.filter(f => dirOf(f.path) === '').forEach(f => html += branch(f.path, 0));
  $('#tree').innerHTML = html || '<div class="empty">Empty vault</div>';
}

$('#tree').addEventListener('click', e => {
  const item = e.target.closest('.treeitem');
  if (!item) return;
  if (item.classList.contains('folder')) {
    const p = item.dataset.folder, cur = st.folders[p] ?? true;
    st.folders[p] = !cur;
    localStorage.setItem('pn-folders', JSON.stringify(st.folders));
    tree();
  } else open(item.dataset.path);
});

function renderTabs() {
  const el = $('#tabs');
  if (!el) return;
  el.innerHTML = st.tabs.map(p =>
    '<button data-tab="' + esc(p) + '" class="' + (st.cur?.path === p ? 'active' : '') + '" title="' + esc(p) + '">' +
    esc((p.split('/').pop() || p).replace(/\.md$/i, '')) +
    '<span data-close="' + esc(p) + '" title="Close tab">×</span></button>').join('');
  $$('[data-tab]').forEach(x => x.onclick = e => { if (e.target.dataset.close) return; open(x.dataset.tab); });
  $$('[data-close]').forEach(x => x.onclick = e => {
    e.stopPropagation();
    st.tabs = st.tabs.filter(p => p !== x.dataset.close);
    localStorage.setItem('pn-tabs', JSON.stringify(st.tabs));
    if (x.dataset.close === st.cur?.path) { st.cur = null; load(); } else renderTabs();
  });
}

const persistTabs = () => localStorage.setItem('pn-tabs', JSON.stringify(st.tabs));

/* ── 4 · Open / save / derive ───────────────────────────────────────── */
async function open(path) {
  setView('notes');
  await save();
  if (!st.tabs.includes(path)) {
    st.tabs.push(path); st.tabs = st.tabs.slice(-8); persistTabs(); renderTabs();
  }
  const n = await api('/api/note?path=' + encodeURIComponent(path));
  st.cur = n; st.findAt = -1;
  $('#title').value = n.title;
  $('#editor').value = n.content;
  $('#folderName').value = n.folder;
  $('#tags').value = n.tags.join(', ');
  $('#star').textContent = n.favorite ? '★' : '☆';
  $('#star').classList.toggle('on', n.favorite);
  $('#pin').classList.toggle('on', n.pinned);
  $('#updated').textContent = n.updated ? 'Updated ' + fmtAgo(n.updated) : '';
  setState('Ready', 'ready');
  derive(); render(); renderTabs();
}

function data() {
  return {
    path: st.cur.path, title: $('#title').value.trim() || 'Untitled',
    content: $('#editor').value, folder: $('#folderName').value.trim(),
    tags: $('#tags').value.split(',').map(x => x.trim().replace(/^#/, '')).filter(Boolean),
    favorite: st.cur.favorite, pinned: st.cur.pinned, updateLinks: true
  };
}

function schedule() {
  if (!st.cur) return;
  st.dirty = true;
  setState('Unsaved', 'unsaved');
  clearTimeout(st.timer);
  st.timer = setTimeout(save, 600);
  derive();
}

async function save() {
  clearTimeout(st.timer);
  if (!st.cur) return;
  setState('Saving…', 'saving');
  try {
    const old = st.cur.path;
    const n = await api('/api/note', { method: 'PUT', body: JSON.stringify(data()) });
    st.cur = n; st.dirty = false;
    if (old !== n.path) {           // rename: keep tabs in sync
      st.tabs = st.tabs.map(p => p === old ? n.path : p);
      persistTabs(); renderTabs();
    }
    const i = st.notes.findIndex(x => x.path === old);
    if (i >= 0) st.notes[i] = n;
    setState('Saved', 'saved');
    $('#updated').textContent = n.updated ? 'Updated ' + fmtAgo(n.updated) : '';
    render(); tree();
  } catch (e) {
    setState('Save failed', 'error');
    toast(e.message);
  }
}

function derive() {
  const s = $('#editor').value;
  $('#preview').innerHTML = md(s);
  const words = s.trim() ? s.trim().split(/\s+/).length : 0;
  $('#words').textContent = words + ' words';
  $('#chars').textContent = s.length + ' chars';
  $('#reading').textContent = Math.max(1, Math.ceil(words / 200)) + ' min read';

  const heads = [];
  s.split('\n').forEach((ln, i) => { const m = /^(#{1,3})\s+(.*)$/.exec(ln); if (m) heads.push({ t: m[2], i }); });
  $('#outline').innerHTML = heads.map(x =>
    '<span class="jump" data-line="' + x.i + '">' + esc(x.t) + '</span>').join('') || '<div class="empty">No headings</div>';

  const links = [...new Set([...s.matchAll(/\[\[([^\]|#]+)/g)].map(x => x[1]))];
  $('#links').innerHTML = links.map(x =>
    '<span class="jump" data-title="' + esc(x) + '">' + esc(x) + '</span>').join('') || '<div class="empty">No links</div>';
  $$('[data-title],.wikilink').forEach(x => x.onclick = () => byTitle(x.dataset.title));

  if (st.cur) api('/api/backlinks?title=' + encodeURIComponent(st.cur.title)).then(bs => {
    $('#backlinks').innerHTML = bs.map(x =>
      '<span class="jump" data-path="' + esc(x.path) + '">' + esc(x.title) + '</span>').join('') || '<div class="empty">No backlinks</div>';
    $$('#backlinks [data-path]').forEach(x => x.onclick = () => open(x.dataset.path));
  });

  // Related notes — Evernote-style suggestions from shared tags
  const rel = $('#related');
  if (rel && st.cur) {
    if (!st.cur.tags.length) {
      rel.innerHTML = '<div class="empty">Add tags to see related notes</div>';
    } else {
      api('/api/search?q=').then(all => {
        const shared = all.filter(n => n.path !== st.cur.path && n.tags.length && n.tags.some(t => st.cur.tags.includes(t))).slice(0, 6);
        rel.innerHTML = shared.map(x =>
          '<span class="jump" data-path="' + esc(x.path) + '">' + esc(x.title) + '</span>').join('') || '<div class="empty">No related notes</div>';
        $$('#related [data-path]').forEach(x => x.onclick = () => open(x.dataset.path));
      }).catch(() => { rel.innerHTML = '<div class="empty">Related unavailable</div>'; });
    }
  }
}

function jumpToLine(lineIdx) {
  if (st.view === 'preview') {
    const h = $('#preview').querySelector('[data-line="' + lineIdx + '"]');
    if (h) h.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  const ed = $('#editor'), v = ed.value;
  const pos = v.split('\n').slice(0, lineIdx).join('\n').length + (lineIdx ? 1 : 0);
  ed.focus(); ed.setSelectionRange(pos, pos);
}

async function byTitle(t) {
  const n = st.notes.find(x => x.title.toLowerCase() === t.toLowerCase());
  n ? open(n.path) : create(t, st.cur?.folder || 'Inbox');
}

async function patch(key) {
  if (!st.cur) return;
  st.cur[key] = !st.cur[key];
  await save(); derive();
}

async function create(title = 'Untitled', folder = 'Inbox', content = '') {
  await save();
  const n = await api('/api/note', { method: 'POST', body: JSON.stringify({ title, folder, content, tags: [] }) });
  st.notes.unshift(n); st.cur = null;
  await open(n.path);
  $('#title').select();
  toast('Note created in ' + (n.folder || 'root'));
}

async function remove() {
  if (!st.cur) return;
  const ok = await ask({
    title: 'Move to trash',
    label: 'Move "' + st.cur.title + '" to the internal trash? Earlier snapshots stay in note history.',
    field: false, ok: 'Move to trash', danger: true
  });
  if (!ok) return;
  const path = st.cur.path;
  await api('/api/note?path=' + encodeURIComponent(path), { method: 'DELETE' });
  st.cur = null;
  st.tabs = st.tabs.filter(p => p !== path);
  persistTabs(); renderTabs();
  load(); toast('Moved to trash');
}

function daily() {
  const d = new Date(), name = todayISO();
  const n = st.notes.find(x => x.title === name && x.folder === 'Daily Notes');
  n ? open(n.path) : create(name, 'Daily Notes', '# ' + name + '\n\n## Notes\n\n## Tasks\n\n- [ ] ');
}

async function newFolder() {
  const name = await ask({ title: 'New folder', label: 'Folder path (nested: Work/Sub)', placeholder: 'e.g. Work/Projects', value: '' });
  if (!name) return;
  await api('/api/folder', { method: 'POST', body: JSON.stringify({ path: name }) });
  tree(); toast('Folder created');
}

/* ── 5 · View modes ─────────────────────────────────────────────────── */
const VIEW_ORDER = ['edit', 'split', 'preview'];
function mode() {
  st.view = VIEW_ORDER[(VIEW_ORDER.indexOf(st.view) + 1) % 3];
  $('#work').className = st.view === 'split' ? 'split' : '';
  $('#preview').classList.toggle('hidden', st.view === 'edit');
  $('#editor').classList.toggle('hidden', st.view === 'preview');
  $('#mode').textContent = st.view === 'edit' ? 'Split' : st.view === 'split' ? 'Preview' : 'Edit';
  derive();
}

/* ── 6 · Editor toolbar & typing helpers ────────────────────────────── */
function wrapSel(before, after, ph) {
  if (!st.cur) return toast('Open a note first');
  const ed = $('#editor'), s = ed.selectionStart, e = ed.selectionEnd;
  const sel = ed.value.slice(s, e) || ph;
  ed.value = ed.value.slice(0, s) + before + sel + after + ed.value.slice(e);
  ed.focus();
  const end = s + before.length + sel.length + after.length;
  ed.setSelectionRange(end, end);
  schedule();
}
function linePrefix(pre) {
  if (!st.cur) return toast('Open a note first');
  const ed = $('#editor'), v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
  const ls = v.lastIndexOf('\n', s - 1) + 1;
  let le = v.indexOf('\n', e); if (le < 0) le = v.length;
  const chunk = v.slice(ls, le).split('\n').map(l => l ? pre + l : l).join('\n');
  ed.value = v.slice(0, ls) + chunk + v.slice(le);
  ed.focus();
  ed.setSelectionRange(s + pre.length, s + pre.length);
  schedule();
}
function insertText(txt) {
  if (!st.cur) return toast('Open a note first');
  const ed = $('#editor'), s = ed.selectionStart, e = ed.selectionEnd;
  ed.value = ed.value.slice(0, s) + txt + ed.value.slice(e);
  ed.focus();
  const p = s + txt.length;
  ed.setSelectionRange(p, p);
  schedule();
}
const TOOLBAR = {
  bold: () => wrapSel('**', '**', 'bold text'),
  italic: () => wrapSel('*', '*', 'italic text'),
  h1: () => linePrefix('# '), h2: () => linePrefix('## '),
  list: () => linePrefix('- '), task: () => linePrefix('- [ ] '), quote: () => linePrefix('> '),
  code: () => wrapSel('`', '`', 'code'),
  wiki: () => wrapSel('[[', ']]', 'Title'),
  hr: () => insertText('\n---\n'),
  date: () => insertText(todayISO()),
  table: () => insertText('\n| Column A | Column B |\n|---|---|\n| value | value |\n'),
  attach: () => attach(),
  orphans: () => showOrphans(),
  diff: () => showDiff(),
};
[...document.querySelectorAll('#toolbar button')].forEach(b => b.onclick = () => TOOLBAR[b.dataset.cmd]());

function attach() {
  if (!st.cur) return toast('Open a note first');
  $('#fileGate').click();
}
$('#fileGate').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !st.cur) return;
  if (f.size > 25 * 1024 * 1024) return toast('Attachment exceeds 25 MB limit');
  toast('Uploading ' + f.name + '…');
  try {
    const r = await api('/api/attachment/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f, headers: {} });
    insertText('[' + r.path + '](/api/attachment?path=' + encodeURIComponent(r.path) + ')');
    toast('Attached to vault/' + r.path);
  } catch (err) { toast(err.message); }
};

/* preview interactions: task toggling + wiki links */
$('#preview').addEventListener('click', e => {
  const ck = e.target.closest('input[type=checkbox][data-ck]');
  if (ck) return toggleTask(+ck.dataset.ck);
  const w = e.target.closest('.wikilink');
  if (w) byTitle(w.dataset.title);
});
function toggleTask(idx) {
  const ed = $('#editor'), lines = ed.value.split('\n');
  let seen = -1;
  for (let j = 0; j < lines.length; j++) {
    const m = lines[j].match(/^(\s*[-*]\s+)\[([ xX])\]\s/);
    if (!m) continue;
    seen++;
    if (seen === idx) {
      lines[j] = lines[j].replace(/\[([ xX])\]/, m[2].toLowerCase() === 'x' ? '[ ]' : '[x]');
      break;
    }
  }
  ed.value = lines.join('\n');
  st.dirty = true;
  setState('Unsaved', 'unsaved');
  clearTimeout(st.timer); st.timer = setTimeout(save, 600);
  derive();
}
$('#outline').addEventListener('click', e => {
  const j = e.target.closest('[data-line]');
  if (j) jumpToLine(+j.dataset.line);
});

/* ── 7 · Find & replace, note history ───────────────────────────────── */
function findReplace() {
  if (!st.cur) return toast('Open a note first');
  st.findAt = -1;
  $('#findState').textContent = 'Choose an action below.';
  $('#findDialog').showModal();
  $('#findText').select();
}
function findNext() {
  const find = $('#findText').value;
  if (!find || !st.cur) return -1;
  const ed = $('#editor'), v = ed.value.toLowerCase(), f = find.toLowerCase();
  let at = v.indexOf(f, Math.max(0, st.findAt));
  if (at < 0 && st.findAt >= 0) at = v.indexOf(f);   // wrap around
  return at;
}
$('#findLocate').onclick = () => {
  const find = $('#findText').value;
  if (!find) return $('#findState').textContent = 'Type text to find first.';
  const at = findNext();
  if (at < 0) return $('#findState').textContent = '"' + find + '" not found in this note.';
  st.findAt = at;
  const ed = $('#editor');
  ed.focus(); ed.setSelectionRange(at, at + find.length);
  $('#findState').textContent = 'Match selected at position ' + (at + 1) + ' · Locate again continues (wraps).';
};
$('#findOnce').onclick = () => {
  const find = $('#findText').value, rep = $('#findRepl').value;
  if (!find) return $('#findState').textContent = 'Type text to find first.';
  const at = findNext();
  if (at < 0) return $('#findState').textContent = '"' + find + '" not found in this note.';
  const ed = $('#editor'), v = ed.value;
  ed.value = v.slice(0, at) + rep + v.slice(at + find.length);
  st.findAt = at + rep.length;
  schedule();
  $('#findState').textContent = 'Replaced 1 occurrence at position ' + (at + 1) + '.';
};
$('#findAll').onclick = () => {
  const find = $('#findText').value, rep = $('#findRepl').value;
  if (!find) return $('#findState').textContent = 'Type text to find first.';
  const ed = $('#editor');
  const rx = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const count = (ed.value.match(rx) || []).length;
  if (!count) return $('#findState').textContent = '"' + find + '" not found in this note.';
  ed.value = ed.value.replace(rx, rep);
  st.findAt = -1;
  schedule();
  $('#findState').textContent = 'Replaced ' + count + ' occurrence' + (count === 1 ? '' : 's') + '.';
};

async function showHistory() {
  if (!st.cur) return toast('Open a note first');
  const h = await api('/api/history?path=' + encodeURIComponent(st.cur.path));
  $('#historyCount').textContent = h.length + ' snapshot' + (h.length === 1 ? '' : 's');
  $('#historyList').innerHTML = h.map(x =>
    '<div class="hrow" data-id="' + esc(x.id) + '" title="Click to restore this snapshot into the editor">' +
    '<span class="stamp">' + esc(new Date(x.modified).toLocaleString()) + '</span>' +
    '<span class="yank">Snapshot ' + esc(x.id) + '</span></div>').join('') ||
    '<div class="empty">No earlier snapshots — history is kept each save (20 per note)</div>';
  $('#historyDialog').showModal();
}
$('#historyRefresh').onclick = () => { $('#historyDialog').close(); showHistory(); };
$('#historyList').addEventListener('click', async e => {
  const rowEl = e.target.closest('.hrow');
  if (!rowEl) return;
  if (st.dirty && !await ask({
    title: 'Unsaved changes',
    label: 'The editor has unsaved changes. Restoring a snapshot replaces the editor content (a new snapshot is taken on next save).',
    field: false, ok: 'Restore anyway', danger: true
  })) return;
  const item = await api('/api/history/item?path=' + encodeURIComponent(st.cur.path) + '&id=' + encodeURIComponent(rowEl.dataset.id));
  $('#editor').value = item.content.replace(/^---[\s\S]*?---\n?/, '');
  schedule();
  $('#historyDialog').close();
  toast('Snapshot restored to editor');
});

/* ── 7b · Orphan attachments & history diff ───────────────────────── */
async function showOrphans() {
  toast('Scanning attachments…');
  let orphans = [];
  try {
    orphans = await api('/api/orphans');
  } catch (err) {
    return toast('Error scanning attachments: ' + err.message);
  }
  $('#historyCount').textContent = orphans.length + ' orphan attachment' + (orphans.length === 1 ? '' : 's');
  $('#historyList').innerHTML = orphans.map(a =>
    '<div class="hrow"><span class="stamp">' + esc(a.name) + '</span>' +
    '<span class="yank">' + Math.round((a.size || 0) / 1024) + ' KB · ' + (a.age_days == null ? '?' : a.age_days) + ' days old</span>' +
    '<a class="yank" href="/api/attachment?path=' + encodeURIComponent(a.path) + '" target="_blank" rel="noopener">View</a></div>').join('') ||
    '<div class="empty">No orphan attachments — every file in Attachments/ is referenced by a note</div>';
  $('#historyDialog').showModal();
}

async function showDiff() {
  if (!st.cur) return toast('Open a note first');
  let h = [];
  try {
    h = await api('/api/history?path=' + encodeURIComponent(st.cur.path));
  } catch (err) {
    return toast('Error loading history: ' + err.message);
  }
  if (h.length < 2) return toast('Need at least two snapshots to compare');
  const opts = h.map(x => '<option value="' + esc(x.id) + '">' + esc(new Date(x.modified).toLocaleString()) + ' (' + esc(x.id) + ')</option>').join('');
  $('#diff1').innerHTML = opts;
  $('#diff2').innerHTML = opts;
  $('#diff1').value = h[1].id;
  $('#diff2').value = h[0].id;
  $('#diff-segments').innerHTML = '<div class="empty">Choose two snapshots and press Compare.</div>';
  $('#historyDiffDialog').showModal();
}
async function renderDiff() {
  const id1 = $('#diff1').value, id2 = $('#diff2').value;
  if (!id1 || !id2) return;
  if (id1 === id2) return toast('Choose two different snapshots');
  try {
    const d = await api('/api/history/diff?path=' + encodeURIComponent(st.cur.path) + '&id1=' + encodeURIComponent(id1) + '&id2=' + encodeURIComponent(id2));
    $('#diff-segments').innerHTML = d.segments.map(s =>
      '<div class="diff-segment"><span class="diff-type">' + esc(s.type) + ' (from line ' + s.from_line + ')</span>' +
      (s.old_lines.length ? '<div class="diff-old">' + s.old_lines.map(esc).join('<br>') + '</div>' : '') +
      (s.new_lines.length ? '<div class="diff-new">' + s.new_lines.map(esc).join('<br>') + '</div>' : '') +
      '</div>').join('') || '<div class="empty">No differences between these snapshots</div>';
  } catch (err) {
    toast('Error comparing snapshots: ' + err.message);
  }
}
$('#historyDiffClose').onclick = () => $('#historyDiffDialog').close();
$('#diffCompare').onclick = renderDiff;

/* ── 7c · View switching (Notes / Board / Graph / Tags / Trash) ───────────── */
const VIEW_NAMES = ['notes', 'board', 'graph', 'tags', 'trash'];
function setView(name) {
  st.viewName = name;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.rail .viewbtn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  if (name === 'board') renderBoard();
  else if (name === 'graph') renderGraph();
  else if (name === 'tags') renderTags();
  else if (name === 'trash') renderTrash();
}
$$('.rail .viewbtn').forEach(b => b.onclick = () => setView(b.dataset.view));

/* ── 7d · Board, graph, tags, trash ───────────────────────────── */
function stripTaskMeta(t) {
  return t.replace(/\b(taskid|depends|estimate|baseline|priority|milestone|project|due):\s*\S+/gi, '').replace(/\s{2,}/g, ' ').trim();
}
const BOARD_COLS = [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Next 7 days'], ['no_due', 'No date'], ['done', 'Done']];
async function renderBoard() {
  const sel = $('#boardProject');
  const proj = sel ? sel.value : '';
  let b;
  try { b = await api('/api/task-board' + (proj ? '?project=' + encodeURIComponent(proj) : '')); }
  catch (e) { $('#board').innerHTML = '<div class="empty">Could not load tasks: ' + esc(e.message) + '</div>'; return; }
  // rebuild the project filter from everything on the board, preserving selection
  if (sel) {
    const projects = new Set();
    BOARD_COLS.forEach(([k]) => (b[k] || []).forEach(x => { if (x.project && x.project !== 'Unassigned') projects.add(x.project); }));
    sel.innerHTML = '<option value="">All projects</option>' + [...projects].sort().map(p => '<option value="' + esc(p) + '"' + (p === proj ? ' selected' : '') + '>' + esc(p) + '</option>').join('');
  }
  $('#board').innerHTML = BOARD_COLS.map(([k, label]) => {
    const items = b[k] || [];
    return '<div class="bcol' + (k === 'done' ? ' done' : '') + '"><h3>' + label + '<span class="n">' + items.length + '</span></h3><div class="bcol-body">' +
      (items.length ? items.map(x =>
        '<button class="bcard p-' + esc(x.priority || 'normal') + (x.done ? ' done' : '') + '" data-path="' + esc(x.path) + '" title="' + esc(x.note + ' · line ' + x.line) + '">' +
        '<p class="t">' + esc(stripTaskMeta(x.text) || x.text) + '</p>' +
        '<div class="meta">' +
        (x.priority && x.priority !== 'normal' ? '<span>!' + esc(x.priority) + '</span>' : '') +
        (x.due ? '<span class="due' + (k === 'overdue' ? ' over' : '') + '">' + esc(x.due) + '</span>' : '') +
        (x.project && x.project !== 'Unassigned' ? '<span>' + esc(x.project) + '</span>' : '') +
        '<span class="grow"></span><span>' + esc(x.note) + '</span></div></button>').join('')
        : '<div class="empty">Nothing here</div>') +
      '</div></div>';
  }).join('');
  $$('#board .bcard').forEach(c => c.onclick = () => { setView('notes'); open(c.dataset.path); });
}
$('#boardRefresh').onclick = renderBoard;
$('#boardProject').onchange = renderBoard;

/* Knowledge graph — deterministic force layout on a canvas */
let gSim = null;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
async function renderGraph() {
  const canvas = $('#graphCanvas'); if (!canvas) return;
  let data;
  try { data = await api('/api/graph'); }
  catch (e) { toast('Graph failed: ' + e.message); return; }
  const nodes = data.nodes.map(n => ({ ...n, deg: 0 }));
  const byPath = Object.fromEntries(nodes.map(n => [n.path, n]));
  const edges = data.edges.filter(([a, b]) => byPath[a] && byPath[b]);
  edges.forEach(([a, b]) => { byPath[a].deg++; byPath[b].deg++; });
  const wrap = canvas.parentElement, dpr = window.devicePixelRatio || 1;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const palette = ['#2563eb', '#7c3aed', '#0e9f6e', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
  const folderColor = f => palette[hashStr(f || '(root)') % palette.length];
  // deterministic seeding, then fixed force iterations
  nodes.forEach(n => {
    const h = hashStr(n.path);
    n.x = W / 2 + Math.cos(h % 6283 / 1000) * (60 + (h % 180));
    n.y = H / 2 + Math.sin((h >> 8) % 6283 / 1000) * (60 + ((h >> 8) % 180));
    n.vx = 0; n.vy = 0;
  });
  const K = 95, ITER = 240;
  for (let it = 0; it < ITER; it++) {
    const cool = 1 - it / ITER;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = Math.max(16, dx * dx + dy * dy), d = Math.sqrt(d2);
      const f = (K * K) / d2 * 0.9 * cool;
      dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    }
    edges.forEach(([pa, pb]) => {
      const a = byPath[pa], b = byPath[pb];
      let dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - K) * 0.012 * cool;
      dx /= d; dy /= d;
      a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
    });
    nodes.forEach(n => {
      n.vx += (W / 2 - n.x) * 0.0012 * cool; n.vy += (H / 2 - n.y) * 0.0012 * cool;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.86; n.vy *= 0.86;
      n.x = Math.max(24, Math.min(W - 24, n.x)); n.y = Math.max(24, Math.min(H - 24, n.y));
    });
  }
  gSim = { nodes, edges, byPath, W, H, scale: 1, ox: 0, oy: 0, drag: null, moved: 0, hover: null };
  // legend
  const folders = [...new Set(nodes.map(n => n.folder))].slice(0, 8);
  $('#graphLegend').innerHTML = folders.map(f =>
    '<span class="legend-item"><span class="legend-dot" style="background:' + folderColor(f) + '"></span>' + esc(f || 'Vault root') + '</span>').join('');
  $('#graphCount').textContent = nodes.length + ' notes · ' + edges.length + ' links';
  paintGraph();
}
function paintGraph() {
  const s = gSim; if (!s) return;
  const canvas = $('#graphCanvas'), ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, s.W, s.H);
  ctx.save();
  ctx.translate(s.ox, s.oy); ctx.scale(s.scale, s.scale);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--line-strong').trim() || '#94a3b8';
  ctx.lineWidth = 1.1 / s.scale;
  s.edges.forEach(([a, b]) => {
    ctx.beginPath(); ctx.moveTo(s.byPath[a].x, s.byPath[a].y); ctx.lineTo(s.byPath[b].x, s.byPath[b].y); ctx.stroke();
  });
  const folderColor = f => ['#2563eb', '#7c3aed', '#0e9f6e', '#d97706', '#dc2626', '#0891b2', '#db2777', '#65a30d'][hashStr(f || '(root)') % 8];
  s.nodes.forEach(n => {
    const r = Math.min(14, 5 + n.deg * 2);
    ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.2832);
    ctx.fillStyle = folderColor(n.folder); ctx.fill();
    ctx.lineWidth = 1.6 / s.scale; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.stroke();
    if (s.nodes.length <= 40 || n === s.hover || n.deg >= 2) {
      ctx.font = (11 / Math.max(0.8, s.scale)) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--ink').trim() || '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(n.title.slice(0, 34), n.x, n.y + r + 12 / s.scale);
    }
  });
  ctx.restore();
}
function graphPos(e) {
  const canvas = $('#graphCanvas'), r = canvas.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  return { mx, my, x: (mx - gSim.ox) / gSim.scale, y: (my - gSim.oy) / gSim.scale };
}
function graphHit(x, y) {
  return gSim.nodes.find(n => Math.hypot(n.x - x, n.y - y) <= Math.min(14, 5 + n.deg * 2) + 3) || null;
}
$('#graphCanvas').addEventListener('mousedown', e => {
  if (!gSim) return;
  const p = graphPos(e), hit = graphHit(p.x, p.y);
  gSim.moved = 0; gSim.drag = hit || 'pan'; gSim.pan = { x: e.clientX, y: e.clientY };
  e.target.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!gSim) return;
  const canvas = $('#graphCanvas');
  const p = graphPos(e);
  if (gSim.drag && gSim.drag !== 'pan') {
    gSim.drag.x = p.x; gSim.drag.y = p.y; gSim.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    paintGraph(); return;
  }
  if (gSim.drag === 'pan') {
    gSim.ox += e.clientX - gSim.pan.x; gSim.oy += e.clientY - gSim.pan.y;
    gSim.pan = { x: e.clientX, y: e.clientY }; gSim.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    paintGraph(); return;
  }
  const hit = graphHit(p.x, p.y);
  gSim.hover = hit;
  const tip = $('#graphTip');
  if (hit) {
    tip.hidden = false;
    tip.textContent = hit.title + (hit.folder ? '  ·  ' + hit.folder : '');
    tip.style.left = (p.mx + 14) + 'px'; tip.style.top = (p.my + 10) + 'px';
    canvas.style.cursor = 'pointer';
  } else { tip.hidden = true; canvas.style.cursor = 'grab'; }
  paintGraph();
});
window.addEventListener('mouseup', () => {
  if (!gSim) return;
  const wasDrag = gSim.drag, moved = gSim.moved;
  gSim.drag = null;
  $('#graphCanvas').classList.remove('dragging');
  if (wasDrag && wasDrag !== 'pan' && moved < 5) { setView('notes'); open(wasDrag.path); }
});
$('#graphCanvas').addEventListener('mouseleave', () => { const tip = $('#graphTip'); if (tip) tip.hidden = true; });
$('#graphCanvas').addEventListener('wheel', e => {
  if (!gSim) return;
  e.preventDefault();
  const p = graphPos(e), factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
  const ns = Math.max(0.3, Math.min(3.2, gSim.scale * factor));
  gSim.ox = p.mx - p.x * ns; gSim.oy = p.my - p.y * ns; gSim.scale = ns;
  paintGraph();
}, { passive: false });
$('#graphRelayout').onclick = () => renderGraph();
window.addEventListener('resize', () => { if (st.viewName === 'graph') renderGraph(); });

async function renderTags() {
  const all = await api('/api/search?q=');
  const counts = {};
  all.forEach(n => n.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  $('#tagCloud').innerHTML = entries.map(([t, c]) =>
    '<button class="tag-chip' + (st.tagFilter === t ? ' active' : '') + '" data-tag="' + esc(t) + '">#<b>' + esc(t) + '</b><small>' + c + '</small></button>'
  ).join('') || '<div class="empty">No tags yet — add #tags to a note and they will bloom here</div>';
  $('#tagResults').innerHTML = '<div class="empty">Select a tag above to see its notes</div>';
  $$('#tagCloud .tag-chip').forEach(el => el.onclick = () => {
    st.tagFilter = el.dataset.tag;
    $$('#tagCloud .tag-chip').forEach(x => x.classList.toggle('active', x === el));
    const hits = all.filter(n => n.tags.includes(st.tagFilter));
    $('#tagResults').innerHTML = '<h4 class="dim" style="margin:2px 2px 8px">' + hits.length + ' note' + (hits.length === 1 ? '' : 's') + ' tagged #' + esc(st.tagFilter) + '</h4>' + hits.map(noteCard).join('');
    $$('#tagResults .note').forEach(x => x.onclick = () => { setView('notes'); open(x.dataset.path); });
  });
}

async function renderTrash() {
  const items = await api('/api/trash').catch(() => []);
  $('#trashList').innerHTML = items.map(x =>
    '<div class="trash-row"><div><div class="name">' + esc(x.display) + '</div>' +
    '<div class="meta">' + Math.max(1, Math.round(x.size / 1024)) + ' KB · deleted ' + esc(new Date(x.modified).toLocaleString()) + '</div></div>' +
    '<button class="btn small" data-restore="' + esc(x.name) + '">Restore</button></div>').join('') ||
    '<div class="empty">Trash is empty</div>';
  $$('#trashList [data-restore]').forEach(b => b.onclick = async () => {
    try {
      const r = await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ name: b.dataset.restore }) });
      toast('Restored to ' + r.path);
      renderTrash(); load();
    } catch (e) { toast('Restore failed: ' + e.message); }
  });
}
$('#emptyTrash').onclick = async () => {
  if (!await ask({ title: 'Empty trash', label: 'Permanently delete every note in the trash? This cannot be undone.', field: false, ok: 'Empty trash', danger: true })) return;
  const r = await api('/api/trash/empty', { method: 'POST', body: '{}' });
  toast('Removed ' + r.removed + ' item' + (r.removed === 1 ? '' : 's'));
  renderTrash();
};

/* ── 7e · Quick capture, templates, import, slash block commands ────────── */
async function quickCapture(text) {
  const t = (text || '').trim();
  if (!t) return;
  const title = t.length > 56 ? t.slice(0, 56).trim() + '…' : t;
  const n = await api('/api/note', { method: 'POST', body: JSON.stringify({ title, folder: 'Inbox', content: t, tags: ['capture'] }) });
  $('#quickCapture').value = '';
  st.notes.unshift(n);
  toast('Captured to Inbox');
  setView('notes');
  await open(n.path);
}
$('#quickCapture').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); quickCapture(e.target.value); } });
$('#quickCaptureBtn').onclick = () => $('#quickCapture').focus();

$('#templatesBtn').onclick = showTemplates;
$('#templatesClose').onclick = () => $('#templatesDialog').close();
async function showTemplates() {
  const items = await api('/api/templates').catch(() => []);
  $('#templateList').innerHTML = items.map(t =>
    '<button class="template-item" data-name="' + esc(t.name) + '"><b>' + esc(t.name) + '</b><small>' +
    esc((t.content || '').replace(/^---[\s\S]*?---/, '').split('\n').map(l => l.trim()).find(Boolean) || 'Empty template').slice(0, 96) + '</small></button>'
  ).join('') || '<div class="empty">No templates yet — drop .md files into a <code>Templates/</code> folder in your vault</div>';
  $$('#templateList .template-item').forEach(el => el.onclick = () => instantiateTemplate(items.find(t => t.name === el.dataset.name)));
  $('#templatesDialog').showModal();
}
async function instantiateTemplate(t) {
  if (!t) return;
  $('#templatesDialog').close();
  const title = await ask({ title: 'New from template', label: 'Title for the new note', placeholder: t.name, value: t.name });
  if (title === null) return;
  const body = t.content.replace(/^---[\s\S]*?---\n?/, '').replace(/\{\{title\}\}/g, title).replace(/\{\{date\}\}/g, todayISO());
  const n = await api('/api/note', { method: 'POST', body: JSON.stringify({ title, folder: 'Inbox', content: body, tags: [] }) });
  setView('notes');
  await open(n.path);
  $('#title').select();
  toast('Created from template “' + t.name + '”');
}

/* Import: .md / .txt files → Inbox notes (button or drag & drop anywhere) */
async function importFiles(list) {
  const files = [...list].filter(f => /\.(md|markdown|txt)$/i.test(f.name));
  if (!files.length) return toast('Drop .md or .txt files');
  let n = 0;
  for (const f of files) {
    try {
      const text = await f.text();
      const title = f.name.replace(/\.(md|markdown|txt)$/i, '');
      await api('/api/note', { method: 'POST', body: JSON.stringify({ title, folder: 'Inbox', content: text, tags: ['import'] }) });
      n++;
    } catch (e) { toast('Import failed for ' + f.name); }
  }
  toast('Imported ' + n + ' note' + (n === 1 ? '' : 's') + ' to Inbox');
  load();
}
$('#importGate').onchange = e => { importFiles(e.target.files); e.target.value = ''; };
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('dragging'); }
}));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  if (ev === 'drop') e.preventDefault();
  if (ev === 'dragleave' && e.relatedTarget) return;
  document.body.classList.remove('dragging');
}));
document.addEventListener('drop', e => {
  if (e.dataTransfer && e.dataTransfer.files.length) { document.body.classList.remove('dragging'); importFiles(e.dataTransfer.files); }
});

/* Slash block commands in the editor */
const SLASH_ITEMS = [
  { k: 'h1', t: 'Heading 1', ins: '# ' },
  { k: 'h2', t: 'Heading 2', ins: '## ' },
  { k: 'task', t: 'Task checkbox', ins: '- [ ] ' },
  { k: 'bullet', t: 'Bullet list', ins: '- ' },
  { k: 'number', t: 'Numbered list', ins: '1. ' },
  { k: 'quote', t: 'Quote', ins: '> ' },
  { k: 'code', t: 'Code fence', ins: '```\n\n```' },
  { k: 'table', t: 'Table', ins: '\n| Column A | Column B |\n|---|---|\n|    |    |\n' },
  { k: 'date', t: "Today's date", ins: () => todayISO() },
  { k: 'wiki', t: 'Wiki link', ins: '[[' },
  { k: 'hr', t: 'Divider', ins: '\n---\n' },
];
let slashState = null;
function slashCaretCoords(ed, pos) {
  const rect = ed.getBoundingClientRect();
  const mirror = document.createElement('div');
  const cs = getComputedStyle(ed);
  ['boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing', 'lineHeight', 'padding', 'borderWidth', 'wordSpacing', 'tabSize'].forEach(p => mirror.style[p] = cs[p]);
  mirror.style.cssText += ';position:fixed;top:' + rect.top + 'px;left:' + rect.left + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;overflow:hidden;white-space:pre-wrap;word-wrap:break-word;visibility:hidden;z-index:-1;';
  mirror.scrollTop = ed.scrollTop;
  mirror.textContent = ed.value.slice(0, pos);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const m = marker.getBoundingClientRect();
  document.body.removeChild(mirror);
  return { x: Math.max(8, Math.min(window.innerWidth - 250, m.left)), y: Math.min(window.innerHeight - 220, m.top + parseFloat(cs.lineHeight || 20) + 4) };
}
function hideSlashMenu() { slashState = null; $('#slashMenu').hidden = true; }
function renderSlashMenu(query, caretPos, start) {
  const items = SLASH_ITEMS.filter(x => !query || x.t.toLowerCase().includes(query) || x.k.includes(query));
  const menu = $('#slashMenu');
  if (!items.length) return hideSlashMenu();
  st.slashIndex = 0;
  slashState = { start, query, caretPos, items };
  menu.innerHTML = items.map((x, i) => '<button class="slash-item' + (i === 0 ? ' sel' : '') + '" data-i="' + i + '">' + esc(x.t) + '<small>/' + esc(x.k) + '</small></button>').join('');
  try {
    const c = slashCaretCoords($('#editor'), caretPos);
    menu.style.left = c.x + 'px'; menu.style.top = c.y + 'px';
  } catch { menu.style.left = '80px'; menu.style.top = '120px'; }
  menu.hidden = false;
  menu.querySelectorAll('.slash-item').forEach(btn => btn.addEventListener('mousedown', e => {
    e.preventDefault();
    applySlashItem(slashState.items[+btn.dataset.i]);
  }));
}
function applySlashItem(item) {
  if (!item || !slashState) return;
  const ed = $('#editor'), pos = slashState.caretPos, start = slashState.start;
  const ins = typeof item.ins === 'function' ? item.ins() : item.ins;
  ed.value = ed.value.slice(0, start) + ins + ed.value.slice(pos);
  hideSlashMenu();
  ed.focus();
  const p = start + ins.length;
  ed.setSelectionRange(p, p);
  schedule();
}
$('#editor').addEventListener('input', () => {
  const ed = $('#editor'), pos = ed.selectionStart, before = ed.value.slice(0, pos);
  const m = /(?:^|\s)\/([a-z0-9]*)$/.exec(before);
  if (m) {
    renderSlashMenu(m[1], pos, pos - m[1].length - 1);
  } else hideSlashMenu();
});
$('#editor').addEventListener('keydown', e => {
  if (!slashState || $('#slashMenu').hidden) return;
  const menu = $('#slashMenu'), items = slashState.items;
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    st.slashIndex = (st.slashIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    menu.querySelectorAll('.slash-item').forEach((el, i) => el.classList.toggle('sel', i === st.slashIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    applySlashItem(items[st.slashIndex]);
  } else if (e.key === 'Escape') {
    e.preventDefault(); hideSlashMenu();
  }
});
$('#editor').addEventListener('blur', () => setTimeout(hideSlashMenu, 120));

/* Focus mode — chrome-free writing */
function toggleFocus() {
  document.body.classList.toggle('focus');
  $('#focusToggle').classList.toggle('on', document.body.classList.contains('focus'));
}
$('#focusToggle').onclick = toggleFocus;
$('#deleteNote').onclick = () => remove();

/* ── 8 · Task & project intelligence (report dialogs) ───────────────── */
async function globalTasks() {
  const a = await api('/api/tasks?status=open');
  const lines = a.length ? a.slice(0, 60).map(x =>
    pad(x.due || 'no due', 12) + pad('!' + (x.priority || 'normal'), 10) + x.text + '  —  ' + x.note) : [];
  report('Global open tasks (' + a.length + ')', lines.join('\n') || 'No open tasks');
}
async function overdueTasks() {
  let a = (await api('/api/tasks?status=open')).filter(x => x.overdue);
  report('Overdue tasks (' + a.length + ')',
    a.map(x => '[' + x.due + '] ' + x.text + '  —  ' + x.note).join('\n') || 'No overdue tasks');
}
async function highPriorityTasks() {
  const a = await api('/api/tasks?status=open&priority=high');
  report('High-priority tasks (' + a.length + ')',
    a.map(x => (x.due ? '[' + x.due + '] ' : '') + x.text + '  —  ' + x.note).join('\n') || 'No high-priority tasks');
}
async function taskDashboard() {
  const d = await api('/api/task-dashboard');
  const lines = [
    pad('Total ' + d.total, 12) + pad('Open ' + d.open, 12) + pad('Done ' + d.done, 12) + 'Overdue ' + d.overdue, '',
    'PROJECT            OPEN   DONE   OVERDUE   HIGH', '─'.repeat(56),
    ...d.projects.map(p =>
      pad(p.project, 18) + pad(p.open, 7) + pad(p.done, 7) + pad(p.overdue, 10) + p.high),
  ];
  report('Task & project dashboard', lines.join('\n'));
}
async function taskCalendar() {
  const a = await api('/api/task-calendar');
  if (!a.length) return report('Task calendar', 'No dated tasks');
  const days = {};
  a.forEach(x => (days[x.due] ??= []).push(x));
  const lines = [];
  Object.keys(days).sort().forEach(d2 => {
    lines.push('◼ ' + d2);
    days[d2].forEach(x => lines.push('   ' + (x.done ? '✓' : '○') + ' ' + pad(x.priority || '', 8) + x.text + '  —  ' + x.note));
    lines.push('');
  });
  report('Task calendar (' + a.length + ')', lines.join('\n'));
}
async function taskBoard() {
  const b = await api('/api/task-board');
  const names = [['overdue', 'OVERDUE'], ['today', 'TODAY'], ['upcoming', 'UPCOMING'], ['no_due', 'NO DUE DATE'], ['done', 'DONE']];
  const lines = [];
  names.forEach(([k, n]) => {
    lines.push('--- ' + n + ' (' + b[k].length + ')');
    b[k].slice(0, 25).forEach(x => lines.push('   ' + (x.done ? '✓' : '○') + ' ' + x.text + '  —  ' + x.note));
    lines.push('');
  });
  report('Task board', lines.join('\n'));
}
async function focusView() {
  const d = await api('/api/task-focus?days=7');
  report('7-day focus (' + d.today + ' → ' + d.through + ')',
    d.items.map(x => '[' + x.bucket.toUpperCase() + '] ' + pad(x.due || '—', 11) + pad(x.priority.toUpperCase(), 8) + x.text + '  —  ' + x.note).join('\n') ||
    'No focus tasks for the next 7 days');
}
async function weeklyReview() {
  const r = await api('/api/task-review'), s = r.summary;
  const lines = ['Open ' + s.open + ' | Done ' + s.done + ' | Overdue ' + s.overdue + ' | Next 7 days ' + s.next7 + ' | Undated ' + s.undated, '',
    'PROJECTS', '─'.repeat(40), ...r.projects.map(x => pad(x.project, 22) + x.open + ' open'), '', 'OVERDUE',
    ...r.overdue.slice(0, 20).map(x => pad(x.due || '', 12) + x.text + '  —  ' + x.note), '', 'NEXT 7 DAYS',
    ...r.next7.slice(0, 20).map(x => pad(x.due || '', 12) + x.text + '  —  ' + x.note)];
  report('Weekly review — ' + r.date, lines.join('\n'));
}
async function productivityStats() {
  const d = await api('/api/task-stats');
  report('Productivity — ' + d.date, [
    'Completion ' + d.completion_percent + '% | Open ' + d.open + ' | Done ' + d.done + ' | Overdue ' + d.overdue + ' | Due today ' + d.due_today, '',
    'OPEN BY PRIORITY', '  High ' + d.priorities.high + ' | Medium ' + d.priorities.medium + ' | Normal ' + d.priorities.normal + ' | Low ' + d.priorities.low, '',
    'PROJECTS', '─'.repeat(48),
    ...d.projects.map(x => pad(x.project, 20) + x.done + '/' + x.total + ' done, ' + x.open + ' open'),
  ].join('\n'));
}
async function projectHealth() {
  const a = await api('/api/task-projects');
  report('Project health', a.length ? [
    pad('PROJECT', 18) + pad('%DONE', 7) + pad('OPEN', 6) + pad('OVERDUE', 9) + pad('HIGH', 6) + 'NEXT DUE', '─'.repeat(62),
    ...a.map(x => pad(x.project, 18) + pad(x.completion_percent + '%', 7) + pad(x.open, 6) + pad(x.overdue, 9) + pad(x.high, 6) + (x.next_due || '')),
  ].join('\n') : 'No projects found');
}
async function projectWorkspace() {
  const name = await ask({ title: 'Project workspace', label: 'Project name (blank = all)', placeholder: 'E2E' });
  if (name === null) return;
  const d = await api('/api/task-project?project=' + encodeURIComponent(name));
  report((d.project || 'All projects').toUpperCase() + ' — workspace', [
    d.completion_percent + '% done | ' + d.open + ' open | ' + d.overdue + ' overdue | ' + d.high + ' high' + (d.next_due ? ' | next ' + d.next_due : ''),
    'Source notes: ' + d.source_notes, '', '─'.repeat(56),
    ...d.tasks.slice(0, 60).map(x => (x.done ? '✓ ' : '○ ') + pad(x.due ? '[' + x.due + ']' : '', 12) + x.text + '  —  ' + x.note),
  ].join('\n'));
}
async function projectTimeline() {
  const name = await ask({ title: 'Project timeline', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (name === null) return;
  const d = await api('/api/task-timeline?project=' + encodeURIComponent(name));
  report('Project timeline' + (name ? ' — ' + name : ''), [
    ...d.months.map(m => '◼ ' + m.month + ': ' + m.count + ' dated | ' + m.open + ' open | ' + m.done + ' done'), '',
    ...d.items.slice(0, 50).map(x => pad(x.date, 12) + (x.done ? '✓' : '○') + ' ' + x.text + '  —  ' + x.note),
  ].join('\n') || 'No dated tasks found');
}
async function milestones() {
  const name = await ask({ title: 'Milestones', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (name === null) return;
  const d = await api('/api/task-milestones?project=' + encodeURIComponent(name));
  report('Milestones', d.milestones.length ? [
    pad('PROJECT / MILESTONE', 40) + pad('DONE', 7) + pad('OPEN', 6) + 'OVERDUE', '─'.repeat(64),
    ...d.milestones.map(x => pad(x.project + ' / ' + x.milestone, 40) + pad(x.completion_percent + '%', 7) + pad(x.open, 6) + x.overdue),
  ].join('\n') : 'No milestones found');
}
async function milestoneBoard() {
  const project = await ask({ title: 'Milestone board', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const milestone = await ask({ title: 'Milestone board', label: 'Milestone name (blank = all)', placeholder: 'optional' });
  if (milestone === null) return;
  const d = await api('/api/task-milestone-board?project=' + encodeURIComponent(project) + '&milestone=' + encodeURIComponent(milestone));
  const lines = [''];
  d.summary.forEach(x => lines.push(pad(x.project + ' / ' + x.milestone, 40) + x.completion_percent + '% | ' + x.open + ' open | ' + x.overdue + ' overdue'));
  [['overdue', 'OVERDUE'], ['active', 'ACTIVE'], ['done', 'DONE']].forEach(([k, n]) => {
    lines.push('', '--- ' + n + ' (' + d.board[k].length + ')');
    d.board[k].slice(0, 30).forEach(x => lines.push('   ' + pad(x.due ? '[' + x.due + ']' : '', 12) + x.text));
  });
  report('Milestone board', lines.join('\n'));
}
async function dependencies() {
  const project = await ask({ title: 'Task dependencies', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-dependencies?project=' + encodeURIComponent(project));
  report('Task dependencies' + (project ? ' — ' + project : ''), [
    'Ready ' + d.counts.ready + ' | Blocked ' + d.counts.blocked + ' | Unresolved ' + d.counts.unresolved, '', 'BLOCKED',
    ...d.blocked.map(x => '   ' + (x.taskid || 'task') + ' waits on ' + x.waiting_on.join(', ') + '  —  ' + x.text), '', 'UNRESOLVED',
    ...d.unresolved.map(x => '   ' + (x.taskid || 'task') + ' missing ' + x.missing_dependencies.join(', ') + '  —  ' + x.text),
  ].join('\n') || 'No task IDs found');
}
async function criticalPath() {
  const project = await ask({ title: 'Critical path', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-critical-path?project=' + encodeURIComponent(project));
  report('Critical path' + (project ? ' — ' + project : ''), [
    'Dependency depth: ' + d.max_depth, '',
    ...d.critical.map(x => x.taskid + '  ' + x.text + '  —  ' + x.note),
    ...(d.cycles.length ? ['', '⚠ CYCLES: ' + d.cycles.join(', ')] : []),
  ].join('\n') || 'No task IDs found');
}
async function riskRadar() {
  const project = await ask({ title: 'Risk radar', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-risk?project=' + encodeURIComponent(project));
  report('Risk radar' + (project ? ' — ' + project : ''), [
    'Critical ' + d.counts.critical + ' | High ' + d.counts.high + ' | Medium ' + d.counts.medium + ' | Low ' + d.counts.low, '',
    ...d.tasks.filter(x => x.risk_level !== 'low').slice(0, 40).map(x =>
      '[' + x.risk_level.toUpperCase() + ' ' + x.risk_score + '] ' + x.text + '\n         reasons: ' + x.reasons.join(', ')),
  ].join('\n') || 'No non-low risk tasks');
}
async function workload() {
  const project = await ask({ title: 'Workload', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-workload?project=' + encodeURIComponent(project));
  report('Workload — ' + d.date + ' → ' + d.through, d.projects.length ? [
    pad('PROJECT', 18) + pad('SCORE', 7) + pad('HOURS', 7) + pad('OPEN', 6) + pad('OVERDUE', 9) + pad('NEXT 7D', 8) + 'UNEST.', '─'.repeat(66),
    ...d.projects.map(x => pad(x.project, 18) + pad(x.load_score, 7) + pad(x.estimated_hours + 'h', 7) + pad(x.open, 6) + pad(x.overdue, 9) + pad(x.next7, 8) + x.unestimated),
  ].join('\n') : 'No open workload found');
}
async function capacity() {
  const hours = await ask({ title: 'Capacity', label: 'Weekly capacity hours', value: '40', placeholder: '40' });
  if (hours === null) return;
  const project = await ask({ title: 'Capacity', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-capacity?hours=' + encodeURIComponent(hours) + '&project=' + encodeURIComponent(project));
  report('Capacity — ' + d.date + ' → ' + d.through, d.projects.length ? [
    'Weekly capacity: ' + d.capacity_hours + 'h', '', pad('PROJECT', 18) + pad('USED', 7) + pad('HOURS', 9) + pad('REMAIN', 10) + pad('STATUS', 11) + 'UNEST.', '─'.repeat(66),
    ...d.projects.map(x => pad(x.project, 18) + pad(x.utilization_percent + '%', 7) + pad(x.estimated_hours + 'h', 9) + pad(x.remaining_hours + 'h', 10) + pad(x.status.toUpperCase(), 11) + x.unestimated),
  ].join('\n') : 'No dated work inside the next 7 days');
}
async function burndown() {
  const project = await ask({ title: 'Burndown', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const days = await ask({ title: 'Burndown', label: 'Horizon in days', value: '14', placeholder: '14' });
  if (days === null) return;
  const d = await api('/api/task-burndown?days=' + encodeURIComponent(days) + '&project=' + encodeURIComponent(project));
  report('Burndown' + (project ? ' — ' + project : ''), [
    pad(d.start + ' → ' + d.end, 26) + pad(d.total_open_hours + 'h open', 14) + d.open_tasks + ' tasks', '',
    pad('DATE', 12) + pad('IDEAL', 10) + 'SCHEDULED', '─'.repeat(40),
    ...d.points.filter((x, i) => i === 0 || i === d.points.length - 1 || i % 3 === 0).map(x =>
      pad(x.date, 12) + pad(x.ideal_remaining_hours + 'h', 10) + x.scheduled_remaining_hours + 'h'),
  ].join('\n'));
}
async function forecast() {
  const hours = await ask({ title: 'Delivery forecast', label: 'Weekly capacity hours', value: '40', placeholder: '40' });
  if (hours === null) return;
  const project = await ask({ title: 'Delivery forecast', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-forecast?hours=' + encodeURIComponent(hours) + '&project=' + encodeURIComponent(project));
  report('Delivery forecast', d.projects.length ? [
    'Capacity: ' + d.capacity_hours_per_week + 'h/week', '',
    ...d.projects.map(x => x.project + ': ' + x.remaining_hours + 'h remaining → ' + x.weeks_needed + ' weeks → finish ' + x.capacity_finish +
      (x.latest_due ? ' (due ' + x.latest_due + ')' : '') + ' [' + x.schedule_status.toUpperCase() + ']'),
  ].join('\n') : 'No open work found');
}
async function schedulePlan() {
  const hours = await ask({ title: 'Schedule plan', label: 'Daily capacity hours', value: '8', placeholder: '8' });
  if (hours === null) return;
  const project = await ask({ title: 'Schedule plan', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-schedule?hours=' + encodeURIComponent(hours) + '&project=' + encodeURIComponent(project));
  const lines = [d.total_hours + 'h across ' + d.days.length + ' day(s) | finish ' + d.finish, '', '─'.repeat(56)];
  d.days.slice(0, 30).forEach(day => {
    lines.push('◼ ' + day.date + ' — ' + day.hours + 'h');
    day.tasks.forEach(x => lines.push('   ' + x.scheduled_hours + 'h  ' + x.text + '  —  ' + x.note));
  });
  report('Schedule plan' + (project ? ' — ' + project : ''), lines.join('\n'));
}
async function slippage() {
  const project = await ask({ title: 'Schedule slippage', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-slippage?project=' + encodeURIComponent(project));
  report('Schedule slippage' + (project ? ' — ' + project : ''), [
    ...d.projects.map(x => x.project + ': ' + x.slipped + ' slipped | ' + x.ahead + ' ahead | ' + x.on_baseline + ' on baseline | max ' + x.max_slip_days + 'd | avg ' + x.average_slip_days + 'd'), '',
    ...d.tasks.slice(0, 40).map(x => '[' + x.status.toUpperCase() + ' ' + x.slip_days + 'd] ' + pad(x.baseline, 12) + '→ ' + x.due + '  ' + x.text),
  ].join('\n') || 'No tasks with baseline and due dates');
}
async function baselineHealth() {
  const project = await ask({ title: 'Baseline health', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-baseline-health?project=' + encodeURIComponent(project));
  report('Baseline health' + (project ? ' — ' + project : ''), [
    pad('PROJECT', 18) + pad('HEALTH', 8) + pad('%TRACKED', 10) + pad('SLIPPED', 9) + pad('UNTRACKED', 11) + pad('AVG SLIP', 10) + 'OVERDUE', '─'.repeat(70),
    ...d.projects.map(x => pad(x.project, 18) + pad(x.health.toUpperCase(), 8) + pad(x.coverage_percent + '%', 10) + pad(x.slipped, 9) + pad(x.untracked, 11) + pad(x.average_slip_days + 'd', 10) + x.overdue),
  ].join('\n') || 'No project tasks found');
}
async function metadataQuality() {
  const project = await ask({ title: 'Metadata quality', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-quality?project=' + encodeURIComponent(project));
  report('Metadata quality' + (project ? ' — ' + project : ''), [
    pad('PROJECT', 18) + pad('%CLEAN', 8) + pad('CLEAN', 7) + pad('TASKS', 7) + 'ISSUES', '─'.repeat(50),
    ...d.projects.map(x => pad(x.project, 18) + pad(x.quality_percent + '%', 8) + pad(x.clean, 7) + pad(x.tasks, 7) + x.issues), '',
    ...d.tasks.filter(x => x.issues.length).slice(0, 40).map(x => '[' + x.quality_score + '%] ' + x.text + '\n         issues: ' + x.issues.join('; ')),
  ].join('\n') || 'No tasks found');
}
async function readiness() {
  const project = await ask({ title: 'Execution readiness', label: 'Project name (blank = all)', placeholder: 'optional' });
  if (project === null) return;
  const d = await api('/api/task-readiness?project=' + encodeURIComponent(project));
  report('Execution readiness' + (project ? ' — ' + project : ''), [
    pad('PROJECT', 18) + pad('%READY', 8) + pad('READY', 7) + pad('ATTENTION', 11) + 'BLOCKED', '─'.repeat(50),
    ...d.projects.map(x => pad(x.project, 18) + pad(x.readiness_percent + '%', 8) + pad(x.ready, 7) + pad(x.attention, 11) + x.blocked), '',
    ...d.tasks.filter(x => x.state !== 'ready').slice(0, 40).map(x =>
      '[' + x.state.toUpperCase() + ' ' + x.readiness_score + '%] ' + x.text + '\n         blockers: ' + x.blockers.join('; ')),
  ].join('\n') || 'No open tasks found');
}
async function duplicates() {
  const a = await api('/api/duplicates');
  report('Duplicate notes', a.length ? a.map(g => g.map(x => x.title).join('  ↔  ')).join('\n') : 'No exact-content duplicates detected');
}
async function unlinkedMentions() {
  if (!st.cur) return toast('Open a note first');
  const a = await api('/api/mentions?title=' + encodeURIComponent(st.cur.title));
  report('Unlinked mentions of "' + st.cur.title + '"',
    a.map(x => x.title + '\n   ' + x.path).join('\n') || 'No unlinked mentions');
}
async function savedSearch() {
  const name = await ask({ title: 'Save current search', label: 'Search name', placeholder: 'e.g. Sprint risks', value: $('#q').value });
  if (!name) return;
  const items = JSON.parse(localStorage.getItem('pn-saved-searches') || '{}');
  items[name] = $('#q').value;
  localStorage.setItem('pn-saved-searches', JSON.stringify(items));
  toast('Search saved: ' + name);
}
async function duplicateNote() {
  if (!st.cur) return toast('Open a note first');
  await save();
  const n = await api('/api/note', {
    method: 'POST', body: JSON.stringify({
      title: st.cur.title + ' (copy)', folder: st.cur.folder,
      content: $('#editor').value, tags: st.cur.tags
    })
  });
  toast('Duplicated as "' + n.title + '"');
  load();
}
async function copyMarkdown() {
  if (!st.cur) return toast('Open a note first');
  try {
    await navigator.clipboard.writeText($('#editor').value);
    toast('Note markdown copied');
  } catch { toast('Clipboard unavailable'); }
}

/* ── 9 · Palette, commands, bindings, init ──────────────────────────── */
const commands = [
  { n: 'New note', k: 'Ctrl N', f: () => create(), g: 'Notes' },
  { n: 'Open daily note', k: 'Ctrl D', f: daily, g: 'Notes' },
  { n: 'New folder', f: newFolder, g: 'Notes' },
  { n: 'Duplicate current note', f: duplicateNote, g: 'Notes' },
  { n: 'Delete current note', f: remove, g: 'Notes' },
  { n: 'Quick capture', k: 'Ctrl ⇧ N', f: () => $('#quickCapture').focus(), g: 'Notes' },
  { n: 'New from template…', f: showTemplates, g: 'Notes' },
  { n: 'Import Markdown files…', f: () => $('#importGate').click(), g: 'Notes' },
  { n: 'Task board view', k: 'Ctrl ⇧ 2', f: () => setView('board'), g: 'Views' },
  { n: 'Knowledge graph view', k: 'Ctrl ⇧ 3', f: () => setView('graph'), g: 'Views' },
  { n: 'Tag cloud view', k: 'Ctrl ⇧ 4', f: () => setView('tags'), g: 'Views' },
  { n: 'Trash view', k: 'Ctrl ⇧ 5', f: () => setView('trash'), g: 'Views' },
  { n: 'Toggle focus mode', k: 'Ctrl \\', f: toggleFocus, g: 'Views' },
  { n: 'Find / replace', k: 'Ctrl F', f: findReplace, g: 'Writing' },
  { n: 'Toggle view mode', f: mode, g: 'Writing' },
  { n: 'Copy note markdown', f: copyMarkdown, g: 'Writing' },
  { n: 'Attach file to note', f: attach, g: 'Writing' },
  { n: 'Note history', k: 'Ctrl H', f: showHistory, g: 'Writing' },
  { n: 'Compare history snapshots', f: showDiff, g: 'Writing' },
  { n: 'Find orphan attachments', f: showOrphans, g: 'Vault' },
  { n: 'Save current search', f: savedSearch, g: 'Vault' },
  { n: 'Unlinked mentions', f: unlinkedMentions, g: 'Vault' },
  { n: 'Find duplicate notes', f: duplicates, g: 'Vault' },
  { n: 'Rebuild search index', f: () => api('/api/rebuild', { method: 'POST', body: '{}' }).then(x => toast('Indexed ' + x.notes + ' notes')), g: 'Vault' },
  { n: 'Export vault', f: () => location.assign('/api/export'), g: 'Vault' },
  { n: 'Task & project dashboard', f: taskDashboard, g: 'Tasks & projects' },
  { n: 'Task board', f: taskBoard, g: 'Tasks & projects' },
  { n: 'Task calendar', f: taskCalendar, g: 'Tasks & projects' },
  { n: '7-day focus', f: focusView, g: 'Tasks & projects' },
  { n: 'Weekly review', f: weeklyReview, g: 'Tasks & projects' },
  { n: 'Productivity stats', f: productivityStats, g: 'Tasks & projects' },
  { n: 'Project health', f: projectHealth, g: 'Tasks & projects' },
  { n: 'Project workspace', f: projectWorkspace, g: 'Tasks & projects' },
  { n: 'Project timeline', f: projectTimeline, g: 'Tasks & projects' },
  { n: 'Milestones', f: milestones, g: 'Tasks & projects' },
  { n: 'Milestone board', f: milestoneBoard, g: 'Tasks & projects' },
  { n: 'Task dependencies', f: dependencies, g: 'Tasks & projects' },
  { n: 'Critical path', f: criticalPath, g: 'Tasks & projects' },
  { n: 'Risk radar', f: riskRadar, g: 'Tasks & projects' },
  { n: 'Workload', f: workload, g: 'Tasks & projects' },
  { n: 'Capacity', f: capacity, g: 'Tasks & projects' },
  { n: 'Burndown', f: burndown, g: 'Tasks & projects' },
  { n: 'Delivery forecast', f: forecast, g: 'Tasks & projects' },
  { n: 'Schedule plan', f: schedulePlan, g: 'Tasks & projects' },
  { n: 'Schedule slippage', f: slippage, g: 'Tasks & projects' },
  { n: 'Baseline health', f: baselineHealth, g: 'Tasks & projects' },
  { n: 'Metadata quality', f: metadataQuality, g: 'Tasks & projects' },
  { n: 'Execution readiness', f: readiness, g: 'Tasks & projects' },
  { n: 'Global open tasks', f: globalTasks, g: 'Tasks & projects' },
  { n: 'Overdue tasks', f: overdueTasks, g: 'Tasks & projects' },
  { n: 'High-priority tasks', f: highPriorityTasks, g: 'Tasks & projects' },
];
st.cmdIndex = -1;

function renderPalette(filter) {
  st.cmdIndex = -1;
  const f = (filter || '').toLowerCase();
  const list = commands.map((c, i) => ({ c, i })).filter(x => !f ||
    x.c.n.toLowerCase().includes(f) || (x.c.g || '').toLowerCase().includes(f));
  let html = '', lastGroup = '';
  list.forEach(x => {
    if (x.c.g !== lastGroup) { html += '<div class="cmd-group">' + esc(x.c.g || '') + '</div>'; lastGroup = x.c.g; }
    html += '<button type="button" class="cmd" data-i="' + x.i + '"><span>' + esc(x.c.n) + '</span><kbd>' + esc(x.c.k || '') + '</kbd></button>';
  });
  $('#commandList').innerHTML = html || '<div class="empty">No commands match</div>';
}

function palette() {
  renderPalette('');
  $('#palette').showModal();
  $('#commandSearch').value = '';
  $('#commandSearch').focus();
}

async function runCommand(i) {
  try { await commands[i].f(); }
  catch (e) { console.error(e); toast('Action failed: ' + e.message); report('Action failed', e.message); }
}

$('#commandList').addEventListener('click', e => {
  const b = e.target.closest('.cmd');
  if (!b) return;
  $('#palette').close();
  runCommand(+b.dataset.i);
});
$('#commandSearch').addEventListener('input', e => renderPalette(e.target.value));
$('#commandSearch').addEventListener('keydown', e => {
  const items = $$('.cmd');
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    st.cmdIndex = e.key === 'ArrowDown'
      ? (st.cmdIndex < 0 ? 0 : Math.min(items.length - 1, st.cmdIndex + 1))
      : (st.cmdIndex <= 0 ? items.length - 1 : st.cmdIndex - 1);
    items.forEach((x, idx) => x.classList.toggle('sel', idx === st.cmdIndex));
    items[st.cmdIndex].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const pick = st.cmdIndex >= 0 ? items[st.cmdIndex] : items[0];
    if (pick) { $('#palette').close(); runCommand(+pick.dataset.i); }
  }
});

/* theme */
function applyTheme() {
  const t = localStorage.theme || 'auto';
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.toggle('dark', t === 'dark' || (t === 'auto' && sysDark));
}
function cycleTheme() {
  const order = ['light', 'dark', 'auto'];
  const t = order[(order.indexOf(localStorage.theme || 'auto') + 1) % 3];
  localStorage.theme = t;
  applyTheme();
  toast('Theme: ' + t + (t === 'auto' ? ' (follows OS)' : ''));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* primary bindings (wiring pinned by the E2E suite) */
$('#new').onclick = () => create();
$('#all').onclick = () => { st.fav = false; $('#navtitle').textContent = 'Notes'; $('#all').classList.add('active'); $('#fav').classList.remove('active'); setView('notes'); load(); };
$('#fav').onclick = () => { st.fav = true; $('#navtitle').textContent = 'Favorites'; $('#fav').classList.add('active'); $('#all').classList.remove('active'); setView('notes'); load(); };
$('#daily').onclick = daily;
$('#folder').onclick = newFolder;
$('#mode').onclick = mode;
$('#star').onclick = () => patch('favorite');
$('#pin').onclick = () => patch('pinned');
$('#commands').onclick = palette;
$('#theme').onclick = cycleTheme;
$('#history').onclick = showHistory;
$('#saveSearch').onclick = savedSearch;
$('#sort').value = st.sort;
$('#sort').onchange = e => { st.sort = e.target.value; localStorage.setItem('pn-sort', st.sort); render(); };
['title', 'editor', 'folderName', 'tags'].forEach(x => $('#' + x).oninput=schedule);
$('#q').oninput = () => { clearTimeout(st.qTimer); st.qTimer = setTimeout(load, 180); };
$('#q').onkeydown = e => { if (e.key === 'Escape') { e.target.value = ''; load(); } };

document.addEventListener('keydown', e => {
  const c = e.ctrlKey || e.metaKey;
  if (c && e.key.toLowerCase() === 'n') { e.preventDefault(); create(); }
  else if (c && e.key.toLowerCase() === 's') { e.preventDefault(); save(); toast('Saved'); }
  else if (c && e.key.toLowerCase() === 'f') { e.preventDefault(); findReplace(); }
  else if (c && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  else if (c && e.key.toLowerCase() === 'd') { e.preventDefault(); daily(); }
  else if (c && e.key.toLowerCase() === 'h') { e.preventDefault(); showHistory(); }
  else if (c && e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); palette(); }
  else if (c && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#quickCapture').focus(); }
  else if (c && e.shiftKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
    e.preventDefault();
    if (e.key === '1') { $('#all').onclick(); } else setView(['board', 'graph', 'tags', 'trash'][+e.key - 2]);
  }
  else if (c && e.key === '\\') { e.preventDefault(); toggleFocus(); }
  else if (c && e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); mode(); }
  else if (c && e.key.toLowerCase() === 'b' && document.activeElement === $('#editor')) {
    e.preventDefault(); TOOLBAR.bold();
  }
  else if (c && e.key.toLowerCase() === 'i' && document.activeElement === $('#editor')) {
    e.preventDefault(); TOOLBAR.italic();
  }
  else if (e.key === 'Tab' && document.activeElement === $('#editor')) {
    e.preventDefault();
    const ed = $('#editor'), s = ed.selectionStart, p = ed.selectionEnd;
    if (s === p) insertText('  ');
    else {                                // indent every line of the selection
      const v = ed.value, ls = v.lastIndexOf('\n', s - 1) + 1;
      let le = v.indexOf('\n', p); if (le < 0) le = v.length;
      ed.value = v.slice(0, ls) + v.slice(ls, le).split('\n').map(l => '  ' + l).join('\n') + v.slice(le);
      ed.setSelectionRange(s + 2, p + 2 * (v.slice(ls, le).split('\n').length));
      schedule();
    }
  }
});

/* reload the open note from disk when returning to the window (external edits) */
window.addEventListener('focus', async () => {
  if (!st.cur || st.dirty || st.timer) return;
  try {
    const n = await api('/api/note?path=' + encodeURIComponent(st.cur.path));
    if (n.updated !== st.cur.updated) {
      st.cur = n;
      $('#editor').value = n.content;
      $('#title').value = n.title; $('#tags').value = n.tags.join(', ');
      derive(); toast('Note reloaded from disk');
    }
  } catch { /* offline or note gone — ignore */ }
});

/* init */
applyTheme();
renderTabs();
load().catch(function (e) {
  console.error(e);
  document.body.insertAdjacentHTML('afterbegin', '<div class="startup-error"><b>Portable Notes server connection failed.</b> Start the app with OPEN_PORTABLE_NOTES.bat and do not open index.html directly.<br>' + esc(e.message) + '</div>');
});

window.PortableNotesUI = { commands: commands.map(x => x.n), runCommand, version: '3.0.0' };
