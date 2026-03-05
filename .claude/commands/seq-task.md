Quick task creation. The user provides a task description as the argument to this command.

Create a minimal but effective C-thread sequence:

1. `bunx seqctl init` (if .threados/ doesn't exist)
2. Create three steps:
   - `plan` (base, claude-code) - analyze the task, create an implementation plan
   - `implement` (base, claude-code) - execute the plan
   - `verify` (base, claude-code) - run tests / validate the implementation
3. Insert a gate between plan and implement: `review-plan`
4. Wire dependencies: implement depends on plan + review-plan, verify depends on implement
5. Write prompt files with the actual task context
6. Show the sequence status
7. Immediately run the `plan` step - do the actual planning work
8. Present the plan to the user and wait for gate approval

Use `--json` for all seqctl commands. The prompt files should be substantive and include the user's task description.
