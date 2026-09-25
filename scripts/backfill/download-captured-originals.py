"""Download only NCAR original URLs already captured from the visible document UI.
Resumes by a verified SHA-256, never re-downloads a complete verified file.
No production access. Usage: python download-captured-originals.py CAPTURE_DIRECTORY
"""
import hashlib
import fcntl
import json
import pathlib
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

root = pathlib.Path(sys.argv[1])
lock = (root / '.download.lock').open('w')
try:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
except BlockingIOError:
    raise SystemExit('Another download is active; resume after it finishes.')
logfile = root / 'pdf-downloads.json'
results = json.loads(logfile.read_text()) if logfile.exists() else {}
for f in sorted(root.glob('*.json')):
    if not f.stem.isdigit(): continue
    d = json.loads(f.read_text())
    for url in d.get('originalUrls', []):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != 'https' or parsed.hostname != 'ncar.gov.sa' or not parsed.path.endswith('/Documents/OriginalAttachPath'):
            continue
        target = root / f'{f.stem}-original.pdf'
        prev = results.get(f.stem, {})
        if target.exists() and prev.get('sha256') == hashlib.sha256(target.read_bytes()).hexdigest(): continue
        entry = {'catalogIndex': d['catalogIndex'], 'sourceUrl': d['url'], 'originalUrl': url,
                 'file': target.name, 'fetchedAt': datetime.now(timezone.utc).isoformat()}
        try:
            with urllib.request.urlopen(url, timeout=25) as response:
                final = urllib.parse.urlsplit(response.url)
                if final.scheme != 'https' or final.hostname != 'ncar.gov.sa':
                    raise ValueError('Unexpected redirect destination')
                data = response.read(80 * 1024 * 1024 + 1)
            if len(data) > 80 * 1024 * 1024 or not data.startswith(b'%PDF-'): raise ValueError('Not a bounded PDF')
            target.write_bytes(data)
            entry.update(status='DOWNLOADED', bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
        except Exception as exc:
            entry.update(status='FAILED', error=str(exc)[:300])
        results[f.stem] = entry
        logfile.write_text(json.dumps(results, ensure_ascii=False, indent=2))
        print(json.dumps({'index': f.stem, 'status':entry['status']},ensure_ascii=False),flush=True)
