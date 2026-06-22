import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const apiMiddleware = () => ({
  name: 'api-middleware',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url?.startsWith('/api/')) {
        try {
          // Parse query string
          const url = new URL(req.url, `http://${req.headers.host}`);
          req.query = Object.fromEntries(url.searchParams);
          
          // Polyfill Vercel's res.status and res.json
          res.status = (code: number) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data: any) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
          };

          // Find the handler
          const route = url.pathname.replace('/api/', ''); // e.g., 'stream'
          // We use ssrLoadModule so Vite transpiles ES modules correctly
          const handlerModule = await server.ssrLoadModule(`/api/${route}.js`);
          await handlerModule.default(req, res);
        } catch (err: any) {
          console.error('Local API Error:', err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      } else {
        next();
      }
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiMiddleware()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
