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
  nickname?: string;
  role_id: number;
  avatar_url?: string;
  phone?: string;
  address?: string;
  dorsal?: number;
  birth_date?: string;
  created_at?: string;
  team_category?: string; // 'Primer Equipo' | 'Juvenil'
  
  // Novedad: Contextos disponibles (multi-rol)
  availableContexts?: UserContext[];
}

export interface UserContext {
  id?: string;
  user_id?: string;
  role_id: number;
  team_category: string;
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
  team_category?: string; // 'Primer Equipo' | 'Juvenil'
  created_at?: string;
}

export interface Team {
  id: string;
  ffcv_cod: string;
  name: string;
  shield_url: string | null;
  competition: string;
  cod_competicion?: string;
  cod_grupo: string;
  season: string;
  club?: string | null;
  campo?: string | null;
  web?: string | null;
  email?: string | null;
  telefono?: string | null;
  horario?: string | null;
  staff_tecnicos?: string[];
  staff_auxiliares?: string[];
  created_at?: string;
  updated_at?: string;
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
  matchday?: string | null;
  callup_time?: string | null;
  callup_location?: string | null;
  kit_shirt_color?: string | null;
  kit_shorts_color?: string | null;
  kit_socks_color?: string | null;
  tactical_system?: string | null;
  tactical_with_ball?: string | null;
  tactical_without_ball?: string | null;
  tactical_set_pieces?: string | null;
  tactical_general?: string | null;
  opponent_events?: {
    goals: { minute: string; dorsal: string }[];
    yellow_cards: { minute: string; dorsal: string }[];
  } | null;
  team_positive_aspects?: string | null;
  team_improve_aspects?: string | null;
  team_ratings?: {
    with_ball: {
      salida_balon?: number;
      posesion?: number;
      finalizacion?: number;
      juego_directo?: number;
      ocupacion_area?: number;
    };
    without_ball: {
      presion_alta?: number;
      bloque_medio?: number;
      bloque_bajo?: number;
      defensa_area?: number;
    };
    set_pieces: {
      ofensiva?: number;
      defensiva?: number;
    };
  } | null;
  team_category?: string; // 'Primer Equipo' | 'Juvenil'
  created_at?: string;
}

export interface PlayerMatchStats {
  id: string;
  player_id: string;
  match_id: string;
  is_called_up: boolean;
  position?: string;
  is_starter?: boolean;
  substituted_for?: string;
  substituted_minute?: number;
  minutes_played: number;
  goals: number;
  conceded_goals?: number;
  own_goals?: number;
  assists: number;
  yellow_cards: number;
  red_card: boolean;
  rating?: number;
  comments?: string;
  positive_aspects?: string | null;
  improve_aspects?: string | null;
  event_minutes?: {
    goals?: string[];
    assists?: string[];
    yellow_cards?: string[];
    red_card?: string | null;
    conceded_goals?: string[];
    own_goals?: string[];
    penalty_goals?: string[];
    conceded_penalty_goals?: string[];
    injuries?: string[];
    sub_out?: { minute: string; playerInId: string }[];
  } | null;
  player_intent?: boolean | null;
  player_reason?: string | null;
  created_at?: string;
  updated_at?: string;
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
  team_category?: string;
  created_at?: string;

  // FFCV data fields
  season?: string;
  competition?: string;
  dorsal?: number;
  convocados?: number;
  jugados?: number;
  titular?: number;
  suplente?: number;
  goles?: number;
  media_goles?: number;
  amarillas?: number;
  doble_amarilla?: number;
  rojas?: number;
  tarjeta_verde?: number;
  participacion?: string;
  titularidad?: string;
  disciplina?: string;
  goles_partido?: number;
  photo_url?: string;
  in_wallet?: boolean;
  x?: number | null;
  y?: number | null;
  alternative_positions?: string;
  comment?: string;
  phone?: string;
  scouting_player_history?: ScoutingPlayerHistory[];
}

export interface ScoutingPlayerHistory {
  id: string;
  scouting_id: string;
  temporada: string;
  equipo: string;
  shield_url?: string;
  categoria?: string;
  created_at?: string;
}

export type ClipAnnotationType =
  | 'spotlight'   // foco: oscurece el resto y resalta un jugador/zona
  | 'player'      // anillo para marcar un jugador (con nº/etiqueta opcional)
  | 'arrow'       // flecha de movimiento/pase
  | 'zone'        // zona/área resaltada (polígono a mano alzada)
  | 'line'        // línea que enlaza varios jugadores (línea defensiva, etc.)
  | 'magnifier'   // catalejo/lupa (2º reproductor sincronizado)
  | 'text';       // etiqueta de texto

