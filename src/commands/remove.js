import inquirer from 'inquirer';
import { readConfig, writeConfig } from '../config.js';

export async function removeCommand(projectName) {
  const config = readConfig();

  if (!config.projects[projectName]) {
    console.error(`Project "${projectName}" not found. Run \`db-setup list\` to see configured projects.`);
    process.exit(1);
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Remove project "${projectName}" from configuration?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log('Cancelled.');
    return;
  }

  delete config.projects[projectName];
  writeConfig(config);
  console.log(`Project "${projectName}" removed.`);
}
