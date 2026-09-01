// CORRECCIÓN DE TEXTOS (2026-08-19, pedido explícito: reemplaza por
// completo al GENERADOR DE ZÓCALOS eliminado en esta misma entrega). El
// operador escribe el texto a mano; esto SOLO corrige ortografía, tildes y
// tipeo básico -- nunca reescribe con otro estilo, nunca agrega
// información, nunca toca nombres propios.
//
// Corrector LOCAL por diccionario, no un LLM: no hay ningún
// ANTHROPIC_API_KEY/OPENAI_API_KEY ni adaptador de IA configurado en este
// proyecto (confirmado en una entrega anterior de esta misma sesión, ver
// CHANGELOG) -- agregar una dependencia externa nueva sin que se pida
// explícitamente no correspondía. El pedido explícitamente habilita esta
// vía: "Si puede resolverse de forma segura con corrector local +
// diccionario, también sirve".
//
// Deliberadamente CONSERVADOR: el diccionario de abajo solo incluye
// palabras SIN ambigüedad gramatical. Pares clásicos como "esta"/"está",
// "mas"/"más", "si"/"sí", "el"/"él", "tu"/"tú" dependen del ROL de la
// palabra en la oración (demostrativo vs. verbo, conjunción vs. adverbio,
// artículo vs. pronombre) -- un reemplazo ciego por palabra los rompería
// en una fracción real de los casos ("ESTA CANCHA" es correcto tal cual,
// "ESTA GANANDO" necesita tilde: la MISMA palabra, dos resultados
// distintos). Se excluyen a propósito en vez de arriesgar el significado.
// Nombres de equipos/jugadores/GLA/VAR nunca se tocan porque simplemente
// no están en este diccionario.
const WORD_CORRECTIONS = new Map(Object.entries({
  // Días (único día de semana con tilde -- ver auditoría 2026-08-20: caía
  // en un test obligatorio y no estaba, "sábado" solo no alcanza).
  miercoles: 'miércoles',
  sabado: 'sábado', sabados: 'sábados',
  dia: 'día', dias: 'días',
  // Familia próximo/último -- muy frecuente en zócalos de fecha/tabla.
  proximo: 'próximo', proxima: 'próxima', proximos: 'próximos', proximas: 'próximas',
  ultimo: 'último', ultima: 'última', ultimos: 'últimos', ultimas: 'últimas',
  unico: 'único', unica: 'única', unicos: 'únicos', unicas: 'únicas',
  // Deportivo/TV.
  futbol: 'fútbol', futbolistico: 'futbolístico', futbolistica: 'futbolística',
  campeon: 'campeón', capitan: 'capitán', titulo: 'título', titulos: 'títulos',
  tecnico: 'técnico', tecnica: 'técnica', tecnicos: 'técnicos', tecnicas: 'técnicas',
  arbitro: 'árbitro', arbitros: 'árbitros',
  publico: 'público', numero: 'número', numeros: 'números',
  // Adjetivos/adverbios comunes.
  dificil: 'difícil', dificiles: 'difíciles', facil: 'fácil', faciles: 'fáciles',
  rapido: 'rápido', rapida: 'rápida', rapidos: 'rápidos', rapidas: 'rápidas',
  basico: 'básico', basica: 'básica', practico: 'práctico', practica: 'práctica',
  logico: 'lógico', logica: 'lógica', tipico: 'típico', tipica: 'típica',
  historico: 'histórico', historica: 'histórica',
  economico: 'económico', economica: 'económica',
  clasico: 'clásico', clasica: 'clásica',
  publica: 'pública', publicos: 'públicos', publicas: 'públicas',
  aqui: 'aquí', alli: 'allí', asi: 'así',
  segun: 'según', tambien: 'también', ademas: 'además', atras: 'atrás',
  // Sustantivos comunes con tilde fija.
  pagina: 'página', musica: 'música', telefono: 'teléfono', medico: 'médico',
  linea: 'línea', area: 'área', camara: 'cámara',
  // Typos frecuentes de tipeo (no son un tema de tilde, son error de
  // letra) -- lista corta y deliberada, no un corrector genérico de typos.
  quedarce: 'quedarse',
  aveces: 'a veces', osea: 'o sea',
}));

// Reglas de sufijo (2026-08-20, auditoría real: el diccionario palabra por
// palabra de la entrega anterior era demasiado angosto -- "no quiero un
// corrector con lista mínima"). "-ción"/"-sión" es un sufijo 100% regular
// en español: CUALQUIER palabra que termine en esas letras SIN tilde la
// necesita, sin excepciones (a diferencia de esta/está, mas/más, que
// dependen del rol gramatical) -- esto cubre de una sola vez decenas de
// palabras reales de este dominio (posición, definición, información,
// situación, clasificación, generación, selección, producción, dirección,
// atención, televisión, decisión, revisión, expresión, extensión,
// tensión, ocasión...) sin tener que listarlas todas a mano, y sigue
// siendo tan seguro como el diccionario: nunca reescribe, nunca inventa,
// nunca toca una palabra que ya está bien escrita (si ya tiene la tilde,
// el patrón sin tilde no matchea).
// Nota: el plural regular ("posiciones", "canciones") va SIN tilde en
// español estándar -- no hace falta (ni corresponde) una regla para el
// plural, solo para el singular "cion"/"sion" sueltos.
const SUFFIX_RULES = [
  [/cion$/i, 'ción'],
  [/sion$/i, 'sión'],
  [/logia$/i, 'logía'],
  [/grafia$/i, 'grafía'],
];

function applySuffixRules(lowerWord) {
  if (lowerWord.length < 6) return null;
  for (const [pattern, replacement] of SUFFIX_RULES) {
    if (pattern.test(lowerWord)) return lowerWord.replace(pattern, replacement);
  }
  return null;
}

function matchCase(original, corrected) {
  if (original === original.toUpperCase()) return corrected.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return corrected.charAt(0).toUpperCase() + corrected.slice(1);
  }
  return corrected;
}

function correctWord(word) {
  const lower = word.toLowerCase();
  const dictHit = WORD_CORRECTIONS.get(lower);
  if (dictHit) return matchCase(word, dictHit);
  const suffixHit = applySuffixRules(lower);
  if (suffixHit) return matchCase(word, suffixHit);
  return word;
}

function correctText(text) {
  if (typeof text !== 'string' || !text) return typeof text === 'string' ? text : '';
  return text.replace(/[A-Za-zÁÉÍÓÚÑÜáéíóúñü]+/g, correctWord);
}

// correctLowerThirdText({ main, sub }) -- función COMPARTIDA y única (no
// una implementación distinta por cada zócalo, pedido explícito). Si
// "sub" no se pasa (zócalo de un solo renglón), simplemente no hay nada
// que corregir ahí -- nunca se inventa un sub que no existía.
export function correctLowerThirdText({ main = '', sub = '' } = {}) {
  return {
    main: correctText(main),
    sub: correctText(sub),
  };
}
