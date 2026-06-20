// Tipos del Dominio ERP UD Atzeneta

export type UserRoleSlug = 'admin' | 'trainer' | 'player' | 'board';

export interface Role {
  id: number;
  name: string;
  slug: UserRoleSlug;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role_id: number;
  avatar_url?: string;
  phone?: string;
  address?: string;
  dorsal?: number;
  birth_date?: string;
  created_at?: string;
}

export interface Permission {
  id: number;
  page: string;
  action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar';
  description?: string;
}

export interface RolePermission {
  role_id: number;
  permission_id: number;
}

export interface UserPermission {
  user_id: string;
  permission_id: number;
  allowed: boolean;
}

export interface Training {
  id: string;
  date: string;
  time: string;
  location: string;
  duration: number; // en minutos
  objective: string;
  observations: string;
  status: 'Programado' | 'Realizado' | 'Cancelado';
  created_at?: string;
}

export interface Match {
  id: string;
  date: string;
  rival: string;
  is_local: boolean;
  competition: 'Liga' | 'Copa' | 'Amistoso' | 'Promoción';
  score_us: number | null;
  score_them: number | null;
  status: 'Programado' | 'Jugado' | 'Suspendido';
  time?: string;
  location?: string;
  objective?: string;
  observations?: string;
  created_at?: string;
}

export interface Fine {
  id: string;
  user_id: string;
  date: string;
  reason: string;
  amount: number;
  status: 'Pendiente' | 'Pagado';
  created_at?: string;
  // Join con perfil para visualización
  profiles?: Profile;
}

export interface PointLog {
  id: string;
  user_id: string;
  date: string;
  reason: string;
  points: number;
  created_at?: string;
  // Join con perfil para visualización
  profiles?: Profile;
}

export interface ScoutingPlayer {
  id: string;
  player_name: string;
  team: string;
  age: number;
  position: string;
  rating: number; // 1-5
  notes: string;
  created_by?: string;
  created_at?: string;
}

export interface OpponentAnalysis {
  id: string;
  opponent: string;
  tactical_system: string;
  strengths: string[];
  weaknesses: string[];
  key_players: string[];
  observations: string;
  created_by?: string;
  created_at?: string;
}

export interface Settings {
  id: number;
  club_name: string;
  logo_url: string | null;
  season: string;
}

// Estructura de estado local de permisos para el editor
export interface RolePermissionMap {
  [roleId: number]: {
    [permissionId: number]: boolean;
  };
}

export interface UserPermissionMap {
  [userId: string]: {
    [permissionId: number]: boolean | null; // true = permitido, false = bloqueado, null = hereda
  };
}

export type AttendanceStatus = 'Entrena' | 'A' | 'ED' | 'L' | 'E' | 'P' | 'LJ' | 'V' | 'AA' | 'AO' | 'D';

export interface TrainingAttendance {
  id: string;
  training_id: string;
  user_id: string;
  status: AttendanceStatus;
  observations?: string;
  created_at?: string;
  updated_at?: string;
  profiles?: Profile;
}

export interface TacticalPlayer {
  id: string; // ffcv-XXXX or custom-XXXX
  nombre: string;
  dorsal: number;
  posicion: string;
  posicion_abbr: string;
  foto: string;
  team: string;
  x: number; // percentage coordinate on the field (0 to 100)
  y: number; // percentage coordinate on the field (0 to 100)
  comment?: string;
}

export interface TacticalBoard {
  id: string;
  name: string;
  formation: string; // 'Libre' | '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1'
  players: TacticalPlayer[];
}

export interface Player {
  id: string;
  profile_id?: string;
  full_name: string;
  nickname?: string;
  photo_url?: string;
  dorsal?: number;
  position?: string;
  dominant_foot?: 'Derecho' | 'Izquierdo' | 'Ambidiestro';
  height?: number;
  weight?: number;
  birth_date?: string;
  phone?: string;
  email?: string;
  physio_notes?: string;
  physical_status?: 'Disponible' | 'Lesionado' | 'En duda' | 'Baja';
  
  // Estadísticas
  matches_played: number;
  minutes_played: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  
  created_at?: string;
  updated_at?: string;
}

export interface PlayerWeight {
  id: string;
  player_id: string;
  date: string;
  weight: number;
  created_at?: string;
}

export interface PlayerPhysioRecord {
  id: string;
  player_id: string;
  date: string;
  status: 'Disponible' | 'Lesionado' | 'En duda' | 'Baja';
  notes: string;
  treatment?: string;
  created_at?: string;
}

export interface PlayerInjury {
  id: string;
  player_id: string;
  body_zone: string;
  body_side: 'frontal' | 'posterior';
  severity: 'Leve' | 'Moderada' | 'Grave';
  status: 'Activa' | 'En tratamiento' | 'Recuperado' | 'Baja';
  diagnosis: string;
  treatment?: string;
  injury_date: string;
  estimated_return?: string;
  actual_return?: string;
  follow_up_notes?: string;
  created_at?: string;
}


