const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let serviceRoleKey = '';

envFile.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) serviceRoleKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('Inserting team permissions...');
  
  const actions = ['ver', 'crear', 'editar', 'eliminar', 'exportar'];
  
  for (const action of actions) {
    const { data, error } = await supabase
      .from('permissions')
      .upsert({ page: 'team', action, description: `Permiso para ${action} en la página team` }, { onConflict: 'page,action' })
      .select();
      
    if (error) {
      console.error('Error inserting permission:', error);
    } else {
      console.log('Inserted:', data[0]);
    }
  }

  // Fetch inserted permissions to get their IDs
  const { data: perms } = await supabase.from('permissions').select('*').eq('page', 'team');
  console.log('Fetched permissions:', perms.map(p => ({ id: p.id, action: p.action })));

  const permVer = perms.find(p => p.action === 'ver').id;
  const permCrear = perms.find(p => p.action === 'crear').id;
  const permEditar = perms.find(p => p.action === 'editar').id;
  const permEliminar = perms.find(p => p.action === 'eliminar').id;
  const permExportar = perms.find(p => p.action === 'exportar').id;

  const rolePerms = [
    // Admin (1) - all
    { role_id: 1, permission_id: permVer },
    { role_id: 1, permission_id: permCrear },
    { role_id: 1, permission_id: permEditar },
    { role_id: 1, permission_id: permEliminar },
    { role_id: 1, permission_id: permExportar },
    // Trainer (2) - all
    { role_id: 2, permission_id: permVer },
    { role_id: 2, permission_id: permCrear },
    { role_id: 2, permission_id: permEditar },
    { role_id: 2, permission_id: permEliminar },
    { role_id: 2, permission_id: permExportar },
    // Player (3) - ver only
    { role_id: 3, permission_id: permVer },
    // Board (4) - ver, exportar
    { role_id: 4, permission_id: permVer },
    { role_id: 4, permission_id: permExportar }
  ];

  for (const rp of rolePerms) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert(rp, { onConflict: 'role_id,permission_id' });
    if (error) {
      console.error('Error assigning role permission:', error);
    } else {
      console.log('Assigned role', rp.role_id, 'to perm', rp.permission_id);
    }
  }
  
  console.log('Done!');
}

run();
