"""Observe Cloud Run counters without the engine's implicit artifact writes."""
import argparse
import json
import subprocess
import sys
import time

p = argparse.ArgumentParser()
for name in ['execution', 'project', 'region']:
    p.add_argument(f'--{name}', required=True)
p.add_argument('--tasks', required=True, type=int)
a = p.parse_args()
try:
    previous = None
    while True:
        result = subprocess.run(['gcloud', 'run', 'jobs', 'executions', 'describe', a.execution, f'--project={a.project}', f'--region={a.region}', '--format=json', '--quiet'], capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise RuntimeError('Execution observation failed')
        data = json.loads(result.stdout)
        status = data.get('status', data)
        counts = tuple(status.get(name, 0) for name in ['succeededCount', 'runningCount', 'failedCount'])
        valid = all(type(n) is int and n >= 0 for n in counts) and sum(counts) <= a.tasks
        if valid and counts != previous:
            print(f'[Cloud Swarm] Progress: {counts[0]}/{a.tasks} succeeded, {counts[1]} running, {counts[2]} failed.', flush=True)
            previous = counts
        complete = any(c.get('type') == 'Completed' and (str(c.get('status')) in ['True', 'False'] or c.get('state') in ['CONDITION_SUCCEEDED', 'CONDITION_FAILED']) for c in status.get('conditions', []))
        if complete or status.get('completionTime'):
            break
        time.sleep(5)
except Exception:
    print('Cloud observation failed; use status to reconcile the execution.', file=sys.stderr)
    raise SystemExit(1)
