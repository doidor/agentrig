# Text probes can reject valid adjacent fields or wrapped lines

## Symptoms
A local frontmatter probe rejected adjacent required fields; a later prose probe rejected valid
instructions because the relevant words wrapped across lines.

## Root cause
The probes' regular expressions assumed an extra blank line between YAML fields or a literal space
between words in Markdown prose.

## Fix
Check delimited frontmatter one field line at a time; normalize whitespace before checking prose.
When cross-checking with a YAML parser, pass only the text between the `---` delimiters.

## Prevention
Exercise probes against adjacent fields and wrapped lines. Inspect the actual file before treating
a helper-check failure as a document defect; parsing the full Markdown file or its closing delimiter
as a single YAML document also produces a false error.
