import { glaAssetPath } from '../../../shared/asset-registry.js';
import { versionedAssetUrl } from '../asset-versions.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { getActiveThemeId } from '../theme-client.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { DEFAULT_THEME_ID, getThemeAsset } from '../../../shared/themes.js';
import { normalizePlayers } from '../../../shared/player-lists.js';
import { teamColorHex } from '../../../shared/team-colors.js';
import { applyElementAdjust, applyPlainTextAdjust, readTextAdjust, toBroadcastUpper } from '../text-fit.js';

const VIDEO_SRC = glaAssetPath('formacionEquipos', 'principal');
const SHIRTS_BASE_SRC = glaAssetPath('formacionEquipos', 'camisetas');
const SHIRTS_WHITE_SRC = glaAssetPath('formacionEquipos', 'camisetasBlancas');
// GLA conserva su asset original (6 camisetas, sin arquero dibujado) tal
// cual estaba. Argentina Streamers pasa a 11 (2026-09-03, pedido explicito
// del usuario: "una formacion de futbol tiene que permitir 11 titulares")
// porque "formacion-arg/oxen/peru.png" YA tienen las 11 posiciones dibujadas
// -- medidas pixel a pixel (ver overlay.css), el sistema solo las tapaba con
// un clip-path. No hay variante por asset/equipo: los 3 PNG miden igual
// (centros de camiseta iguales +/-3px en los 3, ver informe de medicion).
const STARTER_LIMIT_GLA = 6;
const STARTER_LIMIT_ARGENTINA = 11;
const ARGENTINA_CONTENT_DELAY = '700ms';

function getStarterLimit() {
  return getActiveThemeId() === DEFAULT_THEME_ID ? STARTER_LIMIT_GLA : STARTER_LIMIT_ARGENTINA;
}

function resolveFormationShirts(teamId) {
  const themeId = getActiveThemeId();
  if (themeId === DEFAULT_THEME_ID) return versionedAssetUrl(SHIRTS_BASE_SRC);
  return versionedAssetUrl(getThemeAsset(themeId, 'formacionEquipos')?.formationAssetsByTeam?.[teamId] || null);
}

function setCrest(img, teamId) {
  const src = crestFile(teamId);
  if (src) {
    img.src = src;
    img.alt = teamName(teamId);
    img.style.visibility = 'visible';
  } else {
    img.removeAttribute('src');
    img.alt = '';
    img.style.visibility = 'hidden';
  }
}

function buildStructure(el, starterLimit, isGla) {
  const slots = Array.from({ length: starterLimit }, (_, index) => `
    <div class="ov-formacion-slot ov-formacion-slot-${index}">
      <div class="ov-formacion-number"></div>
      <div class="ov-formacion-player-name"></div>
    </div>
  `).join('');

  // "data-adjust=crest" (2026-09-04): SOLO GLA -- dispara el mecanismo
  // generico de Program (applyElementAdjustRegistry) que lee el registro
  // de shared/adjust-registry.js (entrada "crest", ahora "themeOnly:'gla'",
  // exactamente como funcionaba antes de esta tarea). Argentina Streamers
  // NO lo lleva: su posicion por equipo se resuelve 100% a mano mas abajo
  // (crestByTeam) -- si tambien llevara el atributo, el mecanismo generico
  // pisaria ese calculo con el valor plano de siempre, rompiendo el
  // guardado por equipo en cuanto hubiera una posicion especifica guardada.
  el.innerHTML = `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <img class="ov-formacion-shirts" src="${versionedAssetUrl(SHIRTS_BASE_SRC)}" alt="" />
      <div class="ov-formacion-shirts-wrap">
        <img class="ov-formacion-shirts-white" src="${versionedAssetUrl(SHIRTS_WHITE_SRC)}" alt="" />
        <div class="ov-formacion-shirts-tint"></div>
      </div>
      ${slots}
      <img class="ov-formacion-crest" alt="" ${isGla ? 'data-adjust="crest"' : ''} />
      <div class="ov-formacion-subs-title">SUPLENTES</div>
      <div class="ov-formacion-subs-viewport"></div>
    </div>
  `;
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'formacionEquipos', VIDEO_SRC);
  el._gfxBuilt = true;
}

