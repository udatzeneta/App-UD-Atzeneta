// Script maestro para sincronizar plantillas, estadísticas y sanciones FFCV todos los jueves por la mañana
// Uso: node sync_all_ffcv.cjs
// O via npm: npm run sync:all

const { execSync } = require('child_process');

console.log('🚀 [FFCV SYNC] Iniciando sincronización semanal FFCV (Estadísticas, Jugadores y Sanciones)...');

try {
  console.log('\n--- 1/2 Sincronizando Jugadores y Estadísticas FFCV ---');
  execSync('node sync_players_scouting.cjs', { stdio: 'inherit' });

  console.log('\n--- 2/2 Sincronizando Sanciones del Comité FFCV ---');
  execSync('node sync_sanctions_ffcv.cjs', { stdio: 'inherit' });

  console.log('\n✅ [FFCV SYNC] Sincronización semanal completada con éxito.');
} catch (err) {
  console.error('\n❌ [FFCV SYNC] Error durante la sincronización:', err.message);
  process.exit(1);
}
