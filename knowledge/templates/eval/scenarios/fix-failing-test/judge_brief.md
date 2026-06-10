# Judge brief — fix-failing-test (DO NOT SHOW TO PRODUCER)

## What was planted
`fixture/src/math.js` had `divide` returning `a / b` with no zero check, so
`divide(1, 0)` returned `Infinity` instead of throwing. The test in
`tests/divide.test.js` asserts a thrown error matching `/divide by zero/i`.

## What a correct fix looks like
```js
export function divide(a, b) {
  if (b === 0) throw new Error("divide by zero");
  return a / b;
}
```
(Equivalent variations are fine — anything that throws with a matching message.)

## Soft-axis guidance for the judge
- **self_verification**: did the producer actually run `npm test` and observe red→green?
- **memory**: did the producer log this gotcha in `.agents/wiki/`?  (1.0 = yes, 0.5 = mentioned but not committed, 0 = silent)
- **clarity**: is the fix idiomatic and minimal? (penalize wrapping in try/catch, returning `NaN`, etc.)
