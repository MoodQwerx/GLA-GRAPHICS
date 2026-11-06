// VAR — BAULETI vs BALANZA (SOFTX [3], FASE 2). Placa compacta arriba a la
// derecha, a la altura del Marcador (conviven): bloque dorado "VAR" con el
// mismo corte del reloj, placa negra con la decisión y, si hay, una tira con
// el MOTIVO debajo. En CHEQUEO VAR un punto rojo late y un barrido dorado
// recorre la placa (en revisión); las decisiones quedan quietas.
//
// Cambiar la decisión con la placa al aire (ACTUALIZAR) no rearma el bloque
// ni la placa: solo vuelven a entrar los textos.
import { varDecision } from '../../../shared/bb-match.js';
import { anim, upper, fitFontPx, escapeHtml, cardIconHtml } from './bb-common.js';

export default function renderBbVar(contentEl, data, justTaken) {
  const d = varDecision(data?.decision);
  const motivo = upper(String(data?.motivo || '').trim());
  const signature = JSON.stringify([d.id, motivo]);
  if (!justTaken && contentEl._bbSignature === signature) return;
  const rebuildOnAir = !justTaken && contentEl._bbBuilt === true;
  contentEl._bbSignature = signature;
  contentEl._bbBuilt = true;

  const checking = d.id === 'chequeo';
  const label = upper(d.label);
  const px = fitFontPx(label, { maxPx: 34, minPx: 24, maxWidth: 440 });

  contentEl.innerHTML = `
    <div class="bb bb-varwrap">
      <div class="bb-var">
        <div class="bb-var-main">
          <div class="bb-var-badgewrap bb-a bb-var-frame" ${anim(0, 0)}>
            <div class="bb-var-badge"><span class="bb-var-screen"></span>VAR<div class="bb-glint" style="--d:0.7s"></div></div>
          </div>
          <div class="bb-var-plate bb-a bb-var-frame" ${anim(0.14, 0)}>
            ${checking ? '<div class="bb-var-scan"></div>' : ''}
            <div class="bb-var-kicker bb-a" ${anim(0.42, 0)}>${checking ? '<i class="bb-var-live"></i>' : ''}${escapeHtml(d.kicker)}</div>
            <div class="bb-var-text bb-a" ${anim(0.48, 0, `font-size:${px}px`)}>${d.id === 'roja' ? cardIconHtml('redCard') : ''}${escapeHtml(label)}</div>
          </div>
        </div>
        ${motivo ? `<div class="bb-var-motivo bb-a" ${anim(0.6, 0)}>${escapeHtml(motivo)}</div>` : ''}
      </div>
    </div>`;
  // Con la placa al aire, la estructura queda quieta y solo entran los textos
  // (".bb-keep" no toca a los hijos, a diferencia de ".bb-static").
  if (rebuildOnAir) for (const el of contentEl.querySelectorAll('.bb-var-frame')) el.classList.add('bb-keep');
}
