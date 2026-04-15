import { defineConfig } from 'vite';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const WECHAT_CMD = `echo "1" | PATH="/opt/homebrew/bin:/usr/local/bin:$PATH" npx --yes @canghe_ai/wechat-cli`;
const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 10 }; // 10MB

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/npd-simulation-engine/' : '/',
  plugins: [
    {
      name: 'wechat-cli-api',
      configureServer(server) {

        // ── /api/wechat-sessions ──────────────────────────────────────────
        // Lists all recent WeChat sessions (groups & contacts) as JSON array
        server.middlewares.use('/api/wechat-sessions', async (req, res) => {
          try {
            console.log('[Radar] Fetching sessions list...');
            const command = `${WECHAT_CMD} sessions --limit 80 --format json`;
            const { stdout } = await execPromise(command, EXEC_OPTS);

            // Parse the JSON output from wechat-cli
            let sessions = [];
            try {
              sessions = JSON.parse(stdout);
            } catch {
              // wechat-cli might output plain text lines instead of JSON
              sessions = stdout.split('\n')
                .filter(l => l.trim())
                .map(l => ({ name: l.trim(), is_group: true }));
            }

            // Only return groups (filter by name length > 1 or is_group flag)
            const groups = sessions.filter(s =>
              s.is_group === true || s.chat_type === 'group' ||
              (s.name && s.name.length > 0)
            );

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ sessions: groups }));
          } catch (error) {
            console.error('[Radar] Sessions Error:', error.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message }));
          }
        });

        // ── /api/wechat-history ───────────────────────────────────────────
        // Fetches chat history for a given room name with optional date range
        server.middlewares.use('/api/wechat-history', async (req, res) => {
          try {
            const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
            const chatName  = url.searchParams.get('name');
            const limit     = parseInt(url.searchParams.get('limit')) || 300;
            const startDate = url.searchParams.get('startDate'); // e.g. "2026-04-08"

            if (!chatName) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: '请提供目标群聊名称' }));
              return;
            }

            const startFlag = startDate ? ` --start-time "${startDate}"` : '';
            console.log(`[Radar] history: "${chatName}" limit=${limit} start=${startDate || 'none'}`);

            const command = `${WECHAT_CMD} history "${chatName}" --limit ${limit} --format text${startFlag}`;
            const { stdout } = await execPromise(command, EXEC_OPTS);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data: stdout }));
          } catch (error) {
            console.error('[Radar] History Error:', error.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              error: '底层执行失败。请确认已运行 sudo wechat-cli init 完成授权。',
              details: error.message
            }));
          }
        });

      }
    }
  ]
});
