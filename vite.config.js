import { defineConfig } from 'vite';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/npd-simulation-engine/' : '/',
  plugins: [
    {
      name: 'wechat-cli-api',
      configureServer(server) {
        server.middlewares.use('/api/wechat-history', async (req, res, next) => {
          // req.url is essentially just the path and qs inside middleware
          try {
            const url = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
            const chatName = url.searchParams.get('name');
            const limit = parseInt(url.searchParams.get('limit')) || 200;

            if (!chatName) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: '请提供目标群聊名称或联系人名称' }));
              return;
            }

            // Using pure exec allows us to call a global bin like `wechat-cli`
            console.log(`[Radar] Invoking wechat-cli for Target: ${chatName}, Limit: ${limit}`);
            const command = `wechat-cli history "${chatName}" --limit ${limit} --format text`;
            
            const { stdout, stderr } = await execPromise(command);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ data: stdout }));

          } catch (error) {
            console.error('[Radar] Native Fetch Error:', error.message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              error: '底层环境执行失败！请确认已全局安装 "@canghe_ai/wechat-cli"，且在终端执行过 "sudo wechat-cli init" 完成授权！',
              details: error.message
            }));
          }
        });
      }
    }
  ]
});
