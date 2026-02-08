# Coding Standards

## Immutability
- Avoid mutable updates where possible.
- Do not use `let` for reassignment or state mutation unless strictly necessary.
- Do not use mutating array methods like `push`, `pop`, `splice`, or `sort`.
- Prefer immutable patterns such as `map`, `filter`, `reduce` (returning new arrays), `concat`, and spread (`[...acc, item]`).

## Type Safety
- Avoid forced type casts (`as`/`unknown`) to bypass errors.
- Confirm actual type definitions (e.g., `.d.ts`) and model data properly.
