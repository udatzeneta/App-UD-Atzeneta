import { 
  Role, Profile, Permission, Training, Match, Fine, PointLog, 
  ScoutingPlayer, OpponentAnalysis, Settings, RolePermission, UserPermission,
  TrainingAttendance, Player, PlayerWeight, PlayerPhysioRecord, PlayerInjury, PlayerMatchStats
} from '../types';

// Versión del esquema de datos mock. Incrementar cuando cambien PAGES o la estructura.
const MOCK_DATA_VERSION = '10';

// IDs fijos para los perfiles Mock
export const MOCK_USER_IDS = {
  admin: 'mock-uuid-admin-0000-000000000001',
  trainer: 'mock-uuid-trainer-0000-000000000002',
  player: 'mock-uuid-player-0000-000000000003',
  board: 'mock-uuid-board-0000-000000000004',
  player2: 'mock-uuid-player-0000-000000000005',
  player3: 'mock-uuid-player-0000-000000000006',
  udatzenetaAdmin: 'mock-uuid-udatzeneta-admin-0001',
};

// 1. Roles por defecto
const DEFAULT_ROLES: Role[] = [
  { id: 1, name: 'Administrador', slug: 'admin' },
  { id: 2, name: 'Entrenador', slug: 'trainer' },
  { id: 3, name: 'Jugador', slug: 'player' },
  { id: 4, name: 'Directivo', slug: 'board' },
];

// 2. Páginas y acciones para permisos
const PAGES = ['dashboard', 'calendar', 'trainings', 'matches', 'fines', 'points', 'scouting', 'opponent_analysis', 'settings', 'permissions', 'attendance', 'players'];
const ACTIONS: ('ver' | 'crear' | 'editar' | 'eliminar' | 'exportar')[] = ['ver', 'crear', 'editar', 'eliminar', 'exportar'];

const generatePermissions = (): Permission[] => {
  const list: Permission[] = [];
  let id = 1;
  for (const page of PAGES) {
    for (const action of ACTIONS) {
      list.push({
        id: id++,
        page,
        action,
        description: `Permiso para ${action} en la página ${page}`
      });
    }
  }
  return list;
};

const DEFAULT_PERMISSIONS = generatePermissions();

// 3. Permisos de Roles por defecto
const generateDefaultRolePermissions = (perms: Permission[]): { role_id: number; permission_id: number }[] => {
  const mappings: { role_id: number; permission_id: number }[] = [];
  
  for (const p of perms) {
    // Admin (Rol 1) tiene todo
    mappings.push({ role_id: 1, permission_id: p.id });

    // Entrenador (Rol 2) tiene todo excepto página de permissions
    if (p.page !== 'permissions') {
      mappings.push({ role_id: 2, permission_id: p.id });
    }

    // Jugador (Rol 3) solo lectura de dashboard, calendar, trainings, matches, fines, points, attendance
    if (p.action === 'ver' && ['dashboard', 'calendar', 'trainings', 'matches', 'fines', 'points', 'attendance'].includes(p.page)) {
      mappings.push({ role_id: 3, permission_id: p.id });
    }

    // Directivo (Rol 4) ver y exportar en todo excepto settings y permissions
    if ((p.action === 'ver' || p.action === 'exportar') && !['settings', 'permissions'].includes(p.page)) {
      mappings.push({ role_id: 4, permission_id: p.id });
    }
  }

  return mappings;
};

