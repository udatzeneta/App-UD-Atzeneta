import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter(line => line.includes('='))
    .map(line => line.split('='))
);

const supabaseUrl = env.VITE_SUPABASE_URL.trim();
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY.trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'admin@atzeneta.com',
    password: 'password123'
  });
  
  if (authError) {
    console.error("Login failed:", authError.message);
    return;
  }
  
  console.log("Logged in as:", authData.user.email);
  
  const { data, error } = await supabase.rpc('admin_get_users');
  console.log("RPC result:", data);
  if (error) console.error("RPC error:", error);
}

test();