// Todas las coordenadas y tamaños están normalizados (0..1) respecto al frame
// del vídeo, de modo que las anotaciones escalan con cualquier tamaño de pantalla.
export interface ClipAnnotation {
  id: string;
  type: ClipAnnotationType;
  color: string;
  x: number;          // punto principal (centro para círculos, inicio para flecha, esquina para zona)
  y: number;
  radius?: number;    // spotlight / player / magnifier (normalizado al ancho)
  x2?: number;        // flecha: punto final
  y2?: number;
  w?: number;         // zona (rect legado): ancho
  h?: number;         // zona (rect legado): alto
  points?: { x: number; y: number }[]; // zona (polígono libre) y línea de jugadores
  label?: string;     // player / text
  zoom?: number;      // magnifier: factor de ampliación (2, 3...)
}

export type OpponentPhase = 'con_balon' | 'sin_balon' | 'abp';

// Catalogación de un clip: a qué fase/subcategoría del mural pertenece.
export interface ClipCategory {
  phase: OpponentPhase;
  sub: string;                    // clave de subcategoría (ver opponentTaxonomy)
  side?: 'ofensivo' | 'defensivo'; // solo aplica a la fase 'abp'
}

export interface OpponentVideoClip {
  id: string;
  title: string;
  start: number; // in seconds
  end: number;   // in seconds
  freezeTime?: number;            // segundo del vídeo sobre el que se anota (frame congelado)
  pauseDuration?: number;         // Segundos de auto-pausa en reproducción (defecto 3s)
  annotations?: ClipAnnotation[]; // telestración del clip
  description?: string;           // Breve comentario del clip
  board?: string;                 // Campograma adjunto al clip
  category?: ClipCategory;        // catalogación del clip (para enviarlo a su sección)
}

export interface OpponentVideo {
  id: string;
  url: string;
  clips: OpponentVideoClip[];
}

// Vídeo de la videoteca central del rival. Admite YouTube/Vimeo/MP4·M3U8
// (clippable) y embeds tipo Veo/Hudl por iframe (no recortables).
export interface OpponentLibraryVideo {
  id: string;
  url: string;
  title: string;
  provider?: 'youtube' | 'vimeo' | 'direct' | 'embed';
  clippable: boolean;
  added_at?: string;
  clips: OpponentVideoClip[];
}

// Contenido textual + campograma de una subsección del mural (keyed por catKey).
export interface OpponentSubSection {
  description?: string;
  board?: string;
}

// Un ocupante de un puesto del sistema (un puesto puede tener varios).
export interface FormationOccupant {
  id: string;
  name: string;
  number?: number;
  photo_url?: string;
  scouting_id?: string;
}

// Puesto del campograma interactivo (coordenadas 0-100). Puede estar ocupado
// por uno o varios jugadores (p. ej. dos candidatos para la misma demarcación).
export interface FormationPlayer {
  id: string;
  label?: string;   // demarcación abreviada del slot (GK, DFC, LI, DC...)
  role?: string;    // demarcación descriptiva del slot (Lateral Izquierdo...)
  x: number;
  y: number;
  occupants?: FormationOccupant[]; // jugadores asignados a este puesto
  // Legacy (compat con datos ya guardados de un solo jugador):
  number?: number;
  name?: string;
  photo_url?: string;
}

// Alineación / sistema de juego del rival (campograma arrastrable).
export interface OpponentFormation {
  system: string;                 // p. ej. '4-4-2' o 'Libre'
  players: FormationPlayer[];
  label?: string;                 // nombre de una alternativa (p. ej. 'Repliegue 4-4-2')
}

export interface OpponentRosterPlayer {
  id: string;
  name: string;
  number?: number;
  position?: string;
  comments: string;
  photo_url?: string;
}

export interface OpponentAnalysisBlock {
  id: string;
  title: string;
  description: string;
  board: string;
  videos: OpponentVideo[];
}

