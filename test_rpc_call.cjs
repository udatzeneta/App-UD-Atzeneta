const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;
const env = Object.fromEntries(fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL.trim(), env.VITE_SUPABASE_ANON_KEY.trim());

async function run() {
  await supabase.auth.signInWithPassword({ email: 'admin@atzeneta.com', password: 'password123' });
  const { data, error } = await supabase.rpc('admin_update_role_permission', {
    p_role_id: 2,
    p_permission_id: 13,
    p_grant: true
  });
  console.log("RPC Error:", error ? error.message : "Success");
}
run();
