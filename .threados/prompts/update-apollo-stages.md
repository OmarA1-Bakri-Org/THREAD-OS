# Update Apollo Stages

Pack: Apollo Segment Builder (apollo-segment-builder@1.0.0)
Phase: phase-5-persistence

## Objective

Move approved contacts to the resolved Apollo stage without mutating contacts outside the approved segment.

## Inputs

- Dependency steps: `review-approval`.
- Use only dependency artifacts, hydrated thredOS runtime context, and shared references declared by the pack.
- Treat `.threados/tmp/apollo-segment/` as scratch space for this workflow; do not read or write arbitrary host paths.

## Required execution

1. Validate required dependency evidence before taking side effects.
2. Execute the actions in the `THREADOS ACTION CONTRACT` in order, including conditional branches and approval gates.
3. Persist declared output keys or artifacts exactly; expected evidence includes `stage_update_result`.
4. Respect SAFE-mode policy, Apollo credit limits, compliance exclusions, and explicit approval boundaries.
5. If a prerequisite, tool result, or required artifact is missing or malformed, fail closed or return `NEEDS_REVIEW`; never fabricate success evidence.

## Completion contract

The step is complete only when every non-skipped action required by the selected branch has a successful persisted receipt and all declared outputs are present. A zero process exit without required evidence is not completion.
