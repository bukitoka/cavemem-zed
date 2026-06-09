import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readJsonc, writeJsonWithBackup } from './fs-utils.js';
import type { InstallContext, Installer } from './types.js';

interface ZedContextServer {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface ZedSettings {
  context_servers?: Record<string, ZedContextServer>;
  [key: string]: unknown;
}

function configRoot(): string {
  // Zed uses ~/.config/zed/ on all platforms (macOS, Linux, Windows via env).
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ? join(xdg, 'zed') : join(homedir(), '.config', 'zed');
  return base;
}

function settingsFile(): string {
  return join(configRoot(), 'settings.json');
}

export const zed: Installer = {
  id: 'zed',
  label: 'Zed',
  async detect(_ctx: InstallContext): Promise<boolean> {
    return existsSync(configRoot());
  },
  async install(ctx: InstallContext): Promise<string[]> {
    const path = settingsFile();

    // Read existing settings with JSONC support — Zed settings.json can
    // contain comments (// and /* */) which JSON.parse cannot handle.
    const current = readJsonc<ZedSettings>(path, {});

    // Migrate: remove stale mcp_servers.cavemem if present (Zed no longer
    // uses the mcp_servers key — context_servers is the canonical location).
    const oldMcp = current.mcp_servers as Record<string, unknown> | undefined;
    if (oldMcp) {
      delete oldMcp.cavemem;
      if (Object.keys(oldMcp).length === 0) {
        delete current.mcp_servers;
      }
    }

    // Merge cavemem into context_servers, preserving any existing entries.
    const servers: Record<string, ZedContextServer> = current.context_servers ?? {};
    servers.cavemem = {
      command: ctx.nodeBin,
      args: [ctx.cliPath, 'serve'],
    };
    const next: ZedSettings = { ...current, context_servers: servers };

    // Backup before write so the user can always recover.
    writeJsonWithBackup(path, next);
    return [`wrote ${path}`];
  },
  async uninstall(_ctx: InstallContext): Promise<string[]> {
    const path = settingsFile();
    const current = readJsonc<ZedSettings>(path, {});
    if (current.context_servers) {
      delete current.context_servers.cavemem;
      if (Object.keys(current.context_servers).length === 0) {
        delete current.context_servers;
      }
    }
    writeJsonWithBackup(path, current);
    return [`updated ${path}`];
  },
};