// 4. Perfiles por defecto
const DEFAULT_PROFILES: Profile[] = [
  {
    id: MOCK_USER_IDS.admin,
    email: 'admin@atzeneta.com',
    full_name: 'Carlos Albelda (Admin)',
    role_id: 1,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    phone: '600111222',
    address: 'Calle de la Roca, 5, Atzeneta',
    birth_date: '1985-05-15',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.udatzenetaAdmin,
    email: 'udatzenetact@gmail.com',
    full_name: 'Administración UD Atzeneta',
    role_id: 1,
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    phone: '600111333',
    address: 'Calle Roca del Sol, Atzeneta',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.trainer,
    email: 'mister@atzeneta.com',
    full_name: 'Bernabé Ballester (Míster)',
    role_id: 2,
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
    phone: '600222333',
    address: 'Calle Deportiva, 10, Atzeneta',
    birth_date: '1980-09-12',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.player,
    email: 'paco@atzeneta.com',
    full_name: 'Paco Alcácer (Jugador)',
    role_id: 3,
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    phone: '612345678',
    address: 'Calle Mayor 12, Atzeneta del Maestrat',
    dorsal: 9,
    birth_date: '1993-08-30',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.board,
    email: 'directiva@atzeneta.com',
    full_name: 'Pascual Donat (Presidente)',
    role_id: 4,
    avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&q=80',
    phone: '600444555',
    address: 'Plaza del Ayuntamiento, 1, Atzeneta',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.player2,
    email: 'sergio@atzeneta.com',
    full_name: 'Sergio Gómez (Centrocampista)',
    role_id: 3,
    avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80',
    phone: '622987654',
    address: 'Calle Valencia, 24, Atzeneta',
    dorsal: 8,
    birth_date: '2000-09-04',
    created_at: new Date().toISOString()
  },
  {
    id: MOCK_USER_IDS.player3,
    email: 'nacho@atzeneta.com',
    full_name: 'Nacho Porcar (Defensa)',
    role_id: 3,
    avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80',
    phone: '633456789',
    address: 'Avenida del Sol, 8, Atzeneta',
    dorsal: 4,
    birth_date: '1994-01-28',
    created_at: new Date().toISOString()
  }
];

// 5. Entrenamientos por defecto
const DEFAULT_TRAININGS: Training[] = [
  {
    id: 't-1',
    date: '2026-06-18',
    time: '18:00',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    duration: 90,
    objective: 'Fase ofensiva y transiciones rápidas',
    observations: 'Traer tacos de césped artificial y espinilleras.'
  },
  {
    id: 't-2',
    date: '2026-06-19',
    time: '10:00',
    location: 'Gimnasio Municipal Atzeneta',
    duration: 60,
    objective: 'Trabajo de fuerza explosiva e hipertrofia',
    observations: 'Dividido en grupos A (10:00) y B (11:00).'
  },
  {
    id: 't-3',
    date: '2026-06-15',
    time: '18:30',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    duration: 90,
    objective: 'Basculación táctica y salida de balón presionado',
    observations: 'Asistencia 100% obligatoria, análisis en vídeo posterior.'
  },
  {
    id: 't-4',
    date: '2026-05-28',
    time: '18:00',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    duration: 90,
    objective: 'Trabajo físico aeróbico y rondos de presión',
    observations: 'Terminar con partido en dimensiones reducidas.'
  }
];

// 6. Partidos por defecto
const DEFAULT_MATCHES: Match[] = [
  {
    id: 'm-1',
    date: '2026-06-21',
    rival: 'Ontinyent 1931 CF',
    is_local: true,
    competition: 'Liga',
    score_us: null,
    score_them: null,
    status: 'Programado',
    time: '18:00',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    team_positive_aspects: null,
    team_improve_aspects: null
  },
  {
    id: 'm-2',
    date: '2026-06-14',
    rival: 'CD Alcoyano',
    is_local: false,
    competition: 'Liga',
    score_us: 2,
    score_them: 1,
    status: 'Jugado',
    time: '17:00',
    location: 'Estadio El Collao',
    team_positive_aspects: null,
    team_improve_aspects: null
  },
  {
    id: 'm-3',
    date: '2026-06-07',
    rival: 'UD Alzira',
    is_local: true,
    competition: 'Liga',
    score_us: 1,
    score_them: 1,
    status: 'Jugado',
    time: '18:00',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    team_positive_aspects: null,
    team_improve_aspects: null
  },
  {
    id: 'm-4',
    date: '2026-05-31',
    rival: 'CD Castellón B',
    is_local: false,
    competition: 'Liga',
    score_us: 0,
    score_them: 2,
    status: 'Jugado',
    time: '12:00',
    location: 'Ciudad Deportiva Facsa',
    team_positive_aspects: null,
    team_improve_aspects: null
  },
  {
    id: 'm-5',
    date: '2026-05-24',
    rival: 'Elche Ilicitano',
    is_local: true,
    competition: 'Liga',
    score_us: 3,
    score_them: 0,
    status: 'Jugado',
    time: '18:00',
    location: 'El Porrejat (6R7J+Q2 Adzaneta)',
    team_positive_aspects: null,
    team_improve_aspects: null
  }
];

