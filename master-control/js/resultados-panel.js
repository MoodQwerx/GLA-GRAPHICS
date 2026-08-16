import { TEAM_OPTIONS } from '../../shared/teams.js';
import { mountAdjustControl } from './field-editors.js';

// "AJUSTE DE TEXTOS" (2026-08-15, auditoria completa): Resultados es una
// tabla dinamica (hasta 9 encuentros, 6 visibles a la vez por tanda) -- un
// unico ajuste por COLUMNA se aplica a todos los encuentros visibles,
// mismo criterio que Posiciones/Goleadores. "estado" y "estadoFullscreen"
// son elementos DISTINTOS en el DOM (ver program/js/renderers/
// sideTable.js): el primero se ve cuando hay goles cargados, el segundo
// cuando el encuentro todavia no tiene resultado (PROXIMO/HORA/etc.) -- se
// ajustan por separado porque tienen su propia caja/tamaño de fuente.
const ADJUST_COLUMNS = [
  { key: 'golLocal', label: 'Columna Gol Local' },
  { key: 'golVisitante', label: 'Columna Gol Visitante' },
  { key: 'estado', label: 'Estado (modo compacto, con goles)' },
  { key: 'estadoFullscreen', label: 'Estado (modo fullscreen, sin goles)' },
  { key: 'tituloBracket', label: 'Título de encuentro (arriba del estado/hora)' },
];

const POSICIONES = [
  { id: 'placaL', label: 'PLACA L' },
  { id: 'fullscreenDerecha', label: 'FULLSCREEN — ABAJO DERECHA' },
  { id: 'fullscreenIzquierda', label: 'FULLSCREEN — ABAJO IZQUIERDA' },
];

const ESTADOS = [
  { id: 'final', label: 'FINAL' },
  { id: 'proximo', label: 'PRÓXIMO' },
  { id: 'entretiempo', label: 'ENTRETIEMPO' },
  { id: 'en_juego', label: 'EN JUEGO' },
  { id: 'suspendido', label: 'SUSPENDIDO' },
  { id: 'hora', label: 'HORA ESPECÍFICA' },
];

const MAX_ENCUENTROS = 9;
const VISIBLE_ENCUENTROS = 6;

