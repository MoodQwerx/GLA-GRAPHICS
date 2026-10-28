// PLANTELES de Argentina Streamers desde la web (reescrito 2026-10-08).
//
// Fuente: CONVOCADOS de la rama elegida (adaptador compartido,
// server/argentinaStreamersWebData.js) -- pedido explicito del usuario:
// "CARGAR DESDE LA WEB en PLANTELES debe usar CONVOCADOS, NO ESTADISTICAS".
// La version anterior leia "product.roster", campo que la web ya no
// publica (confirmado 2026-10-08: ahora trae "rosterIds"), asi que estaba
// rota de todos modos.
//
// Seguridad de datos: si la web no publica convocados para esa rama, o la
// consulta falla, el plantel actual NO se toca -- se informa el estado.
// Identidad estable: un jugador que ya estaba en el plantel con el mismo
// "webId" conserva su id interno (Ficha Jugador/Estrellas/Formacion lo
// referencian), nunca se regenera por re-sincronizar.
import {
  refreshArgentinaStreamersWebData,
  getWebEntry,
  normalizeRama,
  ramaForTeamId,
} from './argentinaStreamersWebData.js';
import { getRoster, saveRoster } from './playerRosters.js';

const THEME_ID = 'argentinaStreamers';

export async function syncRosterFromWeb(teamId, ramaInput) {
  // Rama: la elegida en el panel; si no llego, la que le corresponde al
  // equipo (argentina-streamers -> masculino, -fem -> femenino). Un rival
  // sin rama no tiene datos en esta web.
  const rama = ramaInput ? normalizeRama(ramaInput) : ramaForTeamId(teamId);
  const current = getRoster(THEME_ID, teamId);
  if (!rama) {
    return { status: 'sin-datos-equipo', mensaje: 'NO HAY DATOS WEB PARA ESTE EQUIPO', snapshot: current };
  }

  const refresh = await refreshArgentinaStreamersWebData(['convocados']);
  const entry = getWebEntry('convocados', rama);
  if (!refresh.ok) {
    return {
      status: 'error', rama, snapshot: current, detalle: refresh.error,
      mensaje: 'NO SE PUDO ACTUALIZAR — SE CONSERVAN LOS ÚLTIMOS DATOS VÁLIDOS',
    };
  }
  if (entry.ultimoResultado !== 'ok' || !entry.data?.jugadores?.length) {
    return {
      status: 'vacio', rama, snapshot: current,
      mensaje: 'SIN CONVOCADOS PUBLICADOS PARA ESTA RAMA — SE CONSERVA LA LISTA ACTUAL',
      ultimoValido: entry.ultimaActualizacion
        ? { fecha: entry.ultimaActualizacion, cantidad: entry.data?.jugadores?.length || 0, partido: entry.data?.partido || null }
        : null,
    };
  }

  const previousByWebId = new Map((current?.jugadores || []).filter((j) => j.webId).map((j) => [j.webId, j]));
  const jugadores = entry.data.jugadores.map((p) => {
    const previous = previousByWebId.get(p.webId);
    return {
      id: previous?.id,
      dorsal: p.dorsal,
      nombre: p.nombre,
      apellido: p.apellido,
      apodo: p.apodo,
      nombreCompleto: p.nombreCompleto,
      webId: p.webId,
      slug: p.slug,
      metadata: { ...(previous?.metadata || {}), position: p.posicion, photoUrl: p.photoUrl, rama },
    };
  });

  const snapshot = saveRoster(THEME_ID, teamId, jugadores, 'argentina-streamers-web', {
    ramaWeb: rama,
    partidoWeb: entry.data.partido || null,
  });
  return { status: 'ok', rama, snapshot, partido: entry.data.partido || null };
}
