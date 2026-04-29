import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config as dotenvConfig } from 'dotenv';
import inquirer from 'inquirer';
import { readConfig } from '../config.js';
import { gitPrepare, gitRestore, checkBranchExists } from '../git.js';
import { dropAndCreateDatabase } from '../db.js';

const FIXED_ENVS = ['dev', 'hlg', 'prod'];

const KNEXFILE_NAMES = ['knexfile.js', 'knexfile.ts', 'knexfile.cjs', 'knexfile.mjs'];

function fillMissingKnexEnvVars(projectDir, creds) {
  let content = null;
  for (const name of KNEXFILE_NAMES) {
    const p = join(projectDir, name);
    if (existsSync(p)) { content = readFileSync(p, 'utf8'); break; }
  }
  if (!content) return;

  const refs = [...content.matchAll(/process\.env\.(\w+)/g)].map(m => m[1]);
  for (const ref of refs) {
    if (process.env[ref] !== undefined) continue;
    const lower = ref.toLowerCase();
    if (lower.includes('password') || lower.includes('_pwd')) {
      process.env[ref] = creds.password;
    } else if (lower.includes('user') && !lower.includes('password')) {
      process.env[ref] = creds.user;
    } else if (lower.includes('write_host') || (lower.includes('host') && !lower.includes('read'))) {
      process.env[ref] = creds.host;
    } else if (lower.includes('port')) {
      process.env[ref] = String(creds.port);
    } else if (lower.includes('database') || lower.includes('db_name')) {
      process.env[ref] = creds.database;
    }
  }
}

async function resolveEnvOrBranch(envInput, project, projectDir, dryRun) {
  if (FIXED_ENVS.includes(envInput)) {
    return project.branches[envInput];
  }

  if (dryRun) {
    console.log(`  [dry-run] Would verify that remote branch "${envInput}" exists.`);
    return envInput;
  }

  console.log(`  "${envInput}" is not a standard env — checking remote branches...`);
  if (!checkBranchExists(projectDir, envInput)) {
    throw new Error(
      `"${envInput}" is not a valid environment (dev/hlg/prod) and no remote branch named "${envInput}" was found.`
    );
  }
  return envInput;
}

async function promptEnv() {
  const { envOrBranch } = await inquirer.prompt([
    {
      type: 'list',
      name: 'envOrBranch',
      message: 'Select environment:',
      choices: [
        { name: 'dev', value: 'dev' },
        { name: 'hlg', value: 'hlg' },
        { name: 'prod', value: 'prod' },
        { name: 'Enter a branch name...', value: '__custom__' },
      ],
    },
  ]);

  if (envOrBranch !== '__custom__') return envOrBranch;

  const { customBranch } = await inquirer.prompt([
    {
      type: 'input',
      name: 'customBranch',
      message: 'Branch name:',
      validate: (v) => v.trim() !== '' || 'Branch name cannot be empty.',
      filter: (v) => v.trim(),
    },
  ]);
  return customBranch;
}

async function runBackup({ host, port, database, user, password }, projectName, branch, dbType) {
  const backupDir = join(homedir(), 'db-setup-backups');
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = dbType === 'mysql' ? 'sql' : 'dump';
  const backupFile = join(backupDir, `${projectName}-${branch}-${timestamp}.${ext}`);

  console.log(`  Backing up to ${backupFile}...`);
  if (dbType === 'mysql') {
    execSync(`mysqldump -h "${host}" -P ${port} -u "${user}" "${database}" -r "${backupFile}"`, {
      env: { ...process.env, MYSQL_PWD: password },
      stdio: 'inherit',
      shell: true,
    });
  } else {
    execSync(`pg_dump -h "${host}" -p ${port} -U "${user}" -d "${database}" -f "${backupFile}"`, {
      env: { ...process.env, PGPASSWORD: password },
      stdio: 'inherit',
      shell: true,
    });
  }
  console.log(`  Backup saved.`);
}

function printDryRun(projectName, project, branch, creds, { skipSeed, migrateOnly, backup }) {
  const dbType = project.dbType ?? 'postgres';
  console.log(`\n[DRY RUN] Steps for "${projectName}" on branch "${branch}":\n`);
  console.log(`  1. Stash uncommitted changes (if any)`);
  console.log(`  2. git fetch + checkout "${branch}" + pull`);
  if (backup) {
    console.log(`  3. ${dbType === 'mysql' ? 'mysqldump' : 'pg_dump'} → ~/db-setup-backups/${projectName}-${branch}-<timestamp>.${dbType === 'mysql' ? 'sql' : 'dump'}`);
  }
  if (!migrateOnly) {
    console.log(`  ${backup ? 4 : 3}. DROP DATABASE "${creds?.dbName ?? project.envVars.name}"`);
    console.log(`  ${backup ? 5 : 4}. CREATE DATABASE "${creds?.dbName ?? project.envVars.name}"`);
  }
  const nextStep = (migrateOnly ? 3 : (backup ? 6 : 5));
  console.log(`  ${nextStep}. Run: ${project.commands.migrate}`);
  if (!skipSeed && !migrateOnly && project.commands.seed) {
    console.log(`  ${nextStep + 1}. Run: ${project.commands.seed}`);
  }
  console.log(`  ${nextStep + ((!skipSeed && !migrateOnly && project.commands.seed) ? 2 : 1)}. Restore git state\n`);
}