export function renderResultadosPanel(container, data, onDirty) {
  const root = document.createElement('div');
  root.className = 'resultados-editor';
  container.appendChild(root);

  // Inicializar encuentros si no existen
  if (!data.encuentros) {
    data.encuentros = [
      { teamA: '', teamB: '', scoreA: '0', scoreB: '0', status: 'final', hora: '', titulo: '' }
    ];
  }
  // Encuentros creados antes de agregar "titulo" (2026-08-15) no lo tienen.
  for (const encuentro of data.encuentros) {
    if (typeof encuentro.titulo !== 'string') encuentro.titulo = '';
  }
  if (!data.snapshotsWeb || typeof data.snapshotsWeb !== 'object') data.snapshotsWeb = {};
  let syncStatus = null;

  async function syncFromWeb(fase) {
    syncStatus = { kind: 'loading', fase, text: 'Actualizando...' };
    render();
    try {
      const response = await fetch(`/api/resultados/${fase}/sync-web`, { method: 'POST' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || `HTTP ${response.status}`);
      data.faseWeb = fase;
      data.snapshotsWeb = body.snapshotsWeb || data.snapshotsWeb;
      data.encuentros = body.encuentros;
      data.tanda = 'tanda1';
      data.ultimaActualizacionWeb = body.ultimaActualizacionWeb;
      syncStatus = { kind: 'success', fase, text: 'RESULTADOS ACTUALIZADOS', unmatchedTeams: body.unmatchedTeams || [] };
      onDirty();
    } catch (error) {
      syncStatus = { kind: 'error', fase, text: 'ERROR AL ACTUALIZAR', detail: error.message };
    }
    render();
  }

  function render() {
    root.innerHTML = '';

    const syncRow = document.createElement('div');
    syncRow.className = 'performance-sync resultados-sync';
    for (const [fase, label] of [
      ['grupos', 'ACTUALIZAR RESULTADOS DE FASE DE GRUPOS'],
      ['playoffs', 'ACTUALIZAR RESULTADOS DE PLAYOFFS'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'performance-sync-btn';
      button.textContent = label;
      button.disabled = syncStatus?.kind === 'loading';
      button.addEventListener('click', () => syncFromWeb(fase));
      syncRow.appendChild(button);
    }
    if (syncStatus) {
      const status = document.createElement('span');
      status.className = `performance-sync-status ${syncStatus.kind}`;
      status.textContent = syncStatus.text;
      if (syncStatus.detail) status.title = syncStatus.detail;
      syncRow.appendChild(status);
    }
    root.appendChild(syncRow);
    if (syncStatus?.unmatchedTeams?.length) {
      const warning = document.createElement('p');
      warning.className = 'performance-sync-warning';
      warning.textContent = `Sin equipo local equivalente para: ${syncStatus.unmatchedTeams.join(', ')}`;
      root.appendChild(warning);
    }

    // --- Posición ---
    const posicionField = document.createElement('div');
    posicionField.className = 'field';
    const posicionLabel = document.createElement('label');
    posicionLabel.textContent = 'Posición';
    posicionField.appendChild(posicionLabel);
    
    const posicionSelect = document.createElement('select');
    for (const opt of POSICIONES) {
      const option = document.createElement('option');
      option.value = opt.id;
      option.textContent = opt.label;
      posicionSelect.appendChild(option);
    }
    posicionSelect.value = data.posicion || 'placaL';
    posicionSelect.addEventListener('change', () => {
      data.posicion = posicionSelect.value;
      onDirty();
    });
    posicionField.appendChild(posicionSelect);
    root.appendChild(posicionField);

    // --- Título General ---
    const tituloField = document.createElement('div');
    tituloField.className = 'field';
    const tituloLabel = document.createElement('label');
    tituloLabel.textContent = 'Título General';
    tituloField.appendChild(tituloLabel);
    
    const tituloInput = document.createElement('input');
    tituloInput.type = 'text';
    tituloInput.value = data.titulo ?? 'RESULTADOS';
    tituloInput.placeholder = 'Escribe el título superior...';
    tituloInput.addEventListener('input', () => {
      data.titulo = tituloInput.value;
      onDirty();
    });
    tituloField.appendChild(tituloInput);
    mountAdjustControl(tituloField, data, 'titulo', onDirty);
    root.appendChild(tituloField);

    // --- Tanda / vista ---
    // Maximo 6 brackets a la vez en Program (composicion aprobada, no se
    // achica para hacer entrar mas): con 7-9 encuentros, esta tanda decide
    // que ventana de 6 se muestra -- tanda1 = partidos 1-6, tanda2 =
    // partidos 4 en adelante (los mismos 4/5/6 suben y entran 7/8/9 desde
    // abajo, ver program/js/renderers/sideTable.js). Sin rotacion
    // automatica: el control manual es el que pidio el usuario que exista
    // si o si, y evita meter un timer sincronizado por red.
    const tandaField = document.createElement('div');
    tandaField.className = 'field';
    const tandaLabel = document.createElement('label');
    tandaLabel.textContent = 'TANDA / VISTA';
    tandaField.appendChild(tandaLabel);

    const tandaSelect = document.createElement('select');
    tandaSelect.setAttribute('aria-label', 'TANDA / VISTA');

    const tanda1Option = document.createElement('option');
    tanda1Option.value = 'tanda1';
    tanda1Option.textContent = 'PARTIDOS 1–6';
    tandaSelect.appendChild(tanda1Option);

    const tanda2Option = document.createElement('option');
    tanda2Option.value = 'tanda2';
    tanda2Option.textContent = 'PARTIDOS 4–9';
    tanda2Option.disabled = data.encuentros.length <= VISIBLE_ENCUENTROS;
    tandaSelect.appendChild(tanda2Option);

    tandaSelect.value = data.encuentros.length > VISIBLE_ENCUENTROS && data.tanda === 'tanda2'
      ? 'tanda2'
      : 'tanda1';
    tandaSelect.addEventListener('change', () => {
      data.tanda = tandaSelect.value;
      onDirty();
    });
    tandaField.appendChild(tandaSelect);
    root.appendChild(tandaField);

    // --- Sección de Encuentros ---
    const section = document.createElement('section');
    section.className = 'resultados-encuentros-section';
    
    const heading = document.createElement('h3');
    heading.textContent = 'ENCUENTROS';
    heading.style.marginTop = '20px';
    heading.style.marginBottom = '10px';
    section.appendChild(heading);

    data.encuentros.forEach((encuentro, index) => {
      const card = document.createElement('div');
      card.className = 'resultados-encuentro-card';
      card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      card.style.padding = '15px';
      card.style.marginBottom = '15px';
      card.style.borderRadius = '6px';
      card.style.background = 'rgba(255, 255, 255, 0.02)';

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.justifyContent = 'space-between';
      titleRow.style.alignItems = 'center';
      titleRow.style.marginBottom = '10px';

      const cardTitle = document.createElement('h4');
      cardTitle.textContent = `Encuentro ${index + 1}`;
      cardTitle.style.margin = '0';
      titleRow.appendChild(cardTitle);

      // Botón Eliminar
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = 'ELIMINAR';
      deleteBtn.className = 'btn-danger';
      deleteBtn.style.padding = '4px 8px';
      deleteBtn.style.fontSize = '12px';
      deleteBtn.style.cursor = 'pointer';
      
      // Permitir borrar siempre que haya al menos 1 encuentro
      if (data.encuentros.length <= 1) {
        deleteBtn.disabled = true;
        deleteBtn.style.opacity = '0.5';
        deleteBtn.style.cursor = 'not-allowed';
      } else {
        deleteBtn.addEventListener('click', () => {
          data.encuentros.splice(index, 1);
          if (data.encuentros.length <= VISIBLE_ENCUENTROS) data.tanda = 'tanda1';
          onDirty();
          render();
        });
      }
      titleRow.appendChild(deleteBtn);
      card.appendChild(titleRow);

      // Fila de Equipos y Goles
      const teamsRow = document.createElement('div');
      teamsRow.style.display = 'grid';
      teamsRow.style.gridTemplateColumns = '1fr 60px 60px 1fr';
      teamsRow.style.gap = '10px';
      teamsRow.style.marginBottom = '10px';

      // Equipo Local
      const localSelect = document.createElement('select');
      localSelect.setAttribute('aria-label', `Equipo Local, encuentro ${index + 1}`);
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        localSelect.appendChild(option);
      }
      localSelect.value = encuentro.teamA || '';
      localSelect.addEventListener('change', () => {
        encuentro.teamA = localSelect.value;
        onDirty();
      });

      // Goles Local
      const localScore = document.createElement('input');
      localScore.type = 'text';
      localScore.value = encuentro.scoreA ?? '0';
      localScore.placeholder = '0';
      localScore.style.textAlign = 'center';
      localScore.addEventListener('input', () => {
        encuentro.scoreA = localScore.value;
        onDirty();
      });

      // Goles Visitante
      const visitorScore = document.createElement('input');
      visitorScore.type = 'text';
      visitorScore.value = encuentro.scoreB ?? '0';
      visitorScore.placeholder = '0';
      visitorScore.style.textAlign = 'center';
      visitorScore.addEventListener('input', () => {
        encuentro.scoreB = visitorScore.value;
        onDirty();
      });

      // Equipo Visitante
      const visitorSelect = document.createElement('select');
      visitorSelect.setAttribute('aria-label', `Equipo Visitante, encuentro ${index + 1}`);
      for (const opt of TEAM_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        visitorSelect.appendChild(option);
      }
      visitorSelect.value = encuentro.teamB || '';
      visitorSelect.addEventListener('change', () => {
        encuentro.teamB = visitorSelect.value;
        onDirty();
      });

      teamsRow.appendChild(localSelect);
      teamsRow.appendChild(localScore);
      teamsRow.appendChild(visitorScore);
      teamsRow.appendChild(visitorSelect);
      card.appendChild(teamsRow);

      // Título individual (aparece arriba del estado/hora en Program, ej.
      // "SEMIS 1" / "GRAN FINAL" -- ver program/js/renderers/sideTable.js).
      // La posicion/tamaño de este texto se ajusta por columna, junto con
      // el resto de "AJUSTE DE TEXTOS" mas abajo (mismo criterio que
      // golLocal/estado/etc.).
      const tituloEncField = document.createElement('div');
      tituloEncField.className = 'field';
      const tituloEncLabel = document.createElement('label');
      tituloEncLabel.textContent = 'Título del encuentro';
      tituloEncField.appendChild(tituloEncLabel);

      const tituloEncInput = document.createElement('input');
      tituloEncInput.type = 'text';
      tituloEncInput.value = encuentro.titulo ?? '';
      tituloEncInput.placeholder = 'Ej: SEMIS 1, GRAN FINAL...';
      tituloEncInput.setAttribute('aria-label', `Título, encuentro ${index + 1}`);
      tituloEncInput.addEventListener('input', () => {
        encuentro.titulo = tituloEncInput.value;
        onDirty();
      });
      tituloEncField.appendChild(tituloEncInput);
      card.appendChild(tituloEncField);

      // Fila de Estado e Info adicional
      const statusRow = document.createElement('div');
      statusRow.style.display = 'grid';
      statusRow.style.gridTemplateColumns = '1fr 1fr';
      statusRow.style.gap = '10px';

      // Selector de Estado
      const statusSelect = document.createElement('select');
      statusSelect.setAttribute('aria-label', `Estado, encuentro ${index + 1}`);
      for (const opt of ESTADOS) {
        const option = document.createElement('option');
        option.value = opt.id;
        option.textContent = opt.label;
        statusSelect.appendChild(option);
      }
      statusSelect.value = encuentro.status || 'final';

      // Campo de hora (se habilita solo si es HORA ESPECÍFICA)
      const horaInput = document.createElement('input');
      horaInput.type = 'text';
      horaInput.value = encuentro.hora ?? '';
      horaInput.placeholder = 'Ej: 18:00 o 20:30';
      horaInput.style.display = statusSelect.value === 'hora' ? 'block' : 'none';

      statusSelect.addEventListener('change', () => {
        encuentro.status = statusSelect.value;
        horaInput.style.display = statusSelect.value === 'hora' ? 'block' : 'none';
        
        // Lógica visual del estado: Ocultar o deshabilitar goles en los inputs si corresponde
        const ocultaGoles = statusSelect.value === 'proximo' || statusSelect.value === 'hora';
        localScore.disabled = ocultaGoles;
        visitorScore.disabled = ocultaGoles;
        if (ocultaGoles) {
          localScore.style.opacity = '0.4';
          visitorScore.style.opacity = '0.4';
        } else {
          localScore.style.opacity = '1';
          visitorScore.style.opacity = '1';
        }
        
        onDirty();
      });

      // Aplicar estado inicial de deshabilitado de goles al cargar
      const ocultaGolesInicial = statusSelect.value === 'proximo' || statusSelect.value === 'hora';
      localScore.disabled = ocultaGolesInicial;
      visitorScore.disabled = ocultaGolesInicial;
      if (ocultaGolesInicial) {
        localScore.style.opacity = '0.4';
        visitorScore.style.opacity = '0.4';
      }

      horaInput.addEventListener('input', () => {
        encuentro.hora = horaInput.value;
        onDirty();
      });

      statusRow.appendChild(statusSelect);
      statusRow.appendChild(horaInput);
      card.appendChild(statusRow);

      section.appendChild(card);
    });

    root.appendChild(section);

    // --- Ajuste de textos (column-level, aplica a todos los encuentros visibles) ---
    const adjustSection = document.createElement('section');
    const adjustHeading = document.createElement('h3');
    adjustHeading.textContent = 'AJUSTE DE TEXTOS (por columna)';
    adjustHeading.style.marginTop = '20px';
    adjustHeading.style.marginBottom = '10px';
    adjustSection.appendChild(adjustHeading);
    for (const { key, label } of ADJUST_COLUMNS) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      wrap.appendChild(lbl);
      mountAdjustControl(wrap, data, key, onDirty);
      adjustSection.appendChild(wrap);
    }
    root.appendChild(adjustSection);

    // --- Footer y Botón Añadir ---
    const footer = document.createElement('div');
    footer.style.marginTop = '15px';
    footer.style.display = 'flex';
    footer.style.flexDirection = 'column';
    footer.style.gap = '8px';

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = 'AÑADIR ENCUENTRO';
    addBtn.className = 'btn';
    addBtn.style.padding = '10px';
    addBtn.style.fontWeight = 'bold';
    addBtn.style.cursor = 'pointer';

    const limitReached = data.encuentros.length >= MAX_ENCUENTROS;
    if (limitReached) {
      addBtn.disabled = true;
      addBtn.style.opacity = '0.5';
      addBtn.style.cursor = 'not-allowed';

      const warning = document.createElement('p');
      warning.textContent = `Límite alcanzado: máximo de ${MAX_ENCUENTROS} encuentros cargados.`;
      warning.style.color = '#e74c3c';
      warning.style.fontSize = '13px';
      warning.style.margin = '0';
      warning.style.fontWeight = 'bold';
      footer.appendChild(warning);
    } else {
      addBtn.addEventListener('click', () => {
        if (data.encuentros.length === VISIBLE_ENCUENTROS) data.tanda = 'tanda1';
        data.encuentros.push({
          teamA: '',
          teamB: '',
          scoreA: '0',
          scoreB: '0',
          status: 'final',
          hora: '',
          titulo: ''
        });
        onDirty();
        render();
      });
    }

    footer.appendChild(addBtn);
    root.appendChild(footer);
  }

  render();
  return () => {};
}
