import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from tools.package_extension import package


class PackagingTests(unittest.TestCase):
    def test_extension_archive_excludes_server_and_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            output = package(Path(directory) / 'extension.zip')
            with ZipFile(output) as archive:
                names = archive.namelist()
                self.assertIn('manifest.json', names)
                self.assertIn('shared/api.js', names)
                self.assertIn('shared/presentation.js', names)
                self.assertTrue(all(f'assets/tiers/{tier}.svg' in names for tier in range(32)))
                self.assertFalse(any(name.startswith(('server/', 'tests/', '.env', '.local/')) for name in names))
                self.assertFalse(any(b'x-client-secret' in archive.read(name) for name in names))
