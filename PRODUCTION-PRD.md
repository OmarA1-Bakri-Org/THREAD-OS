# ThreadOS Production PRD — Thread-Based Engineering Runtime

> **Version**: 2.0 | **Status**: Production Roadmap | **Last Updated**: 2026-02-07
> **Builds on**: `.prd.md` (v1 concept PRD) and `plans/threados-mvp.md` (M0-M2 foundation)

---

## 1. Executive Summary

ThreadOS is a local-first runtime that gives engineers and LLM orchestrators a structured, auditable way to create, execute, and manage multi-step engineering workflows ("threads"). It layers a DAG-based sequence model, deterministic CLI/API controls, a horizontal visual UI, and a chat orchestrator on top of **mprocs** — a parallel terminal process runner.

**Current state**: M0-M2 foundation is ~95% complete. The sequence engine, DAG validation, CLI (`seqctl`), mprocs adapter, runner wrappers, and artifact collection are fully implemented. The web UI is scaffolding only. There are no tests, no audit logging, no policy enforcement, no HTTP API, and no thread template logic.

**This PRD defines everything required to take ThreadOS from foundation to production-ready v1.0.**

---

## 2. What Exists Today (Baseline Audit)

### 2.1 Complete (M0-M2)

| Component | Files | Status |
|-----------|-------|--------|
| Sequence schema (Zod) | `lib/sequence/schema.ts` | Production-ready |
| YAML parser + atomic writes | `lib/sequence/parser.ts`, `lib/fs/atomic.ts` | Production-ready |
| DAG validation + topo sort | `lib/sequence/dag.ts` | Production-ready |
| mprocs client (type-safe) | `lib/mprocs/client.ts` | Production-ready |
| mprocs config generation | `lib/mprocs/config.ts` | Production-ready |
| mprocs state mapping | `lib/mprocs/state.ts` | Production-ready |
| Runner wrapper (spawn, timeout) | `lib/runner/wrapper.ts` | Production-ready |
| Artifact collection | `lib/runner/artifacts.ts` | Production-ready |
| Prompt management | `lib/prompts/manager.ts` | Production-ready |
| Error hierarchy | `lib/errors.ts` | Production-ready |
| CLI: `seqctl init` | `lib/seqctl/commands/init.ts` | Production-ready |
| CLI: `seqctl step add/edit/rm/clone` | `lib/seqctl/commands/step.ts` | Production-ready |
| CLI: `seqctl run step/runnable` | `lib/seqctl/commands/run.ts` | Production-ready |
| CLI: `seqctl status [--watch]` | `lib/seqctl/commands/status.ts` | Production-ready |
| CLI entry point + routing | `lib/seqctl/index.ts` | Production-ready |
| shadcn/ui components | `components/ui/` | Scaffolded (button, card, input, separator, textarea) |

### 2.2 Missing / Not Started

| Component | Priority | Notes |
|-----------|----------|-------|
| Test suite | **Critical** | Only 1 trivial test (`hello.test.ts`). Zero coverage on core modules |
| Thread templates (P/C/F/B/L) | **High** | `seqctl` supports types in schema but no template logic |
| CLI: `dep`, `group`, `fusion`, `gate`, `mprocs` commands | **High** | Referenced in help text but not implemented |
| Audit logging | **High** | `.threados/audit.log` mentioned everywhere but not implemented |
| Policy / SAFE mode | **High** | `policy.yaml` enforcement not implemented |
| HTTP API (Next.js routes) | **High** | Required for UI + chat orchestrator |
| Horizontal Sequence UI | **High** | Only default Next.js template placeholder |
| Chat Orchestrator | **Medium** | NL → structured actions → diff → apply flow |
| State reconciliation | **Medium** | Recovery from crashed/orphaned processes |
| Cross-platform support | **Medium** | Currently Windows-first, mprocs binary only for Windows |
| Observability / metrics | **Low** | Per-run tracking not implemented |
| README / user documentation | **Low** | Currently generic Next.js boilerplate |

---

## 3. Goals and Success Criteria

### 3.1 Production v1.0 Goals

