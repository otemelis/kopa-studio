"""Offline publication failure regression; never calls Apple."""
import importlib.util,json,tempfile,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('refresh',R/'scripts/app-store/refresh.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as td:
 root=Path(td);m.PAGE=root/'page';m.PAGE.mkdir();run=root/'run';run.mkdir()
 good=b'{"previous_validated_snapshot":true}';(m.PAGE/'current.json').write_bytes(good)
 (run/'daily-acquisition-monetization.csv').write_bytes(b'corrupted')
 (run/'daily-independent-validation.json').write_text(json.dumps({'dataset_sha256':'0'*64,'weekly_equals_daily':True}))
 m.write_attempt('2026-10-15T14:00:00Z','running')
 try:m.publish(run,'2026-09-14','2026-10-11')
 except ValueError:m.write_attempt('2026-10-15T14:00:00Z','failed','Verification rejected staged CSV')
 else:raise AssertionError('Corrupted staged CSV published')
 assert (m.PAGE/'current.json').read_bytes()==good
 a=json.loads((m.PAGE/'refresh-status.json').read_text());assert a['status']=='failed' and a['last_attempt_utc']=='2026-10-15T14:00:00Z'
print('PASS: corrupted publication rejected, last-good manifest unchanged, failed attempt recorded')
