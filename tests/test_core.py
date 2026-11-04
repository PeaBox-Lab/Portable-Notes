import importlib.util, tempfile, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('portable_notes',Path(__file__).parents[1]/'app.py'); app=importlib.util.module_from_spec(spec); spec.loader.exec_module(app)
class CoreTests(unittest.TestCase):
    def test_front_matter_roundtrip(self):
        raw=app.front({'id':'1','title':'Test','created':'a','updated':'b','tags':['x'],'favorite':True},'# Body')
        meta,body=app.parse_front(raw); self.assertEqual(meta['title'],'Test'); self.assertIn('x',meta['tags']); self.assertIn('# Body',body)
    def test_safe_name(self): self.assertEqual(app.safe_name('A:B?'),'AB')
    def test_path_rejection(self):
        with self.assertRaises(ValueError): app.norm_rel('../secret')
if __name__=='__main__':unittest.main()
