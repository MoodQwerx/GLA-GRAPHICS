// Cliente WebSocket compartido por Master Control y Program.
// Reconecta solo si se corta la conexion: en un stream en vivo no nos podemos
// dar el lujo de perder el control por un hiccup de red momentaneo.

import { WS_PATH } from './constants.js';

export function connect({ onMessage, onOpen, onClose } = {}) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}${WS_PATH}`;
  let socket = null;

  function open() {
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      if (onOpen) onOpen();
    });

    socket.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (onMessage) onMessage(msg);
    });

    socket.addEventListener('close', () => {
      if (onClose) onClose();
      setTimeout(open, 1500);
    });
  }

  open();

  return {
    send(msg) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(msg));
      }
    },
  };
}
