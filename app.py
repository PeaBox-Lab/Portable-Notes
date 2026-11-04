
#!/usr/bin/env python3
# Portable Notes 2.11.0: local-first Markdown vault with task intelligence.
from __future__ import annotations
import argparse, hashlib, html, io, json, mimetypes, os, re, shutil, sqlite3, threading, time, webbrowser, zipfile
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse

ROOT=Path(__file__).resolve().parent
STATIC=ROOT/'static'; DATA=ROOT/'data'; DEFAULT_VAULT=ROOT/'vault'; CONFIG=DATA/'config.json'; DB=DATA/'index.db'
HOST='127.0.0.1'; PORT=8765
RESERVED={'Templates','Attachments','.portable-notes'}
DATA.mkdir(exist_ok=True)

def iso(): return datetime.now(timezone.utc).isoformat()
def safe_name(value, fallback='Untitled'):
    value=re.sub(r'[<>:"/\|?*\x00-\x1f]','',str(value)).strip().rstrip('.')
    return (value[:120] or fallback)
def norm_rel(value):
    value=unquote(str(value or '')).replace('\\','/').strip('/')
    p=Path(value)
    if value.startswith('.') or '..' in p.parts: raise ValueError('Invalid path')
    return value

def load_cfg():
    default={'vault':str(DEFAULT_VAULT),'theme':'system','version':'2.11.0'}
    if CONFIG.exists():
        try: default.update(json.loads(CONFIG.read_text(encoding='utf-8')))
        except Exception: pass
    return default
CFG=load_cfg()
def vault():
    p=Path(CFG['vault']).expanduser().resolve(); p.mkdir(parents=True,exist_ok=True); return p

def save_cfg(): CONFIG.write_text(json.dumps(CFG,indent=2),encoding='utf-8')
def md_path(rel):
    rel=norm_rel(rel); p=(vault()/rel).resolve()
    if vault() not in p.parents: raise ValueError('Outside vault')
    return p

def parse_front(text):
    meta={}; body=text
    if text.startswith('---\n'):
        end=text.find('\n---\n',4)
        if end>=0:
            raw=text[4:end]; body=text[end+5:]
            current=None
            for line in raw.splitlines():
                if re.match(r'^\s+-\s+',line) and current:
                    meta.setdefault(current,[]).append(line.split('-',1)[1].strip())
                elif ':' in line:
                    k,v=line.split(':',1); current=k.strip(); v=v.strip()
                    if not v: meta[current]=[]
                    elif v.startswith('[') and v.endswith(']'): meta[current]=[x.strip().strip('"\'') for x in v[1:-1].split(',') if x.strip()]
                    else: meta[current]=v.strip('"\'')
    return meta,body

def front(meta,body):
    tags=meta.get('tags',[]); tags=tags if isinstance(tags,list) else [x.strip() for x in str(tags).split(',') if x.strip()]
    lines=['---',f"id: {meta.get('id','')}",f"title: {meta.get('title','Untitled')}",f"created: {meta.get('created',iso())}",f"updated: {meta.get('updated',iso())}",'tags:']+[f'  - {x}' for x in tags]+[f"favorite: {str(bool(meta.get('favorite',False))).lower()}",f"pinned: {str(bool(meta.get('pinned',False))).lower()}",'---','']
    return '\n'.join(lines)+body.lstrip('\n')

def note_id(rel): return hashlib.sha1(rel.encode()).hexdigest()[:16]
def boolv(v): return str(v).lower() in ('1','true','yes','on')
def init_db():
    with sqlite3.connect(DB) as db:
        db.executescript("""CREATE TABLE IF NOT EXISTS notes(path TEXT PRIMARY KEY,title TEXT,content TEXT,folder TEXT,tags TEXT,favorite INTEGER,pinned INTEGER,created TEXT,updated TEXT,mtime REAL,links TEXT); CREATE INDEX IF NOT EXISTS idx_title ON notes(title);""")
        try: db.execute("CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(path UNINDEXED,title,content,tags,folder)")
        except sqlite3.OperationalError: pass

