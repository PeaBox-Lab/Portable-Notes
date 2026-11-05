import unittest,app
class SecurityTests(unittest.TestCase):
 def test_absolute_rejected(self):
  with self.assertRaises(ValueError): app.norm_rel('/etc/passwd')
 def test_dot_rejected(self):
  with self.assertRaises(ValueError): app.norm_rel('./secret')
 def test_encoded_traversal_rejected(self):
  with self.assertRaises(ValueError): app.norm_rel('%2e%2e/secret')
 def test_safe_name_controls(self): self.assertEqual(app.safe_name('a\x00b'),'ab')
 def test_safe_name_limit(self): self.assertEqual(len(app.safe_name('a'*200)),120)
if __name__=='__main__': unittest.main()
