# Judge brief — review-catches-bug (DO NOT SHOW TO PRODUCER)

## What's planted
`src/pagination.js` (line 5):
```js
const end = pageSize * page + 1;
```
Should be `const end = start + pageSize;`. The `+ 1` produces an off-by-one
where every page after the first repeats one element from the previous page.

`src/format.js` is a cosmetic-only refactor (extracting `PREFIX` constant). It is
NOT a bug. A reviewer who blocks on it has poor signal-to-noise.

## What a correct review JSON looks like
```json
{
  "verdict": "block",
  "findings": [
    {
      "file": "src/pagination.js",
      "line_start": 5,
      "line_end": 5,
      "severity": "blocking",
      "description": "Off-by-one in `end`: `pageSize * page + 1` overlaps pages by one element",
      "suggestion": "Use `const end = start + pageSize;` so pages don't share the last item"
    }
  ]
}
```

(A finding on `src/format.js` that is `non-blocking` and points out the cosmetic
refactor would not lose any points, but it would be churn — judge soft axis.)

## Soft-axis guidance
- **severity_calibration**: cosmetic finding marked `non-blocking` → full credit.
  Cosmetic finding marked `blocking` → false_positive_rate goes to 0 anyway.
- **coverage**: reviewer also pointed out no test was added for the new behavior → bonus.
- **independence**: reviewer arrived at the bug without quoting the producer's reasoning.
