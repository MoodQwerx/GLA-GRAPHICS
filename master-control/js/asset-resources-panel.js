// RECURSO GRÁFICO (SOFTX, 2026-10-29): sección compacta dentro de cada
// módulo con asset externo. Lista cada recurso por separado (ej. TARJETA:
// AMARILLA / ROJA / AZUL) con ABRIR CARPETA y RECARGAR propios. Solo manda
// IDs del registro central (shared/asset-registry.js); el servidor resuelve
// la ruta real (server/asset-resources.js).

// Secciones abiertas por el operador en esta sesión (sobrevive al re-render
// del panel, no se persiste).
const openModules = new Set();
// Último resultado de RECARGAR/ABRIR por recurso (se ve tras re-renders).
const lastResults = new Map();

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function describeProbe(probe) {
  if (!probe?.exists) return 'NO EXISTE';
  const parts = [probe.format];
  if (probe.codec) parts.push(probe.codec);
  if (probe.width && probe.height) parts.push(`${probe.width}x${probe.height}`);
  if (probe.fps) parts.push(`${probe.fps} FPS`);
  if (probe.durationSec) parts.push(`${probe.durationSec.toFixed(2)} s`);
  if (probe.stackedAlpha !== undefined) parts.push(probe.stackedAlpha ? 'alfa apilado ✓' : 'sin alfa apilado');
  else if (probe.hasAlpha !== undefined) parts.push(probe.hasAlpha ? 'transparencia ✓' : 'sin transparencia');
  if (probe.sizeBytes) parts.push(`${(probe.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  return parts.join(' · ');
}

// options: { isOnAir(moduleId) -> bool, onReloaded(moduleId) }
export function renderAssetResources(container, moduleId, options = {}) {
  container.innerHTML = '';
  let disposed = false;

  const load = async () => {
    let assets;
    try {
      const res = await fetch(`/api/assets/module/${encodeURIComponent(moduleId)}`);
      const data = await res.json();
      assets = data?.ok ? data.assets : [];
    } catch {
      assets = [];
    }
    if (disposed || !container.isConnected) return;
    render(assets);
  };

  function render(assets) {
    container.innerHTML = '';
    if (!assets.length) return;
    const box = el('details', 'asset-res');
    box.open = openModules.has(moduleId);
    box.addEventListener('toggle', () => {
      if (box.open) openModules.add(moduleId); else openModules.delete(moduleId);
    });
    const summary = el('summary', 'asset-res-summary');
    summary.appendChild(el('span', 'asset-res-title', assets.length > 1 ? `RECURSOS GRÁFICOS (${assets.length})` : 'RECURSO GRÁFICO'));
    summary.appendChild(el('span', 'asset-res-summary-file', assets.length > 1 ? assets.map((a) => a.label.toUpperCase()).join(' · ') : assets[0].fileName));
    if (assets.some((a) => a.warnings.length)) summary.appendChild(el('span', 'asset-res-warn-dot', '⚠'));
    box.appendChild(summary);

    const note = el('p', 'asset-res-note', 'Para cambiar la pieza: ABRIR CARPETA, reemplazá el archivo con el MISMO nombre y apretá RECARGAR. No manda nada al aire.');
    box.appendChild(note);

    for (const asset of assets) box.appendChild(buildRow(asset));
    container.appendChild(box);
  }

  function buildRow(asset) {
    const row = el('div', 'asset-res-row');
    const head = el('div', 'asset-res-head');
    head.appendChild(el('span', 'asset-res-label', asset.label.toUpperCase()));
    head.appendChild(el('code', 'asset-res-file', asset.fileName));
    row.appendChild(head);

    row.appendChild(el('div', 'asset-res-line', `CARPETA: ${asset.folder}/`));
    row.appendChild(el('div', 'asset-res-line', `FORMATO ESPERADO: ${asset.expected}`));
    row.appendChild(el('div', 'asset-res-line', `ARCHIVO ACTUAL: ${describeProbe(asset.probe)}`));
    for (const warning of asset.warnings) row.appendChild(el('div', 'asset-res-warning', warning));

    const actions = el('div', 'asset-res-actions');
    const openBtn = el('button', 'asset-res-btn', 'ABRIR CARPETA');
    openBtn.type = 'button';
    const reloadBtn = el('button', 'asset-res-btn primary', 'RECARGAR');
    reloadBtn.type = 'button';
    actions.append(openBtn, reloadBtn);
    const status = el('div', 'asset-res-status');
    const previous = lastResults.get(asset.id);
    if (previous) {
      status.className = `asset-res-status ${previous.kind}`;
      status.textContent = previous.text;
    }
    row.append(actions, status);

    const setStatus = (kind, text) => {
      lastResults.set(asset.id, { kind, text });
      status.className = `asset-res-status ${kind}`;
      status.textContent = text;
    };

    openBtn.addEventListener('click', async () => {
      try {
        const data = await postJson('/api/assets/open-folder', { assetId: asset.id });
        setStatus('success', data.archivo ? `CARPETA ABIERTA — ${asset.fileName} seleccionado.` : `CARPETA ABIERTA — ${asset.fileName} no existe todavía: copialo ahí.`);
      } catch (err) {
        setStatus('error', `NO SE PUDO ABRIR LA CARPETA: ${err.message}`);
      }
    });

    reloadBtn.addEventListener('click', async () => {
      reloadBtn.disabled = true;
      try {
        const data = await postJson('/api/assets/reload', { assetId: asset.id });
        const result = data.asset;
        const onAir = options.isOnAir?.(asset.moduleId);
        const base = result.probe.exists
          ? (data.changed ? 'RECURSO RECARGADO: se usa el archivo nuevo.' : 'RECURSO RECARGADO (el archivo no cambió desde la última carga).')
          : 'EL ARCHIVO NO EXISTE: Program conserva lo último que tenía cargado.';
        const where = onAir
          ? ' El módulo está AL AIRE: el recurso nuevo se aplica cuando salga del aire (próximo TAKE).'
          : ' Preview actualizado; Program lo usa en el próximo TAKE.';
        const text = [`${base}${result.probe.exists ? where : ''}`, `CARGADO: ${describeProbe(result.probe)}`, ...result.warnings].join('\n');
        setStatus(result.warnings.length || !result.probe.exists ? 'warning' : 'success', text);
        options.onReloaded?.(asset.moduleId);
        await load();
      } catch (err) {
        setStatus('error', `NO SE PUDO RECARGAR: ${err.message}`);
        reloadBtn.disabled = false;
      }
    });
    return row;
  }

  load();
  return () => { disposed = true; };
}
