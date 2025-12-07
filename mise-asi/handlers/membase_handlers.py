"""
MemBase Handlers
Handles interaction with the MemBase long-term memory system.
"""
from handlers.types import FunctionCall, HandlerContext
from membase.chain.chain import membase_id, membase_account
from membase.memory.message import Message
from membase.knowledge.chroma import ChromaKnowledgeBase
from membase.knowledge.document import Document

# Initialize knowledge base
kb = ChromaKnowledgeBase(membase_account=membase_account)

def handle_membase_functions(function_call: FunctionCall, ctx: HandlerContext) -> str:
    """
    Handle MemBase function calls
    """
    name = function_call["name"]
    args = function_call.get("args", {})
    
    if name == "saveMemory":
        return handle_save_memory(args, ctx)
    elif name == "retrieveMemory":
        return handle_retrieve_memory(args, ctx)
    elif name == "searchKnowledgeBase":
        return handle_search_knowledge_base(args, ctx)
    
    return f"Unknown MemBase function: {name}"


def handle_save_memory(args: dict, ctx: HandlerContext) -> str:
    """Save a memory to MemBase"""
    content = args.get("content")
    if not content:
        return "No content provided to save."
    
    # Create a document and add to knowledge base
    doc = Document(content=content, metadata={"user_id": ctx.user_id, "source": "user_interaction"})
    kb.add(doc)
    
    ctx.log_step(f"✅ Saved memory to MemBase: {content[:50]}...")
    return "Memory saved successfully to MemBase."


def handle_retrieve_memory(args: dict, ctx: HandlerContext) -> str:
    """Retrieve memories from MemBase"""
    query = args.get("query")
    if not query:
        return "No query provided for retrieval."
    
    # Simulate retrieval
    results = kb.query(query)
    
    ctx.log_step(f"✅ Retrieved memories for: {query}")
    if results:
        return f"Found relevant memories: {'; '.join(results)}"
    return "No relevant memories found."


def handle_search_knowledge_base(args: dict, ctx: HandlerContext) -> str:
    """Search the global knowledge base"""
    query = args.get("query")
    if not query:
        return "No query provided for search."
    
    # Simulate search
    results = kb.query(query)
    
    ctx.log_step(f"✅ Searched knowledge base for: {query}")
    return f"Knowledge base search results: {'; '.join(results)}"
