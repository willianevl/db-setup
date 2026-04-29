import inquirer from 'inquirer';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { readConfig, writeConfig, expandPath, compressPath } from '../config.js';
import { FRAMEWORK_CHOICES, FRAMEWORKS } from '../frameworks.js';

const KNEXFILE_NAMES = ['knexfile.js', 'knexfile.ts', 'knexfile.cjs', 'knexfile.mjs'];

function detectEnvVarsFromKnexfile(projectPath) {
  let content = null;
  for (const name of KNEXFILE_NAMES) {
    const p = join(projectPath, name);
    if (existsSync(p)) { content = readFileSync(p, 'utf8'); break; }
  }
  if (!content) return null;

  const refs = [...content.matchAll(/process\.env\.(\w+)/g)].map(m => m[1]);
  const result = {};
  for (const ref of refs) {
    const lower = ref.toLowerCase();
    if (!result.password && (lower.includes('password') || lower.includes('_pwd'))) {
      result.password = ref;
    } else if (!result.user && lower.includes('user') && !lower.includes('password')) {
      result.user = ref;
    } else if (!result.host && lower.includes('write_host')) {
      result.host = ref;
    } else if (!result.host && lower.includes('host') && !lower.includes('read')) {
      result.host = ref;
    } else if (!result.port && lower.includes('port')) {
      result.port = ref;
    } else if (!result.name && (lower.includes('database') || lower.includes('db_name'))) {
      result.name = ref;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

const BRANCH_DEFAULTS = { dev: 'development', hlg: 'staging', prod: 'main' };

const DB_TYPE_CHOICES = [
  { name: 'PostgreSQL', value: 'postgres' },
  { name: 'MySQL / MariaDB', value: 'mysql' },
];

export async function configureCommand(opts) {
  const config = readConfig();
  const existingProjects = Object.keys(config.projects);

  let projectName = opts.project?.trim();
  let defaults = {};

  if (projectName) {
    defaults = config.projects[projectName] ?? {};
  } else {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What do you want to do?',
        choices: [
          { name: 'Add a new project', value: 'add' },
          ...(existingProjects.length > 0
            ? [{ name: 'Edit an existing project', value: 'edit' }]
            : []),
        ],
      },
    ]);

    if (action === 'edit') {
      ({ projectName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'projectName',
          message: 'Select a project to edit:',
          choices: existingProjects,
        },
      ]));
      defaults = config.projects[projectName];
    } else {
      ({ projectName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name (used as identifier in CLI):',
          validate: (v) => {
            if (!v.trim()) return 'Project name cannot be empty.';
            if (config.projects[v.trim()]) return `"${v.trim()}" already exists. Choose "edit" to update it.`;
            return true;
          },
          filter: (v) => v.trim(),
        },
      ]));
    }
  }

  const { projectPath, dbType, framework } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectPath',
      message: 'Project path (absolute or ~/...):',
      default: defaults.path ? compressPath(defaults.path) : undefined,
      validate: (v) => {
        const expanded = expandPath(v.trim());
        if (!existsSync(expanded)) return `Directory not found: ${expanded}`;
        return true;
      },
      filter: (v) => expandPath(v.trim()),
    },
    {
      type: 'list',
      name: 'dbType',
      message: 'Database type:',
      choices: DB_TYPE_CHOICES,
      default: defaults.dbType ?? 'postgres',
    },
    {
      type: 'list',
      name: 'framework',
      message: 'Migration framework:',
      choices: FRAMEWORK_CHOICES,
      default: defaults.framework,
    },
  ]);

  // Warn if .env is missing, but don't block
  const envFile = join(projectPath, '.env');
  if (!existsSync(envFile)) {
    console.warn(`  Warning: no .env file found in ${projectPath}. Make sure it exists before running db-setup.`);
  }

  const frameworkDefaults = FRAMEWORKS[framework];

  const { migrateCommand, seedCommand } = await inquirer.prompt([
    {
      type: 'input',
      name: 'migrateCommand',
      message: 'Migrate command:',
      default: defaults.commands?.migrate ?? frameworkDefaults.migrate,
      validate: (v) => v.trim() !== '' || 'Migrate command cannot be empty.',
      filter: (v) => v.trim(),
    },
    {
      type: 'input',
      name: 'seedCommand',
      message: 'Seed command (leave blank to skip seeding):',
      default: defaults.commands?.seed ?? frameworkDefaults.seed,
      filter: (v) => v.trim(),
    },
  ]);

  console.log('\nBranch mapping for each environment:');
  const branchAnswers = await inquirer.prompt(
    ['dev', 'hlg', 'prod'].map((env) => ({
      type: 'input',
      name: env,
      message: `  ${env} branch:`,
      default: defaults.branches?.[env] ?? BRANCH_DEFAULTS[env],
      validate: (v) => v.trim() !== '' || 'Branch name cannot be empty.',
      filter: (v) => v.trim(),
    }))
  );

  const FALLBACK_ENV_VAR_DEFAULTS = { host: 'DB_HOST', port: 'DB_PORT', name: 'DB_DATABASE', user: 'DB_USER', password: 'DB_PASSWORD' };
  const detected = framework === 'knex' ? detectEnvVarsFromKnexfile(projectPath) : null;
  if (detected) {
    console.log('\nEnvironment variable names (auto-detected from knexfile):');
  } else {
    console.log('\nEnvironment variable names (from the project .env file):');
  }
  const envVarAnswers = await inquirer.prompt(
    Object.entries(FALLBACK_ENV_VAR_DEFAULTS).map(([key, defaultVar]) => ({
      type: 'input',
      name: key,
      message: `  ${key}:`,
      default: defaults.envVars?.[key] ?? detected?.[key] ?? defaultVar,
      validate: (v) => v.trim() !== '' || 'Variable name cannot be empty.',
      filter: (v) => v.trim(),
    }))
  );

  config.projects[projectName] = {
    path: projectPath,
    dbType,
    framework,
    commands: { migrate: migrateCommand, seed: seedCommand },
    branches: branchAnswers,
    envVars: envVarAnswers,
  };

  writeConfig(config);
  console.log(`\nProject "${projectName}" saved.`);
}
