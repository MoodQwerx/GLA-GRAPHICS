// Tipos de mensaje del protocolo WebSocket entre Master Control, Program y el servidor.
// Compartido entre Node (server) y navegador (master-control / program) via ES modules.

export const WS_MSG = {
  // Servidor -> clientes
  STATE_SNAPSHOT: 'STATE_SNAPSHOT',
  MODULE_UPDATE: 'MODULE_UPDATE',
  // Cliente (Master Control) -> servidor
  TAKE: 'TAKE',
  OUT: 'OUT',
  UPDATE: 'UPDATE',
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
};

export const PENALTY_KICK_STATUS = {
  PENDING: 'pending',
  SCORED: 'scored',
  MISSED: 'missed',
};

export const WS_PATH = '/ws';
