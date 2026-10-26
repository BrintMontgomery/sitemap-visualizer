import json, sys
from xml.dom import minidom
try:
    doc = minidom.parseString(sys.stdin.read())
    def convert(n):
        return {'localName': n.localName or n.tagName, 'namespaceURI': n.namespaceURI,
                'textContent': ''.join(c.data for c in n.childNodes if c.nodeType in (c.TEXT_NODE, c.CDATA_SECTION_NODE)),
                'children': [convert(c) for c in n.childNodes if c.nodeType == c.ELEMENT_NODE]}
    print(json.dumps(convert(doc.documentElement)))
except Exception:
    print('null')
