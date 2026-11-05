"""Canonical Markdown task model and parser for Portable Notes."""
from dataclasses import dataclass, field, asdict
from typing import Optional
import re

TASK_LINE_RE=re.compile(r'^\s*- \[( |x|X)\]\s+(.+)$')
DUE_RE=re.compile(r'(?:📅|due:)\s*(\d{4}-\d{2}-\d{2})',re.I)
BASELINE_RE=re.compile(r'(?:baseline:|base:)\s*(\d{4}-\d{2}-\d{2})',re.I)
PROJECT_RE=re.compile(r'(?:project:\s*|#project/)([A-Za-z0-9._-]+)',re.I)
PRIORITY_RE=re.compile(r'(?:priority:\s*|!)(high|medium|low)\b',re.I)
ESTIMATE_RE=re.compile(r'(?:estimate:|est:)\s*(\d+(?:\.\d+)?)h\b',re.I)
TASK_ID_RE=re.compile(r'(?:taskid:\s*|#task/)([A-Za-z0-9._-]+)',re.I)
DEPENDENCY_RE=re.compile(r'(?:depends:\s*|#depends/)([A-Za-z0-9._-]+)',re.I)
MILESTONE_RE=re.compile(r'(?:milestone:\s*|#milestone/)([A-Za-z0-9._-]+)',re.I)

@dataclass(frozen=True)
class Task:
    text:str
    done:bool
    line:int=0
    note:str=''
    path:str=''
    due:Optional[str]=None
    baseline:Optional[str]=None
    project:str='Unassigned'
    priority:str='normal'
    estimate_hours:Optional[float]=None
    taskid:Optional[str]=None
    depends:list[str]=field(default_factory=list)
    milestone:Optional[str]=None
    def to_dict(self): return asdict(self)

def parse_task_line(line:str,line_no:int=0,note:str='',path:str='') -> Optional[Task]:
    m=TASK_LINE_RE.match(line)
    if not m:return None
    text=m.group(2).strip()
    def one(rx):
        v=rx.search(text); return v.group(1) if v else None
    estimate=one(ESTIMATE_RE)
    return Task(text=text,done=m.group(1).lower()=='x',line=line_no,note=note,path=path,
        due=one(DUE_RE),baseline=one(BASELINE_RE),project=one(PROJECT_RE) or 'Unassigned',
        priority=(one(PRIORITY_RE) or 'normal').lower(),estimate_hours=float(estimate) if estimate else None,
        taskid=one(TASK_ID_RE),depends=DEPENDENCY_RE.findall(text),milestone=one(MILESTONE_RE))

def parse_tasks(content:str,note:str='',path:str='') -> list[Task]:
    return [t for i,line in enumerate(content.splitlines(),1) if (t:=parse_task_line(line,i,note,path))]
