
class Message:
    def __init__(self, agent_id, content, role="user"):
        self.agent_id = agent_id
        self.content = content
        self.role = role
