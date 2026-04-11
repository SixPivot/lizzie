# Spec template - single feature

Prompt - remove me:

```
Help me write a comprehensive specification for this feature.
 
Before asking any questions:
  - Read the summary and requirements carefully
  - Research the existing codebase for related patterns, components, data models, and any prior art relevant to this feature
  - Identify gaps, ambiguities, edge cases, constraints, and risks that need resolution
 
Then ask targeted clarifying questions, grouped by theme (e.g. UX/behaviour, permissions, data, integrations, edge cases). For each question, briefly explain why it matters to the spec. Prioritise the most impactful unknowns first, and don't ask questions you can answer from research.
 
After I answer, produce the specification including:
  - Summary – rewritten if needed for clarity
  - Detailed description – behaviour, flows, states, constraints
  - Key decisions – recorded with rationale
  - Permissions matrix – if applicable
  - User stories – one or more, concise
  - Diagrams – sequence/flow/state where helpful (Mermaid)
  - Acceptance criteria – comprehensive, in Gherkin syntax
  - Manual test steps – for QA
  - Implementation tasks – ordered, with any dependency notes
```

## Summary

HUMAN: Write up a brief summary of the feature here.

## Detailed description

AI: Allow the AI to fill this in, to check and refine it's understanding of the feature.

## User stories

AI: Use *as a, I want to, so that* syntax

## Key decisions

AI: Document the key decisions made from the clarifying questions you asked

| Decision | Outcome |
|----------|---------|
|          |         |

## Requirements

HUMAN: Fill this in yourself, then let AI finesse it
- Requirement 1
- Requirement 2

## Permissions matrix

AI: Only if appropriate

## Validation

AI: Optional

| Rule | Error message |
| ---- | ------------- |
|      |               |

## Diagrams

AI: Optional. Use Mermaid syntax.

## Acceptance criteria

AI: Comprehensive acceptance criteria written using Gherkin syntax

## Manual test steps

AI: Comprehensive manual testing steps, that any experienced but non-technical user of the system would be able to complete

## Implementation tasks

AI: A list of tasks required to implement the feature. Include dependencies between tasks, and order by dependency. Each task should reference the exact files and patterns to follow.


