import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sync-matches-api',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url === '/api/sync-matches') {
            console.log('Executing sync_matches_supabase.cjs...');
            
            const scriptPath = path.resolve(__dirname, 'sync_matches_supabase.cjs');
            exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
              res.setHeader('Content-Type', 'application/json');
              if (error) {
                console.error(`Error executing script: ${error.message}`);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
              }
              console.log(`Script finished successfully:\n${stdout}`);
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, stdout }));
            });
          } else {
            next();
          }
        });
      }
    }
  ]
})
