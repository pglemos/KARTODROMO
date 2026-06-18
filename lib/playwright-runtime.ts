import { existsSync } from 'node:fs';

const WINDOWS_SYSTEM_PATHS = ['C:\\Windows\\System32', 'C:\\Windows', 'C:\\Windows\\System32\\Wbem'];

const INSTALLED_BROWSER_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

function isPlaywrightHeadlessShell(path: string): boolean {
  return path.toLowerCase().includes('chrome-headless-shell.exe');
}

export function ensureWindowsSystemPath(): void {
  if (process.platform !== 'win32') return;

  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') || 'Path';
  const currentPath = process.env[pathKey] || '';
  const currentParts = new Set(currentPath.split(';').map((part) => part.trim().toLowerCase()).filter(Boolean));
  const missingPaths = WINDOWS_SYSTEM_PATHS.filter((path) => !currentParts.has(path.toLowerCase()));

  if (missingPaths.length === 0) return;

  process.env[pathKey] = [currentPath, ...missingPaths].filter(Boolean).join(';');
  process.env.PATH = process.env[pathKey];
}

export function resolvePreferredBrowserExecutablePath(configuredPath?: string): string | undefined {
  if (configuredPath && existsSync(configuredPath) && !isPlaywrightHeadlessShell(configuredPath)) {
    return configuredPath;
  }

  const installedBrowser = INSTALLED_BROWSER_CANDIDATES.find((candidate) => existsSync(candidate));
  if (installedBrowser) return installedBrowser;

  if (configuredPath && existsSync(configuredPath)) return configuredPath;
  return undefined;
}
