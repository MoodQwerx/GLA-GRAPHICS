// PANTALLA SORTEO — salida propia /pantalla (GLA SUPERCOPA, 2026-11-25).
// Página aparte de Program (el output real) y de Preview: escucha el estado
// del módulo "scSorteo" (STATE_SNAPSHOT al conectar, MODULE_UPDATE en cada
// cambio del panel) y lo dibuja SIEMPRE con el mismo renderer de Program
// (renderers/scSorteo.js), sin TAKE / OUT ni tickers. Nunca manda nada al
// servidor salvo la conexión.
import { WS_MSG } from '../../shared/constants.js';
import { connect } from '../../shared/ws-client.js';
import { updateLocalTeamCatalog } from '../../shared/teams.js';
import { SUPERCOPA_THEME_ID } from '../../shared/themes.js';
import { initStageScale } from './stage-scale.js';
import { waitForProgramFonts } from './program-fonts.js';
import { setActiveThemeId } from './theme-client.js';
import { setAssetVersions } from './asset-versions.js';
import { renderScSorteo } from './renderers/scSorteo.js';

initStageScale(document.getElementById('stage'));

const root = document.getElementById('mod-scSorteo');
const content = root.querySelector('.content');
const notice = document.getElementById('sc-pantalla-aviso');
let data = null;
let theme = null;
let fontsReady = false;
let first = true;

function paint() {
  if (theme && theme !== SUPERCOPA_THEME_ID) {
    root.classList.add('is-hidden');
    notice.hidden = false;
    return;
  }
  notice.hidden = true;
  if (!data || !fontsReady) return;
  root.classList.remove('is-hidden');
  renderScSorteo(content, data, first);
  first = false;
}

async function onTheme(id) {
  if (!id) return;
  const changed = theme !== id;
  theme = id;
  setActiveThemeId(id);
  if (changed && id === SUPERCOPA_THEME_ID) {
    await waitForProgramFonts();
    fontsReady = true;
    first = true;
  }
}

connect({
  async onMessage(msg) {
    if (msg.type === WS_MSG.STATE_SNAPSHOT) {
      await onTheme(msg.theme);
      if (msg.state?.scSorteo) data = msg.state.scSorteo.data;
      paint();
    } else if (msg.type === WS_MSG.MODULE_UPDATE) {
      if (msg.moduleId !== 'scSorteo' || !msg.moduleState) return;
      data = msg.moduleState.data;
      paint();
    } else if (msg.type === 'TEAM_CATALOG_UPDATE') {
      updateLocalTeamCatalog(msg.catalog);
      paint();
    } else if (msg.type === WS_MSG.ASSET_VERSIONS) {
      setAssetVersions(msg.versions);
    } else if (msg.type === WS_MSG.THEME_UPDATE) {
      await onTheme(msg.themeId);
      paint();
    }
  },
});

// Para inspección / pruebas (solo lectura).
window.__pantalla = () => ({ theme, ready: fontsReady, slots: data?.slots || null, equipos: data?.equipos || [] });
