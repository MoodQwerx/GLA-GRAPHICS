import { ADJUST_REGISTRY } from '../../shared/adjust-registry.js';
import { DEFAULT_THEME_ID } from '../../shared/themes.js';
import { applyElementAdjust } from './text-fit.js';
import { getActiveThemeId } from './theme-client.js';

// FUENTE UNICA DE VERDAD para "AJUSTE DE COMPOSICIÓN" (2026-09-26, pedido
// explicito del usuario: "Preview y Program deben renderizar EXACTAMENTE
// la misma composición... no quiero dos sistemas de render"). Extraido de
// program/js/main.js (donde vivia hasta ahora, unico consumidor real) para
// que program/js/preview-main.js pueda aplicar la MISMA logica en vez de
// una copia -- cualquier fix futuro a como se interpreta un offset/scale
// se escribe una sola vez y beneficia a los dos buses (Program real y
// Preview) por igual.
//
// "AJUSTE DE COMPOSICIÓN": posicion X/Y + escala de TODO un modulo como
// una unidad rigida, capa ADICIONAL sobre el diseño base ("posicion final
// = base + offset", "escala final = base × ajuste") -- ver shared/
// modules.js (compositionOffsetX/Y/Scale, mezclados en cloneDefaults()
// para cualquier modulo) y master-control/js/composition-control.js (UI).
//
// Se aplica sobre ".content" (NO sobre "#mod-<id>"), a proposito: varios
// modulos ya tienen su PROPIO "transform" declarado en CSS sobre
// "#mod-<id>" para su posicion de diseño (ej. "#mod-marcadorZocalo",
// "#mod-shortDouble") -- pisarlo con estilo inline desde aca borraria esa
// posicion base. ".content" es el nodo que cada renderer llena via
// "contentEl.innerHTML" (ver program/js/renderers/*.js): ningun renderer
// toca jamas "contentEl.style" directamente, asi que este es el UNICO
// punto de la cadena que puede reclamar esa propiedad sin colisionar con
// nada existente.
//
// GOL SIGUE AL MARCADOR (2026-10-21, pedido explicito del usuario, SOLO
// GLA): la animacion de GOL acompaña cualquier ajuste de composicion del
// MARCADOR PRINCIPAL. Su propio "compositionOffsetX/Y/Scale" pasa a ser el
// AJUSTE FINO RELATIVO al Marcador:
//   posicion final = desplazamiento del Marcador + ajuste propio de GOL
//   escala final   = escala del Marcador × ajuste propio de GOL
// Los dos modulos son "full stage" con el mismo transform-origin
// (960,540, ver ".content" en overlay.css), asi que sumar el mismo
// desplazamiento/escala conserva exactamente su relacion visual. Se usan
// los valores VIGENTES del Marcador (los mismos que pinta Program), nunca
// su base guardada: GUARDAR POSICIÓN del Marcador no mueve nada. Argentina
// Streamers conserva su GOL independiente, sin cambios.
export function composedCompositionData(moduleId, data, allData) {
  if (moduleId !== 'gol' || getActiveThemeId() !== DEFAULT_THEME_ID) return data;
  const sb = allData?.scoreboard;
  if (!sb) return data;
  return {
    compositionOffsetX: (sb.compositionOffsetX || 0) + (data.compositionOffsetX || 0),
    compositionOffsetY: (sb.compositionOffsetY || 0) + (data.compositionOffsetY || 0),
    compositionScale: (sb.compositionScale || 1) * (data.compositionScale || 1),
  };
}

export function applyComposition(target, data, moduleId, allData) {
  const source = moduleId ? composedCompositionData(moduleId, data, allData) : data;
  const dx = source.compositionOffsetX || 0;
  const dy = source.compositionOffsetY || 0;
  const scale = source.compositionScale || 1;
  target.content.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
}

// Registro declarativo de ajuste individual (ver shared/adjust-registry.js
// para el contrato completo). Corre SIEMPRE junto a "applyComposition" para
// cualquier modulo con entradas "kind:'composition'" en su registro.
// Resuelve, para un elemento "crestTeam", el override POR EQUIPO guardado
// en "data.crestByTeam" -- null si no hay equipo resuelto o si ese equipo
// todavia no tiene una posicion propia guardada. El teamId sale SIEMPRE
// del Marcador ("allData.scoreboard.teamA/teamB", el mismo criterio que ya
// usan estos renderers para el escudo en si). "allData" es la misma
// referencia que Program llama "latestData" (snapshot de todos los
// modulos) y Preview arma desde el "draft" completo de Master Control --
// ambos exponen "allData.scoreboard" con la misma forma.
function resolveCrestTeamOverride(entry, data, allData) {
  const sb = allData?.scoreboard;
  if (!sb) return null;
  let slot;
  let teamId;
  if (entry.crestTeam === 'dynamic') {
    const isVisitante = data.equipo === 'visitante';
    slot = isVisitante ? 'away' : 'local';
    teamId = isVisitante ? sb.teamB : sb.teamA;
  } else if (entry.crestTeam === 'B') {
    slot = 'away';
    teamId = sb.teamB;
  } else {
    slot = 'local';
    teamId = sb.teamA;
  }
  // "crestSlot" (ZÓCALO VS, 2026-10-09): slot propio por variante en vez de
  // local/away -- el equipo sigue saliendo del mismo lado del Marcador.
  if (entry.crestSlot) slot = entry.crestSlot;
  return (teamId && data.crestByTeam?.[slot]?.[teamId]) || null;
}

export function applyElementAdjustRegistry(id, target, data, allData) {
  const entries = ADJUST_REGISTRY[id]?.elements;
  if (!entries || !entries.length) return;
  for (const entry of entries) {
    if (entry.kind !== 'composition') continue;
    // "querySelectorAll" (no "querySelector"): cubre tanto el caso de un
    // unico elemento (escudo/logo/sponsor puntual) como el de tablas con
    // filas repetidas -- un mismo id "data-adjust" puede marcar VARIOS
    // nodos (una fila cada uno), y el mismo offset de columna se les
    // aplica a todos por igual.
    const els = target.content.querySelectorAll(`[data-adjust="${entry.id}"]`);
    if (!els.length) continue;
    const override = entry.crestTeam ? resolveCrestTeamOverride(entry, data, allData) : null;
    const source = override || data;
    const adjustValue = {
      offsetX: source[entry.xKey],
      offsetY: source[entry.yKey],
      scale: source[entry.scaleKey],
    };
    els.forEach((el) => applyElementAdjust(el, adjustValue));
  }
}
