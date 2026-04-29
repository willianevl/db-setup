#!/usr/bin/env node
import { program } from 'commander';
import { configureCommand } from '../src/commands/configure.js';
import { runCommand } from '../src/commands/run.js';
import { listCommand } from '../src/commands/list.js';
import { removeCommand } from '../src/commands/remove.js';
import { infoCommand } from '../src/commands/info.js';

program
  .name('dbsetup')
  .description('Drop, recreate, migrate and seed a configured project database')
  .version('0.1.0');

program
  .command('configure')
  .alias('config')
  .description('Add or edit a project configuration')
  .option('-p, --project <name>', 'jump directly to a project (creates it if new, edits if existing)')
  .action(configureCommand);

program
  .command('list')
  .description('List all configured projects')
  .action(listCommand);

program
  .command('info [project]')
  .description('Show full configuration for a project')
  .action(infoCommand);

program
  .command('remove <project>')
  .description('Remove a project from configuration')
  .action(removeCommand);

// Default command — supports both:
//   dbsetup run myapp dev
//   dbsetup myapp dev
//   dbsetup myapp feature/my-branch
program
  .command('run [project] [env]', { isDefault: true })
  .description('Drop, recreate, migrate and seed a project database')
  .option('-p, --project <name>', 'project name')
  .option('-e, --env <env>', 'environment (dev/hlg/prod) or a branch name')
  .option('--skip-seed', 'skip the seed step')
  .option('--migrate-only', 'skip drop/recreate and seed — only run migrations')
  .option('--dry-run', 'print what would happen without executing anything')
  .option('--backup', 'dump the database before dropping it (saved to ~/db-setup-backups/)')
  .action(runCommand);

program.parse();
