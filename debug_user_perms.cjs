const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Prefer': 'return=representation' };

async function debug() {
  const upRes = await fetch(`${SUPABASE_URL}/rest/v1/user_permissions?select=*,profiles!inner(full_name),permissions!inner(*)`, { headers });
  const userPerms = await upRes.json();
  console.log("User permissions:", JSON.stringify(userPerms, null, 2));
}
debug();
