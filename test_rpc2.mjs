import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('='))
);

const url = env.VITE_SUPABASE_URL.trim();
const key = env.VITE_SUPABASE_ANON_KEY.trim();

async function run() {
  const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@atzeneta.com', password: 'password123' })
  });
  const authData = await login.json();
  console.log("AuthData:", authData);
}
run();
