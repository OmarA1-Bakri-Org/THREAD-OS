# ThreadOS — Claude Code Integration

## Project Overview

ThreadOS is a local-first thread runtime for orchestrating multi-agent engineering workloads. You (Claude Code) are the primary orchestrator — you use `seqctl` to create, manage, and execute sequences of work.

## Critical Rules

1. **Always use `seqctl` for sequence mutations** — never edit `.threados/sequence.yaml` directly
2. **All seqctl commands support `--json`** — always use `--json` for programmatic output
3. **Respect gates** — never skip a PENDING gate; ask the user to approve
4. **File-first truth** — `.threados/sequence.yaml` is the source of truth, not memory

## seqctl CLI Reference

Binary: `bunx seqctl` (or `bun run lib/seqctl/index.ts` from repo root)

### Sequence Lifecycle

```bash
# Initialize a new sequence in current directory
seqctl init

# Check current status
seqctl status --json

# Run all steps with satisfied dependencies
seqctl run runnable --json

# Run a specific step
seqctl run step <stepId> --json

# Run all steps in a parallel group
seqctl run group <groupId> --json
```

### Step Management

```bash
# Add a step
seqctl step add <id> --name "Human Name" --type <base|p|c|f|b|l> --model <claude-code|codex|gemini> --prompt <path> --json

# Edit a step
seqctl step edit <id> --name "New Name" --status READY --json

# Remove a step (fails if others depend on it)
seqctl step rm <id> --json

# Clone a step
seqctl step clone <sourceId> <newId> --json
```

### Dependencies

```bash
# Add dependency (stepId depends on depId)
seqctl dep add <stepId> <depId> --json

# Remove dependency
seqctl dep rm <stepId> <depId> --json
```

### Gates (C-Thread Checkpoints)

```bash
# Insert a gate
seqctl gate insert <gateId> --name "Gate Name" --depends-on <stepId> --json

# Approve a gate (unblocks dependents)
seqctl gate approve <gateId> --json

# Block a gate
seqctl gate block <gateId> --json

# List all gates
seqctl gate list --json
```

### Parallel Groups (P-Thread)

```bash
# Group steps as parallel
seqctl group parallelize <stepId1> <stepId2> [stepId3...] --json

# List groups
seqctl group list --json
```

### Fusion (F-Thread)

```bash
# Create fusion: candidates + synth step
seqctl fusion create --candidates <id1> <id2> [id3...] --synth <synthId> --json
```

### Templates

```bash
# Apply a thread template
seqctl template apply <type> --json
# Types: base, parallel, chained, fusion, orchestrated, long-autonomy
```

### Control

```bash
# Stop a running step
seqctl stop <stepId> --json

# Restart a step
seqctl restart <stepId> --json
```

## Thread Type Reference

| Type | Code | When to Use |
|------|------|-------------|
| Base | `base` | Single agent, single task |
| Parallel | `p` | Same task, multiple agents, compare outputs |
| Chained | `c` | Sequential phases with gates between them |
| Fusion | `f` | Multiple candidates → synthesis step merges best |
| Baton | `b` | Orchestrator spawns and coordinates sub-threads |
| Long-autonomy | `l` | Extended autonomous run with optional watchdog |

## Common Workflow Patterns

### Pattern 1: Simple Task (Base)
```bash
seqctl init
seqctl step add do-thing --name "Do the thing" --type base --model claude-code --prompt prompts/do-thing.md --json
seqctl run step do-thing --json
```

### Pattern 2: Plan → Gate → Implement → Test (C-Thread)
```bash
seqctl step add plan --name "Plan" --type base --model claude-code --prompt prompts/plan.md --json
seqctl step add impl --name "Implement" --type base --model claude-code --prompt prompts/impl.md --json
seqctl step add test --name "Test" --type base --model claude-code --prompt prompts/test.md --json
seqctl gate insert review --name "Review Plan" --depends-on plan --json
seqctl dep add impl plan --json
seqctl dep add impl review --json
seqctl dep add test impl --json
```

### Pattern 3: Multi-Model Fusion (F-Thread)
```bash
seqctl step add claude-impl --name "Claude Impl" --type f --model claude-code --prompt prompts/impl.md --json
seqctl step add codex-impl --name "Codex Impl" --type f --model codex --prompt prompts/impl.md --json
seqctl step add synth --name "Synthesize" --type f --model claude-code --prompt prompts/synth.md --json
seqctl fusion create --candidates claude-impl codex-impl --synth synth --json
```

## Prompt Files

Step prompts live in `.threados/prompts/<stepId>.md`. When you add a step, a template prompt file is auto-created. Write the actual task instructions there before running the step.

## Artifacts

Each run produces artifacts in `.threados/runs/<runId>/<stepId>/`:
- `stdout.log` — process stdout
- `stderr.log` — process stderr
- `status.json` — exit code, duration, timestamps

## Project Structure

```
lib/seqctl/          # CLI commands
lib/sequence/        # Schema, parser, DAG validation
lib/runner/          # Step execution wrapper
lib/mprocs/          # mprocs process manager adapter
lib/policy/          # Safety policy engine
lib/audit/           # Audit logging
lib/chat/            # Chat orchestrator (system prompt, validator)
lib/templates/       # Thread type template generators
lib/reconciliation/  # State reconciliation
app/                 # Next.js UI + API routes
components/          # React components (canvas, inspector, chat)
test/                # Integration tests
```

## Testing

```bash
bun test                    # Run all tests (199 tests)
bun test lib/sequence/      # Run specific module tests
```

## Development

```bash
bun install                 # Install dependencies
bun dev                     # Start Next.js dev server (UI)
bun test                    # Run test suite
```