def index_note(p):
    rel=p.relative_to(vault()).as_posix(); text=p.read_text(encoding='utf-8',errors='replace'); meta,body=parse_front(text)
    title=str(meta.get('title') or p.stem); tags=meta.get('tags',[]); tags=tags if isinstance(tags,list) else [x.strip() for x in str(tags).split(',') if x.strip()]
    links=re.findall(r'\[\[([^\]|#]+)',body); folder=p.parent.relative_to(vault()).as_posix(); folder='' if folder=='.' else folder
    item=(rel,title,body,folder,json.dumps(tags),int(boolv(meta.get('favorite'))),int(boolv(meta.get('pinned'))),meta.get('created',''),meta.get('updated',''),p.stat().st_mtime,json.dumps(links))
    with sqlite3.connect(DB) as db:
        db.execute('INSERT OR REPLACE INTO notes VALUES(?,?,?,?,?,?,?,?,?,?,?)',item)
        try: db.execute('DELETE FROM notes_fts WHERE path=?',(rel,)); db.execute('INSERT INTO notes_fts VALUES(?,?,?,?,?)',(rel,title,body,' '.join(tags),folder))
        except sqlite3.OperationalError: pass
    return serialize(item)
def serialize(row):
    keys=['path','title','content','folder','tags','favorite','pinned','created','updated','mtime','links']; d=dict(zip(keys,row)) if not isinstance(row,sqlite3.Row) else dict(row)
    for k in ('tags','links'):
        if isinstance(d.get(k),str):
            try:d[k]=json.loads(d[k])
            except:d[k]=[]
    d['favorite']=bool(d.get('favorite')); d['pinned']=bool(d.get('pinned')); return d

def rebuild():
    init_db(); found=[]
    for p in vault().rglob('*.md'):
        if '.portable-notes' not in p.parts: found.append(p.relative_to(vault()).as_posix()); index_note(p)
    with sqlite3.connect(DB) as db:
        if found: db.execute('DELETE FROM notes WHERE path NOT IN (%s)'%','.join('?'*len(found)),found)
        else: db.execute('DELETE FROM notes')
    return len(found)
def refresh():
    init_db()
    with sqlite3.connect(DB) as db: known={r[0]:r[1] for r in db.execute('SELECT path,mtime FROM notes')}
    actual={}
    for p in vault().rglob('*.md'):
        rel=p.relative_to(vault()).as_posix(); actual[rel]=p.stat().st_mtime
        if rel not in known or abs(known[rel]-actual[rel])>.0001: index_note(p)
    removed=set(known)-set(actual)
    if removed:
        with sqlite3.connect(DB) as db:
            for rel in removed: db.execute('DELETE FROM notes WHERE path=?',(rel,))

def seed():
    p=vault()/'Getting Started'/'Welcome.md'
    if not any(vault().rglob('*.md')):
        p.parent.mkdir(parents=True,exist_ok=True); t=iso(); p.write_text(front({'id':note_id('Getting Started/Welcome.md'),'title':'Welcome to Portable Notes','created':t,'updated':t,'tags':['welcome','guide'],'favorite':True,'pinned':True},"""# Welcome\n\nPortable Notes 2.1 uses **Markdown files as the source of truth**.\n\n## Try it\n\n- Create a note with **Ctrl+N**\n- Link notes with [[Roadmap]]\n- Add tags in the properties bar\n- Use **Ctrl+Shift+P** for the command palette\n- Export a portable ZIP backup\n\n- [ ] Create your first note\n"""),encoding='utf-8')
        tp=vault()/'Templates'/'Meeting.md'; tp.parent.mkdir(parents=True,exist_ok=True); tp.write_text('# {{title}}\n\n**Date:** {{date}}\n\n## Attendees\n\n## Agenda\n\n## Notes\n\n## Actions\n\n- [ ]\n',encoding='utf-8')

def history_dir():
    p=vault()/'.portable-notes'/'history'; p.mkdir(parents=True,exist_ok=True); return p

def snapshot(rel, text):
    stamp=datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    target=history_dir()/hashlib.sha1(rel.encode()).hexdigest()[:12]
    target.mkdir(parents=True,exist_ok=True)
    (target/(stamp+'.md')).write_text(text,encoding='utf-8')
    snaps=sorted(target.glob('*.md'),reverse=True)
    for old in snaps[20:]: old.unlink(missing_ok=True)