1. **Complete thread lifecycle**: Users can create and execute all six thread types (Base/P/C/F/B/L) from both CLI and UI
2. **Visual workflow management**: Horizontal Sequence UI with real-time status, dependency visualization, and interactive controls
3. **LLM orchestration**: Chat interface that converts natural language to structured sequence operations with SAFE-mode approval
4. **Auditability**: Every mutation and execution is logged to an append-only audit trail
5. **Safety**: Policy enforcement prevents unauthorized/destructive actions; SAFE mode requires explicit confirmation
6. **Reliability**: Comprehensive test suite with >80% coverage on core modules; atomic operations prevent data loss
7. **Developer experience**: Clear documentation, intuitive CLI, responsive UI

### 3.2 Acceptance Criteria (Definition of Done for v1.0)

- [ ] All six thread types (Base/P/C/F/B/L) work end-to-end via `seqctl` CLI
- [ ] All six thread types are visualizable and controllable in the Sequence UI
- [ ] Chat orchestrator converts NL to actions with diff preview and apply/discard
- [ ] SAFE mode blocks all destructive operations without explicit user confirmation
- [ ] `policy.yaml` enforces command allowlists, cwd restrictions, and fanout limits
- [ ] Audit log captures every mutation with timestamp, actor, and action payload
- [ ] Test suite: >80% line coverage on `lib/`, all critical paths have integration tests
- [ ] E2E tests pass for Base, P, C (with gates), F (with fusion), B, and L thread flows
- [ ] UI handles 100+ nodes without degraded responsiveness
- [ ] Documentation covers installation, CLI reference, UI guide, and LLM integration

### 3.3 Non-Goals (v1.0)

- Cloud/multi-user collaboration or shared remote sessions
- Fully autonomous "Z-thread" zero-touch deployments
- Replacing Claude Code / Codex / Gemini (ThreadOS wraps them)
- Mobile UI or responsive layouts for non-desktop
- Plugin/extension marketplace

---

## 4. Architecture

### 4.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ThreadOS Runtime                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Chat        │  │  Horizontal  │  │  seqctl CLI              │  │
│  │  Orchestrator│  │  Sequence UI │  │  (LLM-addressable)       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                 │                      │                  │
│         └────────────┬────┴──────────────────────┘                  │
│                      │                                              │
│                      v                                              │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              HTTP API (Next.js Route Handlers)                │  │
│  │  POST /api/actions/apply  GET /api/sequence  POST /api/run   │  │
│  │  POST /api/chat           GET /api/status    POST /api/stop  │  │
│  └──────────────────────────────┬────────────────────────────────┘  │
│                                 │                                   │
│         ┌───────────────────────┼───────────────────────┐          │
│         v                       v                       v          │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────┐    │
│  │  Sequence    │  │  Policy Engine    │  │  Audit Logger    │    │
│  │  Engine      │  │  (SAFE/POWER)     │  │  (append-only)   │    │
│  │  - Schema    │  │  - Allowlists     │  │  - Mutations     │    │
│  │  - Parser    │  │  - CWD restrict   │  │  - Executions    │    │
│  │  - DAG       │  │  - Fanout limits  │  │  - Gate actions  │    │
│  └──────┬───────┘  └───────────────────┘  └──────────────────┘    │
│         │                                                          │
│         v                                                          │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────┐    │
│  │  Runner      │  │  mprocs Adapter   │  │  Prompt Manager  │    │
│  │  - Wrapper   │<─│  - Client         │  │  - Templates     │    │
│  │  - Artifacts │  │  - Config gen     │  │  - Per-step .md  │    │
│  │  - Timeout   │  │  - State map      │  │                  │    │
│  └──────────────┘  └────────┬──────────┘  └──────────────────┘    │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              v
                    ┌───────────────────┐
                    │  mprocs           │
                    │  (--server :4050) │
                    │  Process pool     │
                    └───────────────────┘
                              │
                    ┌─────────┼─────────┐
                    v         v         v
                [claude]  [codex]  [gemini]
                 agents    agents   agents
