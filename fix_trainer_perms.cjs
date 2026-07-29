const fs = require('fs');
const env = {};
fs.readFileSync('.env', 'utf8').split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if(k&&v) env[k.trim()] = v.join('=').trim();
});

async function run() {
  const perms = [11, 12, 13, 14, 15]; // trainings: ver, crear, editar, eliminar, exportar
  
  for (const pid of perms) {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/role_permissions`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ role_id: 2, permission_id: pid })
    });
    
    if (res.ok) {
      console.log(`Permission ${pid} granted to trainer.`);
    } else {
      console.log(`Error for ${pid}:`, await res.text());
    }
  }
}
run();
