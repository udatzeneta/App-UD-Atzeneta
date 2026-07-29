const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;
const env = Object.fromEntries(fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL.trim(), env.VITE_SUPABASE_ANON_KEY.trim());

async function run() {
  await supabase.auth.signInWithPassword({ email: 'admin@atzeneta.com', password: 'password123' });
  const { error } = await supabase.from('role_permissions').insert({ role_id: 2, permission_id: 48 });
  console.log("Insert Error:", error ? error.message : "Success");
}
run();
