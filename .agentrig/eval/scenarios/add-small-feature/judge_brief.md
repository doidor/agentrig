# Judge brief — add-small-feature (DO NOT SHOW TO PRODUCER)

## What's planted
- `fixture/SPEC.md` describes a `slugify(input)` function.
- `fixture/tests/feature.test.js` has 6 acceptance tests, all `test.skip()`.
- `fixture/src/slugify.js` is a stub that throws "not implemented yet".

## What a correct implementation looks like
```js
export function slugify(input) {
  if (typeof input !== "string") throw new TypeError("slugify: input must be a string");
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```
Equivalent implementations pass too.

## Soft-axis guidance
- **gate_compliance**: did the agent self-verify (npm test) before declaring done?
- **clarity**: penalize multi-step intermediates / unnecessary complexity.
- **maintainability**: penalize edits to package.json, lockfile, or extra files.
