import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'local-persistence-server',
        configureServer(server) {
          // Create a simple API middleware to Read/Write a local JSON file
          server.middlewares.use('/api/db', (req, res, next) => {
            const dbPath = path.resolve('credit_insight_db.json');
            
            if (req.method === 'GET') {
              try {
                if (fs.existsSync(dbPath)) {
                  const data = fs.readFileSync(dbPath, 'utf-8');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(data);
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.end('[]');
                }
              } catch (err) {
                console.error('DB Read Error:', err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Failed to read database' }));
              }
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', () => {
                try {
                  // Ensure valid JSON
                  JSON.parse(body);
                  fs.writeFileSync(dbPath, body);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true }));
                } catch (err) {
                  console.error('DB Write Error:', err);
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: 'Failed to write database' }));
                }
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    define: {
      // Polyfill process.env.API_KEY for browser usage
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    server: {
      host: true, // Exposes the server to the network (0.0.0.0)
      port: 3000
    }
  };
});