# Mise AI - Personalized Nutrition Assistant

> Mise (pronounced "meez") is the kitchen term for "everything in its place" - this app keeps your meals, pantry, and shopping just as organized.

A smart, AI-assisted meal planner that learns your preferences, understands what is in your kitchen, suggests meals that minimize waste, and keeps leftovers and shopping lists in sync. The project now includes a dedicated ASI orchestration service (`mise-asi/`) so the heavy AI/tool-calling logic runs server-side.

![Mise AI](public/image.png)

You can try the Mise AI agent on Agentverse  
<https://agentverse.ai/agents/details/agent1qt354vjymslddeu26y2zgtxjm27cpv3035xwmlyll7nyf38ez68s5w3w687/profile>

## Highlights

- Personalized meal suggestions that respect dietary preferences, allergies, and nutrition goals.
- Pantry and shopping list management backed by Supabase (inventory, leftovers, preferences, notes).
- Parallel tool execution for faster responses and richer context gathering.
- Leftover tracking with portion adjustments to cut food waste.
- Server-side orchestration layer (`mise-asi`) that mirrors the frontend toolset and exposes a simple HTTP API.

## What's in `mise-asi`

`mise-asi/` is a Python/Flask service that replaces the old Supabase edge proxy. It:

- Exposes `/health`, `/chat`, and `/tools` endpoints for the React app (`src/hooks/chat/asiProxy.ts`).
- Runs an orchestrator that calls an OpenAI-compatible ASI Cloud model with the full tool registry.
- Dispatches function calls to domain handlers (inventory, shopping list, meals, preferences, leftovers, notes, Amazon search placeholder).
- Persists and reads data from Supabase tables (`user_inventory`, `shopping_lists`, `user_preferences`, `user_leftovers`).

### Architecture (high level)

```
React + Vite UI (chat, pantry, leftovers)
   |
   | HTTP (VITE_ASI_ENDPOINT)
   v
Flask adapter (/chat, /tools, /health)
   |
   v
Orchestrator (OpenAI client -> ASI Cloud)
   |
   |-- Tool registry (OpenAI function schemas)
   `-- Handlers (inventory, shopping list, preferences, leftovers, meals, notes, Amazon)
           |
           v
     Supabase Postgres
```

### Key backend files

- `mise-asi/main.py` - entrypoint that validates env vars and boots Flask.
- `mise-asi/adapters/flask_app.py` - HTTP adapter, CORS, routes.
- `mise-asi/orchestration/orchestrator.py` - chat loop, OpenAI-compatible calls, tool execution.
- `mise-asi/registry/` - tool definitions grouped by domain.
- `mise-asi/handlers/` - executes tool calls and formats responses.
- `mise-asi/utils/supabase_client.py` - Supabase client and CRUD helpers.
- `mise-asi/config/settings.py` - environment-driven settings.

## Project structure

```
.
|-- src/                      # React app (chat, UI, hooks)
|   `-- hooks/chat/asiProxy.ts # Frontend -> mise-asi bridge
|-- supabase/                 # Supabase config, migrations, edge function legacy
|-- public/                   # Static assets (screenshot)
|-- mise-asi/                 # ASI orchestration service (Python/Flask)
|   |-- adapters/             # HTTP adapter
|   |-- orchestration/        # Orchestrator and types
|   |-- registry/             # Tool schemas
|   |-- handlers/             # Domain handlers
|   |-- utils/                # Supabase + logging helpers
|   `-- config/               # Settings and env validation
`-- package.json, vite.config.ts, etc.
```

## Prerequisites

- Node.js 18+
- Python 3.10+ (for `mise-asi`)
- Supabase project (tables: `user_inventory`, `shopping_lists`, `user_preferences`, `user_leftovers`)
- ASI Cloud/OpenAI-compatible API key

## Running the frontend

1. Install deps: `npm install`
2. Configure `.env.local` (defaults to localhost if omitted):

   ```env
   VITE_ASI_ENDPOINT=http://localhost:8001
   ```

3. Start Vite dev server: `npm run dev`
4. Open `http://localhost:5173`

## Running `mise-asi` locally

1. `cd mise-asi`
2. (Optional) Create a venv: `python -m venv .venv && .venv\Scripts\activate`
3. Install deps: `pip install -r requirements.txt`
4. Create `.env` (see `.env.example`):

   ```env
   PORT=8001
   FLASK_ENV=development
   SUPABASE_URL=your_supabase_url
   SUPABASE_KEY=your_supabase_service_key
   ASICLOUD_API_KEY=your_asi_cloud_key
   ASICLOUD_BASE_URL=https://inference.asicloud.cudos.org/v1
   MODEL_NAME=openai/gpt-oss-20b
   AGENT_SEED=mise-asi-agent-seed-phrase
   ```

5. Start the server: `python main.py`
6. Check health: `curl http://localhost:8001/health`

## Supabase setup (optional local dev)

If you want to run Supabase locally instead of the hosted project:

```bash
npx supabase init
npx supabase db push     # apply migrations in supabase/migrations
```

Ensure the tables mentioned above exist; the handlers expect them.

## Tool coverage (server-side)

- Utility: current time.
- Inventory: get, create/update/delete items, categorize and format inventory for the model.
- Shopping list: view/add/remove items, UI "open" command.
- Preferences: read/update/create dietary preferences and goals.
- Leftovers: manage servings, add/remove/update leftovers, UI "open" command.
- Meals: format model-generated meal suggestions and update meal plans.
- Notes: store freeform user notes.
- Amazon search: placeholder responses; wire up RapidAPI + keys to enable real calls.

## Deployment notes

- Point `VITE_ASI_ENDPOINT` to the deployed `mise-asi` host.
- `mise-asi` can be served with gunicorn: `gunicorn -w 4 -b 0.0.0.0:8001 main:app`.
- Keep Supabase service keys server-side; the frontend only calls the orchestrator.

---

Built to help keep every meal, ingredient, and leftover in its place. Enjoy!
