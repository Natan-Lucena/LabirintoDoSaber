# LabirintoDoSaber — Claude Code Instructions

## Running Tests

Do not attempt to run tests (vitest / `pnpm test`) from Claude Code in WSL.

The project lives at `C:\Users\...` and was set up on Windows. `pnpm` installs
Windows-native binaries (e.g. `rollup-win32`). Running vitest from WSL fails
with `MODULE_NOT_FOUND` for the Linux native module
(`@rollup/rollup-linux-x64-gnu`).

**What to do instead:** After implementing code, confirm TypeScript compiles
(`tsc --noEmit` is fine) and tell the user to run the tests themselves in the
Windows shell. Never try to install missing native binaries or run
`pnpm add` for rollup variants.
