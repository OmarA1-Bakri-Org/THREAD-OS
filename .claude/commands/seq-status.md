# Sequence Status

Read the current ThreadOS sequence status by running `bunx seqctl status --json`. Parse the JSON output and present a clear summary showing:

1. Sequence name
2. Each step: ID, name, type, status, model, dependencies
3. Each gate: ID, name, status, depends_on
4. Summary counts (ready, running, done, failed, blocked)
5. The runnable frontier (which steps can be executed next)

If no .threados/ directory exists, tell the user and offer to run `bunx seqctl init`.