// 7. Multas por defecto
const DEFAULT_FINES = (): Fine[] => [
  {
    id: 'f-1',
    user_id: MOCK_USER_IDS.player,
    date: '2026-06-15',
    reason: 'Llegar 15 minutos tarde al entrenamiento táctico',
    amount: 20.00,
    status: 'Pendiente'
  },
  {
    id: 'f-2',
    user_id: MOCK_USER_IDS.player2,
    date: '2026-06-14',
    reason: 'No vestir el chándal oficial en el viaje al partido',
    amount: 50.00,
    status: 'Pagado'
  },
  {
    id: 'f-3',
    user_id: MOCK_USER_IDS.player,
    date: '2026-06-10',
    reason: 'Uso del teléfono móvil en el vestuario técnico',
    amount: 10.00,
    status: 'Pagado'
  }
];

// 8. Puntos por defecto
const DEFAULT_POINTS = (): PointLog[] => [
  {
    id: 'p-1',
    user_id: MOCK_USER_IDS.player,
    date: '2026-06-14',
    reason: 'Goleador del partido (MVP)',
    points: 3
  },
  {
    id: 'p-2',
    user_id: MOCK_USER_IDS.player2,
    date: '2026-06-14',
    reason: 'Esfuerzo físico y 12 recuperaciones',
    points: 2
  },
  {
    id: 'p-3',
    user_id: MOCK_USER_IDS.player3,
    date: '2026-06-14',
    reason: 'Portería a cero y solidez defensiva',
    points: 2
  },
  {
    id: 'p-4',
    user_id: MOCK_USER_IDS.player,
    date: '2026-06-15',
    reason: 'Penalización por retraso',
    points: -1
  }
];

// 9. Scouting por defecto
const DEFAULT_SCOUTING: ScoutingPlayer[] = [
  {
    id: 's-1',
    player_name: 'Marcos Fornés',
    team: 'Hércules CF B',
    age: 21,
    position: 'Delantero Centro',
    rating: 4,
    notes: 'Gran desmarque al espacio, definición de zurda. Necesita mejorar juego de espaldas.',
    in_wallet: true,
    season: '2025-2026',
    competition: 'Lliga Comunitat',
    scouting_player_history: [
      { id: 'sph-1', scouting_id: 's-1', temporada: '2024/2025', equipo: 'Hércules CF B' },
      { id: 'sph-2', scouting_id: 's-1', temporada: '2023/2024', equipo: 'Alicante CF Promesas' }
    ]
  },
  {
    id: 's-2',
    player_name: 'Adrián Soler',
    team: 'Torrent CF',
    age: 23,
    position: 'Pivote Defensivo',
    rating: 5,
    notes: 'Dominio físico en duelos. Excelente visión en salida de balón y cambios de orientación.',
    in_wallet: true,
    season: '2025-2026',
    competition: 'Lliga Comunitat',
    scouting_player_history: [
      { id: 'sph-3', scouting_id: 's-2', temporada: '2024/2025', equipo: 'Torrent CF' },
      { id: 'sph-4', scouting_id: 's-2', temporada: '2023/2024', equipo: 'CD Castellón B' }
    ]
  }
];

