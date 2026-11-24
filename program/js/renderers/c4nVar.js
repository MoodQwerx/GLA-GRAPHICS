// VAR — COPA 4 NACIONES (SOFTX [4], 2026-11-11). Placa abajo a la izquierda
// sobre el PNG real "zocalo-var.png" (ZOCALO_VAR del diseñador: franja de 4
// colores, bloque azul con "VAR" y papel con la decisión). Misma LÓGICA que el
// VAR de BAULETI vs BALANZA, con la identidad de C4N:
//   - decisión con un clic (BB_VAR_DECISIONS: CHEQUEO VAR, GOL, NO GOL, PENAL,
//     NO PENAL, TARJETA ROJA, DECISIÓN CONFIRMADA) y MOTIVO opcional;
//   - en CHEQUEO VAR un punto rojo late ("EN REVISIÓN") y un barrido recorre
//     el papel; las decisiones quedan quietas;
//   - cambiar la decisión / el motivo con la placa al aire NO rearma la placa
//     (PNG y "VAR" quietos): solo vuelven a entrar los textos.
// Motion: el bloque azul y el papel se revelan de izquierda a derecha (regiones
// del PNG, manifest), "VAR" entra con escala y los textos se barren. OUT al
// revés. Posición / escala: COMPOSICIÓN (mueve PNG + textos juntos) y
// ELEMENTOS para cada texto.
// SPONSORS A LA DERECHA (2026-11-13, MOSTRAR / OCULTAR): el MISMO rotativo del
// ZÓCALO COMPUESTO (carpeta sponsors/, ROTACIÓN e INTERVALO de ese módulo,
// "contain") en un recuadro pegado a la derecha de la placa, con la textura
// navy del recuadro de sponsors del COMPUESTO. Carpeta vacía = no hay
// recuadro (sin error ni marcador). Va dentro de la pieza: sale con el OUT.
import { varDecision } from '../../../shared/bb-match.js';
import { anim, escapeHtml, upper, shell, fitFontPx, adj, tadj, contentSignature, applyLayer, cardIcon, backgroundUrl, C4N_FONT_NUM } from './c4n-common.js';
import { compuestoSponsors } from './c4nTextos.js';

export function renderC4nVar(contentEl, data, justTaken, _onEnded, allData) {
  const d = varDecision(data?.decision);
  const motivo = upper(String(data?.motivo || '').trim());
  const sp = data?.sponsors === 'mostrar' ? compuestoSponsors(allData) : null;
  const spBg = sp?.files.length ? backgroundUrl('c4nZocaloCompuesto') : null;
  const signature = contentSignature('c4nVar', [d.id, motivo, sp ? [sp.files, sp.interval, spBg] : null]);
  if (!justTaken && contentEl._c4nSig === signature) {
    applyLayer(contentEl, data);
    return;
  }
  const onAir = !justTaken && contentEl._c4nBuilt === true;
  contentEl._c4nSig = signature;
  contentEl._c4nBuilt = true;
  const checking = d.id === 'chequeo';
  const label = upper(d.label);
  const px = fitFontPx(label, { maxPx: motivo ? 30 : 36, minPx: 18, maxWidth: 296, family: C4N_FONT_NUM, weight: 400 });
  const mpx = motivo ? fitFontPx(motivo, { maxPx: 16, minPx: 11, maxWidth: 296, family: C4N_FONT_NUM, weight: 400 }) : 0;
  contentEl.innerHTML = shell('c4nVar', 'var', data, `
    <div class="c4n-var-badge c4n-a m-sc" ${anim(0.3, 0.12, tadj('Badge'))}><span class="c4n-var-screen" aria-hidden="true"></span><b>VAR</b></div>
    ${checking ? `<div class="c4n-var-scan c4n-a m-fade" aria-hidden="true" ${anim(0.62, 0)}><i></i></div>` : ''}
    ${adj('Texts', `<div class="c4n-var-texts${motivo ? ' has-motivo' : ''}">
      <div class="c4n-var-kicker c4n-a m-sw" ${anim(0.46, 0.06, tadj('Kicker'))}>${checking ? '<i class="c4n-var-live"></i>' : ''}${escapeHtml(d.kicker)}</div>
      <div class="c4n-var-decision c4n-a m-sw" ${anim(0.54, 0.04, `font-size:calc(${px}px * var(--c4n-font));${tadj('Decision')}`)}>${d.id === 'roja' ? cardIcon('redCard') : ''}${escapeHtml(label)}</div>
      ${motivo ? `<div class="c4n-var-motivo c4n-a m-rise" ${anim(0.64, 0.02, `font-size:calc(${mpx}px * var(--c4n-font));${tadj('Motivo')}`)}>${escapeHtml(motivo)}</div>` : ''}
    </div>`)}
    ${sp?.files.length ? `<div class="c4n-var-sp c4n-a m-wiper" ${anim(0.5, 0.02, `${spBg ? `background-image:url('${escapeHtml(spBg)}');` : ''}${tadj('Sponsors')}`)}>
      <div class="c4n-var-sp-logos c4n-a m-fade" ${anim(0.8, 0)}>${sp.html}</div>
    </div>` : ''}`);
  // Al aire: la placa (PNG + "VAR") queda quieta; solo entran los textos nuevos.
  if (onAir) for (const el of contentEl.querySelectorAll('.c4n-slice, .c4n-var-badge')) el.classList.add('c4n-static');
}
