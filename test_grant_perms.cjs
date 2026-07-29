const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if(k&&v) env[k.trim()] = v.join('=').trim();
});
async function run() {
  const rolesRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/roles?select=*`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  console.log('Roles:', await rolesRes.json());
  
  const permRes = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/permissions?page=eq.trainings&action=eq.editar`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  console.log('Permission:', await permRes.json());
}
run();