```

### 4.2 Data Architecture

```
.threados/                          # All runtime state
├── sequence.yaml                   # Source of truth (Zod-validated)
├── policy.yaml                     # Security policy (NEW)
├── prompts/                        # Per-step prompt files
│   └── <stepId>.md
├── templates/                      # Thread type templates (NEW)
│   ├── base.yaml
│   ├── parallel.yaml
│   ├── chained.yaml
│   ├── fusion.yaml
│   ├── orchestrated.yaml
│   └── long-autonomy.yaml
├── runs/                           # Immutable run artifacts
│   └── <runId>/
│       └── <stepId>/
│           ├── stdout.log
│           ├── stderr.log
│           ├── status.json
│           ├── summary.md          # Optional AI-generated summary
│           └── diff.patch          # Optional git diff
├── state/                          # Mutable runtime state
│   ├── mprocs-map.json            # stepId → process index
│   └── mprocs-state.json         # Session state
└── audit.log                       # Append-only audit trail (JSONL)
```

### 4.3 Schema Extensions for v1.0

The existing `SequenceSchema` needs extensions to support thread templates and advanced features:

```typescript
// New fields on StepSchema
group_id: z.string().optional(),          // P-thread group membership
fanout: z.number().min(1).optional(),     // P-thread worker count
fusion_candidates: z.array(z.string()).optional(), // F-thread candidate IDs
fusion_synth: z.boolean().optional(),     // Is this the synth step?
watchdog_for: z.string().optional(),      // L-thread: step being watched
orchestrator: z.boolean().optional(),     // B-thread: is orchestrator step
timeout_ms: z.number().optional(),        // Per-step timeout override
fail_policy: z.enum(['fail_fast', 'best_effort']).optional(),

