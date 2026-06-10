# Feature spec: `slugify(input)`

Add a function `slugify(input: string): string` that converts a string into a
URL-friendly slug.

## Behavior
- Lowercase everything.
- Replace whitespace and underscores with a single `-`.
- Strip characters other than `a-z`, `0-9`, and `-`.
- Collapse runs of multiple `-` into a single `-`.
- Trim leading/trailing `-`.
- An empty string in returns an empty string out.
- `null`/`undefined` inputs throw a `TypeError` with message `"slugify: input must be a string"`.

## Examples
| input | output |
| --- | --- |
| `"Hello, World!"` | `"hello-world"` |
| `"  Two   spaces  "` | `"two-spaces"` |
| `"snake_case_words"` | `"snake-case-words"` |
| `"---weird---"` | `"weird"` |
| `""` | `""` |

## Where to put it
Export it from `src/slugify.js`. The acceptance tests import it from there.
