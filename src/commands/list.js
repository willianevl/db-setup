import { readConfig, compressPath } from '../config.js';

export function listCommand() {
  const config = readConfig();
  const projects = Object.entries(config.projects);

  if (projects.length === 0) {
    console.log('No projects configured. Run `db-setup configure` to add one.');
    return;
  }

  console.log(`\nConfigured projects (${projects.length}):\n`);

  const nameWidth = Math.max(...projects.map(([n]) => n.length), 7);
  const pathWidth = Math.max(...projects.map(([, p]) => compressPath(p.path).length), 4);
  const fwWidth   = Math.max(...projects.map(([, p]) => p.framework.length), 9);

  console.log(`  ${'PROJECT'.padEnd(nameWidth)}   ${'PATH'.padEnd(pathWidth)}   ${'FRAMEWORK'.padEnd(fwWidth)}   DB TYPE`);
  console.log(`  ${'-'.repeat(nameWidth)}   ${'-'.repeat(pathWidth)}   ${'-'.repeat(fwWidth)}   -------`);

  for (const [name, project] of projects) {
    console.log(
      `  ${name.padEnd(nameWidth)}   ${compressPath(project.path).padEnd(pathWidth)}   ${project.framework.padEnd(fwWidth)}   ${project.dbType ?? 'postgres'}`
    );
  }

  console.log('');
}
