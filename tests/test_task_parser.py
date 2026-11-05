import unittest
from core.tasks import parse_task_line,parse_tasks
class TaskParserTests(unittest.TestCase):
 def test_non_task(self): self.assertIsNone(parse_task_line('hello'))
 def test_open_and_done(self):
  self.assertFalse(parse_task_line('- [ ] x').done); self.assertTrue(parse_task_line('- [x] x').done)
 def test_all_metadata(self):
  t=parse_task_line('- [ ] Ship due: 2026-12-01 baseline: 2026-11-20 priority: high estimate: 2.5h project: Pea taskid: A depends: B milestone: GA',7,'N','n.md')
  self.assertEqual((t.due,t.baseline,t.priority,t.estimate_hours,t.project,t.taskid,t.depends,t.milestone),('2026-12-01','2026-11-20','high',2.5,'Pea','A',['B'],'GA'))
  self.assertEqual((t.line,t.note,t.path),(7,'N','n.md'))
 def test_hashtag_aliases(self):
  t=parse_task_line('- [ ] X #project/P #task/T #depends/A #milestone/M !medium est: 1h 📅 2026-12-02')
  self.assertEqual((t.project,t.taskid,t.depends,t.milestone,t.priority,t.estimate_hours,t.due),('P','T',['A'],'M','medium',1.0,'2026-12-02'))
 def test_multiple_dependencies(self): self.assertEqual(parse_task_line('- [ ] X depends: A depends: B').depends,['A','B'])
 def test_defaults(self):
  t=parse_task_line('- [ ] X'); self.assertEqual(t.project,'Unassigned'); self.assertEqual(t.priority,'normal'); self.assertIsNone(t.estimate_hours)
 def test_parse_tasks_line_numbers(self):
  x=parse_tasks('a\n- [ ] b\n- [x] c','N','p.md'); self.assertEqual([t.line for t in x],[2,3])
 def test_to_dict(self): self.assertEqual(parse_task_line('- [ ] X').to_dict()['text'],'X')
if __name__=='__main__': unittest.main()
