# dbsetup

CLI to drop, recreate, migrate, and seed databases — configurable per project and migration framework.

Point it at a project, pick an environment (or branch), and it handles the git checkout, database reset, migrations, and seeding in one command.

## Requirements

- Node.js >= 18
- `git` in PATH
- PostgreSQL (`pg_dump`) or MySQL (`mysqldump`) client tools, if using `--backup`

## Installation

```bash
npm install -g @willianevl/dbsetup
```

Or link during development:

```bash
npm link
```

## Quick Start

```bash
# 1. Register a project
dbsetup configure

# 2. Run against an environment
dbsetup myapp dev
```

## Commands

### `dbsetup configure` (alias: `config`)

Interactively add or edit a project configuration.

```bash
dbsetup configure
dbsetup configure -p myapp   # jump directly to a project (creates or edits)
```

You will be prompted for:

| Field | Description |
|---|---|
| Project name | Identifier used in all other commands |
| Project path | Absolute path or `~/...` to the project root |
| DB type | PostgreSQL or MySQL / MariaDB |
| Migration framework | See [Frameworks](#frameworks) |
| Migrate command | Defaults to the framework standard; editable |
| Seed command | Optional; leave blank to skip seeding |
| Branch mapping | Which git branch maps to `dev`, `hlg`, and `prod` |
| Env var names | Names of DB connection vars in the project `.env` |

Configuration is saved to:
- **Linux / macOS**: `~/.config/db-setup/config.json`
- **Windows**: `%APPDATA%\db-setup\config.json`

---

### `dbsetup run [project] [env]`

Drop, recreate, migrate, and seed a project database. This is the **default command** — `dbsetup myapp dev` is equivalent to `dbsetup run myapp dev`.

```bash
dbsetup myapp dev
dbsetup myapp hlg
dbsetup myapp prod
dbsetup myapp feature/my-branch   # any remote branch name
dbsetup                           # prompts for project and environment
```

**Options:**

| Flag | Description |
|---|---|
| `--skip-seed` | Run migrations but skip the seed step |
| `--migrate-only` | Skip drop/recreate and seed — only run migrations |
| `--dry-run` | Print the steps that would run without executing anything |
| `--backup` | Dump the database before dropping it (saved to `~/db-setup-backups/`) |

**What it does:**

1. Stashes any uncommitted changes in the project
2. Fetches and checks out the target branch
3. *(if `--backup`)* Dumps the database with `pg_dump` or `mysqldump`
4. Drops and recreates the database
5. Runs the migrate command
6. Runs the seed command (unless skipped)
7. Restores the original branch and stash

DB credentials are read from the project's `.env` file using the env var names configured per project.

---

### `dbsetup list`

List all configured projects with their path, framework, and DB type.

```bash
dbsetup list
```

---

### `dbsetup info [project]`

Show full configuration for a project.

```bash
dbsetup info
dbsetup info myapp
```

---

### `dbsetup remove <project>`

Remove a project from the configuration (prompts for confirmation).

```bash
dbsetup remove myapp
```

---

## Frameworks

| Framework | Default migrate command | Default seed command |
|---|---|---|
| Knex | `npm run migrations` | `npm run seeds` |
| Prisma | `npx prisma migrate deploy` | `npx prisma db seed` |
| Flyway | `flyway migrate` | *(none)* |
| Liquibase | `liquibase update` | *(none)* |
| Django | `python3 manage.py migrate` | `python3 manage.py loaddata fixtures/` |
| Alembic | `alembic upgrade head` | *(none)* |
| Laravel | `php artisan migrate` | `php artisan db:seed` |
| Custom | *(user-defined)* | *(user-defined)* |

All commands are editable during `configure` — the framework selection just fills in sensible defaults.

## Example `.env` (default var names)

```env
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=myapp_dev
DB_USER=postgres
DB_PASSWORD=secret
```

Env var names are configurable per project if yours differ (e.g. `DATABASE_URL`, `PGUSER`, etc.).
