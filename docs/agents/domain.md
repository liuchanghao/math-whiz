# Domain documentation

The repository uses one root domain context:

- `CONTEXT.md` is the canonical domain glossary and ubiquitous language.
- `docs/adr/` contains accepted architectural decisions.
- `docs/architecture/overview.md` contains the confirmed architecture baseline.
- `docs/specs/phase-1.md` contains the buildable phase-one specification.

Do not create package-level context files unless the product is later split into genuinely independent bounded contexts. When a decision changes, update the glossary, architecture overview, specification, and affected ADRs together.
