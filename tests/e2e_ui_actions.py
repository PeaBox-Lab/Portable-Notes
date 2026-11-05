#!/usr/bin/env python3
"""Live-server end-to-end regression for every UI action/API-backed command."""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import quote
ROOT=Path(__file__).resolve().parents[1]; PORT='8913'; BASE='http://127.0.0.1:'+PORT
vault=Path(tempfile.mkdtemp(prefix='pn-e2e-'))
proc=subprocess.Popen([sys.executable,str(ROOT/'app.py'),'--no-browser','--port',PORT,'--vault',str(vault)],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
results=[]
def req(path,method='GET',body=None,raw=False):
 data=None if body is None else (body if isinstance(body,bytes) else json.dumps(body).encode())
 r=urlopen(Request(BASE+path,data=data,method=method,headers={'Content-Type':'application/json'}),timeout=10)
 out=r.read(); return out if raw else json.loads(out)
def check(name,fn):
 try: fn(); results.append((name,'PASS',''))
 except Exception as e: results.append((name,'FAIL',str(e)))
try:
 for _ in range(50):
  try:
   if req('/api/health')['version']=='2.30.4': break
  except Exception: time.sleep(.1)
 else: raise RuntimeError('server did not start')
 check('App shell + cache-busted assets',lambda: ('v=2.30.4' in req('/',raw=True).decode()) or (_ for _ in ()).throw(AssertionError()))
 def cache_headers():
  r=urlopen(BASE+'/static/app.js?v=2.30.4'); assert 'no-store' in r.headers.get('Cache-Control',''); r.read()
 check('No-cache UI assets',cache_headers)
 check('JavaScript syntax',lambda: subprocess.run(['node','--check',str(ROOT/'static/app.js')],check=True,capture_output=True))
 content='''# E2E Note\n- [ ] Foundation taskid: A due: 2026-11-01 baseline: 2026-11-01 estimate: 2h priority: high project: E2E milestone: Beta\n- [ ] Dependent taskid: B depends: A due: 2026-11-20 baseline: 2026-11-18 estimate: 3h project: E2E milestone: Beta\n- [x] Done taskid: C due: 2026-11-03 baseline: 2026-11-03 estimate: 1h project: E2E milestone: Beta\n'''
 created=req('/api/note','POST',{'title':'E2E Note','folder':'E2E','content':content,'tags':['e2e']}); path=created['path']; qp=quote(path)
 check('New note',lambda: req('/api/note?path='+qp))
 check('All notes',lambda: req('/api/notes?q='))
 check('Search',lambda: req('/api/search?q=Foundation'))
 check('Favorites filter',lambda: req('/api/notes?q=&favorite=1'))
 check('Folder tree',lambda: req('/api/tree'))
 check('New folder',lambda: req('/api/folder','POST',{'path':'E2E Folder'}))
 updated=req('/api/note','PUT',{'path':path,'title':'E2E Note','folder':'E2E','content':content+'\nUpdated','tags':['e2e'],'favorite':True,'pinned':True})
 check('Save/edit note',lambda: req('/api/note?path='+qp))
 check('Favorite + pin',lambda: (_ for _ in ()).throw(AssertionError()) if not(updated['favorite'] and updated['pinned']) else None)
 check('Backlinks',lambda: req('/api/backlinks?title=E2E%20Note'))
 check('History',lambda: req('/api/history?path='+qp))
 check('Unlinked mentions',lambda: req('/api/mentions?title=E2E%20Note'))
 check('Duplicate notes',lambda: req('/api/duplicates'))
 endpoints=[
 ('Global tasks','/api/tasks?status=open'),('High priority','/api/tasks?status=open&priority=high'),('Task dashboard','/api/task-dashboard'),('Task calendar','/api/task-calendar'),('Task board','/api/task-board?project=E2E'),('Focus','/api/task-focus?days=7'),('Weekly review','/api/task-review'),('Productivity stats','/api/task-stats'),('Project health','/api/task-projects'),('Project workspace','/api/task-project?project=E2E'),('Project timeline','/api/task-timeline?project=E2E'),('Milestones','/api/task-milestones?project=E2E'),('Milestone board','/api/task-milestone-board?project=E2E&milestone=Beta'),('Dependencies','/api/task-dependencies?project=E2E'),('Critical path','/api/task-critical-path?project=E2E'),('Risk radar','/api/task-risk?project=E2E'),('Workload','/api/task-workload?project=E2E'),('Capacity','/api/task-capacity?project=E2E&hours=40'),('Burndown','/api/task-burndown?project=E2E&days=14'),('Delivery forecast','/api/task-forecast?project=E2E&hours=40'),('Schedule plan','/api/task-schedule?project=E2E&hours=8'),('Schedule slippage','/api/task-slippage?project=E2E'),('Baseline health','/api/task-baseline-health?project=E2E'),('Metadata quality','/api/task-quality?project=E2E'),('Execution readiness','/api/task-readiness?project=E2E')]
 for name,url in endpoints: check(name,lambda url=url:req(url))
 check('Export vault',lambda: req('/api/export',raw=True))
 attachment=req('/api/attachment/upload?name=e2e.txt','POST',b'attachment',raw=False)
 check('Attachment upload',lambda: attachment['ok'] or (_ for _ in ()).throw(AssertionError()))
 check('Attachment download',lambda: req('/api/attachment?path='+quote(attachment['path']),raw=True))
 check('Delete note',lambda: req('/api/note?path='+qp,'DELETE'))
 # Static/local-only controls are validated by source-level wiring plus JS syntax.
 js=(ROOT/'static/app.js').read_text(); html=(ROOT/'static/index.html').read_text()
 for ident,label in [('new','New button'),('all','All button'),('daily','Daily note'),('fav','Favorites button'),('folder','Folder button'),('mode','Preview mode'),('star','Favorite button'),('pin','Pin button'),('commands','Command palette'),('theme','Theme button')]:
  check(label+' wiring',lambda ident=ident: ("$('#"+ident+"').onclick" in js) or (_ for _ in ()).throw(AssertionError('missing handler')))
 for label,token in [('Editor autosave','oninput=schedule'),('Command search','commandSearch'),('Keyboard shortcuts','addEventListener(\'keydown\''),('Saved search','pn-saved-searches'),('Find/replace','findReplace'),('Note history UI','showHistory')]:
  check(label,lambda token=token: (token in js) or (_ for _ in ()).throw(AssertionError('missing code')))
 css=(ROOT/'static/style.css').read_text()
 check('Editor long-text scroll',lambda: ('overflow-y:auto!important' in css and '#work{position:relative;overflow:hidden;min-height:0;height:auto}' in css) or (_ for _ in ()).throw(AssertionError('scroll linkage missing')))
 check('Navigation list scroll',lambda: ('.list{flex:1;min-height:0;overflow-y:auto' in css) or (_ for _ in ()).throw(AssertionError('list scroll missing')))
 check('Command palette scroll',lambda: ('#commandList{max-height:60vh;overflow-y:auto' in css) or (_ for _ in ()).throw(AssertionError('palette scroll missing')))
 for pane,token in [('Rail scroll','.rail{min-height:0;overflow-y:auto'),('Folder tree scroll','.tree,.list,.context,#editor,#preview,#commandList,#historyList'),('Notes list scroll','.list{flex:1;min-height:0'),('Context pane scroll','.context,#editor'),('Preview scroll','#editor,#preview'),('History scroll','#commandList,#historyList{max-height:60vh')]:
  check(pane,lambda token=token: (token in css) or (_ for _ in ()).throw(AssertionError('missing pane scroll')))
 failed=[r for r in results if r[1]=='FAIL']
 report=['# UI End-to-End Test Report: v2.30.4','',f'- Total checks: **{len(results)}**',f'- Passed: **{len(results)-len(failed)}**',f'- Failed: **{len(failed)}**','', '| Action | Result | Detail |','|---|---|---|']+[f'| {n} | {s} | {d} |' for n,s,d in results]
 (ROOT/'UI_TEST_REPORT_v2.30.4.md').write_text('\n'.join(report)+'\n')
 print('\n'.join(report[:7]));
 if failed:
  print(failed); sys.exit(1)
finally:
 proc.terminate()
 try:proc.wait(timeout=3)
 except:proc.kill()
