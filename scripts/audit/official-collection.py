"""Offline, read-only audit. Never changes source files or connects to production.
Usage: python scripts/audit/official-collection.py COLLECTION OUTPUT BM25_GZIP
"""
import collections
import gzip
import hashlib
import json
import pathlib
import re
import sys

source, output, index_file = map(pathlib.Path, sys.argv[1:4])
output.mkdir(parents=True, exist_ok=True)
def read(path):
    return json.loads(path.read_text())
def sha(data):
    return hashlib.sha256(data).hexdigest()
def write(name, data):
    (output / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
def norm(text):
    # Comparison-only: old snippets omit numbered paragraph markers.
    text = re.sub(r'(?m)^\s*[0-9٠-٩۰-۹]+\s*[-–.)]\s*', '', text)
    text = re.sub(r'[\u0640\u064b-\u065f\u0670\u200b-\u200f\ufeff]', '', text)
    text = text.translate(str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹أإآى', '01234567890123456789اااي'))
    return re.sub(r'[^\w]', '', text)
def identity(record):
    parts = [record.get('title', '')]
    for label in ['أداة الاعتماد', 'رقم الوثيقة', 'تاريخ الاعتماد']:
        match = next((m for m in record.get('metadata', []) if label in m), '')
        parts.append(match.split(':')[-1].strip(' "'))
    return '|'.join(norm(v) for v in parts)

checksums = read(source / 'checksums.json')
bad = [name for name, digest in checksums.items()
       if not (source / name).is_file() or sha((source / name).read_bytes()) != digest]
manifest = read(source / 'core-documents/manifest.json')
catalog = read(source / 'catalog.json')['documents']
collected = []
for record in manifest:
    pdf = source / 'core-documents' / f"{record['index']}-original.pdf"
    text = source / 'core-documents' / (record.get('textFile') or '__none__')
    collected.append({**record, 'pdfSaved': pdf.is_file(), 'textSavedVerified': text.is_file(),
        'pdfSha256': sha(pdf.read_bytes()) if pdf.is_file() else None,
        'textSha256': sha(text.read_bytes()) if text.is_file() else None})
special_urls = {
    read(source / 'madani-page-provenance.json')['url'],
    read(source / 'madani-supplement-provenance.json')['url'],
}
url_set = {r['url'] for r in collected} | special_urls
identities = {identity(r) for r in collected}
special_descriptors = {
    ('نظام المعاملات المدنية لعام 1444هـ', 'م/191'),
    ('عدم إكساب الشركات الواردة في نظام المعاملات المدنية الشخصية الاعتبارية', '68845'),
}
for record in catalog:
    if any(record['title'] == title and any(norm(m.split(':')[-1]) == norm(number)
           for m in record.get('metadata', []) if 'رقم الوثيقة' in m)
           for title, number in special_descriptors):
        identities.add(identity(record))
queue = []
for i, r in enumerate(catalog):
    if r['url'] in url_set or identity(r) in identities:
        continue
    queue.append({**r, 'catalogIndex': i, 'identityKey': identity(r), 'state': 'PENDING',
                  'productionMatch': 'NOT_CHECKED'})
groups = collections.defaultdict(list)
for i, r in enumerate(catalog): groups[identity(r)].append(i)
duplicate_groups = [v for v in groups.values() if len(v) > 1]

bundle_results = []
for f in source.rglob('*staging.json'):
    b = read(f)
    errors = []
    intro = b['introduction']
    if sha(intro['rawText'].encode()) != intro['contentSha256']: errors.append('INTRO_HASH')
    for d in b['documents']:
        if sha(d['rawText'].encode()) != d['contentSha256']: errors.append('DOC_HASH')
        if ''.join(u['textRaw'] for u in d['units']) != d['rawText']: errors.append('RECONSTRUCTION')
    for a in b['articles']:
        if sha(a['rawText'].encode()) != a['contentSha256']: errors.append('ARTICLE_HASH')
    nums = [a['article_number'] for a in b['articles']]
    bundle_results.append({'file':str(f.relative_to(source)), 'name':b['systemName'],
        'status':b['status'], 'articles':len(nums), 'duplicateNumbers':len(nums)-len(set(nums)),
        'integrityErrors':errors, 'issues':b['issues'], 'legalReview':'NOT_COMPLETED'})

civil = read(source / 'madani-validated-staging.json')
official = [(a['article_number'], norm(a['content'])) for a in civil['articles']]
bm25 = json.loads(gzip.decompress(index_file.read_bytes()))
old = [r for r in bm25['meta'].values() if r['law_name'] == 'نظام المعاملات المدنية']
comparison = []
for r in old:
    snippet = norm(r['snippet'])
    matches = [n for n, text in official if snippet and text.startswith(snippet)]
    match = ('same' if matches == [r['article_number']] else
             'shift+1' if matches == [r['article_number']+1] else 'review')
    comparison.append({'oldNumber':r['article_number'], 'matches':matches, 'status':match,
                       'snippet':r['snippet']})
summary = {'checksumEntries':len(checksums), 'checksumMismatches':bad,
    'catalogRecords':len(catalog), 'uniqueUrls':len({r['url'] for r in catalog}),
    'identityCollisionGroups':duplicate_groups,
    'verifiedManifestContentRecords':sum(r['pdfSaved'] or r['textSavedVerified'] for r in collected),
    'specialContentRecords':2, 'pdfFiles':len(list(source.rglob('*.pdf'))),
    'savedTextFiles':sum(r['textSavedVerified'] for r in collected)+2,
    'bundleStatuses':dict(collections.Counter(r['status'] for r in bundle_results)),
    'bundleIntegrityErrors':sum(bool(r['integrityErrors']) for r in bundle_results),
    'bm25Records':len(bm25['meta']), 'bm25LawNames':len({r['law_name'] for r in bm25['meta'].values()}),
    'bm25Sha256':sha(index_file.read_bytes()), 'civilIndexRecords':len(old),
    'civilComparison':dict(collections.Counter(r['status'] for r in comparison)),
    'pendingCatalogRecords':len(queue), 'productionRead':False, 'productionWrites':0,
    'matchingCaveat':'Identity collisions are review candidates; no records are merged or deleted.'}
write('restored-inventory.json',collected)
write('pending-catalog.json',queue)
write('bundle-integrity.json',bundle_results)
write('production-deployment-bm25-comparison.json',comparison)
write('summary.json',summary)
print(json.dumps(summary,ensure_ascii=False,indent=2))