// Sin campo de color propio: el equipo (y por lo tanto el color real de la
// camiseta) se leen en vivo de "scoreboard" (5to argumento, allData) segun
// "teamSide" -- mismo patron que el escudo, ver mas abajo. No se duplica el
// catalogo de colores (shared/team-colors.js, mismo helper que usa el
// Marcador principal).
export default function renderFormacionEquipos(contentEl, data, justTaken, onOneShotEnded, allData) {
  const starterLimit = getStarterLimit();
  const isGla = getActiveThemeId() === DEFAULT_THEME_ID;
  // Reconstruye si cambia el theme en caliente (6 titulares GLA <-> 11
  // Argentina Streamers, con o sin "data-adjust=crest" -- ver
  // buildStructure): mismo criterio que "signature" en
  // performanceTable.js -- sin esto, un cambio de theme sin recargar la
  // pagina dejaba el DOM viejo (6 u 11 slots fijos desde el primer render).
  const signature = String(starterLimit);
  // "signatureChanged" (2026-09-23, mismo bug/fix que tarjeta.js/vs.js/
  // shortDouble.js -- ver comentario en tarjeta.js): marcar
  // "_gfxBuilt = false" sin destruir el "_alphaVideo" antes de reconstruir
  // dejaba el contexto/video anterior huerfano, y como "justTaken" es
  // false en un cambio de theme en caliente, el video nuevo tampoco se
  // reproducia. En la practica el cambio de theme YA fuerza un teardown
  // completo de todos los modulos antes (ver program/js/main.js), asi que
  // esta rama rara vez llega a ejecutarse con un "_alphaVideo" previo real
  // -- se corrige de todos modos por prolijidad/consistencia con el resto.
  const signatureChanged = contentEl.dataset.signature !== undefined && contentEl.dataset.signature !== signature;
  if (contentEl.dataset.signature !== signature) {
    contentEl.dataset.signature = signature;
    if (signatureChanged && contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    contentEl._gfxBuilt = false;
  }
  if (!contentEl._gfxBuilt) buildStructure(contentEl, starterLimit, isGla);
  if (justTaken || signatureChanged) contentEl._alphaVideo?.playFromStart();

  const sb = (allData && allData.scoreboard) || {};
  const isVisitor = data.teamSide === 'visitor';
  const teamId = isVisitor ? sb.teamB : sb.teamA;
  const shirts = contentEl.querySelector('.ov-formacion-shirts');
  const shirtsSrc = resolveFormationShirts(teamId);
  if (shirtsSrc) {
    shirts.src = shirtsSrc;
    shirts.style.visibility = 'visible';
  } else {
    shirts.removeAttribute('src');
    shirts.style.visibility = 'hidden';
  }
  contentEl.querySelector('.ov-formacion-shirts-wrap').style.display = isGla ? '' : 'none';
  const shirtsAdjust = data.formationKitByTeam?.[teamId] || {};
  applyElementAdjust(shirts, {
    offsetX: shirtsAdjust.offsetX || 0,
    offsetY: shirtsAdjust.offsetY || 0,
    scale: shirtsAdjust.scale || 1,
  });

  // La entrada nueva queda estructuralmente armada a ~0,67 s. El brillo
  // posterior es decorativo y no debe demorar los datos. GLA conserva sus
  // 1200 ms definidos en overlay.css.
  const moduleRoot = contentEl.closest('.gfx');
  if (moduleRoot) {
    if (isGla) moduleRoot.style.removeProperty('--dur-content-delay');
    else moduleRoot.style.setProperty('--dur-content-delay', ARGENTINA_CONTENT_DELAY);
  }
  const crestEl = contentEl.querySelector('.ov-formacion-crest');
  setCrest(crestEl, teamId);
  // Posicion del escudo POR EQUIPO (2026-09-04, pedido explicito del
  // usuario, SOLO Argentina Streamers): mismo patron ya probado arriba
  // para "formationKitByTeam" (sin "data-adjust" en AS -- se removio del
  // <img> a proposito para este theme, se resuelve 100% aca para no
  // duplicar aplicacion). Si todavia no existe una posicion guardada para
  // este teamId puntual, usa el valor plano "crestOffsetX/Y/Scale" (el
  // mismo que ya existia antes de este cambio) como fallback -- asi la
  // posicion actual, ya acomodada por el usuario, NO se mueve para ningun
  // equipo hasta que el operador guarde una especifica desde el nuevo
  // control del panel. GLA NO entra aca: su <img> SI lleva
  // "data-adjust=crest" (ver buildStructure), el mecanismo generico de
  // Program ya se lo aplica solo -- llamarlo tambien aca lo pisaria con el
  // mismo valor (inofensivo hoy, pero redundante y innecesario).
  if (!isGla) {
    const crestAdjust = data.crestByTeam?.[teamId] || {};
    applyElementAdjust(crestEl, {
      offsetX: crestAdjust.crestOffsetX ?? data.crestOffsetX ?? 0,
      offsetY: crestAdjust.crestOffsetY ?? data.crestOffsetY ?? 0,
      scale: crestAdjust.crestScale ?? data.crestScale ?? 1,
    });
  }

  if (isGla) contentEl.querySelector('.ov-formacion-shirts-tint').style.backgroundColor = teamColorHex(sb, isVisitor ? 'B' : 'A');

  // "playerName"/"playerNumber" (2026-08-15, auditoria completa): ajuste
  // compartido por las 6 posiciones (mismo criterio "column-level" que las
  // tablas dinamicas de este sistema, ver Posiciones/Resultados) -- se lee
  // una sola vez fuera del loop, mismo objeto aplicado a las 6.
  const ta = data.textAdjust;
  const nameAdjust = readTextAdjust(ta, 'playerName');
  const numberAdjust = readTextAdjust(ta, 'playerNumber');
  // Orden de carga (2026-09-10, pedido explicito del usuario, item 11):
  // "starters[0]" es SIEMPRE el arquero, seguido de la defensa (derecha a
  // izquierda), el mediocampo (derecha a izquierda) y el ataque (derecha a
  // izquierda) -- "de abajo hacia arriba y de derecha a izquierda dentro de
  // cada linea". El asset de 11 posiciones (Argentina Streamers) dibuja
  // exactamente esa formacion en el orden INVERSO de indice de slot (medido
  // por coordenadas reales en overlay.css: slot-10 es el unico solo/abajo
  // = arquero; slots 6-9 = linea de defensa; slots 2-5 = mediocampo; slots
  // 0-1 = ataque, arriba) -- por eso "slotIndex = (starterLimit-1)-index"
  // hace exactamente ese mapeo sin tocar el dato ni el CSS existente. GLA
  // (6 posiciones, sin arquero dibujado en el asset, ver comentario de
  // "STARTER_LIMIT_GLA" arriba) conserva el orden directo de siempre.
  const starters = normalizePlayers(data.starters).slice(0, starterLimit);
  for (let index = 0; index < starterLimit; index++) {
    const slotIndex = isGla ? index : (starterLimit - 1 - index);
    const slot = contentEl.querySelector(`.ov-formacion-slot-${slotIndex}`);
    const player = starters[index] || { number: '', name: '' };
    applyPlainTextAdjust(slot.querySelector('.ov-formacion-number'), player.number, numberAdjust);
    applyPlainTextAdjust(slot.querySelector('.ov-formacion-player-name'), player.name, nameAdjust);
    slot.style.visibility = player.number || player.name ? 'visible' : 'hidden';
  }

  applyPlainTextAdjust(contentEl.querySelector('.ov-formacion-subs-title'), 'SUPLENTES', readTextAdjust(ta, 'subsTitle'));

  const subsViewport = contentEl.querySelector('.ov-formacion-subs-viewport');
  renderSubstitutes(subsViewport, normalizePlayers(data.substitutes));
  applySubstitutesAdjust(subsViewport, readTextAdjust(ta, 'subsList'));
}

// Ajuste de posicion/tamaño del bloque completo de suplentes (2026-08-15,
// auditoria completa): aparte de "renderSubstitutes" (que solo reconstruye
// cuando cambia la lista o el alto visible, ver signature/measuredHeight
// mas abajo) porque tiene que aplicarse en TODOS los renders, incluidos los
// que no reconstruyen nada. "dx"/"dy" van sobre el viewport (translate, no
// interfiere con el recorte por overflow que ya tiene esa caja); "dSize" se
// suma sobre el tamaño BASE que ya calculo renderSubstitutes segun la
// cantidad de suplentes (guardado en dataset.baseFontSize, ver mas abajo)
// -- nunca sobre un tamaño ya ajustado de una vuelta anterior, para que
// cambiar la cantidad de suplentes seguya recalculando bien el tamaño base.
function applySubstitutesAdjust(viewport, adjust = {}) {
  const { dx = 0, dy = 0, dSize = 0 } = adjust;
  viewport.style.translate = `${dx}px ${dy}px`;
  viewport.querySelectorAll('.ov-formacion-subs-list').forEach((list) => {
    const base = parseFloat(list.dataset.baseFontSize) || 0;
    if (base) list.style.fontSize = `${Math.max(1, base + dSize)}px`;
  });
}

function renderSubstitutes(viewport, players) {
  const signature = JSON.stringify(players);
  const visibleHeight = viewport.clientHeight;
  if (
    visibleHeight > 0
    && viewport.dataset.signature === signature
    && viewport.dataset.measuredHeight === String(visibleHeight)
  ) return;
  viewport.dataset.signature = signature;
  viewport.dataset.measuredHeight = String(visibleHeight);
  viewport.classList.remove('is-scrolling');
  viewport.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'ov-formacion-subs-list';
  const baseFontSize = players.length > 12 ? 16
    : players.length > 10 ? 18
    : players.length > 8 ? 22
    : players.length > 6 ? 26
    : 30;
  list.style.fontSize = `${baseFontSize}px`;
  // Base sin ajuste (2026-08-15, auditoria completa): "applySubstitutesAdjust"
  // lo lee para sumarle "dSize" sin perder de donde partir -- cloneNode(true)
  // mas abajo copia tambien este dataset, asi que el clon de la marquesina
  // (si el contenido no entra y hay que animar el scroll) lo hereda solo.
  list.dataset.baseFontSize = String(baseFontSize);
  for (const player of players) {
    const row = document.createElement('div');
    row.className = 'ov-formacion-sub';
    row.textContent = toBroadcastUpper(player.number ? `${player.number} - ${player.name}` : player.name);
    list.appendChild(row);
  }
  viewport.appendChild(list);

  if (visibleHeight === 0 || list.scrollHeight <= visibleHeight) return;

  const track = document.createElement('div');
  track.className = 'ov-formacion-subs-track';
  const clone = list.cloneNode(true);
  track.append(list, clone);
  viewport.replaceChildren(track);
  const distance = list.scrollHeight + 22;
  track.style.setProperty('--subs-distance', `${distance}px`);
  track.style.setProperty('--subs-duration', `${Math.max(12, distance / 18)}s`);
  viewport.classList.add('is-scrolling');
}
