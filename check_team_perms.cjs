const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: perms, error: err1 } = await supabase.from('permissions').select('*').eq('page', 'team');
  console.log('Permissions for team:', perms);
  
  if (perms && perms.length > 0) {
    const permIds = perms.map(p => p.id);
    const { data: rp, error: err2 } = await supabase.from('role_permissions').select('*').in('permission_id', permIds);
    console.log('Role Permissions:', rp);
  }
}

run();
