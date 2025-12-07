import os

class MemBaseChain:
    def register(self, agent_id):
        print(f"Registered agent: {agent_id}")

membase_id = os.getenv("MEMBASE_ID", "agent_12345")
membase_account = os.getenv("MEMBASE_ACCOUNT", "0x1234567890abcdef")
membase_secret = os.getenv("MEMBASE_SECRET_KEY", "secret_key_123")
membase_chain = MemBaseChain()
