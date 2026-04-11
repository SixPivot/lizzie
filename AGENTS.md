# Agents

## Project overview

An Electron app that provides a layer over Azure DevOps (AzDO). It syncs AzDO work items to/from local Markdown files, and provides a consolidated board view across multiple AzDO projects. No server component — the app is self-contained. See `README.md` for key decisions and `feature-specifications/` for detailed feature specs.

## Behaviour

- **Ask before assuming.** If requirements or intent are unclear, ask a clarifying question rather than guessing.
- **Stay focused.** Keep changes scoped to what was requested. Don't refactor or restructure unrelated code.
- **Campsite rule.** If you notice an obvious bug or issue outside the current scope, fix it — but call it out separately.
- **Update documentation.** If a change affects `README.md`, `AGENTS.md`, or a feature spec, update it as part of the work.
- **Reference feature specs.** Before implementing a feature, check `feature-specifications/` for a relevant spec and follow it.

## Coding style

We use TypeScript, React, and TailwindCSS as the basis for the application.

- Use functional components, not class based
- Four spaces per tab
- Terminate using semi-colons
- Use double quotes for string literals, not single quotes
- Where possible use template literals over string concatenation
- Attempt to extract reusable components where it makes sense
- Where possible prefer traditional function declarations over arrow functions, except in nested scenarios such as `useMemo(() => ...)`
- Where possible use type declarations sparingly - prefer implicit types
- Don't use `any` types

## Testing

- Test framework: **Vitest**
- When creating code that has complex logic or that is prone to regressions, create a co-located test suite (eg. `ProjectSelector.test.ts`)
- Run tests after making changes, and fix failing tests (or fix the implementation)




