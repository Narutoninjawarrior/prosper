from pathlib import Path
import subprocess
import sys

BASE_DIR = Path(__file__).resolve().parent
SCRIPTS = [
    'init_db.py',
    'seed_sample_data.py',
    'query_recent_decisions.py',
    'export_work_card_json.py',
]


def main() -> None:
    for script_name in SCRIPTS:
        script_path = BASE_DIR / script_name
        print(f'\n=== Running {script_path.name} ===')
        subprocess.run([sys.executable, str(script_path)], check=True)


if __name__ == '__main__':
    main()
