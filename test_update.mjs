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
  let authData = await login.json();
  if (authData.error) {
     const login2 = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin', password: 'password123' })
     });
     authData = await login2.json();
  }
  
  if (!authData.access_token) return console.log("Login failed");
  const token = authData.access_token;
  
  const payload = [
     {
         match_id: 'eb7db9ed-cc09-4171-aa34-dc3989c6d4ba', // fake match? we don't know the match.
         // wait I cannot easily test upsert without knowing a real match and player ID.
     }
  ]
  console.log("Logged in!");
}
run();
