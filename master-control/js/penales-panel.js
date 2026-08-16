// Panel a medida para Marcador de Penales: unico control extra que
// necesita este modulo es el toggle de "MUERTE SÚBITA" (2026-08-15,
// pedido explicito del usuario). No hay asset ni elemento nuevo del lado
// de Program -- el renderer (program/js/renderers/marcadorPenales.js) le
// agrega el texto al mismo titulo que ya existe cuando este flag esta
// activo, asi que aca solo hace falta el boton.
export function renderPenalesPanel(container, data, onDirty) {
  const box = document.createElement('div');
  box.className = 'clock-box';

  const title = document.createElement('div');
  title.className = 'clock-box-title';
  title.textContent = 'MUERTE SÚBITA';
  box.appendChild(title);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = data.suddenDeath ? 'btn-clock btn-clock-danger active' : 'btn-clock';
  btn.textContent = data.suddenDeath ? 'MUERTE SÚBITA: ACTIVADA (tocar para desactivar)' : 'ACTIVAR MUERTE SÚBITA';
  btn.addEventListener('click', () => {
    data.suddenDeath = !data.suddenDeath;
    btn.classList.toggle('active', data.suddenDeath);
    btn.classList.toggle('btn-clock-danger', data.suddenDeath);
    btn.textContent = data.suddenDeath ? 'MUERTE SÚBITA: ACTIVADA (tocar para desactivar)' : 'ACTIVAR MUERTE SÚBITA';
    onDirty();
  });
  box.appendChild(btn);

  container.appendChild(box);
}
