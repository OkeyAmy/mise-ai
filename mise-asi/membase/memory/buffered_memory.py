
class BufferedMemory:
    def __init__(self, membase_account=None, auto_upload_to_hub=True):
        self.membase_account = membase_account
        self.auto_upload_to_hub = auto_upload_to_hub
        self.memories = []

    def add(self, message):
        self.memories.append(message)
