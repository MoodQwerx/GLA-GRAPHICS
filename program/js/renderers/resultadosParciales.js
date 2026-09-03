import { resolveImageSrc } from '../theme-assets.js';
import { crestFile, teamName } from '../../../shared/teams.js';
import { applyFittedText, updateFittedTextWithTransition, readTextAdjust } from '../text-fit.js';

const DEFAULT_TITULO = 'RESULTADOS PARCIALES';

const TITULO_MAX_FONT = 28;
const TITULO_MIN_FONT = 16;
const TITULO_MAX_WIDTH = 340;

const NAME_MAX_FONT = 18;
const NAME_MIN_FONT = 11;
const NAME_MAX_WIDTH = 90;

const SCORE_MAX_FONT = 22;
const SCORE_MIN_FONT = 14;
const SCORE_MAX_WIDTH = 30;

const ESTADO_MAX_FONT = 14;
const ESTADO_MIN_FONT = 10;
const ESTADO_MAX_WIDTH = 70;

function setCrest(imgEl, teamId) {
  if (!imgEl) return;
  const src = crestFile(teamId);
  if (src) {
    imgEl.src = src;
    imgEl.alt = teamName(teamId) || teamId;
    imgEl.style.visibility = 'visible';
  } else {
    imgEl.removeAttribute('src');
    imgEl.alt = '';
    imgEl.style.visibility = 'hidden';
  }
}

function buildStructure(el) {
  el.innerHTML = `
    <div class="ov-resparc-card" style="position: absolute; left: 1517px; top: 120px; width: 386px; min-height: 340px; background: rgba(8, 8, 10, 0.92); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.12); padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); transform: translate(-29px, 0);">
      <img class="gfx-bg-img" style="display:none; position:absolute; left:0; top:0; width:386px; height:100%; object-fit:cover; border-radius:8px;" />
      <div class="gfx-overlay" style="position:relative; z-index:2;">
        
        <!-- TÍTULO -->
        <div style="border-bottom: 2px solid rgba(255, 193, 7, 0.6); padding-bottom: 10px; margin-bottom: 16px; text-align: center;">
          <div class="ov-resparc-titulo" style="font-family: var(--font-display); color: #ffffff; font-weight: 800; text-transform: uppercase;"></div>
        </div>
        
        <!-- PARTIDO 1 -->
        <div class="ov-resparc-match-1" style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 8px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <!-- LOCAL -->
            <div style="display: flex; align-items: center; gap: 6px; width: 110px;">
              <img class="ov-resparc-crest-local-1" style="width: 32px; height: 32px; object-fit: contain;" />
              <div class="ov-resparc-name-local-1" style="font-family: var(--font-display); color: #ffffff; font-weight: 700; text-transform: uppercase;"></div>
            </div>
            
            <!-- MARCADOR -->
            <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
              <div class="ov-resparc-score-local-1" style="font-family: var(--font-display); color: #ffffff; font-weight: 900;"></div>
              <div style="font-family: var(--font-display); color: rgba(255,255,255,0.5); font-size: 16px;">-</div>
              <div class="ov-resparc-score-visitante-1" style="font-family: var(--font-display); color: #ffffff; font-weight: 900;"></div>
            </div>

            <!-- VISITANTE -->
            <div style="display: flex; align-items: center; gap: 6px; width: 110px; justify-content: flex-end;">
              <div class="ov-resparc-name-visitante-1" style="font-family: var(--font-display); color: #ffffff; font-weight: 700; text-transform: uppercase; text-align: right;"></div>
              <img class="ov-resparc-crest-visitante-1" style="width: 32px; height: 32px; object-fit: contain;" />
            </div>
          </div>
          <div class="ov-resparc-estado-1" style="font-family: var(--font-display); color: #ffc107; font-weight: 700; text-align: center; margin-top: 6px;"></div>
        </div>

        <!-- PARTIDO 2 -->
        <div class="ov-resparc-match-2" style="background: rgba(255,255,255,0.04); border-radius: 6px; padding: 10px 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <!-- LOCAL -->
            <div style="display: flex; align-items: center; gap: 6px; width: 110px;">
              <img class="ov-resparc-crest-local-2" style="width: 32px; height: 32px; object-fit: contain;" />
              <div class="ov-resparc-name-local-2" style="font-family: var(--font-display); color: #ffffff; font-weight: 700; text-transform: uppercase;"></div>
            </div>
            
            <!-- MARCADOR -->
            <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">
              <div class="ov-resparc-score-local-2" style="font-family: var(--font-display); color: #ffffff; font-weight: 900;"></div>
              <div style="font-family: var(--font-display); color: rgba(255,255,255,0.5); font-size: 16px;">-</div>
              <div class="ov-resparc-score-visitante-2" style="font-family: var(--font-display); color: #ffffff; font-weight: 900;"></div>
            </div>

            <!-- VISITANTE -->
            <div style="display: flex; align-items: center; gap: 6px; width: 110px; justify-content: flex-end;">
              <div class="ov-resparc-name-visitante-2" style="font-family: var(--font-display); color: #ffffff; font-weight: 700; text-transform: uppercase; text-align: right;"></div>
              <img class="ov-resparc-crest-visitante-2" style="width: 32px; height: 32px; object-fit: contain;" />
            </div>
          </div>
          <div class="ov-resparc-estado-2" style="font-family: var(--font-display); color: #ffc107; font-weight: 700; text-align: center; margin-top: 6px;"></div>
        </div>

      </div>
    </div>
  `;
  el._gfxBuilt = true;
}

