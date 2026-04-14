---
name: ts-axioms
description: >
  TypeScript invariants enforced in this repo. Apply when writing or editing any `.ts` / `.tsx` /
  `.astro` file. Covers the judgement cases not caught by Biome + tsconfig alone: when type
  narrowing is preferable to casts, when to extract named parameters, when `readonly` matters,
  and when to reach for a brand/schema instead of a structural type. Triggers on any code-editing
  task in `src/`, `scripts/`, or `tests/`.
---

## Core Principle

Types are a contract, not a suggestion. The compiler and the linter enforce syntax-level axioms. This skill enforces the *judgement-level* axioms that catch the code that passes the compiler but still rots the codebase.

## Axioms

### 1. No `any`

- `noExplicitAny: error` in Biome — the lint catches `any`
- Judgement case: when tempted to use `any`, ask: *"what type do I actually know this is?"*
- If truly unknown: use `unknown` and narrow
- If external (JSON, env): parse through a schema validator, return a typed result

### 2. No `as` casts outside test files

- `as SomeType` bypasses the compiler — never do it in `src/` or `scripts/`
- Allowed in `*.test.ts` only when constructing fixtures
- Replace with:
  - **Type narrowing**: `if (typeof x === "string") { ... }`
  - **Discriminated unions**: tag your variants
  - **Brand constructors**: `function userId(s: string): UserId { ... }`
  - **Schema validation**: `Schema.decode(input)` returns a typed value

Exception: `as const` is not a cast — always fine.

### 3. `noUncheckedIndexedAccess`

- Array / record access returns `T | undefined`
- Handle the `undefined` branch, don't ignore it
- If you know the index is safe (e.g., iterating with `.map`), destructure the known element instead of indexing

### 4. Named parameters for 3+ arguments

- Positional: `foo(a, b)` fine
- Positional with 3+: hard to read at call site, easy to swap silently
- Refactor to object:
  ```ts
  function foo({ a, b, c }: { a: number; b: string; c: Date }) { ... }
  ```
- Applies equally to constructors and factory functions

### 5. Immutability by default

- Fields: `readonly` unless mutation is the whole point
- Arrays: `readonly T[]` in function signatures
- Object literals as config: `as const`
- If you find yourself reaching for `Object.freeze`, the type system already has this covered — use `readonly` + `as const`

### 6. Prefer narrow types to wide ones

- `string` is rarely what you mean. `EmailAddress`, `UserId`, `PostSlug` are what you mean.
- Branding:
  ```ts
  type PostSlug = string & { readonly __brand: "PostSlug" };
  const postSlug = (s: string): PostSlug => {
    if (!/^[a-z0-9-]+$/.test(s)) throw new Error("invalid slug");
    return s as PostSlug;  // only cast allowed: inside the constructor
  };
  ```
- The single `as` inside the constructor is fine — it's the boundary where validation happens.

### 7. No mutable module-level state

- Module-level `let` is a global variable with prettier syntax
- State lives inside a function, class, or is passed explicitly
- Exception: module-level `const` registries built once at load time

### 8. Prefer composition to inheritance

- Classes only where the framework requires (rare in this stack)
- Default to plain functions + types
- Inherit only from framework base classes (e.g., Astro component types)

### 9. Exhaustive switches

- Every `switch` on a discriminated union needs a `never` fallback:
  ```ts
  function handle(kind: SpecKind) {
    switch (kind) {
      case "code": ...
      case "rule": ...
      case "workflow": ...
      case "writeup": ...
      default: {
        const _exhaustive: never = kind;
        throw new Error(`unhandled: ${_exhaustive}`);
      }
    }
  }
  ```
- Adding a new variant → compiler fails every switch until updated

### 10. No `!` non-null assertion

- `noNonNullAssertion: error` in Biome
- If the value might be null, handle the null case
- If you're certain it isn't, narrow explicitly or throw with a reason

## Workflow

When invoked on a code change:

1. Scan the diff for axiom violations (any, as, `!`, module-level let, positional 3+ args)
2. For each violation, propose the idiomatic fix per the axiom
3. Flag cases where the axiom creates friction — those become candidates for an `ai-axioms`-level discussion, not silent violation

## When this skill does NOT apply

- Editing `*.test.ts` files: relaxed on `as` for fixtures
- Editing `scripts/`: relaxed on named parameters (scripts are often single-use CLI)
- Editing Astro frontmatter: Astro-specific types may require looser patterns per framework conventions

## Escalation

If a task cannot be completed without violating an axiom, stop and write a `blocker.md` in the active spec folder explaining which axiom conflicts and why. Never violate silently.
