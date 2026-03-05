The user will describe a task they want to accomplish. Your job is to decompose it into a ThreadOS sequence with appropriate thread types, gates, and dependencies.

Steps:
1. Analyze the task and break it into logical phases
2. For each phase, determine the right thread type:
   - `base` for straightforward single-agent work
   - `p` if the phase benefits from parallel exploration
   - `f` if multiple models should attempt it and results should be fused
   - `c` for sequential phases needing human review between them
3. Insert gates between high-risk transitions (e.g., before deployment, after planning)
4. Write prompt files for each step in `.threados/prompts/`
5. Execute the seqctl commands to build the sequence:
   - `bunx seqctl step add ...` for each step
   - `bunx seqctl dep add ...` for dependencies
   - `bunx seqctl gate insert ...` for gates
   - `bunx seqctl dep add <step> <gate>` to wire gates into the dependency graph
6. Run `bunx seqctl status --json` to confirm the sequence is valid
7. Present the final sequence to the user for review before running

Always use `--json` flag for seqctl commands. Write substantive prompt files - not just placeholders.
