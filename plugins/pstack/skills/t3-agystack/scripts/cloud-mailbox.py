#!/usr/bin/env python3
import argparse
import contextlib
import io
import json
from pathlib import Path
import re
import sys
import time

p = argparse.ArgumentParser()
p.add_argument('--engine', required=True)
p.add_argument('--verb', choices=['steer', 'questions', 'reply'], required=True)
p.add_argument('--session-id', required=True)
p.add_argument('--gcs-bucket', required=True)
p.add_argument('--max-tasks', type=int, required=True)
p.add_argument('--task')
p.add_argument('--seq', type=int)
p.add_argument('--text')
p.add_argument('--local-dir')
a = p.parse_args()
try:
    sys.path.insert(0, str(Path(a.engine).resolve().parent))
    from storage_messenger import StorageMessenger, MailboxEnvelope, MessageType, MessageStatus
    if a.local_dir:
        messenger = StorageMessenger(bucket_name=a.gcs_bucket, session_id=a.session_id, is_worker=False, local_dir=a.local_dir)
    else:
        from google.cloud import storage
        messenger = StorageMessenger(bucket_name=a.gcs_bucket, session_id=a.session_id, is_worker=False, storage_client=storage.Client())
    prefix = f'swarms/{a.session_id}/tasks/'
    pattern = re.compile(re.escape(prefix) + r'task-(\d+)/outbox/(\d+)_question\.json$')

    def question(blob):
        match = pattern.fullmatch(blob.name)
        if not match or int(match[1]) >= a.max_tasks:
            raise ValueError('question path does not belong to this run')
        if getattr(blob, 'size', 0) and blob.size > 32768:
            raise ValueError('question too large')
        content = blob.download_as_text()
        if len(content) > 32768:
            raise ValueError('question too large')
        item = json.loads(content)
        task, seq = int(match[1]), int(match[2])
        if item.get('session_id') != a.session_id or type(item.get('task_index')) is not int or item['task_index'] != task or type(item.get('seq')) is not int or item['seq'] != seq or seq < 1 or item.get('msg_type') != 'question':
            raise ValueError('question envelope mismatch')
        text = item.get('payload', {}).get('question')
        if not isinstance(text, str) or not text.strip() or len(text) > 8000:
            raise ValueError('invalid question text')
        return {'taskIndex': task, 'seq': seq, 'question': text}

    if a.verb == 'questions':
        result = []
        for count, blob in enumerate(messenger.bucket.list_blobs(prefix=prefix)):
            if count >= 4096:
                raise ValueError('mailbox listing limit reached')
            if not pattern.fullmatch(blob.name):
                continue
            item = question(blob)
            reply = messenger.bucket.blob(f"{prefix}task-{item['taskIndex']}/inbox/{item['seq']:04d}_reply.json")
            if not reply.exists():
                result.append(item)
            if len(result) > 256:
                raise ValueError('too many pending questions')
        result.sort(key=lambda item: (item['taskIndex'], item['seq']))
    else:
        if not a.text or not a.text.strip() or len(a.text) > 8000:
            raise ValueError('message text required, at most 8000 characters')
        tasks = list(range(a.max_tasks)) if a.task == 'all' and a.verb == 'steer' else [int(a.task)]
        if not tasks or any(task < 0 or task >= a.max_tasks for task in tasks):
            raise ValueError('task outside this run')
        result = []
        for task in tasks:
            if a.verb == 'steer':
                with contextlib.redirect_stdout(io.StringIO()):
                    envelope = messenger.send_steer(task, a.text)
                result.append({'taskIndex': task, 'seq': envelope.seq, 'status': 'submitted'})
            else:
                if not a.seq or a.seq < 1:
                    raise ValueError('reply sequence required')
                question(messenger.bucket.blob(f'{prefix}task-{task}/outbox/{a.seq:04d}_question.json'))
                envelope = MailboxEnvelope(session_id=a.session_id, task_index=task, seq=a.seq, msg_type=MessageType.REPLY, sender='orchestrator', recipient=f'worker-{task}', timestamp=time.time(), payload={'reply': a.text, 'text': a.text}, status=MessageStatus.PENDING, reply_to_seq=a.seq)
                blob = messenger.bucket.blob(f'{prefix}task-{task}/inbox/{a.seq:04d}_reply.json')
                blob.upload_from_string(envelope.to_json(), content_type='application/json', if_generation_match=0)
                result.append({'taskIndex': task, 'seq': a.seq, 'status': 'submitted'})
    print(json.dumps(result))
except Exception:
    print('Mailbox operation failed; no successful delivery or empty listing is implied.', file=sys.stderr)
    sys.exit(1)
