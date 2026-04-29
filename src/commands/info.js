import inquirer from 'inquirer';
import { readConfig, compressPath } from '../config.js';

export async function infoCommand(projectArg) {
  const config = readConfig();
  const projectNames = Object.keys(config.projects);

  if (projectNames.length === 0) {
    console.log('No projects configured. Run `db-setup configure` to add one.');
    return;
  }

  let projectName = projectArg;
  if (!projectName) {
    ({ projectName } = await inquirer.prompt([
      { type: 'list', name: 'projectName', message: 'Select a project:', choices: projectNames },
    ]));
  } else if (!config.projects[projectName]) {
    console.error(`Unknown project "${projectName}". Run \`db-setup list\` to see configured projects.`);
    process.exit(1);
  }

  const p = config.projects[projectName];

  console.log(`\nProject:   ${projectName}`);
  console.log(`Path:      ${compressPath(p.path)}`);
  console.log(`DB Type:   ${p.dbType ?? 'postgres'}`);
  console.log(`Framework: ${p.framework}`);
  console.log(`\nCommands:`);
  console.log(`  Migrate: ${p.commands.migrate}`);
  console.log(`  Seed:    ${p.commands.seed || '(none)'}`);
  console.log(`\nEnvironments:`);
  console.log(`  dev  →  ${p.branches.dev}`);
  console.log(`  hlg  →  ${p.branches.hlg}`);
  console.log(`  prod →  ${p.branches.prod}`);
  console.log(`\nEnv Variables:`);
  for (const [key, varName] of Object.entries(p.envVars)) {
    console.log(`  ${key.padEnd(9)} ${varName}`);
  }
  console.log('');
}
