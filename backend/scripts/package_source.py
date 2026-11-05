"""Create a clean, two-folder source archive; exclude all secrets/runtime state."""
from pathlib import Path
import shutil
import zipfile

root = Path(__file__).resolve().parents[2]
excluded = {'.venv', 'node_modules', 'dist', '.git', '__pycache__', '.pytest_cache', 'tmp', 'output', '.openai'}
files = [(root / name, Path(name)) for name in ('README.md', '.gitignore', '.gitattributes') if (root / name).is_file()]
for folder in ('frontend', 'backend'):
    for path in (root / folder).rglob('*'):
        relative = path.relative_to(root)
        if any(p in excluded for p in relative.parts) or not path.is_file():
            continue
        if path.name == '.env' or path.suffix in ('.db','.pyc','.zip','.tsbuildinfo') or '.db-' in path.name:
            continue
        files.append((path, relative))
destination = root / 'backend/output/brandguard-ai-source.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
    for path, relative in files:
        archive.write(path, relative.as_posix())
print(f'Packaged {len(files)} source files: {destination}')
# Static judge/demo downloads include the same full source, without deployment identity.
shutil.copyfile(destination, root / 'frontend/public/brandguard-ai-source.zip')
