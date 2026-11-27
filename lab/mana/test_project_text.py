import io
import unittest
from project_text import RangeFile, Budget, project_row

class Response:
    def __init__(self, status=206, content_range="bytes 2-4/10", data=b"abc"):
        self.status=status
        self.headers={"Content-Range":content_range}
        self.data=io.BytesIO(data)
    def geturl(self):return "https://huggingface.co/test"
    def read(self,n):return self.data.read(n)
    def __enter__(self):return self
    def __exit__(self,*args):pass

class TestRange(unittest.TestCase):
    def test_exact_range(self):
        b=Budget(5)
        def opener(req,timeout):
            self.assertEqual(req.get_header("Range"),"bytes=2-4")
            return Response()
        f=RangeFile("https://huggingface.co/test",10,b,opener)
        f.seek(2);self.assertEqual(f.read(3),b"abc")
        self.assertEqual(f.tell(),5);self.assertEqual(b.used,3)
        with self.assertRaises(ValueError):f.read(3)
    def test_refuse_full_response_before_body(self):
        for status,header,data in [(200,"",b"abc"),(206,"bytes 0-2/10",b"abc"),(206,"bytes 2-4/10",b"ab")]:
            f=RangeFile("https://huggingface.co/test",10,Budget(10),lambda *a,**k:Response(status,header,data))
            f.seek(2)
            with self.assertRaises(ValueError):f.read(3)
        with self.assertRaises(ValueError):f.read()
        with self.assertRaises(ValueError):f.seek(-1)
class TestProjection(unittest.TestCase):
    def test_missing_values_and_quality_accounting(self):
        cols=["file name","transcript","match quality"]
        def row(id_,text,quality):
            return project_row(dict(zip(cols,[id_,text,quality])),cols)
        self.assertEqual(row("1-2.wav","کتاب","HIGH"),({"id":"1-2.wav","text":"کتاب","quality":"HIGH"},None))
        self.assertEqual(row("1-2.wav",None,"REJECT"),({"id":"1-2.wav","text":"","quality":"REJECT"},None))
        self.assertEqual(row("1-2.wav",None,"HIGH"),(None,"invalid-high-transcript"))
        self.assertEqual(row("1-2.wav","کتاب",None),(None,"invalid-quality"))
        self.assertEqual(row(None,"کتاب","HIGH"),(None,"invalid-id"))
        self.assertEqual(row("../1.wav","کتاب","HIGH"),(None,"invalid-id"))
if __name__=="__main__":unittest.main()
