"""Fetch only task results.tsv files omitted by the native candidate harvester."""
import argparse
import json
import os
import re
from pathlib import Path
import tempfile


class ArtifactInputError(Exception):
    pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--gcs-bucket", required=True)
    parser.add_argument("--max-tasks", required=True, type=int)
    parser.add_argument("--destination", required=True)
    args = parser.parse_args()
    if not args.session_id.startswith("t3-") or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in args.session_id) or not 1 <= args.max_tasks <= 1000000:
        raise ArtifactInputError("Invalid run context")
    from google.cloud import storage
    bucket = storage.Client().bucket(args.gcs_bucket)
    root = Path(args.destination)
    if root.is_symlink():
        raise ArtifactInputError("Unsafe artifact root")
    root.mkdir(parents=True, exist_ok=True)
    delivered = []
    prefix = f"swarms/{args.session_id}/task-"
    pattern = re.compile(re.escape(prefix) + r"(0|[1-9][0-9]*)/results\.tsv$")
    for count, blob in enumerate(bucket.list_blobs(prefix=prefix)):
        if count >= 1000000:
            raise ArtifactInputError("Artifact listing limit reached")
        match = pattern.fullmatch(blob.name)
        if not match:
            continue
        index = int(match[1])
        if index >= args.max_tasks:
            raise ArtifactInputError("Artifact task is outside this run")
        if blob.size is None or blob.size > 64 * 1024 * 1024:
            raise ArtifactInputError("Artifact exceeds download limit")
        directory = root / f"task-{index}"
        if directory.is_symlink():
            raise ArtifactInputError("Unsafe task directory")
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
    except ArtifactInputError as error:
        print(f"RESULTS_INPUT: {error}", file=__import__("sys").stderr)
        raise SystemExit(1)
    except Exception as error:
        category = type(error).__name__ if type(error).__name__ in {'Forbidden', 'Unauthorized', 'NotFound', 'PreconditionFailed', 'TooManyRequests', 'ServiceUnavailable', 'TimeoutError', 'ConnectionError'} else 'RemoteError'
        print(f"RESULTS_{category}: Results download failed; no completion should be assumed.", file=__import__("sys").stderr)
        raise SystemExit(1)
