import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => l.split('='))
);

const supabase = createClient(env.VITE_SUPABASE_URL.trim(), env.VITE_SUPABASE_ANON_KEY.trim());

async function run() {
  const { data: auth, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@atzeneta.com',
    password: 'password123'
  });

  if (loginErr) {
    console.log("Login error:", loginErr.message);
    const { data: auth2, error: loginErr2 } = await supabase.auth.signInWithPassword({
        email: 'admin', // Maybe username? Usually email
        password: 'password123'
    });
    if (loginErr2) return console.log("Login error 2:", loginErr2.message);
  }

  console.log("Logged in!");
  const { data, error } = await supabase.rpc('admin_get_users');
  console.log("Data:", data);
  console.log("Error:", error);
}

run();
