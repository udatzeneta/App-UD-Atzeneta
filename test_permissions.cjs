const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if(k&&v) env[k.trim()] = v.join('=').trim();
});
async function run() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/permissions?select=*`, {
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
  });
  console.log(await res.json());
}
run();
