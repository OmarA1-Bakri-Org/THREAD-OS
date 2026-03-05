# Run the next available step(s) in the current ThreadOS sequence.

Steps:
1. Run `bunx seqctl status --json` to get current state
2. Identify the runnable frontier (READY steps with all deps satisfied)
3. If there are PENDING gates blocking progress, tell the user and ask if they want to approve
4. If gates need approval, run `bunx seqctl gate approve <gateId> --json`
5. For each runnable step:
   - Read its prompt file from `.threados/prompts/<stepId>.md`
   - Execute the actual task described in the prompt (you ARE the agent — do the work described in the prompt)
   - After completing the work, mark the step as done: `bunx seqctl step edit <stepId> --status DONE --json`
6. After completing steps, run `bunx seqctl status --json` again to show updated state
7. If more steps are now runnable, ask the user if they want to continue

Important: You are not just orchestrating — you are the execution engine. When a step says "implement feature X", you implement it. When it says "write tests", you write them.