// New top-level SequenceSchema fields
metadata: z.object({
  created_at: z.string(),
  updated_at: z.string(),
  created_by: z.string().optional(),
  description: z.string().optional(),
}).optional(),
policy: z.object({
  mode: z.enum(['SAFE', 'POWER']).default('SAFE'),
  max_fanout: z.number().default(10),
  max_concurrent: z.number().default(20),
  allowed_commands: z.array(z.string()).optional(),
  allowed_cwd: z.array(z.string()).optional(),
  forbidden_patterns: z.array(z.string()).optional(),
}).optional(),
```

---

## 5. Feature Specifications

### 5.1 Thread Templates (M3)

Thread templates codify the six thread patterns as reusable sequence fragments.

#### 5.1.1 Base Thread
- Single step with one mprocs process
- CLI: `seqctl step add <id> --type base --model claude-code`
- Template generates: 1 step, 1 prompt file

#### 5.1.2 P-Thread (Parallel)
- Fan-out to N workers running the same or varied prompts
- CLI: `seqctl group parallelize <stepIds...>` or `seqctl step add <id> --type p --fanout 3`
- Template generates: N steps sharing `group_id`, optional merge step
- Configurable `fail_policy`: `fail_fast` (default) or `best_effort`

#### 5.1.3 C-Thread (Chained + Checkpoints)
- Sequential phases connected by approval gates
- CLI: `seqctl gate insert <gateId> --after <stepId> --before <stepId>`
- CLI: `seqctl gate approve <gateId>` / `seqctl gate block <gateId>`
- Template generates: N phases with N-1 gates between them

#### 5.1.4 F-Thread (Fusion)
- Parallel candidates → synthesis step that merges outputs
- CLI: `seqctl fusion create --candidates <stepIds...> --synth <synthId>`
- Template generates: N candidate steps + 1 synth step depending on all candidates
- Synth step receives all candidate artifacts as input

#### 5.1.5 B-Thread (Big/Orchestrated)
- Orchestrator step that dynamically spawns sub-steps via `seqctl`
- CLI: `seqctl step add <id> --type b --orchestrator`
- Orchestrator runs as a long-lived process that calls `seqctl step add` / `seqctl run step` internally

#### 5.1.6 L-Thread (Long Autonomy)
- Long-running agent with optional watchdog companion
- CLI: `seqctl step add <id> --type l --timeout 7200000`
- Optional: `seqctl step add <watchdogId> --type base --watchdog-for <id>`
- Watchdog periodically checks main step output and can signal stop

### 5.2 CLI Completion (Missing Commands)

These commands are referenced in help text and PRD but not implemented:

| Command | Purpose | Priority |
|---------|---------|----------|
| `seqctl dep add <stepId> <depId>` | Add dependency edge | High |
| `seqctl dep rm <stepId> <depId>` | Remove dependency edge | High |
| `seqctl group parallelize <ids...>` | Create P-thread group | High |
| `seqctl fusion create <ids...>` | Create F-thread structure | High |
| `seqctl gate insert <id>` | Insert approval gate | High |
| `seqctl gate approve <id>` | Approve gate (unblock dependents) | High |
| `seqctl gate block <id>` | Block gate | Medium |
| `seqctl run group <groupId>` | Run all steps in a group | High |
| `seqctl run all` | Run all steps in topo order | Medium |
| `seqctl stop <stepId>` | Stop running step | High |
| `seqctl restart <stepId>` | Restart step | High |
| `seqctl mprocs open` | Launch mprocs with current config | Medium |
| `seqctl mprocs select <stepId>` | Focus step in mprocs UI | Low |

### 5.3 HTTP API (Next.js Route Handlers)

The API bridges the UI/chat to the sequence engine. All endpoints return JSON.

```
GET  /api/sequence              → Current sequence definition
GET  /api/status                → Current status snapshot
GET  /api/status/stream         → SSE stream of status changes
POST /api/run                   → { stepId? } Run step or runnable frontier
POST /api/stop                  → { stepId } Stop step
POST /api/restart               → { stepId } Restart step
POST /api/step                  → { action: 'add'|'edit'|'rm'|'clone', ...params }
POST /api/dep                   → { action: 'add'|'rm', stepId, depId }
POST /api/gate                  → { action: 'insert'|'approve'|'block', gateId }
POST /api/group                 → { action: 'parallelize', stepIds }
POST /api/fusion                → { action: 'create', candidates, synthId }
POST /api/chat                  → { message } → SSE stream of structured actions
POST /api/actions/validate      → Dry-run: validate proposed actions
POST /api/actions/apply         → Apply validated actions to sequence
GET  /api/audit                 → { limit?, offset? } Audit log entries
GET  /api/runs/:runId/:stepId   → Artifacts for a specific run
```

All mutating endpoints go through the policy engine and audit logger before execution.

### 5.4 Horizontal Sequence UI

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ▶ Run Runnable  │  SAFE ▾  │  Search...        │  ◧ Minimap    │
├──────────────────────────────────────────────────────────────────┤
│                                                 │                │
│  ┌──────┐   ┌──────┐   ╔══════╗   ┌──────┐    │  Step Inspector│
│  │step-1│──▶│step-2│──▶║gate-1║──▶│step-3│    │                │
│  │ DONE │   │ RUN  │   ║PEND  ║   │BLOCK │    │  Name: step-2  │
│  └──────┘   └──────┘   ╚══════╝   └──────┘    │  Type: base    │
│                                                 │  Model: claude │
│  ┌──────┐   ┌──────┐                           │  Status: RUN   │
│  │step-4│──▶│step-5│──────────────▶ (merge)    │  CWD: ./src    │
│  │ RUN  │   │ RUN  │                           │                │
│  └──────┘   └──────┘                           │  [▶Run] [■Stop]│
│                                                 │  [↻Restart]    │
│        Horizontal Sequence Canvas               │  [📄 Logs]     │
├──────────────────────────────────────────────────┤  [📝 Prompt]   │
│  Chat Orchestrator (collapsible)                │                │
│  > "Add a verification step after step-3"       │                │
│  ┌────────────────────────────────────────┐     │                │
│  │ Proposed: step add verify-3 --type base│     │                │
│  │ + dep add verify-3 step-3              │     │                │
│  │ [Apply] [Apply & Run] [Discard]        │     │                │
│  └────────────────────────────────────────┘     │                │
└──────────────────────────────────────────────────┴────────────────┘
```