export interface OpponentAnalysis {
  id: string;
  opponent: string;
  tactical_system: string;
  strengths: string[];
  weaknesses: string[];
  key_players: string[];
  observations: string;
  general_board?: string;
  created_by?: string;
  team_category?: string;
  created_at?: string;
  roster_comments?: OpponentRosterPlayer[];
  with_ball_blocks?: OpponentAnalysisBlock[];
  without_ball_blocks?: OpponentAnalysisBlock[];
  abp_blocks?: OpponentAnalysisBlock[];
  // Nueva estructura: videoteca central + contenido por subsección.
  library_videos?: OpponentLibraryVideo[];
  sub_sections?: Record<string, OpponentSubSection>;
  general_formation?: OpponentFormation; // sistema de juego (campograma arrastrable)
  alternative_formations?: OpponentFormation[]; // sistemas alternativos (campogramas pequeños)
  presentations?: OpponentPresentation[]; // presentaciones a pantalla completa por bloques
}

// =====================================================================
// Presentaciones: diapositivas ordenadas por bloques para reproducir a
// pantalla completa (clips anotados, campogramas, informes de texto y
// portadas de bloque).
// =====================================================================
export type PresentationSlideType = 'cover' | 'formation' | 'board' | 'text' | 'clip' | 'general_summary';
export type PresentationBlock = 'generales' | 'jugadores' | 'con_balon' | 'sin_balon' | 'abp';

export interface PresentationSlide {
  id: string;
  sourceKey?: string;                // clave del catálogo para sincronizar cambios
  type: PresentationSlideType;
  block: PresentationBlock;          // agrupación / orden
  title?: string;                    // encabezado mostrado en la diapositiva
  subtitle?: string;
  text?: string;                     // type 'text'
  board?: string;                    // type 'board' (valor de TaskBoardEditor)
  formation?: OpponentFormation;     // type 'formation' (snapshot)
  videoId?: string;                  // type 'clip' → resolver en library_videos
  clipId?: string;                   // type 'clip'
  summaryData?: {
    mainFormation?: OpponentFormation;
    alternativeFormations?: OpponentFormation[];
    strengths?: string[];
    weaknesses?: string[];
    keyPlayers?: string[];
    observations?: string;
    rosterComments?: OpponentRosterPlayer[];
  };
}

export interface OpponentPresentation {
  id: string;
  title: string;
  created_at?: string;
  slides: PresentationSlide[];
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
  player_id: string;
  status: string;
  observations?: string;
  player_intent?: boolean | null;
  player_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  players?: Player;
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
  rating?: number;
  alternative_positions?: string;
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
  
  team_category?: string; // 'Primer Equipo' | 'Juvenil'
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
  baja_date?: string;
  estimated_return?: string;
  actual_return?: string;
  origin?: string;
  match_id?: string;
  follow_up_notes?: string;
  competitive_leave?: boolean;
  created_at?: string;
}

export interface SocialEvent {
  id: string;
  date: string;
  time: string;
  type: 'Cena' | 'Comida' | 'Fiesta' | 'Otro';
  location: string;
  observations?: string;
  team_category?: string;
  created_at?: string;
}

export interface TrainingTask {
  id: string;
  title: string;
  description: string;
  duration: number; // en minutos
  series?: number; // number of series
  series_duration?: number; // duration per series in minutos
  task_types?: string[]; // tipos de tarea (Posesion, Rondo, etc)
  category: string; // Calentamiento, Principal, etc.
  board_data?: string; // JSON con los elementos de la pizarra táctica
  coach_roles?: string;
  teams_board_data?: string;
  created_at?: string;
}

export interface TrainingSessionTask {
  id: string;
  training_id: string;
  task_id: string;
  order_index: number;
  duration?: number; // override duration en minutos
  notes?: string;
  
  // Relación opcional para visualizar
  task?: TrainingTask;
}

// =====================================================================
// MÓDULO "MEJORA INDIVIDUAL" (Individual Improvement)
// =====================================================================

export type ImprovementStatus =
  | 'Borrador' | 'Enviado' | 'Revisado' | 'Comentado' | 'Finalizado';

export type ImprovementHalf = 'Primera parte' | 'Segunda parte' | 'Prórroga';

export type ImprovementActionType =
  | 'Ataque' | 'Defensa' | 'Transición' | 'ABP' | 'Duelo' | 'Pase'
  | 'Finalización' | 'Presión' | 'Cobertura' | 'Otro';

export type ImprovementResult = 'Positivo' | 'Negativo' | 'Mejorable';

export type ImprovementImportance = 'Alta' | 'Media' | 'Baja';

