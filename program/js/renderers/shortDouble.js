import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';
import { resolveTeamTokens } from '../../../shared/text-tokens.js';
import { mountThemedAlphaVideo } from '../theme-assets.js';
import { getActiveThemeId } from '../theme-client.js';
import { DEFAULT_THEME_ID } from '../../../shared/themes.js';
import { GLA_SEGOE_BOLD_FAMILY } from '../program-fonts.js';

const VIDEO_SRC = '/assets/zocalos/zocalo-corto-doble-alpha.mp4';

const NAME_MAX_FONT = 41;
const NAME_MIN_FONT = 24;
const ROLE_MAX_FONT = 22;
const ROLE_MIN_FONT = 14;
const BOX_WIDTH = 500;
const SAFETY_MARGIN = 20;
const MAX_WIDTH = BOX_WIDTH - SAFETY_MARGIN;

function pairMarkup() {
  return `
    <div class="av-target"></div>
    <div class="gfx-overlay">
      <div class="ov-short-double-name"></div>
      <div class="ov-short-double-role"></div>
    </div>
  `;
}

function buildSingleStructure(el) {
  el.innerHTML = pairMarkup();
  el._alphaVideo = mountThemedAlphaVideo(el.querySelector('.av-target'), 'shortDouble', VIDEO_SRC);
  el._gfxBuilt = true;
}

function buildDoubleStructure(el) {
  el.innerHTML = `
    <div class="ov-short-double-pair ov-short-double-pair-1">${pairMarkup()}</div>
    <div class="ov-short-double-pair ov-short-double-pair-2">${pairMarkup()}</div>
  `;
  const video1 = mountThemedAlphaVideo(el.querySelector('.ov-short-double-pair-1 .av-target'), 'shortDouble', VIDEO_SRC);
  const video2 = mountThemedAlphaVideo(el.querySelector('.ov-short-double-pair-2 .av-target'), 'shortDouble', VIDEO_SRC);
  // Wrapper "combinado" (2026-08-21, sistema multi-theme): cualquiera de
  // los dos puede ser null si el theme activo todavía no tiene este
  // asset -- cada método solo llama a los handles que de verdad existen.
  el._alphaVideo = (video1 || video2) ? {
    playFromStart() { video1?.playFromStart(); video2?.playFromStart(); },
    destroy() { video1?.destroy(); video2?.destroy(); },
  } : null;
  el._gfxBuilt = true;
}

// "family" (2026-09-24, pedido explicito: "Segoe UI Bold", SOLO GLA) --
// mismo criterio que longSimple.js/shortSimple.js.
function fillPair(root, name, role, textAdjust, nameKey, roleKey, isExplicitUpdate, prevStore, sb) {
  const nameEl = root.querySelector('.ov-short-double-name');
  const roleEl = root.querySelector('.ov-short-double-role');
  const newName = resolveTeamTokens(name || '', sb);
  const newRole = resolveTeamTokens(role || '', sb);
  const oldName = prevStore[nameKey];
  const oldRole = prevStore[roleKey];
  const family = getActiveThemeId() === DEFAULT_THEME_ID ? GLA_SEGOE_BOLD_FAMILY : undefined;

  updateFittedTextWithTransition(nameEl, newName, oldName, {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: MAX_WIDTH, weight: 800, family,
  }, readTextAdjust(textAdjust, nameKey), isExplicitUpdate);

  updateFittedTextWithTransition(roleEl, newRole, oldRole, {
    maxFont: ROLE_MAX_FONT, minFont: ROLE_MIN_FONT, maxWidth: MAX_WIDTH, weight: 600, letterSpacing: 1, family,
  }, readTextAdjust(textAdjust, roleKey), isExplicitUpdate);

  prevStore[nameKey] = newName;
  prevStore[roleKey] = newRole;
}

export default function renderShortDouble(contentEl, data, justTaken, onOneShotEnded, allData) {
  const mode = data.airMode === 'double' ? 'double' : 'single';
  const sb = allData && allData.scoreboard;
  // "modeChanged" (2026-09-23, mismo bug/fix que tarjeta.js/vs.js -- ver
  // comentario en tarjeta.js): pasar de individual a doble (o viceversa)
  // CON LA GRAFICA AL AIRE armaba la estructura nueva sin destruir la
  // vieja (huerfana) ni reproducir el/los video(s) nuevos.
  const modeChanged = contentEl.dataset.airMode !== undefined && contentEl.dataset.airMode !== mode;

  if (!contentEl._gfxBuilt || modeChanged) {
    if (contentEl._alphaVideo) contentEl._alphaVideo.destroy();
    if (mode === 'double') buildDoubleStructure(contentEl); else buildSingleStructure(contentEl);
    contentEl.dataset.airMode = mode;
  }
  if (justTaken || modeChanged) contentEl._alphaVideo?.playFromStart();

  if (!contentEl._prevStore) contentEl._prevStore = {};
  const isExplicitUpdate = !justTaken;

  const adjust = data.textAdjust;
  if (mode === 'single') {
    // "double1" es LA fuente para el modo individual (2026-09-10, pedido
    // explicito del usuario: "que el zócalo doble 1 sea el zócalo
    // individual") -- ya no existe un "data.name/role" aparte, mandar un
    // solo zocalo y mandar dos siempre leen del mismo lugar.
    const double1 = data.double1 || {};
    fillPair(contentEl, double1.name, double1.role, adjust, 'double1.name', 'double1.role', isExplicitUpdate, contentEl._prevStore, sb);
  } else {
    const double1 = data.double1 || {};
    const double2 = data.double2 || {};
    fillPair(contentEl.querySelector('.ov-short-double-pair-1'), double1.name, double1.role, adjust, 'double1.name', 'double1.role', isExplicitUpdate, contentEl._prevStore, sb);
    fillPair(contentEl.querySelector('.ov-short-double-pair-2'), double2.name, double2.role, adjust, 'double2.name', 'double2.role', isExplicitUpdate, contentEl._prevStore, sb);
  }
}
