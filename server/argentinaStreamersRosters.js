// Plantel de Argentina Streamers vía argentinastreamers.com (BLOQUE 3,
// 2026-09-09). Investigado ANTES de escribir este archivo (ver informe
// entregado al usuario): la web es el mismo Next.js App Router ya
// integrado en server/argentinaStreamersClient.js (RSC embebido via
// `self.__next_f.push`, sin endpoint JSON público separado). El payload
// "product" -- ya usado por Goleadores/Asistidores/Participaciones/
// Historial -- también trae "product.roster": el plantel ACTUAL del
// equipo (36 jugadores confirmados en vivo, subconjunto de "product.players",
// que además incluye historicos/inactivos) con nombre completo, apodo,
// dorsal, posición, foto y redes -- confirmado por inspección real de la
// respuesta, no inventado.
//
// LIMITACIÓN REAL CONFIRMADA (no un supuesto): argentinastreamers.com es
// el sitio propio de ESE equipo -- "product" no trae ningún plantel de los
// rivales (Perú Creadores, OXEN, Argentina Senior, etc.), que en esta web
// solo existen como nombre/escudo de rival dentro de Historial. Por eso
// esta sincronización SOLO cubre teamId "argentina-streamers"; para
// cualquier otro equipo se informa el límite real (nunca se inventa un
// plantel) y la carga manual sigue siendo el camino esperado.
//
// Archivo deliberadamente propio (no reutiliza server/glaFutbolRosters.js):
// mismo criterio de aislamiento total entre themes que ya usan
// argentinaStreamersClient.js/argentinaStreamersSync.js frente a
// glaFutbolClient.js/glaFutbolSync.js -- cero imports cruzados.
import { fetchArgentinaStreamersHtml, extractProductData } from './argentinaStreamersClient.js';
import { saveRoster } from './playerRosters.js';

const THEME_ID = 'argentinaStreamers';
const OWN_TEAM_ID = 'argentina-streamers';

export async function syncRosterFromWeb(teamId) {
  if (teamId !== OWN_TEAM_ID) {
    throw new Error(
      `argentinastreamers.com no publica el plantel de este equipo (solo trae el propio, "${OWN_TEAM_ID}"). Usá carga manual para este equipo.`
    );
  }

  const html = await fetchArgentinaStreamersHtml();
  const product = extractProductData(html);
  const roster = Array.isArray(product?.roster) ? product.roster : [];
  if (roster.length === 0) {
    throw new Error('argentinastreamers.com no devolvió jugadores en "product.roster" (puede haber cambiado el formato de la página).');
  }

  const jugadores = roster.map((player) => ({
    dorsal: String(player?.number ?? '').trim(),
    nombre: String(player?.firstName ?? '').trim(),
    apellido: String(player?.lastName ?? '').trim(),
    apodo: String(player?.nickname ?? player?.displayName ?? '').trim(),
    nombreCompleto: String(player?.name ?? '').trim(),
    webId: player?.id ?? null,
    slug: player?.slug ?? null,
    // "metadata" (sección 14, compatibilidad futura con Ficha Jugador --
    // BLOQUE 4): se persiste tal cual la trae la web, sin usarla todavía
    // para nada (ni estadísticas ni ficha individual en esta etapa).
    metadata: {
      position: player?.position || '',
      photoUrl: player?.photoUrl || '',
      birthDate: player?.birthDate || null,
      socials: player?.socials || {},
    },
  }));

  return saveRoster(THEME_ID, teamId, jugadores, 'argentina-streamers-web');
}
