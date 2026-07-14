const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');

globalThis.WebSocket = WebSocket;

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('='))
);

const supabase = createClient(env.VITE_SUPABASE_URL.trim(), env.VITE_SUPABASE_ANON_KEY.trim());

async function run() {
  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@atzeneta.com',
    password: 'password123' // Is this the right password? We'll find out.
  });

  if (loginErr) {
    console.log("Login error:", loginErr.message);
    // Let's try alternative
    const { data: auth2, error: loginErr2 } = await supabase.auth.signInWithPassword({
        email: 'mister@atzeneta.com',
        password: 'password123'
    });
    if (loginErr2) {
        console.log("Login error 2:", loginErr2.message);
        return;
    }
  }

  console.log("Logged in!");
  const { data, error } = await supabase.rpc('admin_get_users');
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
