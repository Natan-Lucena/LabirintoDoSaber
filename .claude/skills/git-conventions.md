---
name: git-conventions
description: This skill should be used when the user asks to "commit", "create a commit", "push", "open a PR", "create a pull request", "push and open PR", or invokes commit/PR slash commands (e.g. /commit, /commit-push-pr) in the wave-telcel-adapter-api repo. Provides the project's conventional-commit emoji format and PT-BR PR rules.
---

# Git conventions (wave-telcel-adapter-api)

Apply these rules whenever creating commits or PRs in this repo.

## Commits

Use **conventional commits with a unicode emoji prefix**. Format:

```
<emoji> <type>: <description>
```

- Description in lowercase, imperative, no trailing period.
- Prefer unicode emoji (✨, 🐛) over shortcodes (`:sparkles:`, `:bug:`) for consistency, even though both appear in history.

Type → emoji map:

| Type | Emoji | Use for |
|------|-------|---------|
| `feat` | ✨ | new feature |
| `fix` | 🐛 | bug fix |
| `refactor` | ♻️ | restructure without behavior change |
| `test` | ✅ | tests added or updated |
| `chore` | 📦 | deps, tooling, build |
| `docs` | 📝 | documentation only |

Examples:

- `✨ feat: add redis cache client`
- `🐛 fix: handle null response from SOAP`
- `♻️ refactor: extract gateway registry`

## Pull requests

- **Do NOT use `--draft`.** Open regular PRs ready for review.
- **Language: PT-BR** for both title and body.
- Title under 70 chars, no emoji, direct.
- Body must be **descriptive but direct** — every line adds information. Cut anything that just restates the title or describes generic process.

### Body template

```markdown
## Resumo

- <o que mudou e por quê — 2 a 4 bullets densos>
- <decisão técnica relevante, se houver>
- <impacto / breaking changes, se houver>

## Plano de testes

- [ ] <passo verificável>
- [ ] <passo verificável>
```

Rules for the body:

- Bullets state **what changed and why**, not "this PR does X" prose.
- Omit a section entirely if it has nothing to say — do not leave placeholder bullets.
- No marketing language, no "this elegant solution", no closing summary.
- Reference issue IDs/links only when they add context the diff cannot show.

### `gh pr create` invocation

Pass the body via HEREDOC to preserve formatting:

```bash
gh pr create --title "<título em PT-BR>" --body "$(cat <<'EOF'
## Resumo

- ...

## Plano de testes

- [ ] ...
EOF
)"
```
