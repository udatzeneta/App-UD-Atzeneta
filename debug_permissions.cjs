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
  const permRes = await fetch(`${SUPABASE_URL}/rest/v1/permissions?page=eq.fines`, { headers });
  const permissions = await permRes.json();
  console.log("Permissions for fines:", permissions);

  const rpRes = await fetch(`${SUPABASE_URL}/rest/v1/role_permissions`, { headers });
  const rolePerms = await rpRes.json();
  
  for (const p of permissions) {
     const assignedRoles = rolePerms.filter(rp => rp.permission_id === p.id).map(rp => rp.role_id);
     console.log(`Permission ${p.action} (id: ${p.id}) is assigned to roles:`, assignedRoles);
  }
}
debug();
