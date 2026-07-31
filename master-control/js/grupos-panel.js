import { TEAM_OPTIONS } from '../../shared/teams.js';

const VARIANTS = [
  { id: 'grupo1', label: 'Grupo 1' },
  { id: 'grupo2', label: 'Grupo 2' },
];

// Panel dedicado (no el editor generico de schema, ver docs/ARCHITECTURE.md):
// el editor generico (field-editors.js) no tiene un tipo de campo que
// combine un SELECT de equipo por fila con una cantidad de filas fija (sin
// agregar/quitar) que ademas cambia segun la variante elegida — mismo
// criterio que el panel dedicado de Formacion (formation-list-panel.js),
// pero con filas de cantidad fija en vez de lista libre.
//
// Cada variante (grupo1/grupo2) guarda su propio arreglo "filas" por
// separado en "data" — son grupos de equipos distintos, cambiar el
// selector no pisa lo cargado en el otro grupo. Escudo y nombre completo
// NUNCA se escriben a mano: se derivan siempre del mismo catalogo de
// equipos que usa el Marcador principal (TEAM_OPTIONS/crestFile/teamName,
// shared/teams.js) a partir del "teamId" elegido en el desplegable.
export function renderGruposPanel(container, data, onDirty) {
  const root = document.createElement('div');
  root.className = 'grupos-editor';
  container.appendChild(root);

  function render() {
    root.innerHTML = '';

    const varianteField = document.createElement('div');
    varianteField.className = 'field';
    const varianteLabel = document.createElement('label');
    varianteLabel.textContent = 'Variante (asset a mostrar)';
    varianteField.appendChild(varianteLabel);
    const varianteSelect = document.createElement('select');
    for (const opt of VARIANTS) {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      varianteSelect.appendChild(option);
    }
    varianteSelect.value = data.variante || 'grupo1';
    varianteSelect.addEventListener('change', () => {
      data.variante = varianteSelect.value;
      onDirty();
      render();
    });
    varianteField.appendChild(varianteSelect);
    root.appendChild(varianteField);

    const variante = data.variante === 'grupo2' ? 'grupo2' : 'grupo1';
    const filas = data[variante].filas;

    const section = document.createElement('section');
    section.className = 'grupos-rows-section';
    const heading = document.createElement('h2');
    heading.textContent = VARIANTS.find((v) => v.id === variante).label.toUpperCase();
    section.appendChild(heading);

    filas.forEach((fila, index) => {
      const row = document.createElement('div');
      row.className = 'grupos-row';

      const teamSelect = document.createElement('select');
      teamSelect.setAttribute('aria-label', `Equipo, fila ${index + 1}`);
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        teamSelect.appendChild(option);
      }
      teamSelect.value = fila.teamId || '';
      teamSelect.addEventListener('change', () => {
        fila.teamId = teamSelect.value;
        onDirty();
      });
      row.appendChild(teamSelect);

      const puntosInput = document.createElement('input');
      puntosInput.type = 'text';
      puntosInput.inputMode = 'numeric';
      puntosInput.placeholder = 'Pts';
      puntosInput.className = 'grupos-puntos-input';
      puntosInput.value = fila.puntos ?? '';
      puntosInput.addEventListener('input', () => {
        fila.puntos = puntosInput.value;
        onDirty();
      });
      row.appendChild(puntosInput);

      section.appendChild(row);
    });

    const note = document.createElement('p');
    note.className = 'grupos-limit-note';
    note.textContent = `El asset de ${VARIANTS.find((v) => v.id === variante).label} trae ${filas.length} casilleros de equipo — la cantidad de filas no se puede cambiar.`;
    section.appendChild(note);

    root.appendChild(section);
  }

  render();
  return () => {};
}
