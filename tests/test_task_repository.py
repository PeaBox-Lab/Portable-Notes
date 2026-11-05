import unittest
from services.task_repository import TaskRepository
class RepositoryTests(unittest.TestCase):
 def setUp(self): self.tasks=TaskRepository([{'title':'N','path':'n.md','content':'- [ ] A project: P\n- [x] B project: Q'}]).all()
 def test_all(self): self.assertEqual(len(self.tasks),2)
 def test_project_filter(self): self.assertEqual(len(TaskRepository.filter(self.tasks,project='p')),1)
 def test_done_filter(self): self.assertEqual(TaskRepository.filter(self.tasks,done=True)[0].text,'B project: Q')
if __name__=='__main__': unittest.main()
