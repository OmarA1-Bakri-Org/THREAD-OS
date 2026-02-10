# ThreadOS

**AI Agent Sequence Orchestrator** — Define multi-agent workflows as DAGs, enforce safety policies, and orchestrate execution through a visual canvas UI and CLI.

ThreadOS lets you define sequences of AI agent steps, wire them with dependencies, enforce safety policies (SAFE/POWER modes), and monitor execution through a horizontal canvas UI or the `seqctl` CLI.

## Tech Stack

- **Framework:** Next.js 16, React 19
- **Graph Visualization:** @xyflow/react, dagre
- **State Management:** Zustand, TanStack React Query
- **Styling:** Tailwind CSS 4, shadcn/ui, lucide-react
- **Validation:** Zod 4
- **Process Management:** mprocs (external)
- **CLI Runtime:** Bun

## Installation

```bash
# Using npm
npm install

# Or using bun
bun install
```

## Quick Start

### CLI

```bash
# Initialize a new sequence
bunx seqctl init my-project

# Add steps
bunx seqctl step add --id research --name "Research" --type base --model claude-code --prompt prompts/research.md
bunx seqctl step add --id implement --name "Implement" --type base --model claude-code --prompt prompts/implement.md

# Add dependencies
bunx seqctl dep add --from implement --to research

# Run the sequence
bunx seqctl run

# Check status
bunx seqctl status
```

### Web UI

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

Opens the horizontal canvas UI at `http://localhost:3000` with:
- **Sequence Canvas** — Visual DAG of steps and dependencies
- **Step Inspector** — Edit step properties and metadata
- **Chat Panel** — AI-assisted sequence management (SSE streaming)
- **Toolbar** — Run, stop, and status controls

## Deployment (Railway)

The app is configured for Railway out of the box.

**What's set up:**
- `output: 'standalone'` in `next.config.ts` for optimized container builds
- Start script binds to `0.0.0.0` on the Railway-provided `PORT`
- `instrumentation.ts` auto-creates the `.threados/` directory on server startup

**Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port (set automatically by Railway) |
| `THREADOS_BASE_PATH` | No | `process.cwd()` | Base path for `.threados/` directory |
| `ANTHROPIC_API_KEY` | No | — | Enables AI chat features |
| `THREADOS_MPROCS_PATH` | No | `mprocs` | Path to mprocs binary (local execution only) |
| `NODE_ENV` | No | — | Set to `production` for production error handling |

**Deploy steps:**
1. Connect your repo to Railway
2. Railway auto-detects the Next.js app and runs `npm run build` then `npm run start`
3. Optionally set `ANTHROPIC_API_KEY` in Railway variables to enable the chat panel

## API Routes

All routes are under `/api/` and return JSON.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/sequence` | GET | Fetch the full sequence definition |
| `/api/step` | POST | Add, edit, remove, or clone steps |
| `/api/dep` | POST | Add or remove step dependencies |
| `/api/gate` | GET, POST | List gates; insert, approve, or block gates |
| `/api/group` | GET, POST | List groups; parallelize steps into groups |
| `/api/fusion` | POST | Create fusion patterns (candidates + synthesis) |
| `/api/run` | POST | Execute a step, group, or all runnable steps |
| `/api/stop` | POST | Stop a running step |
| `/api/restart` | POST | Restart a failed/stopped step |
| `/api/status` | GET | Step counts by state |
| `/api/audit` | GET | Paginated audit log entries |
| `/api/chat` | POST | SSE stream for AI chat interactions |
| `/api/apply` | POST | Validate and apply proposed actions to the sequence |

## CLI Reference

See [docs/cli-reference.md](docs/cli-reference.md) for the complete command reference.

| Command | Subcommands | Description |
|---------|-------------|-------------|
| `seqctl init` | — | Initialize `.threados/` directory |
| `seqctl step` | add, edit, rm, clone | Manage steps |
| `seqctl dep` | add, rm | Manage dependencies |
| `seqctl gate` | insert, approve, block, list | Manage approval gates |
| `seqctl group` | parallelize, list | Group steps for parallel execution |
| `seqctl fusion` | create | Create fusion patterns |
| `seqctl run` | step, runnable, group | Execute steps |
| `seqctl status` | — | View sequence state (supports `--watch`) |
| `seqctl control` | stop, restart | Control running processes |
| `seqctl template` | apply | Apply predefined thread templates |
| `seqctl mprocs` | open, select | Launch mprocs UI |

## Thread Types

| Type | Name | Description |
|------|------|-------------|
| `base` | Base | Single sequential agent |
| `p` | Parallel | Multiple agents, same task |
| `c` | Chained | Sequential pipeline |
| `f` | Fusion | Candidates + synthesis |
| `b` | Baton | Hand-off between agents |
| `l` | Long-autonomy | Extended autonomous operation |

## Architecture

```
ThreadOS
├── app/                  # Next.js pages + 13 API routes
├── components/
│   ├── canvas/           # SequenceCanvas, StepNode, GateNode, DependencyEdge
│   ├── inspector/        # StepInspector, StepForm, StepActions
│   ├── chat/             # ChatPanel, ChatInput, MessageBubble, ActionCard, DiffPreview
│   ├── toolbar/          # Toolbar (run, stop, status)
│   └── ui/               # shadcn/ui primitives (button, card, input, etc.)
├── lib/
│   ├── seqctl/           # CLI commands (11 command groups)
│   ├── sequence/         # Zod schema, YAML parser, DAG validation
│   ├── mprocs/           # mprocs adapter (client, config, state mapping)
│   ├── runner/           # Step execution wrapper, artifact collection
│   ├── policy/           # Safety policy engine (SAFE/POWER modes)
│   ├── audit/            # Append-only JSONL audit logging
│   ├── chat/             # Chat validator, system prompt builder
│   ├── templates/        # Thread type templates (base/p/c/f/b/l)
│   ├── reconciliation/   # State reconciliation for crashed processes
│   ├── prompts/          # Prompt file manager
│   ├── fs/               # Atomic file writes
│   └── ui/               # Zustand store, providers
├── test/                 # Unit + integration tests (Bun test runner)
├── docs/                 # CLI reference, thread types, policy guide
└── instrumentation.ts    # Server startup (.threados/ initialization)
```

## Testing

```bash
bun test
```

Tests cover API routes, audit logging, action validation, chat flow, CLI lifecycle, policy enforcement, and thread type patterns.

## CI

GitHub Actions runs on every push and PR:
- `bun install` + `bun test`
- `tsc --noEmit` (TypeScript type checking)

## Documentation

- [CLI Reference](docs/cli-reference.md)
- [Thread Types Guide](docs/thread-types.md)
- [Policy Configuration](docs/policy.md)

## License

MIT
