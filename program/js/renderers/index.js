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
import sitioWebPromoL from './sitioWebPromoL.js';
import charts from './charts.js';
import bbMarcador from './bbMarcador.js';
import bbFormacion from './bbFormacion.js';
import bbVs from './bbVs.js';
import bbTarjeta from './bbTarjeta.js';
import bbGol from './bbGol.js';
import bbPenales from './bbPenales.js';
import bbCambio from './bbCambio.js';
import bbVar from './bbVar.js';
import bbVsResultado from './bbVsResultado.js';
import bbCharts from './bbCharts.js';
import { renderBbZocaloLargo as bbZocaloLargo, renderBbZocaloCorto as bbZocaloCorto, renderBbZocaloCortoDoble as bbZocaloCortoDoble } from './bbZocalos.js';
import c4nMarcador from './c4nMarcador.js';
import { renderC4nTarjeta as c4nTarjeta, renderC4nCambio as c4nCambio } from './c4nEventos.js';
import {
  renderC4nZocaloTexto as c4nZocaloTexto, renderC4nZocaloTextoDoble as c4nZocaloTextoDoble,
  renderC4nZocaloCorto as c4nZocaloCorto, renderC4nZocaloCortoDoble as c4nZocaloCortoDoble,
  renderC4nZocaloCompuesto as c4nZocaloCompuesto, renderC4nMoscaLogo as c4nMoscaLogo, renderC4nMoscaTexto as c4nMoscaTexto,
  renderC4nRotativoSponsors as c4nRotativoSponsors,
  renderC4nPromoWeb as c4nPromoWeb,
} from './c4nTextos.js';
import {
  renderC4nGoleadores as c4nGoleadores, renderC4nAsistencias as c4nAsistencias, renderC4nGA as c4nGA,
  renderC4nPosiciones as c4nPosiciones, renderC4nMejoresJugadores as c4nMejoresJugadores,
} from './c4nTablas.js';
import { renderC4nVsPrepartido as c4nVsPrepartido, renderC4nVsResultado as c4nVsResultado, renderC4nFormacion as c4nFormacion } from './c4nPlacas.js';
import { renderC4nFixture as c4nFixture } from './c4nFixture.js';
import { renderC4nStatsPrevia as c4nStatsPrevia, renderC4nStatsEntretiempo as c4nStatsEntretiempo, renderC4nStatsFinal as c4nStatsFinal } from './c4nStats.js';
// "c4nDatos" es solo datos (nunca va al aire).
const c4nDatos = () => {};
import zocaloVs from './zocaloVs.js';

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
  sitioWebPromoL,
  zocaloVs,
  charts,
  bbMarcador,
  bbFormacion,
  bbVs,
  bbTarjeta,
  bbGol,
  bbPenales,
  bbCambio,
  bbVar,
  bbVsResultado,
  bbCharts,
  bbZocaloLargo,
  bbZocaloCorto,
  bbZocaloCortoDoble,
  c4nMarcador,
  c4nTarjeta,
  c4nCambio,
  c4nZocaloTexto,
  c4nZocaloTextoDoble,
  c4nZocaloCorto,
  c4nZocaloCortoDoble,
  c4nZocaloCompuesto,
  c4nMoscaLogo,
  c4nMoscaTexto,
  c4nRotativoSponsors,
  c4nGoleadores,
  c4nAsistencias,
  c4nGA,
  c4nPosiciones,
  c4nPromoWeb,
  c4nMejoresJugadores,
  c4nFixture,
  c4nVsPrepartido,
  c4nVsResultado,
  c4nFormacion,
  c4nStatsPrevia,
  c4nStatsEntretiempo,
  c4nStatsFinal,
  c4nDatos,
};
