import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {'src', 'href'} and value and not value.startswith(('https:', 'http:', '#')):
                self.refs.append(value)


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    for reference in [manifest['action']['default_popup'], manifest['options_ui']['page'], *manifest['icons'].values()]:
        assert (ROOT / reference).is_file(), reference
    for folder in ['popup', 'options']:
        for file in (ROOT / folder).glob('*.html'):
            parser = References()
            parser.feed(file.read_text(encoding='utf-8'))
            for reference in parser.refs:
                assert (file.parent / reference).is_file(), (file, reference)
    scripts = [ROOT / 'utils.js', *(ROOT / 'shared').glob('*.js'), *(ROOT / 'popup').glob('*.js'), *(ROOT / 'options').glob('*.js')]
    for script in scripts:
        text = script.read_text(encoding='utf-8')
        assert not any(word in text for word in ['/api/v3', 'cors.eu.org', 'html2canvas', 'x-client-secret']), script
        for module in re.findall(r"from ['\"]([^'\"]+)['\"]", text):
            assert (script.parent / module).is_file(), (script, module)
        subprocess.run(['node', '--check', str(script)], check=True)
    assert not any((ROOT / file).exists() for file in ['index.html', 'script.js', 'style.css'])
    print('PASS: manifest/HTML/import references, JS syntax, archive/v3/secret removal')


if __name__ == '__main__':
    main()