// 10. Análisis de Rivales por defecto
const DEFAULT_OPPONENT_ANALYSIS: OpponentAnalysis[] = [
  {
    id: 'oa-1',
    opponent: 'Ontinyent 1931 CF',
    tactical_system: '1-4-3-3',
    strengths: ['Presión alta y tras pérdida muy intensa', 'Interiores con gran llegada al área'],
    weaknesses: ['Transición defensiva lenta si superamos primera línea', 'Laterales suben mucho, dejando espacios'],
    key_players: ['Javi Llor (MCO)', 'David Torres (DC)'],
    observations: 'Nuestra clave será atraer su presión para jugar balones largos a las bandas explotando su debilidad defensiva en transición.'
  }
];

// 11. Configuración por defecto
const DEFAULT_SETTINGS: Settings = {
  id: 1,
  club_name: 'UD Atzeneta',
  logo_url: null,
  season: '2025/2026'
};

// 12. Asistencias por defecto semilladas
const DEFAULT_ATTENDANCE: TrainingAttendance[] = [
  { id: 'att-1', training_id: 't-3', player_id: 'p-1', status: 'Entrena', observations: 'Excelente desempeño' },
  { id: 'att-2', training_id: 't-3', player_id: 'p-2', status: 'Entrena' },
  { id: 'att-3', training_id: 't-3', player_id: 'p-3', status: 'ED', observations: 'Molestias en el abductor, trabaja con fisio' },
  { id: 'att-4', training_id: 't-4', player_id: 'p-1', status: 'A', observations: 'Sin justificar' },
  { id: 'att-5', training_id: 't-4', player_id: 'p-2', status: 'Entrena' },
  { id: 'att-6', training_id: 't-4', player_id: 'p-3', status: 'L', observations: 'Esguince de tobillo' },
];

// 13. Jugadores por defecto
const DEFAULT_PLAYERS: Player[] = [
  {
    id: 'p-1',
    profile_id: MOCK_USER_IDS.player,
    full_name: 'Paco Alcácer',
    nickname: 'Paco',
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80',
    dorsal: 9,
    position: 'Delantero Centro',
    dominant_foot: 'Derecho',
    height: 175,
    weight: 72.5,
    birth_date: '1993-08-30',
    phone: '612345678',
    email: 'paco@atzeneta.com',
    physio_notes: 'Molestias leves en el isquiotibial izquierdo. Realizando trabajo preventivo.',
    physical_status: 'En duda',
    matches_played: 18,
    minutes_played: 1450,
    goals: 12,
    assists: 4,
    yellow_cards: 2,
    red_cards: 0
  },
  {
    id: 'p-2',
    profile_id: MOCK_USER_IDS.player2,
    full_name: 'Sergio Gómez',
    nickname: 'Gómez',
    photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=100&q=80',
    dorsal: 8,
    position: 'Mediocentro',
    dominant_foot: 'Izquierdo',
    height: 171,
    weight: 68.0,
    birth_date: '2000-09-04',
    phone: '622987654',
    email: 'sergio@atzeneta.com',
    physio_notes: 'Ninguna molestia reportada. Parámetros óptimos.',
    physical_status: 'Disponible',
    matches_played: 20,
    minutes_played: 1680,
    goals: 3,
    assists: 8,
    yellow_cards: 4,
    red_cards: 0
  },
  {
    id: 'p-3',
    profile_id: MOCK_USER_IDS.player3,
    full_name: 'Nacho Porcar',
    nickname: 'Porcar',
    photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80',
    dorsal: 4,
    position: 'Defensa Central',
    dominant_foot: 'Derecho',
    height: 185,
    weight: 81.2,
    birth_date: '1994-01-28',
    phone: '633456789',
    email: 'nacho@atzeneta.com',
    physio_notes: 'Esguince de tobillo grado 1 en recuperación.',
    physical_status: 'Lesionado',
    matches_played: 15,
    minutes_played: 1350,
    goals: 1,
    assists: 1,
    yellow_cards: 6,
    red_cards: 1
  }
];

