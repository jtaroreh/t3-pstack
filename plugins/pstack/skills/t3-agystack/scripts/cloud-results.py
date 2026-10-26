"""Fetch only task results.tsv files omitted by the native candidate harvester."""
import argparse
import json
import os
from pathlib import Path
import tempfile


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--gcs-bucket", required=True)
    parser.add_argument("--max-tasks", required=True, type=int)
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    if not args.session_id.startswith("t3-") or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in args.session_id) or not 1 <= args.max_tasks <= 100000:
        raise ValueError("Invalid run context")
    from google.cloud import storage
    bucket = storage.Client().bucket(args.gcs_bucket)
    root = Path(args.destination)
    if root.is_symlink():
        raise ValueError("Unsafe artifact root")
    root.mkdir(parents=True, exist_ok=True)
    delivered = []
    for index in range(args.max_tasks):
        blob = bucket.get_blob(f"swarms/{args.session_id}/task-{index}/results.tsv")
        if blob is None:
            continue
        if blob.size is None or blob.size > 64 * 1024 * 1024:
            raise ValueError("Artifact exceeds download limit")
        directory = root / f"task-{index}"
        if directory.is_symlink():
            raise ValueError("Unsafe task directory")
        directory.mkdir(exist_ok=True)
        fd, temporary = tempfile.mkstemp(prefix=".results-", dir=directory)
        try:
            with os.fdopen(fd, "wb") as output:
                blob.download_to_file(output, if_generation_match=blob.generation)
                output.flush()
                os.fsync(output.fileno())
            os.replace(temporary, directory / "results.tsv")
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        delivered.append({"taskIndex": index, "kind": "results"})
    print(json.dumps(delivered))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Results download failed; no completion should be assumed.", file=__import__("sys").stderr)
        raise SystemExit(1)
