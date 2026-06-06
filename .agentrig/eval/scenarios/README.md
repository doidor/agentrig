# Dynamic-eval results

`score.mjs` writes one JSON file per scenario run here. Do not hand-edit; use:

```bash
node ../score.mjs save --scenario <id> --judge <model> --axis name=score[:CODE] ...
node ../score.mjs report
```

This directory is git-ignored by default (results are run artifacts).
