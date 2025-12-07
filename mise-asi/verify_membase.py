
try:
    import sys
    import os
    # Add current directory to path if needed
    sys.path.append(os.getcwd())
    
    # Mock supabase and dotenv
    from unittest.mock import MagicMock
    sys.modules["supabase"] = MagicMock()
    sys.modules["dotenv"] = MagicMock()
    
    # Load env vars manually for verification since we mocked dotenv
    import os
    os.environ["MEMBASE_ID"] = "agent_12345"
    
    from membase.chain.chain import membase_id, membase_account
    print(f"✅ Successfully imported membase_id: {membase_id}")
    print(f"✅ Successfully imported membase_account: {membase_account}")
    
    from registry.tools import get_tool_by_name
    from handlers import FUNCTION_HANDLERS
    
    tools = ["saveMemory", "retrieveMemory", "searchKnowledgeBase"]
    for t in tools:
        if get_tool_by_name(t):
            print(f"✅ Tool {t} registered")
        else:
            print(f"❌ Tool {t} NOT registered")
            
    print("\nChecking handlers...")
    for t in tools:
        if t in FUNCTION_HANDLERS:
            print(f"✅ Handler for {t} registered")
        else:
            print(f"❌ Handler for {t} NOT registered")
            
except Exception as e:
    print(f"❌ Verification failed: {e}")
