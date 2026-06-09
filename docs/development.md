# Development

## Prereqs

- Node ≥ 20
- pnpm ≥ 9

## Setup

```bash
pnpm install
pnpm build
```

Link the CLI for local use:

```bash
cd apps/cli && pnpm link --global
cavemem --help
```

## Run against a scratch data dir

```bash
export CAVEMEM_HOME=$PWD/.cavemem-dev
pnpm dev
```

## Verifying a local build

After building, check that everything is wired correctly:

```bash
node apps/cli/dist/index.js status
```

This shows settings, database health, observation and session counts, IDE integrations,
embedding backfill progress, and whether the worker is running. See the [README](../README.md#local-development) for a full breakdown of each field.

You can also point to a scratch data dir:

```bash
CAVEMEM_HOME=$PWD/.cavemem-dev node apps/cli/dist/index.js status
```

## Gates

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

All four must pass before merging.

## Adding a changeset

```bash
pnpm changeset
```

Commit the generated file with your PR.