// 14. Historial de Pesos por defecto
const DEFAULT_PLAYER_WEIGHTS: PlayerWeight[] = [
  { id: 'w-1', player_id: 'p-1', date: '2026-05-15', weight: 73.8 },
  { id: 'w-2', player_id: 'p-1', date: '2026-05-30', weight: 73.1 },
  { id: 'w-3', player_id: 'p-1', date: '2026-06-10', weight: 72.8 },
  { id: 'w-4', player_id: 'p-1', date: '2026-06-20', weight: 72.5 },
  
  { id: 'w-5', player_id: 'p-2', date: '2026-05-15', weight: 67.5 },
  { id: 'w-6', player_id: 'p-2', date: '2026-05-30', weight: 67.8 },
  { id: 'w-7', player_id: 'p-2', date: '2026-06-10', weight: 68.1 },
  { id: 'w-8', player_id: 'p-2', date: '2026-06-20', weight: 68.0 },

  { id: 'w-9', player_id: 'p-3', date: '2026-05-15', weight: 82.5 },
  { id: 'w-10', player_id: 'p-3', date: '2026-05-30', weight: 81.9 },
  { id: 'w-11', player_id: 'p-3', date: '2026-06-10', weight: 81.5 },
  { id: 'w-12', player_id: 'p-3', date: '2026-06-20', weight: 81.2 }
];

// 15. Notas de Fisio por defecto
const DEFAULT_PHYSIO_RECORDS: PlayerPhysioRecord[] = [
  { id: 'ph-1', player_id: 'p-1', date: '2026-06-15', status: 'En duda', notes: 'Sobrecarga leve en isquiotibial izquierdo.', treatment: 'Masaje de descarga e hidroterapia.' },
  { id: 'ph-2', player_id: 'p-3', date: '2026-06-10', status: 'Lesionado', notes: 'Esguince de ligamento lateral externo del tobillo derecho grado 1.', treatment: 'Vendaje compresivo, reposo deportivo y magnetoterapia.' },
  { id: 'ph-3', player_id: 'p-3', date: '2026-06-18', status: 'Lesionado', notes: 'Evolución favorable del tobillo. Empieza carrera continua.', treatment: 'Readaptación en campo y fortalecimiento propioceptivo.' }
];

