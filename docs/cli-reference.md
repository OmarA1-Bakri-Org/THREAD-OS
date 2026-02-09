# seqctl CLI Reference

## Global Options

- `--json` — Output as JSON
- `--help` — Show help
- `--watch` — Watch mode (for status)

## Commands

### `seqctl init <name>`

Initialize a new ThreadOS sequence in the current directory.

```bash
seqctl init my-project
# Creates .threados/sequence.yaml
```

### `seqctl step add`

Add a new step to the sequence.

```bash
seqctl step add --id build --name "Build" --type base --model claude-code --prompt prompts/build.md
```

Options:
- `--id` (required) — Unique step identifier
- `--name` (required) — Human-readable name
- `--type` (required) — Step type: base, p, c, f, b, l
- `--model` (required) — Model: claude-code, codex, gemini
- `--prompt` (required) — Path to prompt file
- `--depends-on` — Comma-separated dependency IDs
- `--cwd` — Working directory
- `--lane` — Lane assignment

### `seqctl step remove`

Remove a step and clean up dependencies.

```bash
seqctl step remove --id build
```

### `seqctl step update`

Update step fields.

```bash
seqctl step update --id build --name "Build v2" --type p
```

### `seqctl run`

Execute the sequence via mprocs.

```bash
seqctl run
```

### `seqctl stop`

Stop the sequence or a specific step.

```bash
seqctl stop
seqctl stop --step-id build
```

### `seqctl restart`

Restart a specific step.

```bash
seqctl restart --step-id build
```

### `seqctl status`

View sequence status.

```bash
seqctl status
seqctl status --json
seqctl status --watch
```

### `seqctl dep add`

Add a dependency between steps.

```bash
seqctl dep add --from build --to research
```

### `seqctl dep remove`

Remove a dependency.

```bash
seqctl dep remove --from build --to research
```

### `seqctl gate approve`

Approve a gate to allow downstream steps to proceed.

```bash
seqctl gate approve --id review-gate
```

### `seqctl gate block`

Block a gate.

```bash
seqctl gate block --id review-gate
```

### `seqctl group create`

Create a step group.

```bash
seqctl group create --id my-group --steps step-1,step-2,step-3
```

### `seqctl fusion create`

Create a fusion pattern with candidates and a synthesis step.

```bash
seqctl fusion create --candidates step-a,step-b --synth step-c
```

### `seqctl template apply`

Apply a predefined template.

```bash
seqctl template apply parallel --name "Parallel Research"
seqctl template apply chained --name "Pipeline"
```

Available templates: base, parallel, chained, fusion, orchestrated, long-autonomy
