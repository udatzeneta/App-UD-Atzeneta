import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Reads the raw JSON body of an incoming dev-server request
function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Ensure the FFCV serverless handler (which reads process.env directly) has Supabase creds during `vite dev`
  const env = loadEnv(mode, __dirname, '');
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  return {
  plugins: [
    react(),
    {
      name: 'scrape-ffcv-opponent-api',
      configureServer(server: any) {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (req.url === '/api/scrape-ffcv-opponent' && req.method === 'POST') {
            try {
              const body = await readJsonBody(req);
              const handlerModule = await server.ssrLoadModule('/api/scrape-ffcv-opponent.ts');
              const handler = handlerModule.default;

              const fakeReq = { method: 'POST', body, query: {} };
              const fakeRes = {
                _status: 200,
                status(code: number) { this._status = code; return this; },
                json(payload: any) {
                  res.statusCode = this._status;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(payload));
                },
                setHeader() {},
                end() { res.statusCode = this._status; res.end(); },
              };

              await handler(fakeReq, fakeRes);
            } catch (err: any) {
              console.error('[FFCV Dev API] Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Error en scraping de FFCV (dev).' }));
            }
          } else {
            next();
          }
        });
      }
    },
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
    },
    {
      name: 'opponent-scouting-api',
      configureServer(server: any) {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          if (req.url && req.url.startsWith('/api/opponent-scouting') && req.method === 'GET') {
            try {
              const urlObj = new URL(req.url, 'http://localhost');
              const team = urlObj.searchParams.get('team') || '';
              if (!(globalThis as any).WebSocket) {
                // @ts-ignore
                const wsModule: any = await import('ws');
                (globalThis as any).WebSocket = wsModule.default || wsModule;
              }
              const { createClient } = await import('@supabase/supabase-js');
              const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
              const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
              const supabaseAdmin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

              let query = supabaseAdmin
                .from('scouting')
                .select('*')
                .order('created_at', { ascending: false });

              if (team) {
                const words = team
                  .toLowerCase()
                  .replace(/['"’‘´`“”]/g, '')
                  .replace(/\b(c\.?f\.?|c\.?d\.?|u\.?d\.?|s\.?d\.?|a\.?d\.?|f\.?c\.?|at\.?|atlético|atletico)\b/gi, '')
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]/g, ' ')
                  .split(/\s+/)
                  .filter((w: string) => w.length >= 3 && !['club', 'futbol', 'deportivo', 'equipo', 'castellon'].includes(w));

                if (words.length > 0) {
                  const orCondition = words.map((w: string) => `team.ilike.%${w}%`).join(',');
                  query = query.or(orCondition);
                }
              }

              const { data, error } = await query;
              if (error) throw error;
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data || []));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          } else {
            next();
          }
        });
      }
    }
  ]
  };
})