// 16. Lesiones por defecto
const DEFAULT_PLAYER_INJURIES: PlayerInjury[] = [
  {
    id: 'inj-1',
    player_id: 'p-1',
    body_zone: 'isquiotibial_izquierdo',
    body_side: 'posterior',
    severity: 'Moderada',
    status: 'En tratamiento',
    diagnosis: 'Sobrecarga muscular grado I en isquiotibial izquierdo.',
    treatment: 'Masaje de descarga, crioterapia y trabajo excéntrico progresivo.',
    injury_date: '2026-06-12',
    estimated_return: '2026-06-25',
    follow_up_notes: '15/06: Mejora en la movilidad. Empieza carrera suave.\n18/06: Puede entrenar con limitaciones.',
    created_at: '2026-06-12T10:00:00Z'
  },
  {
    id: 'inj-2',
    player_id: 'p-3',
    body_zone: 'tobillo_derecho',
    body_side: 'frontal',
    severity: 'Grave',
    status: 'Baja',
    diagnosis: 'Esguince de ligamento lateral externo del tobillo derecho, grado II.',
    treatment: 'Inmovilización parcial, vendaje compresivo, magnetoterapia y readaptación funcional.',
    injury_date: '2026-06-08',
    estimated_return: '2026-07-05',
    follow_up_notes: '10/06: Inflamación importante. Reposo absoluto.\n15/06: Baja inflamación. Inicia movilidad pasiva.\n18/06: Ejercicios propioceptivos en piscina.',
    created_at: '2026-06-08T14:00:00Z'
  },
  {
    id: 'inj-3',
    player_id: 'p-3',
    body_zone: 'rodilla_derecha',
    body_side: 'frontal',
    severity: 'Leve',
    status: 'Recuperado',
    diagnosis: 'Contusión en la rodilla derecha tras choque en entrenamiento.',
    treatment: 'Hielo, antiinflamatorios y reposo 3 días.',
    injury_date: '2026-05-20',
    estimated_return: '2026-05-25',
    actual_return: '2026-05-24',
    follow_up_notes: '22/05: Sin dolor. Alta deportiva.',
    created_at: '2026-05-20T09:30:00Z'
  },
  {
    id: 'inj-4',
    player_id: 'p-2',
    body_zone: 'gemelo_izquierdo',
    body_side: 'posterior',
    severity: 'Leve',
    status: 'Recuperado',
    diagnosis: 'Contractura leve en gemelo izquierdo tras partido.',
    treatment: 'Estiramientos, masaje descontracturante.',
    injury_date: '2026-05-28',
    actual_return: '2026-06-01',
    follow_up_notes: '30/05: Sin molestias. Entrena con normalidad.',
    created_at: '2026-05-28T18:00:00Z'
  },
  {
    id: 'inj-5',
    player_id: 'p-1',
    body_zone: 'cabeza',
    body_side: 'frontal',
    severity: 'Moderada',
    status: 'Recuperado',
    diagnosis: 'Traumatismo craneal leve por choque de cabezas en partido.',
    treatment: 'Protocolo de conmoción cerebral. Reposo cognitivo 48h.',
    injury_date: '2026-04-15',
    actual_return: '2026-04-22',
    follow_up_notes: '17/04: Sin síntomas. Pruebas cognitivas correctas.\n20/04: Retorno gradual al ejercicio.',
    created_at: '2026-04-15T20:00:00Z'
  }
];


// =====================================================================
// MOTOR DE PERSISTENCIA MOCK EN LOCALSTORAGE
// =====================================================================