def note_history(rel):
    target=history_dir()/hashlib.sha1(rel.encode()).hexdigest()[:12]
    if not target.exists(): return []
    return [{'id':p.stem,'modified':datetime.fromtimestamp(p.stat().st_mtime).isoformat()} for p in sorted(target.glob('*.md'),reverse=True)]

def read_body(req):
    n=int(req.headers.get('Content-Length','0')); return json.loads(req.rfile.read(n) or b'{}')
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args): print('[Portable Notes]',fmt%args)
    def send_json(self,obj,status=200):
        raw=json.dumps(obj,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(raw))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(raw)
    def fail(self,e,status=400): self.send_json({'error':str(e)},status)
    def do_GET(self):
        try:
            u=urlparse(self.path); q=parse_qs(u.query)
            if u.path=='/api/notes':
                refresh(); query=q.get('q',[''])[0].strip(); favorite=q.get('favorite',['0'])[0]=='1'
                with sqlite3.connect(DB) as db:
                    db.row_factory=sqlite3.Row
                    if query:
                        pat='%'+query.lower()+'%'; rows=db.execute('SELECT * FROM notes WHERE lower(title) LIKE ? OR lower(content) LIKE ? OR lower(tags) LIKE ? OR lower(folder) LIKE ? ORDER BY pinned DESC,updated DESC',(pat,pat,pat,pat)).fetchall()
                    else: rows=db.execute('SELECT * FROM notes ORDER BY pinned DESC,updated DESC').fetchall()
                data=[serialize(r) for r in rows]; data=[x for x in data if not favorite or x['favorite']]; return self.send_json(data)
            if u.path=='/api/search':
                refresh(); query=q.get('q',[''])[0].strip(); folder=q.get('folder',[''])[0]; tag=q.get('tag',[''])[0]
                with sqlite3.connect(DB) as db:
                    db.row_factory=sqlite3.Row
                    if query:
                        try:
                            paths=[r[0] for r in db.execute('SELECT path FROM notes_fts WHERE notes_fts MATCH ? ORDER BY rank LIMIT 200',(query,))]
                            rows=db.execute('SELECT * FROM notes WHERE path IN (%s)'%','.join('?'*len(paths)),paths).fetchall() if paths else []
                        except sqlite3.OperationalError:
                            pat='%'+query.lower()+'%'; rows=db.execute('SELECT * FROM notes WHERE lower(title) LIKE ? OR lower(content) LIKE ?',(pat,pat)).fetchall()
                    else: rows=db.execute('SELECT * FROM notes ORDER BY pinned DESC,updated DESC').fetchall()
                data=[serialize(r) for r in rows]
                if folder: data=[x for x in data if x['folder']==folder]
                if tag: data=[x for x in data if tag in x['tags']]
                return self.send_json(data)
            if u.path=='/api/mentions':
                title=q.get('title',[''])[0].strip()
                if not title:return self.send_json([])
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                return self.send_json([serialize(r) for r in rows if title.lower() in serialize(r)['content'].lower() and title not in serialize(r)['links'] and serialize(r)['title']!=title])
            if u.path=='/api/duplicates':
                refresh(); groups={}
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r); key=re.sub(r'\s+',' ',re.sub(r'[^a-z0-9 ]','',d['content'].lower())).strip()
                    if len(key)>=40: groups.setdefault(hashlib.sha1(key.encode()).hexdigest(),[]).append({'path':d['path'],'title':d['title']})
                return self.send_json([v for v in groups.values() if len(v)>1])
            if u.path=='/api/tasks':
                refresh(); tasks=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m: continue
                        text=m.group(2).strip(); due=None
                        dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I)
                        if dm: due=dm.group(1)
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else ''
                        today=datetime.now().date().isoformat(); done=m.group(1).lower()=='x'
                        tasks.append({'path':d['path'],'note':d['title'],'line':line_no,'text':text,'done':done,'due':due,'priority':priority,'project':project,'overdue':bool(due and due<today and not done)})
                status=q.get('status',['all'])[0]; project=q.get('project',[''])[0]; priority=q.get('priority',[''])[0]
                if status=='open': tasks=[x for x in tasks if not x['done']]
                elif status=='done': tasks=[x for x in tasks if x['done']]
                if project: tasks=[x for x in tasks if x['project'].lower()==project.lower()]
                if priority: tasks=[x for x in tasks if x['priority']==priority.lower()]
                weight={'high':0,'medium':1,'normal':2,'low':3}; tasks.sort(key=lambda x:(x['done'], not x['overdue'], x['due'] or '9999-12-31',weight.get(x['priority'],2),x['note'].lower()))
                return self.send_json(tasks)
            if u.path=='/api/task-dashboard':
                refresh(); tasks=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I); due=dm.group(1) if dm else None
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else 'Unassigned'
                        tasks.append({'done':done,'due':due,'priority':priority,'project':project})
                today=datetime.now().date().isoformat(); projects={}
                for t in tasks:
                    x=projects.setdefault(t['project'],{'project':t['project'],'total':0,'open':0,'done':0,'overdue':0,'high':0})
                    x['total']+=1; x['done' if t['done'] else 'open']+=1
                    if not t['done'] and t['due'] and t['due']<today:x['overdue']+=1
                    if not t['done'] and t['priority']=='high':x['high']+=1
                summary={'total':len(tasks),'open':sum(not x['done'] for x in tasks),'done':sum(x['done'] for x in tasks),'overdue':sum(bool(not x['done'] and x['due'] and x['due']<today) for x in tasks),'projects':sorted(projects.values(),key=lambda x:(-x['open'],x['project'].lower()))}
                return self.send_json(summary)
            if u.path=='/api/task-calendar':
                refresh(); items=[]; start=q.get('start',[''])[0]; end=q.get('end',[''])[0]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m: continue
                        text=m.group(2).strip(); dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I)
                        if not dm: continue
                        due=dm.group(1)
                        if start and due<start: continue
                        if end and due>end: continue
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'due':due,'done':m.group(1).lower()=='x','priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                weight={'high':0,'medium':1,'normal':2,'low':3}; items.sort(key=lambda x:(x['due'],x['done'],weight.get(x['priority'],2),x['note'].lower()))
                return self.send_json(items)
            if u.path=='/api/task-board':
                refresh(); board={'overdue':[],'today':[],'upcoming':[],'no_due':[],'done':[]}; today=datetime.now().date().isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I); due=dm.group(1) if dm else None
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else 'Unassigned'
                        item={'due':due,'done':done,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no}
                        lane='done' if done else ('no_due' if not due else ('overdue' if due<today else ('today' if due==today else 'upcoming')))
                        board[lane].append(item)
                weight={'high':0,'medium':1,'normal':2,'low':3}
                for lane in board: board[lane].sort(key=lambda x:(x['due'] or '9999-12-31',weight.get(x['priority'],2),x['project'].lower(),x['note'].lower()))
                project=q.get('project',[''])[0]
                if project:
                    for lane in board: board[lane]=[x for x in board[lane] if x['project'].lower()==project.lower()]
                return self.send_json(board)
            if u.path=='/api/task-focus':
                refresh(); items=[]; today=datetime.now().date(); horizon=int(q.get('days',['7'])[0] or 7); end=(today+timedelta(days=max(0,min(horizon,365)))).isoformat(); today_s=today.isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I); due=dm.group(1) if dm else None
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else 'Unassigned'
                        if not due and priority not in ('high','medium'): continue
                        if due and due>end: continue
                        bucket='overdue' if due and due<today_s else ('today' if due==today_s else ('next' if due else 'priority'))
                        items.append({'bucket':bucket,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                weight={'overdue':0,'today':1,'next':2,'priority':3}; pweight={'high':0,'medium':1,'normal':2,'low':3}
                items.sort(key=lambda x:(weight[x['bucket']],x['due'] or '9999-12-31',pweight.get(x['priority'],2),x['project'].lower()))
                return self.send_json({'today':today_s,'through':end,'items':items,'count':len(items)})
            if u.path=='/api/task-review':
                refresh(); items=[]; today=datetime.now().date(); today_s=today.isoformat(); week=(today+timedelta(days=7)).isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=re.match(r'^\s*- \[( |x|X)\]\s+(.+)$',line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=re.search(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',text,re.I); due=dm.group(1) if dm else None
                        pm=re.search(r'(?:priority:\s*|!)(high|medium|low)\b',text,re.I); priority=pm.group(1).lower() if pm else 'normal'
                        jm=re.search(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',text,re.I); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'done':done,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                open_items=[x for x in items if not x['done']]; done_items=[x for x in items if x['done']]
                overdue=[x for x in open_items if x['due'] and x['due']<today_s]
                next7=[x for x in open_items if x['due'] and today_s<=x['due']<=week]
                undated=[x for x in open_items if not x['due']]
                projects={}
                for x in open_items: projects[x['project']]=projects.get(x['project'],0)+1
                return self.send_json({'date':today_s,'through':week,'summary':{'total':len(items),'open':len(open_items),'done':len(done_items),'overdue':len(overdue),'next7':len(next7),'undated':len(undated)},'projects':[{'project':k,'open':v} for k,v in sorted(projects.items(),key=lambda a:(-a[1],a[0].lower()))],'overdue':overdue,'next7':next7,'undated':undated})
            if u.path=='/api/note':
                rel=norm_rel(q.get('path',[''])[0]); p=md_path(rel)
                if not p.exists(): return self.fail('Note not found',404)
                return self.send_json(index_note(p))
            if u.path=='/api/tree':
                refresh(); tree=[]
                for p in sorted(vault().rglob('*'),key=lambda x:(not x.is_dir(),str(x).lower())):
                    if '.portable-notes' in p.parts or p.name.startswith('.'): continue
                    tree.append({'path':p.relative_to(vault()).as_posix(),'name':p.name,'type':'folder' if p.is_dir() else 'note' if p.suffix.lower()=='.md' else 'asset'})
                return self.send_json({'vault':str(vault()),'items':tree})
            if u.path=='/api/backlinks':
                title=q.get('title',[''])[0]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                return self.send_json([serialize(r) for r in rows if title in json.loads(r['links'] or '[]')])
            if u.path=='/api/history':
                rel=norm_rel(q.get('path',[''])[0]); return self.send_json(note_history(rel))
            if u.path=='/api/history/item':
                rel=norm_rel(q.get('path',[''])[0]); hid=safe_name(q.get('id',[''])[0]); hp=history_dir()/hashlib.sha1(rel.encode()).hexdigest()[:12]/(hid+'.md')
                if not hp.exists(): return self.fail('History item not found',404)
                return self.send_json({'id':hid,'content':hp.read_text(encoding='utf-8',errors='replace')})
            if u.path=='/api/export':
                mem=io.BytesIO()
                with zipfile.ZipFile(mem,'w',zipfile.ZIP_DEFLATED) as z:
                    for p in vault().rglob('*'):
                        if p.is_file() and '.portable-notes' not in p.parts: z.write(p,p.relative_to(vault()))
                    z.writestr('portable-notes-backup.json',json.dumps({'version':'2.11.0','created':iso(),'vault':str(vault())},indent=2))
                raw=mem.getvalue(); self.send_response(200); self.send_header('Content-Type','application/zip'); self.send_header('Content-Disposition','attachment; filename="portable-notes-vault-backup.zip"'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); return self.wfile.write(raw)
            if u.path=='/api/attachment':
                rel=norm_rel(q.get('path',[''])[0]); p=md_path(rel)
                if not p.exists() or p.is_dir(): return self.fail('Attachment not found',404)
                raw=p.read_bytes(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(p.name)[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); return self.wfile.write(raw)
            if u.path=='/api/health': return self.send_json({'ok':True,'version':'2.11.0','vault':str(vault()),'notes':rebuild()})
            if u.path=='/': self.path='/static/index.html'
            return super().do_GET()
        except Exception as e: return self.fail(e)
    def do_POST(self):
        try:
            if self.path.startswith('/api/attachment/upload'):
                u=urlparse(self.path); q=parse_qs(u.query); name=safe_name(q.get('name',['attachment.bin'])[0],'attachment.bin'); size=int(self.headers.get('Content-Length','0'))
                if size>25*1024*1024: return self.fail('Attachment exceeds 25 MB limit',413)
                raw=self.rfile.read(size); adir=vault()/'Attachments'; adir.mkdir(parents=True,exist_ok=True); dest=adir/name; stem,suffix=dest.stem,dest.suffix; i=1
                while dest.exists(): i+=1; dest=adir/f'{stem}-{i}{suffix}'
                dest.write_bytes(raw); rel=dest.relative_to(vault()).as_posix(); return self.send_json({'ok':True,'path':rel,'name':dest.name,'size':len(raw)},201)
            b=read_body(self)
            if self.path=='/api/note':
                title=safe_name(b.get('title','Untitled')); folder=norm_rel(b.get('folder','Inbox')); folder_path=md_path(folder) if folder else vault(); folder_path.mkdir(parents=True,exist_ok=True)
                base=title; i=1; p=folder_path/(safe_name(base)+'.md')
                while p.exists(): i+=1; p=folder_path/(safe_name(base)+f' {i}.md')
                rel=p.relative_to(vault()).as_posix(); t=iso(); p.write_text(front({'id':note_id(rel),'title':title,'created':t,'updated':t,'tags':b.get('tags',[])},b.get('content','')),encoding='utf-8'); return self.send_json(index_note(p),201)
            if self.path=='/api/folder':
                p=md_path(norm_rel(b.get('path','New Folder'))); p.mkdir(parents=True,exist_ok=True); return self.send_json({'ok':True,'path':p.relative_to(vault()).as_posix()},201)
            if self.path=='/api/rebuild': return self.send_json({'ok':True,'notes':rebuild()})
            return self.fail('Not found',404)
        except Exception as e:return self.fail(e)
    def do_PUT(self):
        try:
            if self.path!='/api/note': return self.fail('Not found',404)
            b=read_body(self); old=md_path(b['path'])
            if not old.exists(): return self.fail('Note not found',404)
            old_text=old.read_text(encoding='utf-8',errors='replace'); snapshot(b['path'],old_text); old_meta,old_body=parse_front(old_text); title=safe_name(b.get('title',old_meta.get('title',old.stem))); folder=norm_rel(b.get('folder',old.parent.relative_to(vault()).as_posix())); dest_dir=md_path(folder) if folder else vault(); dest_dir.mkdir(parents=True,exist_ok=True)
            desired=dest_dir/(title+'.md')
            if desired!=old and desired.exists(): return self.fail('A note with this name already exists',409)
            old_title=str(old_meta.get('title',old.stem)); new_meta={**old_meta,'title':title,'updated':iso(),'tags':b.get('tags',old_meta.get('tags',[])),'favorite':b.get('favorite',boolv(old_meta.get('favorite'))),'pinned':b.get('pinned',boolv(old_meta.get('pinned'))),'id':old_meta.get('id') or note_id(b['path'])}
            old.write_text(front(new_meta,b.get('content',old_body)),encoding='utf-8')
            if desired!=old:
                old.rename(desired)
                if b.get('updateLinks',True) and old_title!=title:
                    for p in vault().rglob('*.md'):
                        if p!=desired:
                            s=p.read_text(encoding='utf-8',errors='replace'); n=re.sub(r'\[\['+re.escape(old_title)+r'(?=\]|#|\|)', '[['+title,s)
                            if n!=s:p.write_text(n,encoding='utf-8')
                with sqlite3.connect(DB) as db: db.execute('DELETE FROM notes WHERE path=?',(b['path'],))
            return self.send_json(index_note(desired))
        except Exception as e:return self.fail(e)
    def do_DELETE(self):
        try:
            u=urlparse(self.path)
            if u.path!='/api/note':return self.fail('Not found',404)
            rel=norm_rel(parse_qs(u.query).get('path',[''])[0]); p=md_path(rel); trash=vault()/'.portable-notes'/'trash'; trash.mkdir(parents=True,exist_ok=True); dest=trash/(p.stem+'-'+str(int(time.time()))+p.suffix); shutil.move(str(p),dest)
            with sqlite3.connect(DB) as db: db.execute('DELETE FROM notes WHERE path=?',(rel,))
            return self.send_json({'ok':True})
        except Exception as e:return self.fail(e)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=PORT); parser.add_argument('--no-browser',action='store_true'); parser.add_argument('--vault'); args=parser.parse_args()
    global CFG
    if args.vault: CFG['vault']=str(Path(args.vault).expanduser().resolve()); save_cfg()
    seed(); rebuild(); os.chdir(ROOT); server=ThreadingHTTPServer((HOST,args.port),Handler); url=f'http://{HOST}:{args.port}'
    print(f'Portable Notes 2.11.0 running at {url}\nVault: {vault()}\nPress Ctrl+C to stop.')
    if not args.no_browser: threading.Timer(.5,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nStopped.')
    finally:server.server_close()
if __name__=='__main__':main()
