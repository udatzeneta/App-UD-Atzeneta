const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
globalThis.WebSocket = WebSocket;
const env = Object.fromEntries(fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('=')));
const supabase = createClient(env.VITE_SUPABASE_URL.trim(), env.VITE_SUPABASE_ANON_KEY.trim());

async function run() {
  const { data, error } = await supabase.from('permissions').select('*');
  console.log("Error:", error);
  console.log("Data length:", data ? data.length : 0);
}
run();
