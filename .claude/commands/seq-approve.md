Approve a pending gate to unblock the next phase of the sequence.

1. Run `bunx seqctl gate list --json` to show all gates
2. If a gate ID was provided as argument, approve it: `bunx seqctl gate approve <gateId> --json`
3. If no gate ID was provided, show pending gates and ask the user which to approve
4. After approval, run `bunx seqctl status --json` to show the updated state
5. Identify newly unblocked steps and offer to run them
