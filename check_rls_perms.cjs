const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf-8').split('\n').filter(l => l.includes('=')).map(l => {
  const [k, ...v] = l.split('=');
  if(k&&v) env[k.trim()] = v.join('=').trim();
});
async function run() {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/admin_exec_sql`, {
    method: 'POST',
    headers: { 'apikey': env.SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT * FROM pg_policies WHERE tablename = 'scouting_player_history';" })
  });
  console.log(await res.text());
}
run();