#### Technology Choices
- **Canvas rendering**: React Flow (https://reactflow.dev) for DAG visualization
- **Layout**: Dagre or ELK for automatic graph layout (left-to-right)
- **Panels**: Resizable panels via `react-resizable-panels`
- **Real-time updates**: SSE from `/api/status/stream`, React Query for data fetching
- **State management**: React Query (server state) + Zustand (UI state)

#### Node Types
| Node Type | Visual | Behavior |
|-----------|--------|----------|
| Step (base) | Rounded rectangle with status color | Click to inspect, double-click to edit |
| Step (running) | Pulsing border animation | Shows elapsed time |
| Gate | Diamond shape | Click to approve/block |
| Group boundary | Dashed rectangle around P-thread members | Collapsible |
| Fusion merge | Triangle/funnel merge point | Shows candidate count |
| Dependency edge | Solid arrow (hard dep) | Animated flow when running |

#### Status Colors
| Status | Color | Description |
|--------|-------|-------------|
| READY | Blue | Can be executed |
| RUNNING | Amber (pulsing) | Currently executing |
| DONE | Green | Completed successfully |
| FAILED | Red | Execution failed |
| BLOCKED | Gray | Waiting on dependencies/gates |
| NEEDS_REVIEW | Purple | Awaiting human review |

### 5.5 Chat Orchestrator

#### Interaction Model
1. User types natural language request
2. Orchestrator parses intent and generates structured actions (JSON array of `seqctl` commands)
3. UI shows proposed actions as a diff card
4. User clicks **Apply**, **Apply & Run**, or **Discard**
5. On apply, actions are validated, executed, and audit-logged

#### SAFE Mode Behavior
- **SAFE (default)**: All proposed actions require explicit user confirmation. Destructive actions (rm, stop, restart) require double-confirmation.
- **POWER**: Non-destructive actions auto-apply. Destructive actions still require single confirmation.

#### Action Schema
```typescript
interface ProposedAction {
  id: string;
  command: string;          // seqctl command string
  description: string;      // Human-readable explanation
  destructive: boolean;     // Requires extra confirmation
  reversible: boolean;      // Can be undone
  dry_run_result?: string;  // Preview of what would change
}

interface ChatResponse {
  message: string;          // Natural language response
  actions: ProposedAction[];
  sequence_diff?: string;   // Unified diff of sequence.yaml changes
}
```

### 5.6 Audit Logging

Append-only JSONL file at `.threados/audit.log`.

```typescript
interface AuditEntry {
  timestamp: string;        // ISO 8601
  actor: 'user' | 'orchestrator' | 'system';
  action: string;           // e.g., 'step.add', 'run.start', 'gate.approve'
  target: string;           // e.g., step ID, gate ID
  payload: Record<string, unknown>; // Action-specific data
  policy_mode: 'SAFE' | 'POWER';
  result: 'success' | 'denied' | 'error';
  error?: string;
}
```

Every mutating operation (step CRUD, dep changes, run/stop/restart, gate approve/block, policy change) writes an entry.

### 5.7 Policy Engine

Policy file at `.threados/policy.yaml`:

```yaml
mode: SAFE                        # SAFE or POWER
max_fanout: 10                    # Max parallel workers per P-thread
max_concurrent: 20                # Max simultaneous running processes
timeout_default_ms: 1800000       # 30 minutes

allowed_commands:                 # Allowlist for runner commands
  - "claude"
  - "codex"
  - "gemini"
  - "bun"
  - "npm"
  - "npx"
  - "node"
  - "git"
  - "tsc"

allowed_cwd:                      # Allowed working directories (glob patterns)
  - "./**"                        # Relative to project root

forbidden_patterns:               # Blocked command patterns (regex)
  - "rm\\s+-rf\\s+/"
  - "sudo"
  - "format\\s+[A-Z]:"

confirmation_required:            # Actions requiring confirmation even in POWER mode
  - "step.rm"
  - "gate.block"
  - "run.all"
```

The policy engine validates every action before execution and returns `denied` with reason if policy is violated.

### 5.8 State Reconciliation

On startup or reconnection:
1. Read `.threados/state/mprocs-map.json` for last-known process mapping
2. Query mprocs server for running processes
3. For each step marked RUNNING in `sequence.yaml`:
   - If corresponding mprocs process is alive → keep RUNNING
   - If process is dead → mark FAILED with `reason: "orphaned_process"`
4. Write reconciliation to audit log

---

## 6. Non-Functional Requirements

### 6.1 Performance
- UI responsive with 100+ nodes (React Flow virtualization)
- Status polling ≤1s latency via SSE
- CLI commands complete in <500ms for non-execution operations
- Support 20-50 concurrent mprocs processes

### 6.2 Reliability
- All state writes are atomic (temp-then-rename pattern)
- UI crash does not lose sequence state (file-first design)
- mprocs failure marks affected steps as FAILED with error context
- Orphaned process detection on startup

### 6.3 Security
- Policy engine enforces all allowlists before execution
- SAFE mode is default, requires explicit opt-in to POWER
- Secrets redaction in audit logs (pattern-based scrubbing)
- No remote network access by default (local-first)

### 6.4 Observability
Track per-run metrics in `status.json`:
- Thread count by type (Base/P/C/F/B/L)
- Average step duration
- Failure/restart rates
- Fanout utilization (P/F threads)
- Gate approval latency (C threads)
- Fusion agreement rate (heuristic, F threads)

---

## 7. Testing Strategy

### 7.1 Unit Tests (Bun test runner)
Target: >80% line coverage on `lib/`

| Module | Test File | Key Cases |
|--------|-----------|-----------|
| `sequence/schema.ts` | `sequence/schema.test.ts` | Valid/invalid steps, gates, enums, edge cases |
| `sequence/parser.ts` | `sequence/parser.test.ts` | Read/write roundtrip, malformed YAML, missing file |
| `sequence/dag.ts` | `sequence/dag.test.ts` | Acyclic graph, single cycle, diamond dependency, isolated nodes |
| `mprocs/client.ts` | `mprocs/client.test.ts` | Command serialization, error handling (mock shell) |
| `mprocs/config.ts` | `mprocs/config.test.ts` | Config generation for each thread type |
| `mprocs/state.ts` | `mprocs/state.test.ts` | Read/write/update map, missing file |
| `runner/wrapper.ts` | `runner/wrapper.test.ts` | Success, failure, timeout, signal handling |
| `runner/artifacts.ts` | `runner/artifacts.test.ts` | Directory creation, file writes, status JSON |
| `prompts/manager.ts` | `prompts/manager.test.ts` | CRUD operations, missing files |
| `errors.ts` | `errors.test.ts` | Error codes, messages, inheritance |
| `seqctl/commands/*.ts` | `seqctl/commands/*.test.ts` | Each command with valid/invalid inputs |
| `policy/engine.ts` | `policy/engine.test.ts` | Allow/deny decisions, mode switching |
| `audit/logger.ts` | `audit/logger.test.ts` | Entry formatting, append behavior |

### 7.2 Integration Tests
- Full `seqctl` CLI flows: `init → step add → dep add → run runnable → status`
- mprocs lifecycle: start server → add process → run → stop → cleanup
- Artifact pipeline: run step → verify stdout.log + stderr.log + status.json
- Policy enforcement: attempt blocked command → verify denial + audit entry

### 7.3 E2E Tests
One test per thread type that exercises the full lifecycle:
1. **Base**: Create → run → verify artifacts → done
2. **P-Thread**: Create group of 3 → run parallel → verify all complete → check fail_policy
3. **C-Thread**: Create phases → run phase 1 → gate pending → approve gate → run phase 2
4. **F-Thread**: Create 3 candidates → run → synth merges → verify fusion output
5. **B-Thread**: Create orchestrator → runs and spawns sub-steps → verify sub-step artifacts
6. **L-Thread**: Create long-run + watchdog → run → watchdog signals → verify both logs

### 7.4 UI Tests
- Component tests with React Testing Library
- Visual regression tests for step nodes, gate nodes, status colors
- Interaction tests: drag to reorder, click to inspect, approve gate

---

## 8. Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| mprocs process lifetime (exits = processes end) | High | Certain | File-first state; artifacts survive mprocs restart |
| Windows quoting complexity for `cmd` arrays | Medium | Likely | Centralize command building; use `cmd` arrays not `shell` strings |
| LLM-driven destructive actions | High | Likely | SAFE mode default; policy allowlists; audit trail; double-confirm |
| State desync between UI and mprocs | Medium | Possible | SSE polling + reconciliation on reconnect |
| React Flow performance at scale (100+ nodes) | Medium | Possible | Virtualization; collapse groups; lazy render off-screen |
| Chat orchestrator hallucinating invalid actions | Medium | Likely | Validate actions via dry-run before showing to user; schema check |
| Concurrent file writes to sequence.yaml | Medium | Possible | Atomic writes + file-level mutex for write operations |
| Cross-platform mprocs binary availability | Low | Possible | Document platform-specific setup; consider Linux/Mac CI |

---

## 9. Future Considerations (Post v1.0)

- **Z-Thread**: Zero-touch autonomous deployments with governance hooks
- **Cloud sync**: Optional sync of sequences/artifacts to cloud storage
- **Team collaboration**: Shared sequences with role-based access
- **Plugin system**: Custom step types, model adapters, output processors
- **Mini-map**: Zoomed-out overview of large sequences
- **Soft dependencies**: Dashed arrows for "nice-to-have-before" relationships
- **Git integration**: Auto-create worktrees per step, branch per thread
- **Richer synthesis**: AI-powered artifact comparison and merge tooling
- **Notifications**: Desktop/Slack/webhook notifications on step completion/failure
