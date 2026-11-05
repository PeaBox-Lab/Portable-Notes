"""Reusable task query layer over indexed note rows."""
from core.tasks import parse_tasks
class TaskRepository:
    def __init__(self, rows): self.rows=rows
    def all(self, serializer=lambda x:x):
        out=[]
        for row in self.rows:
            note=serializer(row)
            out.extend(parse_tasks(note.get('content',''),note.get('title',''),note.get('path','')))
        return out
    @staticmethod
    def filter(tasks,project=None,done=None):
        result=list(tasks)
        if project: result=[t for t in result if t.project.lower()==project.lower()]
        if done is not None: result=[t for t in result if t.done is done]
        return result
