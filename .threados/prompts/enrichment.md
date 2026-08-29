# Apollo Enrichment

Pack: Apollo Segment Builder (apollo-segment-builder@1.0.0)
Phase: phase-3-enrichment

## Objective

Enrich only approved missing fields within the configured Apollo credit budget and persist attributable enrichment evidence.

## Inputs

- Dependency steps: `merge-dedup-comply`.
- Use only dependency artifacts, hydrated thredOS runtime context, and shared references declared by the pack.
- Treat `.threados/tmp/apollo-segment/` as scratch space for this workflow; do not read or write arbitrary host paths.

## Required execution

1. Validate required dependency evidence before taking side effects.
2. Execute the actions in the `THREADOS ACTION CONTRACT` in order, including conditional branches and approval gates.
3. Persist declared output keys or artifacts exactly; expected evidence includes `enriched_segment`.
4. Respect SAFE-mode policy, Apollo credit limits, compliance exclusions, and explicit approval boundaries.
5. If a prerequisite, tool result, or required artifact is missing or malformed, fail closed or return `NEEDS_REVIEW`; never fabricate success evidence.

## Completion contract

The step is complete only when every non-skipped action required by the selected branch has a successful persisted receipt and all declared outputs are present. A zero process exit without required evidence is not completion.
