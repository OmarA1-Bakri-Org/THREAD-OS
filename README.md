# ThreadOS

**AI Agent Sequence Orchestrator** — Manage multi-agent workflows with dependency graphs, policy enforcement, and a visual UI.

ThreadOS lets you define sequences of AI agent steps, wire them with dependencies, enforce safety policies, and monitor execution through a horizontal canvas UI.

## Installation

```bash
bun install
```

## Quick Start

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

## Architecture

```
ThreadOS
├── lib/seqctl/        # CLI commands
├── lib/sequence/      # Schema, parser, DAG
├── lib/mprocs/        # Process manager adapter
├── lib/runner/        # Step execution wrapper
├── lib/policy/        # Safety policy engine
├── lib/audit/         # Audit logging
├── lib/chat/          # Chat orchestrator (system prompt, validator)
├── lib/reconciliation/# State reconciliation
├── app/               # Next.js UI + API routes
├── components/        # React components (canvas, inspector, chat)
└── docs/              # Extended documentation
```

### Thread Types

| Type | Name | Description |
|------|------|-------------|
| `base` | Base | Single sequential agent |
| `p` | Parallel | Multiple agents, same task |
| `c` | Chained | Sequential pipeline |
| `f` | Fusion | Candidates + synthesis |
| `b` | Baton | Hand-off between agents |
| `l` | Long-autonomy | Extended autonomous operation |

## CLI Reference

See [docs/cli-reference.md](docs/cli-reference.md) for the complete command reference.

Key commands:
- `seqctl init <name>` — Initialize a sequence
- `seqctl step add|remove|update` — Manage steps
- `seqctl dep add|remove` — Manage dependencies
- `seqctl gate approve|block` — Control gates
- `seqctl run` — Execute the sequence
- `seqctl status` — View current state

## UI

```bash
bun dev
```

Opens the horizontal canvas UI at `http://localhost:3000` with:
- **Sequence Canvas** — Visual DAG of steps and dependencies
- **Step Inspector** — Edit step properties
- **Chat Panel** — AI-assisted sequence management
- **Toolbar** — Run, stop, status controls

## Documentation

- [CLI Reference](docs/cli-reference.md)
- [Thread Types Guide](docs/thread-types.md)
- [Policy Configuration](docs/policy.md)

## Testing

```bash
bun test
```

## License

MIT
