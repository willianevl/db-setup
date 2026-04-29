import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const CONFIG_DIR =
  process.platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'db-setup')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'db-setup');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export function readConfig() {
  if (!existsSync(CONFIG_FILE)) return { projects: {} };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    console.error(`Error reading config at ${CONFIG_FILE}`);
    process.exit(1);
  }
}

export function writeConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function expandPath(p) {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

export function compressPath(p) {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}
