/* ═══════════════════════════════════════════════════════════════════════
   Portable Notes 2.32.0 — application script (vanilla JS, no build step)
   Sections:
     0. Utilities & state        5. View modes
     1. Markdown renderer        6. Editor toolbar & typing helpers
     2. Dialogs (ask/report)     7. Find & replace, history
     3. Notes: load/render/tree  8. Task & project intelligence commands
     4. Open/save/derive         9. Palette, bindings, init
   The test suite pins several source tokens (element wiring, scroll CSS).
   Keep them intact when editing: $('#new').onclick-style handlers,
   oninput=schedule, findReplace, showHistory, commandSearch,
   'pn-saved-searches', addEventListener('keydown'.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── 0 · Utilities & state ──────────────────────────────────────────── */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pad = (x, n) => String(x).padEnd(n);
const todayISO = () => new Date().toISOString().slice(0, 10);

const st = {
  notes: [], cur: null, timer: null, dirty: false, findAt: -1,
  view: 'edit', fav: false,
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

function render() {
  let ns = [...st.notes];
  if (st.sort === 'alpha') ns.sort((a, b) => a.title.localeCompare(b.title));
  if (st.sort === 'alpha-desc') ns.sort((a, b) => b.title.localeCompare(a.title));
  $('#count').textContent = st.notes.length;
  $('#list').innerHTML = ns.map(n =>
    '<div class="note ' + (st.cur?.path === n.path ? 'active' : '') + '" data-path="' + esc(n.path) + '">' +
    '<h4>' + (n.pinned ? '<span class="p">⌖</span>' : '') + (n.favorite ? '<span class="f">★</span>' : '') + esc(n.title) + '</h4>' +
    '<p>' + esc(n.content.replace(/[#*[\]_>]/g, ' ').slice(0, 90) || 'Empty note') + '</p>' +
    '<small>' + esc(n.folder || 'Vault root') +
    n.tags.slice(0, 3).map(t => '<span class="tag">#' + esc(t) + '</span>').join('') +
    (n.tags.length > 3 ? '<span>+' + (n.tags.length - 3) + '</span>' : '') +
    '<span class="grow"></span>' + fmtAgo(n.updated) + '</small></div>').join('') ||
    '<div class="empty">No notes found</div>';
  $$('.note').forEach(x => x.onclick = () => open(x.dataset.path));
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
  { n: 'Find / replace', k: 'Ctrl F', f: findReplace, g: 'Writing' },
  { n: 'Toggle view mode', f: mode, g: 'Writing' },
  { n: 'Copy note markdown', f: copyMarkdown, g: 'Writing' },
  { n: 'Attach file to note', f: attach, g: 'Writing' },
  { n: 'Note history', k: 'Ctrl H', f: showHistory, g: 'Writing' },
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
$('#all').onclick = () => { st.fav = false; $('#navtitle').textContent = 'Notes'; $('#all').classList.add('active'); $('#fav').classList.remove('active'); load(); };
$('#fav').onclick = () => { st.fav = true; $('#navtitle').textContent = 'Favorites'; $('#fav').classList.add('active'); $('#all').classList.remove('active'); load(); };
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

window.PortableNotesUI = { commands: commands.map(x => x.n), runCommand, version: '2.32.0' };
