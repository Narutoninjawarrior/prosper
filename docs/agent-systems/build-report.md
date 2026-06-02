# Builder report contract

Use this when a builder finishes a pass and needs to report results back to a steward or another builder.

The goal is to make every report easy to scan and easy to compare across future passes.

## Required sections

1. **Research summary**
2. **What changed**
3. **What stayed the same**
4. **What was deferred**
5. **Build / verification**
6. **Manual next step**
7. **Next prompt**

## Suggested format

```md
## Research summary
Leave as-is:
...

Smallest gap:
...

## What changed
- file/path
- file/path

## What stayed the same
- contracts
- build path

## What was deferred
- ...

## Build / verification
- `npm run build`: green
- notes:

## Manual next step
- ...

## Next prompt
```text
...
```
```

## Rules for the report

- Be explicit about what stayed untouched.
- Use real file paths when mentioning files.
- Call out CLI-only steps when relevant.
- Separate public mirror steps from repo-clone steps.
- If a build was not run, say so plainly.
- If a change is docs-only, say so plainly.

## What not to do

- Do not hide deferred work.
- Do not mix research with the change log.
- Do not invent a build result.
- Do not bury the next manual action.

## When to use it

- After a Cursor pass
- After an Emergent mirror pass
- After a steward sync pass
- After any future builder edit where the output should be reusable

