import vs from './vs.js';
import scoreboard from './scoreboard.js';
import marcadorTiempoAdicional from './marcadorTiempoAdicional.js';
import marcadorEntretiempo from './marcadorEntretiempo.js';
import marcadorPenales from './marcadorPenales.js';
import marcadorZocalo from './marcadorZocalo.js';
import sideTable from './sideTable.js';
// DESACTIVADO TEMPORALMENTE junto con su entrada en shared/modules.js (ver
// ese archivo) — descomentar esta linea y la del registro mas abajo para
// reactivar. El archivo longSimple.js no se toco.
// import longSimple from './longSimple.js';
import longDouble from './longDouble.js';
import shortSimple from './shortSimple.js';
import shortDouble from './shortDouble.js';
import varCheck from './varCheck.js';
import replay from './replay.js';
import bug from './bug.js';
import upcoming from './upcoming.js';
import formacionEquipos from './formacionEquipos.js';
import vsPrepartido from './vsPrepartido.js';
import vsResultado from './vsResultado.js';
import tarjeta from './tarjeta.js';
import cambios from './cambios.js';
import gol from './gol.js';

// Registro de funciones de render: id de modulo -> (contentEl, data, justTaken, onOneShotEnded) => void
export const renderers = {
  vs,
  scoreboard,
  marcadorTiempoAdicional,
  marcadorEntretiempo,
  marcadorPenales,
  marcadorZocalo,
  sideTable,
  // longSimple, // DESACTIVADO TEMPORALMENTE — ver comentario junto al import mas arriba.
  longDouble,
  shortSimple,
  shortDouble,
  varCheck,
  replay,
  bug,
  upcoming,
  formacionEquipos,
  vsPrepartido,
  vsResultado,
  tarjeta,
  cambios,
  gol,
};
