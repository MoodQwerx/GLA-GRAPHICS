// Tipos de mensaje del protocolo WebSocket entre Master Control, Program y el servidor.
// Compartido entre Node (server) y navegador (master-control / program) via ES modules.

export const WS_MSG = {
  // Servidor -> clientes
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  MODULE_UPDATE: 'MODULE_UPDATE',
  // THEME_UPDATE (2026-08-20, sistema multi-theme): el theme activo es
  // GLOBAL -- Master Control y Program tienen que enterarse del mismo
  // cambio sin refrescar, mismo mecanismo de broadcast que ya usan
  // TAKE/UPDATE/OUT (ver shared/themes.js, server/theme.js).
  THEME_UPDATE: 'THEME_UPDATE',
  // Cliente (Master Control) -> servidor
  TAKE: 'TAKE',
  OUT: 'OUT',
  UPDATE: 'UPDATE',
  SET_THEME: 'SET_THEME',
};

export const MODULE_STATUS = {
  OUT: 'OUT',
  ON: 'ON',
};

export const FIELD_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  SELECT: 'select',
  LIST: 'list',
  PENALTY_SERIES: 'penaltySeries',
  // Texto visible en Program que NO es editable a mano (viene del Marcador,
  // de un reloj, o es un rotulo fijo del diseño) pero igual necesita el
  // editor de posicion/tamaño (2026-08-15, auditoria completa pedida por
  // el usuario). Solo pinta la etiqueta + el control de ajuste, sin input
  // de texto -- field-editors.js lo resuelve igual que "adjustable:true"
  // en un campo TEXT, pero sin la parte de tipear.
  ADJUST_ONLY: 'adjustOnly',
};

export const PENALTY_KICK_STATUS = {
  PENDING: 'pending',
  SCORED: 'scored',
  MISSED: 'missed',
};

export const WS_PATH = '/ws';
