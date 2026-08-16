# GLA Broadcast Graphics System

Software de graficas ("CG"/overlay) para transmisiones de futbol en vivo. Incluye un **Master Control** (panel de operador) y un **Program/Overlay** (la salida que se agrega en OBS como Browser Source), sincronizados en tiempo real.

Identidad visual: dorado + negro, estetica broadcast premium inspirada en graficas deportivas de nivel Mundial, sin copiar diseños existentes.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior instalado en la maquina que corre el software.
- OBS Studio (u otro software de switching que soporte Browser Source) para capturar el Program.

## Como arrancar

1. Doble click en [start.bat](start.bat).
2. La primera vez instala dependencias automaticamente (puede tardar unos segundos).
3. El servidor arranca en una ventana aparte (minimizada) y se abre el **Master Control** en el navegador.
4. La ventana principal de `start.bat` queda mostrando las direcciones y un menu:
   - **[P]** vuelve a abrir el Master Control en el navegador.
   - **[Q]** cierra todo el software (servidor incluido) y termina — no hace falta abrir otro archivo para apagarlo.
5. Si esa ventana se cerro de otra forma y el servidor quedo corriendo, ejecutar [end.bat](end.bat) para cerrarlo manualmente.

## Actualizaciones desde `gla.futbol`

Las tablas, planteles, grupos y resultados se actualizan solo mediante los botones del Master Control; no hay polling. El servidor conserva el ultimo snapshot valido, de modo que una falla de Internet no borra la carga anterior. Los nombres y estadisticas vienen de la web, pero escudos, abreviaturas, colores e identidad grafica siempre se resuelven desde el catalogo local.

## Agregar el Program en OBS o vMix

1. En OBS: **Fuentes → + → Navegador (Browser Source)** · En vMix: **Add Input → Browser**.
2. URL: `http://localhost:4400/program` (o la "IP VMIX BROWSER" que muestra `start.bat` si vMix corre en otra PC de la misma red).
3. Ancho: `1920`, Alto: `1080`.
4. Fondo transparente (no marcar color de fondo).
5. **No** tildar "Apagar fuente cuando no este visible" (shutdown source when not visible) — si se apaga, pierde la conexion con el Master Control y no muestra graficas al volver a estar visible sin reconectar.
6. Mantener el zoom del navegador en `100%` y no agregar CSS personalizado que escale el contenido.
7. Configurar la escena y la salida de OBS/vMix en `1920x1080`. Capturar el Browser Input a una resolucion menor y ampliarlo despues produce perdida de nitidez que CSS no puede recuperar.

El Program arranca siempre vacio: ninguna grafica se muestra hasta que el operador la manda al aire desde el Master Control.

El Preview Monitor del Master Control reduce deliberadamente el Program para que entre en el panel y sirve como referencia operativa, no como control de nitidez. Para evaluar calidad usar `http://localhost:4400/program` como salida independiente a 1920x1080, zoom 100%.

## Uso del Master Control

- La barra lateral izquierda agrupa las graficas por categoria (Marcador, Eventos, VAR / Replay, Zocalos, Mosca, Placas, Tablas). El modulo con el punto dorado "● EN AIRE" esta actualmente visible en el Program.
- Cada panel tiene sus propios campos para cargar datos — solo los que esa grafica necesita.
- **TOMAR AL AIRE**: manda la grafica al Program con los datos actuales (reproduce el video una vez desde el inicio). En piezas de una sola pasada (festejos) el boton dice **REPRODUCIR**.
- **ACTUALIZAR**: envia los datos actuales sin sacarla ni ponerla al aire (util para corregir un dato mientras ya esta en pantalla, ej. el marcador, sin reiniciar el video).
- **SACAR DEL AIRE**: la retira del Program. Los datos cargados quedan guardados para la proxima vez que se tome esa grafica. Piezas con animacion de salida propia (ej. el festejo de Gol) vuelven a OUT solas al terminar el clip, sin necesidad de apretar este boton.
- **STOP ALL** (boton en el header, siempre visible incluso con scroll — encabezado fijo): saca del aire cualquier grafica activa de un solo click, sin perder ningun dato cargado.
- Varias graficas de distintos modulos pueden estar al aire al mismo tiempo (ej. la Mosca + un Zocalo VS); las placas fullscreen quedan a criterio del operador para no combinarlas.

## Modulos incluidos

22 graficas agrupadas por categoria (21 disponibles en el panel; Zocalo largo simple esta desactivado temporalmente, ver `docs/MODULES.md`) — Marcador (marcador principal, tiempo adicional, entretiempo, penales, marcador zocalo — titulo + contador sobre imagen estatica, detras del marcador principal), Placas (formacion de equipos, VS prepartido, VS con resultado), Eventos (tarjeta, cambios, gol), VAR / Replay (VAR chequeo, replay con sponsor), Mosca (LocalStrike), Zocalos (largo simple — desactivado —, largo doble, corto simple/doble, VS compacto), Grupos (Grupo 1 / Grupo 2 — imagen estatica con escudo, nombre y puntos por equipo, tomados del mismo catalogo que el Marcador principal) y Tablas (tabla lateral, proximos encuentros).

Cada grafica usa el asset original entregado por el usuario (nunca una recreacion en CSS), reproducido con canal alfa real cuando es video o mostrado directo cuando es una imagen estatica con alfa (PNG). Ver el detalle de campos, asset y posicion de cada modulo en [docs/MODULES.md](docs/MODULES.md).

## Estructura del proyecto

```
GLA_SOFT/
├── start.bat              # Levanta todo el entorno (menu P/Q para abrir Master Control o cerrar todo)
├── end.bat                # Cierra el servidor (lo mismo que hace la opcion Q de start.bat)
├── server/                # Servidor Express + WebSocket (estado autoritativo)
├── shared/                # Constantes, schema de modulos y utilidades compartidas
├── master-control/        # UI del operador
├── program/                # Overlay que se captura en OBS/vMix (renderers de video con alfa en program/js/renderers/)
├── assets/                 # Fuentes (Anton Regular) y videos transcodificados en uso (marcador/, eventos/, zocalos/, etc.)
├── ai-gfx/                 # Archivo fuente de los assets originales (.mov/.png) — no se sirve en runtime
└── docs/                   # Documentacion tecnica
```

Ver el detalle tecnico de la arquitectura, el protocolo WebSocket y como agregar un modulo nuevo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Puerto

Por defecto el servidor usa el puerto `4400`. Se puede cambiar seteando la variable de entorno `GLA_PORT` antes de correr `start.bat`.
