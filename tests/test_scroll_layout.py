import unittest
from pathlib import Path
class ScrollLayoutTests(unittest.TestCase):
 def setUp(self): self.css=Path('static/style.css').read_text()
 def test_editor_scroll(self): self.assertIn('overflow-y:auto!important',self.css)
 def test_work_clips_to_available_height(self): self.assertIn('#work{position:relative;overflow:hidden;min-height:0;height:auto}',self.css)
 def test_main_can_shrink(self): self.assertIn('.nav,.context,main{height:100%;min-height:0}',self.css)
 def test_list_scroll(self): self.assertIn('.list{flex:1;min-height:0;overflow-y:auto',self.css)
 def test_command_list_scroll(self): self.assertIn('#commandList{max-height:60vh;overflow-y:auto',self.css)
if __name__=='__main__': unittest.main()