function loadCredentials(project, projectDir) {
  const envFile = join(projectDir, '.env');
  if (!existsSync(envFile)) throw new Error(`.env not found in ${projectDir}`);

  const { parsed } = dotenvConfig({ path: envFile, override: true });
  if (!parsed) throw new Error(`Could not parse .env at ${envFile}`);

  const v = project.envVars;
  const dbType = project.dbType ?? 'postgres';
  const dbHost     = parsed[v.host]     || 'localhost';
  const dbPort     = parsed[v.port]     || (dbType === 'mysql' ? '3306' : '5432');
  const dbName     = parsed[v.name]     || '';
  const dbUser     = parsed[v.user]     || (dbType === 'mysql' ? 'root' : 'postgres');
  const dbPassword = parsed[v.password] || '';

  if (!dbName) throw new Error(`Env var "${v.name}" is not set in ${envFile}`);

  return { host: dbHost, port: dbPort, database: dbName, user: dbUser, password: dbPassword };
}

export async function runCommand(projectArg, envArg, opts) {
  const { skipSeed, migrateOnly, dryRun, backup } = opts;
  const config = readConfig();
  const projectNames = Object.keys(config.projects);

  if (projectNames.length === 0) {
    console.error('No projects configured. Run `db-setup configure` first.');
    process.exit(1);
  }

  let projectName = projectArg ?? opts.project;
  if (!projectName) {
    ({ projectName } = await inquirer.prompt([
      { type: 'list', name: 'projectName', message: 'Select a project:', choices: projectNames },
    ]));
  } else if (!config.projects[projectName]) {
    console.error(`Unknown project "${projectName}". Run \`db-setup list\` to see configured projects.`);
    process.exit(1);
  }

  const project = config.projects[projectName];
  const projectDir = project.path;

  if (!existsSync(projectDir)) {
    console.error(`Project directory not found: ${projectDir}`);
    process.exit(1);
  }

  const envInput = envArg ?? opts.env ?? await promptEnv();

  let branch;
  try {
    branch = await resolveEnvOrBranch(envInput, project, projectDir, dryRun);
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }

  if (dryRun) {
    printDryRun(projectName, project, branch, null, { skipSeed, migrateOnly, backup });
    return;
  }

  const gitState = gitPrepare(projectDir, branch);

  try {
    const creds = loadCredentials(project, projectDir);
    const dbType = project.dbType ?? 'postgres';

    if (project.framework === 'knex') fillMissingKnexEnvVars(projectDir, creds);

    console.log('\n======================================================');
    console.log(`  ${'Project:'.padEnd(14)} ${projectName}`);
    console.log(`  ${'Branch:'.padEnd(14)} ${branch}`);
    console.log(`  ${'DB Type:'.padEnd(14)} ${dbType}`);
    console.log(`  ${'Host:'.padEnd(14)} ${creds.host}:${creds.port}`);
    console.log(`  ${'DB name:'.padEnd(14)} ${creds.database}`);
    console.log(`  ${'User:'.padEnd(14)} ${creds.user}`);
    if (migrateOnly)  console.log(`  ${'Mode:'.padEnd(14)} migrate-only (no drop/recreate)`);
    if (skipSeed)     console.log(`  ${'Mode:'.padEnd(14)} skip seed`);
    console.log('======================================================');

    if (backup) {
      console.log('\n→ backup:  creating dump before drop...');
      try {
        await runBackup(creds, projectName, branch, dbType);
      } catch (err) {
        console.warn(`  Warning: backup failed — ${err.message}`);
        console.warn('  Continuing without backup...');
      }
    }

    if (!migrateOnly) {
      console.log(`\n→ db:      dropping "${creds.database}"...`);
      console.log(`→ db:      creating "${creds.database}"...`);
      await dropAndCreateDatabase({ ...creds, dbType });
    }

    const execOpts = { cwd: projectDir, stdio: 'inherit', shell: true };

    console.log(`\n→ migrate: ${project.commands.migrate}`);
    execSync(project.commands.migrate, execOpts);

    if (!skipSeed && !migrateOnly && project.commands.seed) {
      console.log(`\n→ seed:    ${project.commands.seed}`);
      execSync(project.commands.seed, execOpts);
    } else if (project.commands.seed && (skipSeed || migrateOnly)) {
      console.log(`\n→ seed:    skipped`);
    }

    console.log('\n======================================================');
    console.log(`  Done. "${projectName}" is ready on branch "${branch}".`);
    console.log('======================================================\n');
  } catch (err) {
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  } finally {
    try {
      gitRestore(projectDir, gitState);
    } catch (err) {
      console.warn(`  Warning: could not restore git state — ${err.message}`);
    }
  }
}
