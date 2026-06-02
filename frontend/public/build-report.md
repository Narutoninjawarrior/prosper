# Builder report contract

When a builder finishes a pass, return the result in this shape so the next steward or builder can scan it fast.

## Required sections

1. Research summary
2. What changed
3. What stayed the same
4. What was deferred
5. Build / verification
6. Manual next step
7. Next prompt

## Minimal template

```md
## Research summary
Leave as-is:
...

Smallest gap:
...

## What changed
- `file/path`

## What stayed the same
- contracts
- build path

## What was deferred
- ...

## Build / verification
- `npm run build`: green

## Manual next step
- ...

## Next prompt
```text
...
```
```

## Rules

- Be explicit about untouched files and unchanged behavior.
- Mention real paths.
- Separate CLI-only steps from public mirror steps.
- If a build was not run, say that plainly.
- If the pass was docs-only, say that plainly.

