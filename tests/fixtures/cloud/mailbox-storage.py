import json
import os


class Blob:
    def __init__(self, item):
        self.name = item['name']
        self.content = item.get('content', {})
        self.size = len(json.dumps(self.content))

    def download_as_text(self):
        return json.dumps(self.content)

    def exists(self):
        return False


class Bucket:
    def list_blobs(self, *, prefix, start_offset, max_results):
        assert max_results == 4096
        with open(os.environ['LIST_LOG'], 'a') as output:
            output.write(json.dumps({'prefix': prefix, 'start_offset': start_offset, 'max_results': max_results}) + '\n')
        with open(os.environ['MAILBOX_OBJECTS']) as source:
            items = json.load(source)
        return [Blob(item) for item in sorted(items, key=lambda item: item['name'])
                if item['name'].startswith(prefix) and item['name'] >= start_offset][:max_results]

    def blob(self, name):
        return Blob({'name': name})


class Client:
    def bucket(self, name):
        assert name == 'test-bucket'
        return Bucket()