// Estados emocionales predefinidos (emoji + etiqueta)
export const EMOTIONAL_STATES = [
  '😀 Seguro',
  '😐 Normal',
  '😟 Nervioso',
  '😤 Frustrado',
  '😎 Muy confiado',
] as const;
export type ImprovementEmotionalState = (typeof EMOTIONAL_STATES)[number];

// Cabecera del análisis por partido (incluye el cuestionario de autoevaluación)
export interface ImprovementAnalysis {
  id: string;
  player_id: string;
  match_id: string;
  season?: string | null;
  status: ImprovementStatus;

  // Cuestionario (1-10)
  rating_match?: number | null;
  rating_physical?: number | null;
  rating_mental?: number | null;
  rating_concentration?: number | null;
  rating_communication?: number | null;

  // Texto libre
  did_well?: string | null;
  to_improve?: string | null;
  next_goal?: string | null;

  // Valoración del entrenador (percepción vs. técnico)
  coach_rating?: number | null;

  time_spent_seconds: number;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;

  // Relaciones opcionales (populadas al cargar detalle)
  match?: Match;
  player?: Player;
  actions?: ImprovementAction[];
}

export interface ImprovementAction {
  id: string;
  analysis_id: string;
  minute?: number | null;
  half?: ImprovementHalf | null;
  action_type?: ImprovementActionType | null;
  result?: ImprovementResult | null;
  description?: string | null;

  reflection_why?: string | null;
  reflection_options?: string | null;
  reflection_keep_same?: string | null;
  reflection_change?: string | null;
  reflection_learning?: string | null;

  emotional_state?: string | null;
  importance: ImprovementImportance;

  video_url?: string | null;
  video_timestamp?: number | null;

  board_data?: string | null; // JSON del campograma (TaskBoardEditor)

  sort_order: number;
  created_at?: string;
  updated_at?: string;

  // Relaciones opcionales
  evidence?: ImprovementEvidence[];
  messages?: ImprovementMessage[];
}

export interface ImprovementEvidence {
  id: string;
  action_id: string;
  type: 'image' | 'screenshot' | 'annotation' | 'video';
  url: string;
  caption?: string | null;
  created_at?: string;
}

export interface ImprovementMessage {
  id: string;
  action_id: string;
  sender_id: string;
  body: string;
  read_at?: string | null;
  created_at?: string;

  // Relación opcional para pintar el chat
  sender?: Pick<Profile, 'id' | 'full_name' | 'nickname' | 'avatar_url' | 'role_id'>;
}

export interface ImprovementObjective {
  id: string;
  player_id: string;
  created_by?: string | null;
  title: string;
  description?: string | null;
  target_date?: string | null;
  progress: number;
  status: 'Activo' | 'En progreso' | 'Cumplido' | 'Descartado';
  created_at?: string;
  updated_at?: string;
}

export interface ImprovementNotification {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  type: 'analysis_submitted' | 'coach_replied' | 'objective_assigned' | 'analysis_reviewed';
  analysis_id?: string | null;
  action_id?: string | null;
  message?: string | null;
  read_at?: string | null;
  created_at?: string;
}

// =====================================================================
// MÓDULO "PREPARACIÓN FÍSICA Y GPS" (PF)
// =====================================================================

export interface GpsRecord {
  id: string;
  jugador_id: string;
  session_id: string;
  session_type: 'entrenamiento' | 'partido';
  distancia_total?: number;
  velocidad_maxima?: number;
  sprints?: number;
  hsr?: number;
  distancia_alta_intensidad?: number;
  aceleraciones?: number;
  deceleraciones?: number;
  distancia_por_minuto?: number;
  equilibrio_pasos?: number;
  created_at?: string;
  updated_at?: string;
}

export interface FuerzaSession {
  id: string;
  plantilla: string; // 'primer_equipo' | 'juvenil'
  tipo: 'tabata' | 'repeticiones';
  fecha: string;
  created_at?: string;
}

export interface EjercicioFuerza {
  id: string;
  nombre: string;
  grupos?: string[];
  tags?: string[];
  explicacion?: string;
  imagen_url?: string;
  zona?: 'anterior' | 'posterior' | 'ambos';
  tren?: 'superior' | 'inferior' | 'full_body';
  patron?: string;
  otroTexto?: string;
  created_at?: string;
}

export interface FuerzaSesionEjercicio {
  id: string;
  sesion_id: string;
  ejercicio_id: string;
  repeticiones?: string;
  tiempo?: string;
  comentarios?: string;
  created_at?: string;
}
