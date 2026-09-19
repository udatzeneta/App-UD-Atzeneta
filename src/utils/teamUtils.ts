/**
 * Normaliza el nombre de un equipo para facilitar comparaciones flexibles.
 * Elimina comillas (simples y dobles), prefijos habituales (C.F., U.D., At., etc.),
 * acentos y signos de puntuación.
 */
export const normalizeTeamName = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['"’‘´`“”]/g, '')
    .replace(/\b([a-z])\.([a-z])\./gi, '$1$2')
    .replace(/\b([a-z])\.([a-z])\b/gi, '$1$2')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractTeamDetails = (name: string) => {
  const norm = normalizeTeamName(name);
  if (!norm) return { norm: '', clean: '', letter: null, prefix: null, words: [] };

  let letter: string | null = null;
  const letterMatch = norm.match(/\b([a-c])\b$/);
  if (letterMatch) {
    letter = letterMatch[1];
  }

  const wordsRaw = norm.split(' ');
  let prefix: string | null = null;
  for (let i = 0; i < Math.min(3, wordsRaw.length); i++) {
    const w = wordsRaw[i];
    if (['ud', 'ue', 'cd', 'cf', 'fb', 'sd', 'ad', 'fc'].includes(w)) {
      prefix = w;
      break;
    }
  }
  if (!prefix) {
    if (wordsRaw.includes('ue')) prefix = 'ue';
    else if (wordsRaw.includes('ud')) prefix = 'ud';
    else if (wordsRaw.includes('cf')) prefix = 'cf';
    else if (wordsRaw.includes('cd')) prefix = 'cd';
  }

  const noise = new Set([
    'cf', 'cd', 'ud', 'ue', 'sd', 'ad', 'fc', 'fb', 'club', 'futbol',
    'deportivo', 'deportiva', 'union', 'esportiva', 'associacio',
    'atletico', 'atletic', 'at', 'de', 'del', 'dels', 'la', 'les', 'los',
    'las', 'el', 'en', 'i', 'y', 'a', 'b', 'c', '1931', '2024', '2025'
  ]);

  const meaningfulWords = wordsRaw.filter(w => !noise.has(w) && w.length >= 2);
  const clean = meaningfulWords.join(' ');

  return { norm, clean, letter, prefix, words: meaningfulWords };
};

/**
 * Compara dos nombres de equipo de manera precisa y flexible.
 * Distingue clubes diferentes (ej. U.D. Atzeneta de Castellón vs Atzeneta U.E.)
 * y filiales (ej. C.D. Roda 'A' vs C.D. Roda 'B').
 */
export const isSameTeam = (teamA?: string, teamB?: string): boolean => {
  if (!teamA || !teamB) return false;
  const a = extractTeamDetails(teamA);
  const b = extractTeamDetails(teamB);
  if (!a.clean || !b.clean) return false;

  // Si ambos especifican explícitamente letra de filial ('A', 'B', 'C') y difieren -> FALSO
  if (a.letter && b.letter && a.letter !== b.letter) {
    return false;
  }

  // Si el núcleo de palabras significativas es exactamente idéntico
  if (a.clean === b.clean) {
    // Si ambos tienen prefijos explícitos y son distintos (ej. UD vs UE) -> FALSO
    if (a.prefix && b.prefix && a.prefix !== b.prefix) {
      return false;
    }
    return true;
  }

  const longer = a.words.length >= b.words.length ? a : b;
  const shorter = a.words.length >= b.words.length ? b : a;

  // Si todas las palabras del más corto están contenidas en el más largo
  const allShorterInLonger = shorter.words.every(w => longer.words.includes(w));
  if (allShorterInLonger) {
    if (a.prefix && b.prefix && a.prefix !== b.prefix) {
      return false;
    }
    return true;
  }

  return false;
};

/**
 * Normaliza el nombre de un jugador para comparaciones flexibles.
 * Quita acentos, signos de puntuación y convierte a minúsculas.
 */
export const normalizePlayerName = (str?: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const COMMON_FIRST_NAMES = new Set([
  'jose', 'juan', 'carlos', 'antonio', 'luis', 'manuel', 'francisco', 'david',
  'miguel', 'javier', 'pablo', 'sergio', 'alejandro', 'victor', 'pau', 'jaime',
  'alberto', 'maria', 'pedro', 'jesus', 'jorge', 'angel', 'diego', 'raul',
  'mario', 'adrian', 'alvaro', 'gonzalo', 'ruben', 'ivan', 'borja', 'eric'
]);

/**
 * Compara dos nombres de jugador de forma flexible (ej. "VIVÓ CHULIÁ, SERGIO" vs "Sergio Vivó").
 * Previene falsos positivos entre diferentes jugadores con nombres comunes o hermanos.
 */
export const isSamePlayer = (
  nameA?: string,
  nameB?: string,
  dorsalA?: number | string,
  dorsalB?: number | string
): boolean => {
  if (!nameA || !nameB) {
    if (dorsalA && dorsalB && Number(dorsalA) > 0 && Number(dorsalA) === Number(dorsalB)) return true;
    return false;
  }

  const normA = normalizePlayerName(nameA);
  const normB = normalizePlayerName(nameB);
  if (!normA || !normB) return false;

  if (normA === normB) return true;

  // Si ambas cadenas tienen coma "APELLIDOS, NOMBRE", comparar partes de apellidos y nombre
  if (nameA.includes(',') && nameB.includes(',')) {
    const [surnamesA, firstA] = nameA.split(',').map(s => normalizePlayerName(s));
    const [surnamesB, firstB] = nameB.split(',').map(s => normalizePlayerName(s));

    const sWordsA = surnamesA.split(' ').filter(w => w.length >= 2);
    const sWordsB = surnamesB.split(' ').filter(w => w.length >= 2);
    const surnameMatches = sWordsA.filter(w => sWordsB.includes(w));
    if (surnameMatches.length === 0) return false; // Apellidos distintos = diferente jugador

    const fWordsA = (firstA || '').split(' ').filter(w => w.length >= 2);
    const fWordsB = (firstB || '').split(' ').filter(w => w.length >= 2);
    const firstMatch = fWordsA.some(w => fWordsB.includes(w));

    // Si los apellidos son idénticos ("VIVÓ CHULIÁ" vs "VIVO CHULIA") pero los nombres de pila son distintos ("SERGIO" vs "ALEJANDRO")
    if (surnamesA === surnamesB && fWordsA.length > 0 && fWordsB.length > 0 && !firstMatch) {
      return false; // Hermanos o parientes con distintos nombres de pila
    }

    if (surnamesA === surnamesB && (firstMatch || fWordsA.length === 0 || fWordsB.length === 0)) {
      return true;
    }
  }

  // Si una tiene coma y la otra no ("VIVÓ CHULIÁ, SERGIO" vs "Sergio Vivó")
  const wordsA = normA.split(' ').filter(w => w.length >= 2);
  const wordsB = normB.split(' ').filter(w => w.length >= 2);

  const matchingWords = wordsA.filter(w => wordsB.includes(w));
  const nonCommonMatches = matchingWords.filter(w => !COMMON_FIRST_NAMES.has(w));

  if (nonCommonMatches.length >= 1 && matchingWords.length >= 2) return true;
  if (nonCommonMatches.length >= 1 && (wordsA.length <= 2 || wordsB.length <= 2)) return true;

  if (dorsalA && dorsalB && Number(dorsalA) > 0 && Number(dorsalA) === Number(dorsalB) && nonCommonMatches.length >= 1) {
    return true;
  }

  return false;
};

/**
 * Convierte un nombre de posición en una abreviatura limpia y concisa (ej. "PORTERO/A" -> "POR", "MEDIO CENTRO" -> "MC").
 */
export const formatPositionAbbr = (pos?: string): string => {
  if (!pos) return 'DF';
  const clean = pos.toUpperCase().trim();
  if (clean.includes('PORTER')) return 'POR';
  if (clean.includes('CENTRAL')) return 'CEN';
  if (clean.includes('LATERAL DER') || clean.includes('LATERAL D')) return 'LD';
  if (clean.includes('LATERAL IZQ') || clean.includes('LATERAL I')) return 'LI';
  if (clean.includes('LATERAL')) return 'LAT';
  if (clean.includes('MEDIO CEN') || clean.includes('CENTROCAMPISTA') || clean.includes('MEDIOCAMPISTA')) return 'MC';
  if (clean.includes('MEDIO DER')) return 'MD';
  if (clean.includes('MEDIO IZQ')) return 'MI';
  if (clean.includes('MEDIO')) return 'MED';
  if (clean.includes('EXTREMO DER')) return 'ED';
  if (clean.includes('EXTREMO IZQ')) return 'EI';
  if (clean.includes('EXTREMO')) return 'EXT';
  if (clean.includes('DELANTERO')) return 'DEL';
  if (clean.includes('PUNT')) return 'DC';
  if (clean.includes('DESCONOCI') || clean.includes('SIN')) return 'JUG';
  if (clean.length <= 4) return clean;
  return clean.slice(0, 3);
};
