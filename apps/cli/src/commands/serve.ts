import type { Command } from 'commander';

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description(
      'MCP server with automatic session lifecycle and agent-driven recording tools (typically invoked by the IDE)',
    )
    .action(async () => {
      const { MemoryStore, createSessionId } = await import('@cavemem/core');
      const { loadSettings, resolveDataDir } = await import('@cavemem/config');
      const { buildServer } = await import('@cavemem/mcp-server');
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');

      const settings = loadSettings();
      const { join } = await import('node:path');
      const dbPath = join(resolveDataDir(settings.dataDir), 'data.db');
      const store = new MemoryStore({ dbPath, settings });

      // Generate a session ID and start the session.
      // This ties the MCP server's lifetime to a cavemem session:
      // when Zed launches the context server, a session begins.
      const sessionId = createSessionId();
      store.startSession({
        id: sessionId,
        ide: 'zed',
        cwd: process.cwd(),
      });

      process.stderr.write(`${JSON.stringify({ ok: true, event: 'session-start', sessionId })}\n`);

      // Build the MCP server with recording tools enabled.
      const server = buildServer(store, settings, sessionId);

      // On shutdown, end the session.
      const endSession = () => {
        store.endSession(sessionId);
        store.close();
        process.stderr.write(`${JSON.stringify({ ok: true, event: 'session-end', sessionId })}\n`);
      };

      process.on('SIGTERM', () => {
        endSession();
        process.exit(0);
      });
      process.on('SIGINT', () => {
        endSession();
        process.exit(0);
      });
      process.on('exit', () => {
        // Best-effort close when stdio hangs up (Zed kills the process).
        try {
          store.endSession(sessionId);
          store.close();
        } catch {
          // Silently ignore — process is exiting.
        }
      });

      const transport = new StdioServerTransport();
      await server.connect(transport);
    });
}