export class MockDatabase {
  private static get<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(`ud_atzeneta_mock_${key}`);
    if (!data) {
      this.set(key, defaultValue);
      return defaultValue;
    }
    return JSON.parse(data) as T;
  }

  private static set<T>(key: string, value: T): void {
    localStorage.setItem(`ud_atzeneta_mock_${key}`, JSON.stringify(value));
  }

  // Comprueba la versión del caché y lo resetea si es obsoleto
  static checkAndMigrateCache(): void {
    const storedVersion = localStorage.getItem('ud_atzeneta_mock_version');
    if (storedVersion !== MOCK_DATA_VERSION) {
      // Borrar todas las claves de datos mock (preservar la sesión)
      const sessionUserId = localStorage.getItem('ud_atzeneta_mock_session_user_id');
      Object.keys(localStorage)
        .filter(k => k.startsWith('ud_atzeneta_mock_') && k !== 'ud_atzeneta_mock_session_user_id')
        .forEach(k => localStorage.removeItem(k));
      // Restaurar sesión si había una activa
      if (sessionUserId) {
        localStorage.setItem('ud_atzeneta_mock_session_user_id', sessionUserId);
      }
      // Guardar nueva versión
      localStorage.setItem('ud_atzeneta_mock_version', MOCK_DATA_VERSION);
    }
  }

  // Métodos de lectura y escritura de tablas
  static getRoles(): Role[] {
    return this.get('roles', DEFAULT_ROLES);
  }

  static getProfiles(): Profile[] {
    return this.get('profiles', DEFAULT_PROFILES);
  }

  static setProfiles(profiles: Profile[]): void {
    this.set('profiles', profiles);
  }

  static getPermissions(): Permission[] {
    return this.get('permissions', DEFAULT_PERMISSIONS);
  }

  static getRolePermissions(): RolePermission[] {
    return this.get('role_permissions', generateDefaultRolePermissions(this.getPermissions()));
  }

  static setRolePermissions(perms: RolePermission[]): void {
    this.set('role_permissions', perms);
  }

  static getUserPermissions(): UserPermission[] {
    return this.get('user_permissions', []);
  }

  static setUserPermissions(perms: UserPermission[]): void {
    this.set('user_permissions', perms);
  }

  static getTrainings(): Training[] {
    return this.get('trainings', DEFAULT_TRAININGS);
  }

  static setTrainings(data: Training[]): void {
    this.set('trainings', data);
  }

  static getMatches(): Match[] {
    return this.get('matches', DEFAULT_MATCHES);
  }

  static setMatches(data: Match[]): void {
    this.set('matches', data);
  }

  static getFines(): Fine[] {
    return this.get('fines', DEFAULT_FINES());
  }

  static setFines(data: Fine[]): void {
    this.set('fines', data);
  }

  static getPoints(): PointLog[] {
    return this.get('points', DEFAULT_POINTS());
  }

  static setPoints(data: PointLog[]): void {
    this.set('points', data);
  }

  static getScouting(): ScoutingPlayer[] {
    return this.get('scouting', DEFAULT_SCOUTING);
  }

  static setScouting(data: ScoutingPlayer[]): void {
    this.set('scouting', data);
  }

  static getOpponentAnalysis(): OpponentAnalysis[] {
    return this.get('opponent_analysis', DEFAULT_OPPONENT_ANALYSIS);
  }

  static setOpponentAnalysis(data: OpponentAnalysis[]): void {
    this.set('opponent_analysis', data);
  }

  static getSettings(): Settings {
    return this.get('settings', DEFAULT_SETTINGS);
  }

  static setSettings(data: Settings): void {
    this.set('settings', data);
  }

  static getTrainingAttendance(): TrainingAttendance[] {
    return this.get('training_attendance', DEFAULT_ATTENDANCE);
  }

  static setTrainingAttendance(data: TrainingAttendance[]): void {
    this.set('training_attendance', data);
  }

  static getPlayers(): Player[] {
    return this.get('players', DEFAULT_PLAYERS);
  }

  static setPlayers(data: Player[]): void {
    this.set('players', data);
  }

  static getPlayerWeights(): PlayerWeight[] {
    return this.get('player_weights', DEFAULT_PLAYER_WEIGHTS);
  }

  static setPlayerWeights(data: PlayerWeight[]): void {
    this.set('player_weights', data);
  }

  static getPlayerPhysioRecords(): PlayerPhysioRecord[] {
    return this.get('player_physio_records', DEFAULT_PHYSIO_RECORDS);
  }

  static setPlayerPhysioRecords(data: PlayerPhysioRecord[]): void {
    this.set('player_physio_records', data);
  }

  static getPlayerInjuries(): PlayerInjury[] {
    return this.get('player_injuries', DEFAULT_PLAYER_INJURIES);
  }

  static setPlayerInjuries(data: PlayerInjury[]): void {
    this.set('player_injuries', data);
  }

  static getPlayerMatchStats(): PlayerMatchStats[] {
    return this.get('player_match_stats', []);
  }

  static setPlayerMatchStats(data: PlayerMatchStats[]): void {
    this.set('player_match_stats', data);
  }

  // Sesión actual mockeada
  static getSessionUser(): Profile | null {
    const userId = localStorage.getItem('ud_atzeneta_mock_session_user_id');
    if (!userId) return null;
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === userId) || null;
  }

  static setSessionUser(userId: string | null): void {
    if (userId) {
      localStorage.setItem('ud_atzeneta_mock_session_user_id', userId);
    } else {
      localStorage.removeItem('ud_atzeneta_mock_session_user_id');
    }
  }
}

// Helper para simular retardo de servidor de forma asíncrona
export const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));
