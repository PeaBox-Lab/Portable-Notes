
#!/usr/bin/env python3
# Portable Notes 2.30.2: architecture and reliability release.
from __future__ import annotations
import argparse, hashlib, html, io, json, mimetypes, os, re, shutil, sqlite3, threading, time, webbrowser, zipfile
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlparse
from core.tasks import (TASK_LINE_RE,DUE_RE,BASELINE_RE,PROJECT_RE,PRIORITY_RE,ESTIMATE_RE,TASK_ID_RE,DEPENDENCY_RE,MILESTONE_RE,parse_task_line,parse_tasks)
from core.errors import AppError, ValidationError, NotFoundError

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
    raw=unquote(str(value or '')).replace('\\','/')
    if raw.startswith('/') or re.match(r'^[A-Za-z]:/',raw): raise ValueError('Invalid path')
    value=raw.strip('/'); p=Path(value)
    if value.startswith('.') or '..' in p.parts: raise ValueError('Invalid path')
    return value

def load_cfg():
    default={'vault':str(DEFAULT_VAULT),'theme':'system','version':'2.30.2'}
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
    def end_headers(self):
        # The UI is shipped as local files and must never reuse a stale broken asset.
        if self.path=='/' or self.path.startswith('/static/'):
            self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
            self.send_header('Pragma','no-cache')
            self.send_header('Expires','0')
        super().end_headers()
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
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); due=None
                        dm=DUE_RE.search(text)
                        if dm: due=dm.group(1)
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else ''
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
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
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
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); dm=DUE_RE.search(text)
                        if not dm: continue
                        due=dm.group(1)
                        if start and due<start: continue
                        if end and due>end: continue
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'due':due,'done':m.group(1).lower()=='x','priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                weight={'high':0,'medium':1,'normal':2,'low':3}; items.sort(key=lambda x:(x['due'],x['done'],weight.get(x['priority'],2),x['note'].lower()))
                return self.send_json(items)
            if u.path=='/api/task-board':
                refresh(); board={'overdue':[],'today':[],'upcoming':[],'no_due':[],'done':[]}; today=datetime.now().date().isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
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
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
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
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'done':done,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                open_items=[x for x in items if not x['done']]; done_items=[x for x in items if x['done']]
                overdue=[x for x in open_items if x['due'] and x['due']<today_s]
                next7=[x for x in open_items if x['due'] and today_s<=x['due']<=week]
                undated=[x for x in open_items if not x['due']]
                projects={}
                for x in open_items: projects[x['project']]=projects.get(x['project'],0)+1
                return self.send_json({'date':today_s,'through':week,'summary':{'total':len(items),'open':len(open_items),'done':len(done_items),'overdue':len(overdue),'next7':len(next7),'undated':len(undated)},'projects':[{'project':k,'open':v} for k,v in sorted(projects.items(),key=lambda a:(-a[1],a[0].lower()))],'overdue':overdue,'next7':next7,'undated':undated})
            if u.path=='/api/task-stats':
                refresh(); items=[]; today=datetime.now().date(); today_s=today.isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'done':done,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                total=len(items); done=sum(x['done'] for x in items); open_n=total-done
                overdue=sum(bool(not x['done'] and x['due'] and x['due']<today_s) for x in items)
                due_today=sum(bool(not x['done'] and x['due']==today_s) for x in items)
                priorities={k:sum(bool(not x['done'] and x['priority']==k) for x in items) for k in ('high','medium','normal','low')}
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'total':0,'open':0,'done':0})
                    z['total']+=1; z['done' if x['done'] else 'open']+=1
                completion=round((done/total*100),1) if total else 0.0
                return self.send_json({'date':today_s,'total':total,'open':open_n,'done':done,'completion_percent':completion,'overdue':overdue,'due_today':due_today,'priorities':priorities,'projects':sorted(projects.values(),key=lambda x:(-x['open'],x['project'].lower()))})
            if u.path=='/api/task-project':
                refresh(); name=q.get('project',[''])[0].strip()
                if not name: return self.fail('project is required',400)
                items=[]; today=datetime.now().date().isoformat(); notes=set()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
                        if project.lower()!=name.lower(): continue
                        done=m.group(1).lower()=='x'; dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        notes.add(d['path']); items.append({'done':done,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no,'overdue':bool(not done and due and due<today)})
                open_items=[x for x in items if not x['done']]; done_items=[x for x in items if x['done']]; weight={'high':0,'medium':1,'normal':2,'low':3}
                open_items.sort(key=lambda x:(not x['overdue'],x['due'] or '9999-12-31',weight.get(x['priority'],2),x['note'].lower()))
                total=len(items); done=len(done_items)
                return self.send_json({'project':name,'total':total,'open':len(open_items),'done':done,'completion_percent':round(done/total*100,1) if total else 0.0,'overdue':sum(x['overdue'] for x in items),'high':sum(not x['done'] and x['priority']=='high' for x in items),'next_due':min((x['due'] for x in open_items if x['due']),default=None),'source_notes':len(notes),'tasks':open_items+done_items})
            if u.path=='/api/task-timeline':
                refresh(); project=q.get('project',[''])[0].strip(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); dm=DUE_RE.search(text)
                        if not dm: continue
                        jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        items.append({'date':dm.group(1),'done':m.group(1).lower()=='x','priority':priority,'project':proj,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                weight={'high':0,'medium':1,'normal':2,'low':3}; items.sort(key=lambda x:(x['date'],x['done'],weight.get(x['priority'],2),x['project'].lower()))
                months={}
                for x in items: months.setdefault(x['date'][:7],[]).append(x)
                return self.send_json({'project':project or None,'items':items,'months':[{'month':k,'count':len(v),'open':sum(not x['done'] for x in v),'done':sum(x['done'] for x in v)} for k,v in sorted(months.items())]})
            if u.path=='/api/task-milestones':
                refresh(); project=q.get('project',[''])[0].strip(); items=[]; today=datetime.now().date().isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); mm=MILESTONE_RE.search(text)
                        if not mm: continue
                        jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'; done=m.group(1).lower()=='x'
                        items.append({'milestone':mm.group(1),'project':proj,'due':due,'done':done,'priority':priority,'overdue':bool(not done and due and due<today),'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                groups={}
                for x in items:
                    key=(x['project'],x['milestone']); z=groups.setdefault(key,{'project':x['project'],'milestone':x['milestone'],'total':0,'open':0,'done':0,'overdue':0,'next_due':None})
                    z['total']+=1; z['done' if x['done'] else 'open']+=1; z['overdue']+=int(x['overdue'])
                    if not x['done'] and x['due'] and (z['next_due'] is None or x['due']<z['next_due']): z['next_due']=x['due']
                data=[]
                for z in groups.values(): z['completion_percent']=round(z['done']/z['total']*100,1) if z['total'] else 0.0; data.append(z)
                data.sort(key=lambda z:(-z['overdue'],z['next_due'] or '9999-12-31',z['project'].lower(),z['milestone'].lower()))
                return self.send_json({'project':project or None,'milestones':data,'tasks':items})
            if u.path=='/api/task-milestone-board':
                refresh(); project=q.get('project',[''])[0].strip(); milestone=q.get('milestone',[''])[0].strip(); today=datetime.now().date().isoformat()
                board={'overdue':[],'active':[],'done':[]}; summary={}
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); mm=MILESTONE_RE.search(text)
                        if not mm: continue
                        ms=mm.group(1); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        if milestone and ms.lower()!=milestone.lower(): continue
                        done=m.group(1).lower()=='x'; dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'; overdue=bool(not done and due and due<today)
                        item={'milestone':ms,'project':proj,'due':due,'done':done,'priority':priority,'overdue':overdue,'text':text,'note':d['title'],'path':d['path'],'line':line_no}
                        lane='done' if done else ('overdue' if overdue else 'active'); board[lane].append(item)
                        key=proj+' / '+ms; z=summary.setdefault(key,{'project':proj,'milestone':ms,'total':0,'open':0,'done':0,'overdue':0})
                        z['total']+=1; z['done' if done else 'open']+=1; z['overdue']+=int(overdue)
                weight={'high':0,'medium':1,'normal':2,'low':3}
                for lane in board: board[lane].sort(key=lambda x:(x['due'] or '9999-12-31',weight.get(x['priority'],2),x['project'].lower(),x['milestone'].lower()))
                for z in summary.values(): z['completion_percent']=round(z['done']/z['total']*100,1) if z['total'] else 0.0
                return self.send_json({'project':project or None,'milestone':milestone or None,'summary':sorted(summary.values(),key=lambda z:(-z['overdue'],-z['open'],z['project'].lower(),z['milestone'].lower())),'board':board})
            if u.path=='/api/task-dependencies':
                refresh(); project=q.get('project',[''])[0].strip(); tasks=[]; ids={}
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        im=TASK_ID_RE.search(text); taskid=im.group(1) if im else None
                        deps=DEPENDENCY_RE.findall(text)
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        item={'taskid':taskid,'depends':deps,'project':proj,'done':m.group(1).lower()=='x','due':due,'text':text,'note':d['title'],'path':d['path'],'line':line_no}
                        tasks.append(item)
                        if taskid: ids[taskid.lower()]=item
                blocked=[]; ready=[]; unresolved=[]
                for x in tasks:
                    missing=[d for d in x['depends'] if d.lower() not in ids]
                    waiting=[d for d in x['depends'] if d.lower() in ids and not ids[d.lower()]['done']]
                    row=dict(x); row['missing_dependencies']=missing; row['waiting_on']=waiting
                    if x['done']: continue
                    if missing: unresolved.append(row)
                    elif waiting: blocked.append(row)
                    else: ready.append(row)
                return self.send_json({'project':project or None,'ready':ready,'blocked':blocked,'unresolved':unresolved,'counts':{'ready':len(ready),'blocked':len(blocked),'unresolved':len(unresolved)}})
            if u.path=='/api/task-critical-path':
                refresh(); project=q.get('project',[''])[0].strip(); tasks=[]; ids={}
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        im=TASK_ID_RE.search(text); taskid=im.group(1) if im else None
                        if not taskid: continue
                        deps=DEPENDENCY_RE.findall(text)
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        item={'taskid':taskid,'depends':deps,'project':proj,'done':m.group(1).lower()=='x','due':due,'text':text,'note':d['title'],'path':d['path'],'line':line_no}
                        tasks.append(item); ids[taskid.lower()]=item
                visiting=set(); memo={}; cycles=set()
                def depth(tid):
                    key=tid.lower()
                    if key in memo:return memo[key]
                    if key in visiting: cycles.add(key); return 0
                    visiting.add(key); x=ids.get(key); best=1
                    if x:
                        vals=[depth(d)+1 for d in x['depends'] if d.lower() in ids]
                        if vals: best=max(vals)
                    visiting.discard(key); memo[key]=best; return best
                rows=[]
                for x in tasks:
                    missing=[d for d in x['depends'] if d.lower() not in ids]; waiting=[d for d in x['depends'] if d.lower() in ids and not ids[d.lower()]['done']]
                    rows.append(dict(x,depth=depth(x['taskid']),missing_dependencies=missing,waiting_on=waiting,blocked=bool(missing or waiting)))
                rows.sort(key=lambda x:(-x['depth'],x['done'],x['due'] or '9999-12-31',x['taskid'].lower()))
                max_depth=max((x['depth'] for x in rows),default=0); critical=[x for x in rows if x['depth']==max_depth and max_depth>0]
                return self.send_json({'project':project or None,'max_depth':max_depth,'critical':critical,'tasks':rows,'cycles':sorted(cycles)})
            if u.path=='/api/task-risk':
                refresh(); project=q.get('project',[''])[0].strip(); today=datetime.now().date().isoformat(); tasks=[]; ids={}
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        im=TASK_ID_RE.search(text); taskid=im.group(1) if im else None
                        deps=DEPENDENCY_RE.findall(text)
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        item={'taskid':taskid,'depends':deps,'project':proj,'due':due,'priority':priority,'text':text,'note':d['title'],'path':d['path'],'line':line_no}; tasks.append(item)
                        if taskid: ids[taskid.lower()]=item
                risks=[]
                for x in tasks:
                    missing=[d for d in x['depends'] if d.lower() not in ids]; waiting=[d for d in x['depends'] if d.lower() in ids]
                    score=0; reasons=[]
                    if x['due'] and x['due']<today: score+=5; reasons.append('overdue')
                    if x['priority']=='high': score+=3; reasons.append('high priority')
                    elif x['priority']=='medium': score+=1
                    if waiting: score+=min(4,len(waiting)*2); reasons.append('dependency blocked')
                    if missing: score+=4; reasons.append('missing dependency')
                    level='critical' if score>=8 else ('high' if score>=5 else ('medium' if score>=3 else 'low'))
                    risks.append(dict(x,risk_score=score,risk_level=level,reasons=reasons,waiting_on=waiting,missing_dependencies=missing))
                risks.sort(key=lambda x:(-x['risk_score'],x['due'] or '9999-12-31',x['project'].lower(),x['note'].lower()))
                counts={k:sum(x['risk_level']==k for x in risks) for k in ('critical','high','medium','low')}
                return self.send_json({'project':project or None,'counts':counts,'tasks':risks})
            if u.path=='/api/task-workload':
                refresh(); project=q.get('project',[''])[0].strip(); today=datetime.now().date(); through=(today+timedelta(days=7)).isoformat(); today_s=today.isoformat(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else None
                        items.append({'project':proj,'due':due,'priority':priority,'estimate_hours':estimate,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'open':0,'overdue':0,'next7':0,'estimated_hours':0.0,'unestimated':0})
                    z['open']+=1; z['overdue']+=int(bool(x['due'] and x['due']<today_s)); z['next7']+=int(bool(x['due'] and today_s<=x['due']<=through))
                    if x['estimate_hours'] is None:z['unestimated']+=1
                    else:z['estimated_hours']+=x['estimate_hours']
                data=[]
                for z in projects.values():
                    z['estimated_hours']=round(z['estimated_hours'],1); z['load_score']=round(z['estimated_hours']+z['overdue']*4+z['next7']*2+z['unestimated'],1); data.append(z)
                data.sort(key=lambda z:(-z['load_score'],-z['overdue'],-z['open'],z['project'].lower()))
                return self.send_json({'date':today_s,'through':through,'project':project or None,'projects':data,'tasks':items})
            if u.path=='/api/task-capacity':
                refresh(); project=q.get('project',[''])[0].strip(); weekly=float(q.get('hours',['40'])[0] or 40); weekly=max(1.0,min(weekly,168.0)); today=datetime.now().date(); through=(today+timedelta(days=7)).isoformat(); today_s=today.isoformat(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else None
                        if due and due<=through: items.append({'project':proj,'due':due,'estimate_hours':estimate,'text':text,'note':d['title'],'path':d['path'],'line':line_no,'overdue':due<today_s})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'tasks':0,'estimated_hours':0.0,'unestimated':0,'overdue':0})
                    z['tasks']+=1; z['overdue']+=int(x['overdue'])
                    if x['estimate_hours'] is None:z['unestimated']+=1
                    else:z['estimated_hours']+=x['estimate_hours']
                data=[]
                for z in projects.values():
                    z['estimated_hours']=round(z['estimated_hours'],1); z['capacity_hours']=weekly; z['utilization_percent']=round(z['estimated_hours']/weekly*100,1); z['remaining_hours']=round(weekly-z['estimated_hours'],1); z['status']='overloaded' if z['estimated_hours']>weekly else ('tight' if z['estimated_hours']>=weekly*.8 else 'available'); data.append(z)
                data.sort(key=lambda z:(-z['utilization_percent'],-z['overdue'],z['project'].lower()))
                return self.send_json({'date':today_s,'through':through,'capacity_hours':weekly,'project':project or None,'projects':data,'tasks':items})
            if u.path=='/api/task-burndown':
                refresh(); project=q.get('project',[''])[0].strip(); horizon=max(1,min(int(q.get('days',['14'])[0] or 14),90)); today=datetime.now().date(); end=today+timedelta(days=horizon); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else 1.0
                        items.append({'project':proj,'due':due,'estimate_hours':estimate,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                total=round(sum(x['estimate_hours'] for x in items),1); dated=[x for x in items if x['due']]
                points=[]
                for i in range(horizon+1):
                    day=today+timedelta(days=i); ds=day.isoformat(); remaining=round(sum(x['estimate_hours'] for x in items if not x['due'] or x['due']>=ds),1); ideal=round(total*(1-i/horizon),1)
                    points.append({'date':ds,'ideal_remaining_hours':ideal,'scheduled_remaining_hours':remaining})
                return self.send_json({'project':project or None,'days':horizon,'start':today.isoformat(),'end':end.isoformat(),'total_open_hours':total,'unestimated_default_hours':1.0,'points':points,'dated_tasks':len(dated),'open_tasks':len(items)})
            if u.path=='/api/task-forecast':
                refresh(); project=q.get('project',[''])[0].strip(); capacity=max(1.0,min(float(q.get('hours',['40'])[0] or 40),168.0)); today=datetime.now().date(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else 1.0
                        items.append({'project':proj,'due':due,'estimate_hours':estimate,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'open_tasks':0,'remaining_hours':0.0,'dated_tasks':0,'latest_due':None})
                    z['open_tasks']+=1; z['remaining_hours']+=x['estimate_hours']
                    if x['due']:
                        z['dated_tasks']+=1
                        if z['latest_due'] is None or x['due']>z['latest_due']: z['latest_due']=x['due']
                data=[]
                for z in projects.values():
                    z['remaining_hours']=round(z['remaining_hours'],1); z['weeks_needed']=round(z['remaining_hours']/capacity,2)
                    days=max(1,round(z['weeks_needed']*7)); z['capacity_finish']=(today+timedelta(days=days)).isoformat(); z['schedule_status']='at_risk' if z['latest_due'] and z['capacity_finish']>z['latest_due'] else 'on_track'; z['capacity_hours_per_week']=capacity; data.append(z)
                data.sort(key=lambda z:(z['schedule_status']!='at_risk',-z['weeks_needed'],z['project'].lower()))
                return self.send_json({'date':today.isoformat(),'capacity_hours_per_week':capacity,'project':project or None,'projects':data})
            if u.path=='/api/task-schedule':
                refresh(); project=q.get('project',[''])[0].strip(); capacity=max(1.0,min(float(q.get('hours',['8'])[0] or 8),24.0)); today=datetime.now().date(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else 1.0
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        items.append({'project':proj,'due':due,'estimate_hours':estimate,'priority':priority,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                weight={'high':0,'medium':1,'normal':2,'low':3}; items.sort(key=lambda x:(x['due'] or '9999-12-31',weight.get(x['priority'],2),x['project'].lower(),x['note'].lower()))
                days=[]; cursor=today; remaining=capacity; bucket=[]
                def flush():
                    nonlocal cursor,remaining,bucket
                    if bucket: days.append({'date':cursor.isoformat(),'hours':round(capacity-remaining,1),'tasks':bucket})
                    cursor+=timedelta(days=1); remaining=capacity; bucket=[]
                for x in items:
                    left=x['estimate_hours']
                    while left>0:
                        take=min(left,remaining); part=dict(x,scheduled_hours=round(take,1)); bucket.append(part); remaining=round(remaining-take,10); left=round(left-take,10)
                        if remaining<=0: flush()
                if bucket: days.append({'date':cursor.isoformat(),'hours':round(capacity-remaining,1),'tasks':bucket})
                return self.send_json({'project':project or None,'daily_capacity_hours':capacity,'start':today.isoformat(),'finish':days[-1]['date'] if days else today.isoformat(),'open_tasks':len(items),'total_hours':round(sum(x['estimate_hours'] for x in items),1),'days':days})
            if u.path=='/api/task-slippage':
                refresh(); project=q.get('project',[''])[0].strip(); today=datetime.now().date().isoformat(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m or m.group(1).lower()=='x': continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        bm=BASELINE_RE.search(text); baseline=bm.group(1) if bm else None
                        if not due or not baseline: continue
                        delta=(datetime.fromisoformat(due).date()-datetime.fromisoformat(baseline).date()).days
                        state='slipped' if delta>0 else ('ahead' if delta<0 else 'on_baseline')
                        items.append({'project':proj,'baseline':baseline,'due':due,'slip_days':delta,'status':state,'overdue':due<today,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'tracked':0,'slipped':0,'ahead':0,'on_baseline':0,'max_slip_days':0,'net_slip_days':0})
                    z['tracked']+=1; z[x['status']]+=1; z['max_slip_days']=max(z['max_slip_days'],x['slip_days']); z['net_slip_days']+=x['slip_days']
                data=[]
                for z in projects.values(): z['average_slip_days']=round(z['net_slip_days']/z['tracked'],1) if z['tracked'] else 0.0; data.append(z)
                data.sort(key=lambda z:(-z['max_slip_days'],-z['slipped'],z['project'].lower())); items.sort(key=lambda x:(-x['slip_days'],x['due'],x['note'].lower()))
                return self.send_json({'project':project or None,'projects':data,'tasks':items})
            if u.path=='/api/task-baseline-health':
                refresh(); project=q.get('project',[''])[0].strip(); today=datetime.now().date().isoformat(); items=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        bm=BASELINE_RE.search(text); baseline=bm.group(1) if bm else None
                        done=m.group(1).lower()=='x'; delta=(datetime.fromisoformat(due).date()-datetime.fromisoformat(baseline).date()).days if due and baseline else None
                        covered=bool(due and baseline); status='untracked' if not covered else ('slipped' if delta>0 else ('ahead' if delta<0 else 'on_baseline'))
                        items.append({'project':proj,'done':done,'due':due,'baseline':baseline,'slip_days':delta,'status':status,'overdue':bool(not done and due and due<today),'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'tasks':0,'tracked':0,'untracked':0,'slipped':0,'ahead':0,'on_baseline':0,'overdue':0,'net_slip_days':0})
                    z['tasks']+=1; z['overdue']+=int(x['overdue'])
                    if x['status']=='untracked': z['untracked']+=1
                    else: z['tracked']+=1; z[x['status']]+=1; z['net_slip_days']+=x['slip_days']
                data=[]
                for z in projects.values():
                    z['coverage_percent']=round(z['tracked']/z['tasks']*100,1) if z['tasks'] else 0.0; z['average_slip_days']=round(z['net_slip_days']/z['tracked'],1) if z['tracked'] else 0.0; z['health']='red' if z['overdue'] or z['average_slip_days']>3 else ('amber' if z['untracked'] or z['average_slip_days']>0 else 'green'); data.append(z)
                data.sort(key=lambda z:({'red':0,'amber':1,'green':2}[z['health']],z['project'].lower()))
                return self.send_json({'project':project or None,'projects':data,'tasks':items})
            if u.path=='/api/task-quality':
                refresh(); project=q.get('project',[''])[0].strip(); tasks=[]
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                seen_ids={}
                raw=[]
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        im=TASK_ID_RE.search(text); taskid=im.group(1) if im else None
                        deps=DEPENDENCY_RE.findall(text)
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        bm=BASELINE_RE.search(text); baseline=bm.group(1) if bm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else None
                        raw.append({'project':proj,'taskid':taskid,'depends':deps,'due':due,'baseline':baseline,'estimate_hours':estimate,'done':m.group(1).lower()=='x','text':text,'note':d['title'],'path':d['path'],'line':line_no})
                        if taskid: seen_ids.setdefault(taskid.lower(),0); seen_ids[taskid.lower()]+=1
                for x in raw:
                    issues=[]
                    if not x['taskid']: issues.append('missing task ID')
                    elif seen_ids.get(x['taskid'].lower(),0)>1: issues.append('duplicate task ID')
                    if not x['due'] and not x['done']: issues.append('missing due date')
                    if x['due'] and not x['baseline'] and not x['done']: issues.append('missing baseline')
                    if x['estimate_hours'] is None and not x['done']: issues.append('missing estimate')
                    missing=[d for d in x['depends'] if d.lower() not in seen_ids]
                    if missing: issues.append('unresolved dependencies: '+', '.join(missing))
                    score=max(0,100-len(issues)*20); tasks.append(dict(x,quality_score=score,issues=issues))
                projects={}
                for x in tasks:
                    z=projects.setdefault(x['project'],{'project':x['project'],'tasks':0,'clean':0,'issues':0,'score_total':0})
                    z['tasks']+=1; z['clean']+=int(not x['issues']); z['issues']+=len(x['issues']); z['score_total']+=x['quality_score']
                data=[]
                for z in projects.values(): z['quality_percent']=round(z['score_total']/z['tasks'],1) if z['tasks'] else 100.0; data.append(z)
                data.sort(key=lambda z:(z['quality_percent'],-z['issues'],z['project'].lower())); tasks.sort(key=lambda x:(x['quality_score'],x['project'].lower(),x['note'].lower()))
                return self.send_json({'project':project or None,'projects':data,'tasks':tasks})
            if u.path=='/api/task-readiness':
                refresh(); project=q.get('project',[''])[0].strip(); tasks=[]; seen_ids={}; today=datetime.now().date().isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                raw=[]
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); jm=PROJECT_RE.search(text); proj=jm.group(1) if jm else 'Unassigned'
                        if project and proj.lower()!=project.lower(): continue
                        im=TASK_ID_RE.search(text); taskid=im.group(1) if im else None
                        deps=DEPENDENCY_RE.findall(text)
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        bm=BASELINE_RE.search(text); baseline=bm.group(1) if bm else None
                        em=ESTIMATE_RE.search(text); estimate=float(em.group(1)) if em else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        raw.append({'project':proj,'taskid':taskid,'depends':deps,'due':due,'baseline':baseline,'estimate_hours':estimate,'priority':priority,'done':m.group(1).lower()=='x','text':text,'note':d['title'],'path':d['path'],'line':line_no})
                        if taskid: seen_ids.setdefault(taskid.lower(),0); seen_ids[taskid.lower()]+=1
                done_ids={x['taskid'].lower() for x in raw if x['done'] and x['taskid']}
                for x in raw:
                    if x['done']: continue
                    blockers=[]
                    if not x['taskid']: blockers.append('missing task ID')
                    elif seen_ids.get(x['taskid'].lower(),0)>1: blockers.append('duplicate task ID')
                    if not x['due']: blockers.append('missing due date')
                    if x['due'] and not x['baseline']: blockers.append('missing baseline')
                    if x['estimate_hours'] is None: blockers.append('missing estimate')
                    missing=[d for d in x['depends'] if d.lower() not in seen_ids]
                    waiting=[d for d in x['depends'] if d.lower() in seen_ids and d.lower() not in done_ids]
                    if missing: blockers.append('unresolved dependencies: '+', '.join(missing))
                    if waiting: blockers.append('waiting on: '+', '.join(waiting))
                    if x['due'] and x['due']<today: blockers.append('overdue')
                    score=max(0,100-len(blockers)*15); state='ready' if not blockers else ('attention' if score>=70 else 'blocked')
                    tasks.append(dict(x,readiness_score=score,state=state,blockers=blockers))
                projects={}
                for x in tasks:
                    z=projects.setdefault(x['project'],{'project':x['project'],'open':0,'ready':0,'attention':0,'blocked':0,'score_total':0})
                    z['open']+=1; z[x['state']]+=1; z['score_total']+=x['readiness_score']
                data=[]
                for z in projects.values(): z['readiness_percent']=round(z['score_total']/z['open'],1) if z['open'] else 100.0; data.append(z)
                data.sort(key=lambda z:(z['readiness_percent'],-z['blocked'],z['project'].lower())); tasks.sort(key=lambda x:(x['readiness_score'],x['due'] or '9999-12-31',x['note'].lower()))
                return self.send_json({'project':project or None,'projects':data,'tasks':tasks})
            if u.path=='/api/task-projects':
                refresh(); items=[]; today=datetime.now().date().isoformat()
                with sqlite3.connect(DB) as db: db.row_factory=sqlite3.Row; rows=db.execute('SELECT * FROM notes').fetchall()
                for r in rows:
                    d=serialize(r)
                    for line_no,line in enumerate(d['content'].splitlines(),1):
                        m=TASK_LINE_RE.match(line)
                        if not m: continue
                        text=m.group(2).strip(); done=m.group(1).lower()=='x'
                        dm=DUE_RE.search(text); due=dm.group(1) if dm else None
                        pm=PRIORITY_RE.search(text); priority=pm.group(1).lower() if pm else 'normal'
                        jm=PROJECT_RE.search(text); project=jm.group(1) if jm else 'Unassigned'
                        items.append({'done':done,'due':due,'priority':priority,'project':project,'text':text,'note':d['title'],'path':d['path'],'line':line_no})
                projects={}
                for x in items:
                    z=projects.setdefault(x['project'],{'project':x['project'],'total':0,'open':0,'done':0,'overdue':0,'high':0,'next_due':None,'completion_percent':0.0})
                    z['total']+=1; z['done' if x['done'] else 'open']+=1
                    if not x['done'] and x['due'] and x['due']<today:z['overdue']+=1
                    if not x['done'] and x['priority']=='high':z['high']+=1
                    if not x['done'] and x['due'] and (z['next_due'] is None or x['due']<z['next_due']):z['next_due']=x['due']
                for z in projects.values(): z['completion_percent']=round(z['done']/z['total']*100,1) if z['total'] else 0.0
                data=sorted(projects.values(),key=lambda z:(-z['overdue'],-z['high'],-z['open'],z['project'].lower()))
                return self.send_json(data)
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
                    z.writestr('portable-notes-backup.json',json.dumps({'version':'2.30.2','created':iso(),'vault':str(vault())},indent=2))
                raw=mem.getvalue(); self.send_response(200); self.send_header('Content-Type','application/zip'); self.send_header('Content-Disposition','attachment; filename="portable-notes-vault-backup.zip"'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); return self.wfile.write(raw)
            if u.path=='/api/attachment':
                rel=norm_rel(q.get('path',[''])[0]); p=md_path(rel)
                if not p.exists() or p.is_dir(): return self.fail('Attachment not found',404)
                raw=p.read_bytes(); self.send_response(200); self.send_header('Content-Type',mimetypes.guess_type(p.name)[0] or 'application/octet-stream'); self.send_header('Content-Length',str(len(raw))); self.end_headers(); return self.wfile.write(raw)
            if u.path=='/api/health': return self.send_json({'ok':True,'version':'2.30.2','vault':str(vault()),'notes':rebuild()})
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
    print(f'Portable Notes 2.30.2 running at {url}\nVault: {vault()}\nPress Ctrl+C to stop.')
    if not args.no_browser: threading.Timer(.5,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nStopped.')
    finally:server.server_close()
if __name__=='__main__':main()
