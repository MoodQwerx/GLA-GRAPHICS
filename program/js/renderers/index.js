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
import formacionEquipos from './formacionEquipos.js';
import vsPrepartido from './vsPrepartido.js';
import vsResultado from './vsResultado.js';
import tarjeta from './tarjeta.js';
import cambios from './cambios.js';
import gol from './gol.js';
import grupos from './grupos.js';
import estrellas from './estrellas.js';
import posiciones from './posiciones.js';
import { goleadores, asistidores, jugadores } from './performanceTable.js';
import fichaJugador from './fichaJugador.js';
// BRACKETS (2026-09-02, handoff de un agente concurrente -- ver
// docs/PATCH_SHARED_CLAUDE.md). Su patch pedia registrarlos en un objeto
// "RENDERERS" dentro de program/js/main.js, pero ese archivo no tiene tal
// objeto -- el registro real de renderers es este archivo (program/js/main.js
// importa "renderers" desde aca). Se registran aca para que su intencion
// (renderer real, sin tocar su codigo) funcione con la arquitectura vigente.
import cronogramaHoy from './cronogramaHoy.js';
import resultadosParciales from './resultadosParciales.js';
import historial from './historial.js';
import zocaloFinalDiv from './zocaloFinalDiv.js';
import zocaloFinal from './zocaloFinal.js';
import zocaloCompuesto from './zocaloCompuesto.js';
import zocaloCompuestoEquipos from './zocaloCompuestoEquipos.js';
import zocaloCompuestoLogo from './zocaloCompuestoLogo.js';
import placaLInfo from './placaLInfo.js';
import sitioWebPromoL from './sitioWebPromoL.js';

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
  formacionEquipos,
  vsPrepartido,
  vsResultado,
  tarjeta,
  cambios,
  gol,
  grupos,
  estrellas,
  posiciones,
  posicionesTorneo: posiciones,
  goleadores,
  asistidores,
  jugadores,
  fichaJugador,
  cronogramaHoy,
  resultadosParciales,
  historial,
  zocaloFinalDiv,
  zocaloFinal,
  zocaloCompuesto,
  zocaloCompuestoEquipos,
  zocaloCompuestoLogo,
  placaLInfo,
  sitioWebPromoL,
};
