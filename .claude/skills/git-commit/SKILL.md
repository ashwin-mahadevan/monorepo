---
name: git-commit
description: Stage and commit changes with a structured message. Use after making atomic code changes.
disable-model-invocation: true
allowed-tools: Bash
---

# Git Commit Workflow

Stage and commit changes using separate `git add` and `git commit` commands.
Each `-m` flag to `git commit` becomes a new paragraph in the commit message.
Always append a `Co-Authored-By` trailer as the final `-m`.

## Arguments

- `$ARGUMENTS`: Describes what to commit (files, message, context)

## Workflow

1. **Stage files**: `git add <files>`
2. **Commit**: `git commit -m "<subject>" -m "<body>" -m "Co-Authored-By: <your-name> <noreply@anthropic.com>"`

Run these as two separate Bash commands so each can be reviewed independently.

## Example

```bash
# Step 1
git add src/foo.ts src/bar.ts

# Step 2
git commit \
  -m "Add foo and bar utilities" \
  -m "foo does X; bar does Y." \
  -m "Co-Authored-By: <your-name> <noreply@anthropic.com>"
```
