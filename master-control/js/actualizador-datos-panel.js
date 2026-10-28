// ACTUALIZADOR DE DATOS (2026-10-21, pedido explicito del usuario, SOLO
// GLA): modulo administrativo (no es una grafica: sin TAKE/OUT/PREVIEW,
// mismo patron que EQUIPOS/PLANTELES). Elige de que edicion del TORNEO
// toman datos los "ACTUALIZAR DESDE WEB" con FUENTE = TORNEO. Cambiar la
// edicion solo guarda la preferencia: no actualiza ningun modulo (cada uno
// se actualiza con su propio boton).
import {
  getGlaTorneoEdicion, getGlaTorneoEdiciones, loadGlaTorneoEdicion, setGlaTorneoEdicion,
} from './gla-torneo-source.js';

const CONSUMIDORES = 'Goleadores, Asistidores y Jugadores (con FUENTE = TORNEO), Posiciones Torneo, Grupos A/B, Resultados (fase de grupos y playoffs) y Estrellas (con FUENTE = TORNEO). Los módulos con FUENTE = LIGA no cambian.';

export function renderActualizadorDatosPanel(container) {
  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'performance-editor performance-editor--actualizador';
  container.appendChild(root);

  let status = null;
  let verificacion = null;
  let verificando = false;

  async function guardar(key) {
    try {
      const res = await fetch('/api/gla/torneo-edicion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setGlaTorneoEdicion(body.edicion);
      status = { kind: 'success', text: `GUARDADO — los próximos ACTUALIZAR DESDE WEB de TORNEO toman datos de ${body.edicion.label}. No se actualizó ningún módulo todavía.` };
    } catch (error) {
      status = { kind: 'error', text: `NO SE PUDO GUARDAR LA EDICIÓN: ${error.message}` };
    }
    render();
  }

  async function verificar() {
    verificando = true;
    render();
    try {
      const res = await fetch('/api/gla/torneo-ediciones/verificar');
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      verificacion = body.ediciones;
      status = null;
    } catch (error) {
      status = { kind: 'error', text: `NO SE PUDO CONSULTAR gla.futbol: ${error.message}` };
    }
    verificando = false;
    render();
  }

  function render() {
    root.innerHTML = '';
    const actual = getGlaTorneoEdicion();

    const desc = document.createElement('p');
    desc.className = 'performance-note';
    desc.textContent = `Edición del TORNEO de gla.futbol que usan los botones ACTUALIZAR DESDE WEB de: ${CONSUMIDORES} Cambiar la edición NO actualiza nada solo: después actualizá cada módulo con su botón.`;
    root.appendChild(desc);

    const field = document.createElement('label');
    field.className = 'field';
    const label = document.createElement('span');
    label.textContent = 'TORNEO / EDICIÓN';
    const select = document.createElement('select');
    for (const edicion of getGlaTorneoEdiciones()) {
      const option = document.createElement('option');
      option.value = edicion.key;
      option.textContent = edicion.label;
      select.appendChild(option);
    }
    select.value = actual?.key || '';
    select.disabled = !getGlaTorneoEdiciones().length;
    select.addEventListener('change', () => guardar(select.value));
    field.append(label, select);
    root.appendChild(field);

    const current = document.createElement('p');
    current.className = 'performance-sync-updated-at';
    current.textContent = actual ? `FUENTE ACTUAL: ${actual.label}` : 'Cargando edición...';
    root.appendChild(current);

    const row = document.createElement('div');
    row.className = 'performance-sync';
    const verifyBtn = document.createElement('button');
    verifyBtn.type = 'button';
    verifyBtn.className = 'performance-sync-btn';
    verifyBtn.textContent = verificando ? 'CONSULTANDO gla.futbol...' : 'VERIFICAR EDICIONES EN LA WEB';
    verifyBtn.disabled = verificando;
    verifyBtn.addEventListener('click', verificar);
    row.appendChild(verifyBtn);
    if (status) {
      const statusEl = document.createElement('span');
      statusEl.className = `performance-sync-status ${status.kind}`;
      statusEl.textContent = status.text;
      row.appendChild(statusEl);
    }
    root.appendChild(row);

    if (verificacion) {
      const list = document.createElement('div');
      list.className = 'performance-note';
      for (const e of verificacion) {
        const line = document.createElement('p');
        line.style.margin = '4px 0';
        if (!e.existe) {
          line.textContent = `✗ ${e.label}: no existe en gla.futbol.`;
        } else if (!e.publicado) {
          line.textContent = `⚠ ${e.label} ("${e.nombreWeb}", estado: ${e.estado || '—'}): existe pero todavía no publica datos.`;
        } else {
          line.textContent = `✓ ${e.label} ("${e.nombreWeb}", estado: ${e.estado || '—'}): ${e.equipos} equipos, ${e.grupos} grupos, ${e.posiciones} posiciones, ${e.goleadores} goleadores, ${e.asistidores} asistidores, ${e.partidosPlayoff} partidos de playoff.`;
        }
        if (e.key === actual?.key) line.style.fontWeight = '800';
        list.appendChild(line);
      }
      root.appendChild(list);
    }
  }

  render();
  loadGlaTorneoEdicion().then(() => render());
  return () => {};
}
