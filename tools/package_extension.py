"""확장에 필요한 파일만 ZIP에 포함한다. 서버·시크릿·테스트는 제외한다."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]


def package(output=None):
    output = output or ROOT / '.local' / 'Algosaurus-extension.zip'
    output.parent.mkdir(parents=True, exist_ok=True)
    files = [ROOT / 'manifest.json', ROOT / 'utils.js', ROOT / 'common.css']
    for folder in ['popup', 'options', 'shared']:
        files.extend(p for p in (ROOT / folder).glob('*') if p.suffix in {'.html', '.js', '.css'})
    files.extend(ROOT / 'assets' / f'algoIcon{size}.png' for size in [16, 48, 128])
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for file in sorted(files):
            archive.write(file, file.relative_to(ROOT).as_posix())
    return output


if __name__ == '__main__':
    print(package())
