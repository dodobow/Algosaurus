import os
from pathlib import Path


def load_env(path='.env'):
    file = Path(path)
    if not file.is_file():
        return
    allowed = {'SOLVED_CLIENT_ID', 'SOLVED_CLIENT_SECRET', 'PORT', 'ALLOWED_EXTENSION_IDS'}
    for line in file.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, separator, value = line.partition('=')
        if separator and key.strip() in allowed:
            os.environ.setdefault(key.strip(), value.strip().strip('\"\''))
