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
    .replace(/\b(c\.?f\.?|c\.?d\.?|u\.?d\.?|s\.?d\.?|a\.?d\.?|f\.?c\.?|at\.?|atlético|atletico)\b/gi, '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Compara dos nombres de equipo de manera flexible.
 * Devuelve true si coinciden tras la normalización o si uno contiene al otro.
 */
export const isSameTeam = (teamA?: string, teamB?: string): boolean => {
  if (!teamA || !teamB) return false;
  const normA = normalizeTeamName(teamA);
  const normB = normalizeTeamName(teamB);
  if (!normA || !normB) return false;

  if (normA === normB) return true;

  // Comparación por subcadena solo si la cadena corta tiene al menos 3 caracteres
  if (normA.length >= 3 && normB.length >= 3) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  // Coincidencia por palabras clave principales de más de 3 letras
  const wordsA = normA.split(/\s+/).filter(w => w.length >= 3 && !['1931', '2024', '2025', 'club'].includes(w));
  const wordsB = normB.split(/\s+/).filter(w => w.length >= 3 && !['1931', '2024', '2025', 'club'].includes(w));
  if (wordsA.length > 0 && wordsB.length > 0) {
    const hasCommonWord = wordsA.some(w => wordsB.includes(w));
    if (hasCommonWord) return true;
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