export default function renderResultadosParciales(contentEl, data, justTaken) {
  if (!contentEl._gfxBuilt) buildStructure(contentEl);

  const bgImg = contentEl.querySelector('.gfx-bg-img');
  const imageSrc = resolveImageSrc('resultadosParciales', null);
  if (imageSrc) {
    bgImg.src = imageSrc;
    bgImg.style.display = 'block';
  } else {
    bgImg.removeAttribute('src');
    bgImg.style.display = 'none';
  }

  const encuentros = Array.isArray(data.encuentros) ? data.encuentros : [];
  const enc1 = encuentros[0] || { teamA: '', teamB: '', scoreA: '0', scoreB: '0', estado: '' };
  const enc2 = encuentros[1] || { teamA: '', teamB: '', scoreA: '0', scoreB: '0', estado: '' };

  // Título
  const tituloEl = contentEl.querySelector('.ov-resparc-titulo');
  const newTitulo = (data.titulo || '').trim() || DEFAULT_TITULO;
  updateFittedTextWithTransition(tituloEl, newTitulo, contentEl._prevTitulo, {
    maxFont: TITULO_MAX_FONT, minFont: TITULO_MIN_FONT, maxWidth: TITULO_MAX_WIDTH, weight: 800, letterSpacing: 0.5,
  }, readTextAdjust(data.textAdjust, 'titulo'), !justTaken);
  contentEl._prevTitulo = newTitulo;

  // Match 1
  setCrest(contentEl.querySelector('.ov-resparc-crest-local-1'), enc1.teamA);
  setCrest(contentEl.querySelector('.ov-resparc-crest-visitante-1'), enc1.teamB);

  applyFittedText(contentEl.querySelector('.ov-resparc-name-local-1'), teamName(enc1.teamA) || enc1.teamA || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'teamA1'));

  applyFittedText(contentEl.querySelector('.ov-resparc-name-visitante-1'), teamName(enc1.teamB) || enc1.teamB || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'teamB1'));

  applyFittedText(contentEl.querySelector('.ov-resparc-score-local-1'), String(enc1.scoreA ?? '0'), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreA1'));

  applyFittedText(contentEl.querySelector('.ov-resparc-score-visitante-1'), String(enc1.scoreB ?? '0'), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreB1'));

  applyFittedText(contentEl.querySelector('.ov-resparc-estado-1'), enc1.estado || '', {
    maxFont: ESTADO_MAX_FONT, minFont: ESTADO_MIN_FONT, maxWidth: ESTADO_MAX_WIDTH, weight: 700,
  }, readTextAdjust(data.textAdjust, 'estado1'));

  // Match 2
  setCrest(contentEl.querySelector('.ov-resparc-crest-local-2'), enc2.teamA);
  setCrest(contentEl.querySelector('.ov-resparc-crest-visitante-2'), enc2.teamB);

  applyFittedText(contentEl.querySelector('.ov-resparc-name-local-2'), teamName(enc2.teamA) || enc2.teamA || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'teamA2'));

  applyFittedText(contentEl.querySelector('.ov-resparc-name-visitante-2'), teamName(enc2.teamB) || enc2.teamB || '', {
    maxFont: NAME_MAX_FONT, minFont: NAME_MIN_FONT, maxWidth: NAME_MAX_WIDTH, weight: 800,
  }, readTextAdjust(data.textAdjust, 'teamB2'));

  applyFittedText(contentEl.querySelector('.ov-resparc-score-local-2'), String(enc2.scoreA ?? '0'), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreA2'));

  applyFittedText(contentEl.querySelector('.ov-resparc-score-visitante-2'), String(enc2.scoreB ?? '0'), {
    maxFont: SCORE_MAX_FONT, minFont: SCORE_MIN_FONT, maxWidth: SCORE_MAX_WIDTH, weight: 900,
  }, readTextAdjust(data.textAdjust, 'scoreB2'));

  applyFittedText(contentEl.querySelector('.ov-resparc-estado-2'), enc2.estado || '', {
    maxFont: ESTADO_MAX_FONT, minFont: ESTADO_MIN_FONT, maxWidth: ESTADO_MAX_WIDTH, weight: 700,
  }, readTextAdjust(data.textAdjust, 'estado2'));
}
