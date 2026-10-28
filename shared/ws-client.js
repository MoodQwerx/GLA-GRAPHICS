// Cliente WebSocket compartido por Master Control y Program.
// Reconecta solo si se corta la conexion: en un stream en vivo no nos podemos
// dar el lujo de perder el control por un hiccup de red momentaneo.

import { WS_PATH } from './constants.js';

// Techo defensivo (2026-09-26, BUG real en vivo -- "presiono OUT y no sale,
// tengo que volver a hacer TAKE" -- causa real: "send()" descartaba el
// mensaje EN SILENCIO si el socket no estaba OPEN en ese instante exacto
// -- ej. durante el hueco de reconexion de 1500ms tras un hiccup de red
// momentaneo, o el reinicio del servidor -- sin cola ni feedback, el click
// de OUT simplemente se perdia; el operador interpretaba que un TAKE
// posterior "lo arreglaba", pero en realidad solo el intento QUE LLEGO
// DESPUES de que el socket ya habia reconectado tenia efecto). Limite
// generoso: una reconexion normal tarda 1500ms y el autosave manda cada
// 80ms mientras se tipea, asi que un corte breve encola a lo sumo unas
// pocas decenas de mensajes -- este techo es solo para no crecer sin
// limite en un corte anormalmente largo (laptop en suspension, etc.),
// descartando los mensajes MAS VIEJOS (los mas nuevos, mas cerca del
// estado real actual, son los que importa conservar).
const MAX_QUEUED_MESSAGES = 500;

export function connect({ onMessage, onOpen, onClose } = {}) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${protocol}://${location.host}${WS_PATH}`;
  let socket = null;
  // "pendingQueue" (2026-09-26): mensajes pedidos mientras el socket NO
  // estaba OPEN -- se reenvian en orden apenas reconecta, en vez de
  // perderse. TAKE/OUT explicitos y autosaves comparten la misma cola sin
  // tratamiento especial: reenviar un autosave viejo de mas no rompe nada
  // (el servidor solo aplica el ultimo Object.assign, idempotente), pero
  // perder un TAKE/OUT explicito si rompe la confiabilidad pedida.
  let pendingQueue = [];

  function flushQueue() {
    if (!pendingQueue.length) return;
    const toSend = pendingQueue;
    pendingQueue = [];
    for (const msg of toSend) {
      socket.send(JSON.stringify(msg));
    }
  }

  function open() {
    socket = new WebSocket(url);

    socket.addEventListener('open', () => {
      flushQueue();
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
        return;
      }
      pendingQueue.push(msg);
      if (pendingQueue.length > MAX_QUEUED_MESSAGES) {
        pendingQueue.splice(0, pendingQueue.length - MAX_QUEUED_MESSAGES);
      }
    },
  };
}
