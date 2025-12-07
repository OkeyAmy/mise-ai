"""
MemBase tool schemas
"""

save_memory_tool = {
    "name": "saveMemory",
    "description": "Stores a new memory or fact into the long-term vector database.",
    "input_schema": {
        "type": "object",
        "properties": {
            "content": {
                "type": "string",
                "description": "The content of the memory to save."
            }
        },
        "required": ["content"]
    }
}

retrieve_memory_tool = {
    "name": "retrieveMemory",
    "description": "Retrieves relevant memories based on a query.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query to search for relevant memories."
            }
        },
        "required": ["query"]
    }
}

search_knowledge_base_tool = {
    "name": "searchKnowledgeBase",
    "description": "Searches the global knowledge base for information.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query to search the knowledge base."
            }
        },
        "required": ["query"]
    }
}
