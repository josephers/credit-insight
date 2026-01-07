import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'local-persistence-server',
        configureServer(server) {
          // Middleware for DB (Sessions)
          server.middlewares.use('/api/db', (req, res, next) => {
            const dbPath = path.resolve('credit_insight_db.json');
            handleJsonFileRequest(req, res, next, dbPath);
          });

          // Middleware for Settings (Terms & Benchmarks)
          server.middlewares.use('/api/settings', (req, res, next) => {
            const settingsPath = path.resolve('credit_insight_settings.json');
            handleJsonFileRequest(req, res, next, settingsPath);
          });

          // Middleware for Azure Auth Token
          server.middlewares.use('/api/auth/azure-token', async (req, res, next) => {
            try {
              // Dynamically import @azure/identity so build doesn't fail if user hasn't installed it yet
              // This allows the app to function with just API Keys if preferred.
              const { DefaultAzureCredential } = await import('@azure/identity');
              
              const credential = new DefaultAzureCredential();
              // The scope for Azure OpenAI is strictly the Cognitive Services endpoint
              const scope = "https://cognitiveservices.azure.com/.default";
              
              console.log("Refreshing Azure Access Token via DefaultAzureCredential...");
              const tokenResponse = await credential.getToken(scope);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                token: tokenResponse.token, 
                expiresOn: tokenResponse.expiresOnTimestamp 
              }));
            } catch (err: any) {
              // If package is missing or auth fails, return 500 so frontend falls back to ENV var
              const msg = err.code === 'ERR_MODULE_NOT_FOUND' 
                ? "Missing @azure/identity package." 
                : err.message;
              
              console.warn("Azure Token Refresh Failed:", msg);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: msg }));
            }
          });
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.API_KEY),
      'process.env.AZURE_OPENAI_ENDPOINT': JSON.stringify(env.AZURE_OPENAI_ENDPOINT),
      'process.env.AZURE_OPENAI_API_KEY': JSON.stringify(env.AZURE_OPENAI_API_KEY),
      'process.env.AZURE_OPENAI_AD_TOKEN': JSON.stringify(env.AZURE_OPENAI_AD_TOKEN),
      'process.env.AZURE_OPENAI_DEPLOYMENT': JSON.stringify(env.AZURE_OPENAI_DEPLOYMENT)
    },
    server: {
      host: true,
      port: 3000
    }
  };
});

// Helper for reading/writing JSON files
function handleJsonFileRequest(req: any, res: any, next: any, filePath: string) {
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        res.setHeader('Content-Type', 'application/json');
        res.end(data);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.end('null'); // Return null if no file exists
      }
    } catch (err) {
      console.error(`Read Error (${filePath}):`, err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Failed to read file' }));
    }
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        JSON.parse(body); // Validate JSON
        fs.writeFileSync(filePath, body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error(`Write Error (${filePath}):`, err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Failed to write file' }));
      }
    });
  } else {
    next();
  }
}