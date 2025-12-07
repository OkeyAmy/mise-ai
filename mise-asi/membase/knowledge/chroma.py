
class ChromaKnowledgeBase:
    def __init__(self, membase_account=None):
        self.membase_account = membase_account
        self.documents = []

    def add(self, document):
        self.documents.append(document)

    def query(self, query_text):
        return ["Simulated result for: " + query_text]
