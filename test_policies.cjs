const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if(k&&v) env[k.trim()] = v.join('=').trim();
});
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_exec_sql`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'role_permissions';" })
  });
  if (!res.ok) {
     console.log(await res.text());
  } else {
     console.log(await res.json());
  }
}
run();
