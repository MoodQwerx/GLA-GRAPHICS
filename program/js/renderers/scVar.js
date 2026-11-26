// VAR — GLA SUPERCOPA (SOFTX [5]). Sobre el PNG real "var.png" (ZOCALOS_VAR:
// la misma placa en 3 posiciones del lienzo; se dibuja SOLO la elegida en
// "posicion"): franja clara arriba ("VAR" + decisión) y franja oscura abajo
// (EN REVISIÓN / DECISIÓN / motivo). Misma lógica que el VAR de la COPA:
// decisión con un clic (BB_VAR_DECISIONS), motivo opcional; en CHEQUEO VAR un
// punto rojo late. Cambiar la decisión / el motivo al aire NO rearma la placa:
// el PNG queda quieto y solo vuelven a entrar los textos.
import { varDecision } from '../../../shared/bb-match.js';
import { SC_VAR_SLOTS } from '../../../shared/sc-assets.js';
import { anim, escapeHtml, upper, shell, fitFontPx, adj, contentSignature, applyLayer, backgroundUrl, sliceHtml, cardIcon, SC_FONT_TEXT } from './sc-common.js';

const FULL_BOX = { x: 0, y: 0, w: 1920, h: 1080 };

export function renderScVar(contentEl, data, justTaken) {
  const d = varDecision(data?.decision);
  const motivo = upper(String(data?.motivo || '').trim());
  const slotId = SC_VAR_SLOTS[data?.posicion] ? data.posicion : 'abajoIzq';
  const S = SC_VAR_SLOTS[slotId];
  const bg = backgroundUrl('scVar');
  const signature = contentSignature('scVar', [d.id, motivo, slotId]);
  if (!justTaken && contentEl._scSig === signature) {
    applyLayer(contentEl, data);
    return;
  }
  const onAir = !justTaken && contentEl._scBuilt === true && contentEl._scVarSlot === slotId;
  contentEl._scSig = signature;
  contentEl._scBuilt = true;
  contentEl._scVarSlot = slotId;
  const [x0, , x1] = S.rect;
  const w = x1 - x0;
  const light = [x0, S.light[0], x1, S.light[1]];
  const dark = [x0, S.dark[0], x1, S.dark[1]];
  const checking = d.id === 'chequeo';
  const label = upper(d.label);
  const badgeW = Math.round(w * 0.27);
  const px = fitFontPx(label, { maxPx: Math.round((S.light[1] - S.light[0]) * 0.66), minPx: 16, maxWidth: w - badgeW - 26, letterSpacing: 0.02 });
  // v2 (2026-11-25): una decisión FINAL (GOL, NO GOL, PENAL, NO PENAL, TARJETA
  // ROJA) se titula DECISIÓN CONFIRMADA (con el motivo a continuación, si hay).
  const final = !checking && d.id !== 'confirmada';
  const lower = final ? (motivo ? `DECISIÓN CONFIRMADA · ${motivo}` : 'DECISIÓN CONFIRMADA') : (motivo || upper(d.kicker));
  const mpx = fitFontPx(lower, { maxPx: Math.round((S.dark[1] - S.dark[0]) * 0.56), minPx: 11, maxWidth: w - 40, family: SC_FONT_TEXT, weight: 700, letterSpacing: 0.08 });
  const bgHtml = bg ? `<div class="sc-bg sc-sliced">
      ${sliceHtml({ id: 'clara', rect: [x0 - 2, light[1] - 2, x1 + 2, light[3]], anim: 'wipe-r', d: 0, o: 0.16, dur: 0.46, durOut: 0.26 }, bg, FULL_BOX)}
      ${sliceHtml({ id: 'oscura', rect: [x0 - 2, dark[1], x1 + 2, dark[3] + 2], anim: 'wipe-r', d: 0.12, o: 0.04, dur: 0.46, durOut: 0.24 }, bg, FULL_BOX)}
    </div>` : '';
  contentEl.innerHTML = shell('scVar', 'var', data, adj('Plate', `
    ${adj('Badge', `<div class="sc-var-badge sc-a m-sc" ${anim(0.3, 0.12, `left:${x0}px;top:${light[1]}px;width:${badgeW}px;height:${light[3] - light[1]}px`)}><b>VAR</b></div>`)}
    ${adj('Decision', `<div class="sc-var-decision sc-a m-sw" ${anim(0.42, 0.06, `left:${x0 + badgeW + 8}px;top:${light[1]}px;width:${w - badgeW - 18}px;height:${light[3] - light[1]}px;font-size:calc(${px}px * var(--sc-font))`)}>${d.id === 'roja' ? cardIcon('redCard', 'sc-var-card') : ''}<span>${escapeHtml(label)}</span></div>`)}
    ${adj('Motivo', `<div class="sc-var-lower${motivo ? ' is-motivo' : ''} sc-a m-sw" ${anim(0.52, 0.02, `left:${x0 + 16}px;top:${dark[1]}px;width:${w - 28}px;height:${dark[3] - dark[1]}px;font-size:calc(${mpx}px * var(--sc-font))`)}>${checking ? '<i class="sc-var-live"></i>' : ''}<span>${escapeHtml(lower)}</span></div>`)}
  `), { bgHtml, extraClass: `sc-var-${slotId}` });
  if (onAir) for (const el of contentEl.querySelectorAll('.sc-slice, .sc-var-badge')) el.classList.add('sc-static');
}
