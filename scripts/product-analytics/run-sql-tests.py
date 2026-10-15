from pathlib import Path
import tempfile,subprocess,os,shutil
b=Path('/opt/homebrew/opt/postgresql@16/bin');root=Path(tempfile.mkdtemp(prefix='kopa-sql-test-',dir='/private/tmp'));pg=root/'db'
try:
 subprocess.run([b/'initdb','-D',pg,'-A','trust','--no-locale'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run([b/'pg_ctl','-D',pg,'-l',root/'log','-o',f"-k {root} -h '' -p 54338",'-w','start'],check=True,stdout=subprocess.DEVNULL)
 subprocess.run(['node',str(Path(__file__).with_name('sql.test.mjs'))],env={**os.environ,'KOPA_TEST_SOCKET':str(root)},check=True)
finally:
 if (pg/'postmaster.pid').exists():subprocess.run([b/'pg_ctl','-D',pg,'-m','fast','-w','stop'],check=True,stdout=subprocess.DEVNULL)
 shutil.rmtree(root)
