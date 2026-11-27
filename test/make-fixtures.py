import codecs
import pathlib

simplified = "第一章 测试\n这是一段用于编码检测的中文文本。\nHello world 12345\n"
traditional = "第一章 測試\n這是一段用於編碼檢測的中文文本。\nHello world 12345\n"
base = pathlib.Path(__file__).with_name("fixtures")
base.mkdir(parents=True, exist_ok=True)

fixtures = [
    ("gb18030", "sample-gb18030.txt", None, simplified),
    ("big5", "sample-big5.txt", None, traditional),
    ("utf-8", "sample-utf8.txt", None, simplified),
    ("utf-16-le", "sample-utf16le-bom.txt", codecs.BOM_UTF16_LE, simplified),
    ("utf-16-be", "sample-utf16be-bom.txt", codecs.BOM_UTF16_BE, simplified),
    ("utf-32-le", "sample-utf32le-bom.txt", codecs.BOM_UTF32_LE, simplified),
    ("utf-32-be", "sample-utf32be-bom.txt", codecs.BOM_UTF32_BE, simplified),
]

for encoding, name, bom, text in fixtures:
    data = text.encode(encoding)
    if bom is not None:
        data = bom + data
    (base / name).write_bytes(data)
    print(name, len(data))

# A minimal, valid EPUB 3 fixture used by the EPUB reader tests.
import zipfile

epub_path = base / "sample.epub"
container = """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""
opf = """<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>EPUB 测试书</dc:title>
    <dc:identifier id="bookid">urn:uuid:test</dc:identifier>
    <dc:language>zh-CN</dc:language>
  </metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>
"""
ch1 = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第一章</title></head>
<body><h1>第一章 起点</h1><p>这是 EPUB 第一章的正文。</p><p>第二段包含 <strong>加粗</strong> 与 &amp; 符号。</p></body></html>
"""
ch2 = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>第二章</title></head>
<body><h1>第二章 继续</h1><p>这是 EPUB 第二章的正文，用于跨章节搜索测试。</p></body></html>
"""
nav = """<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body><nav><ol><li><a href="ch1.xhtml">第一章</a></li></ol></nav></body></html>
"""
with zipfile.ZipFile(epub_path, "w") as archive:
    archive.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
    archive.writestr("META-INF/container.xml", container, compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr("OEBPS/content.opf", opf, compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr("OEBPS/ch1.xhtml", ch1, compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr("OEBPS/ch2.xhtml", ch2, compress_type=zipfile.ZIP_DEFLATED)
    archive.writestr("OEBPS/nav.xhtml", nav, compress_type=zipfile.ZIP_DEFLATED)
print("sample.epub", epub_path.stat().st_size)

