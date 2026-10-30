# SOFTX

**SOFTX** (antes LIVE GRAPHICS / GLA GRAPHICS) es el software base de graficas ("CG"/overlay) para transmisiones en vivo. Incluye un **Master Control** (panel de operador) y un **Program/Overlay** (la salida que se agrega en OBS/vMix como Browser Source), sincronizados en tiempo real.

SOFTX inicia uno de dos sistemas, elegido al arrancar y fijo durante toda la ejecucion:

1. **ARGENTINA STREAMERS**
2. **GLA RELAMPAGO** (GRAN LIGA RELAMPAGO, con sus datos de `gla.futbol`)

Ya no existe selector de theme en el Master Control: para usar el otro sistema se cierra SOFTX y se vuelve a iniciar. Los datos, equipos, presets y assets de cada sistema estan separados. Ver [docs/THEMES.md](docs/THEMES.md) para la arquitectura interna (internamente cada sistema sigue siendo un "theme").

Identidad visual: dorado + negro, estetica broadcast premium inspirada en graficas deportivas de nivel Mundial, sin copiar diseños existentes.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior instalado en la maquina que corre el software.
- OBS Studio (u otro software de switching que soporte Browser Source) para capturar el Program.

## Persistencia de datos

En local, todos los datos configurados por el operador se guardan bajo `data/` (ignorada por Git). En Render Free, cuyo filesystem es efimero, produccion debe usar Supabase para que presets, posiciones, escalas, colores, formaciones, abreviaturas y snapshots sobrevivan a commits y deploys. La configuracion, migracion de los JSON actuales, variables exactas y recuperacion estan en [docs/PERSISTENCE.md](docs/PERSISTENCE.md).

## Como arrancar

1. Doble click en **`START SOFTX.bat`**: muestra "BIENVENIDO A SOFTX" y pregunta que software usar (**[1] ARGENTINA STREAMERS** / **[2] GLA RELÁMPAGO** / **[3] BAULETI vs BALANZA**).
   - Accesos directos: **`START GLA RELÁMPAGO.bat`**, **`START ARGENTINA STREAMERS.bat`** y **`START BAULETI VS BALANZA.bat`** inician ese sistema sin preguntar.
   - Los tres usan el mismo arranque ([start.bat](start.bat), que tambien acepta `start.bat gla` / `start.bat argentinaStreamers` / `start.bat bauletiBalanza`).
2. La primera vez instala dependencias automaticamente (puede tardar unos segundos).
3. El servidor arranca en una ventana aparte (minimizada) con el sistema elegido (`node server/index.js --system=gla|argentinaStreamers|bauletiBalanza`) y, cuando responde, se abre el **Master Control** en el navegador.
4. La ventana de SOFTX queda mostrando el sistema activo, las direcciones y un menu:
   - **[P]** vuelve a abrir el Master Control en el navegador.
   - **[Q]** cierra SOFTX (servidor incluido). Al volver a abrir `START SOFTX.bat` pregunta de nuevo que sistema usar.
5. Si esa ventana se cerro de otra forma y el servidor quedo corriendo, ejecutar [end.bat](end.bat) para cerrarlo manualmente.

Por consola: `npm run start:gla`, `npm run start:as`, `npm run start:bb`, o `npm start` (usa el ultimo sistema iniciado). Tambien se puede definir `SOFTX_SYSTEM=gla|argentinaStreamers|bauletiBalanza`.

## Recurso grafico (reemplazar assets sin tocar codigo)

Cada modulo con un asset externo tiene, debajo de sus controles, la seccion plegable **RECURSO GRÁFICO** (o **RECURSOS GRÁFICOS** si tiene varios: ej. TARJETA → AMARILLA / ROJA / AZUL). Por recurso muestra el archivo actual, la carpeta, el formato esperado (ej. `MP4 H.264 con alfa apilado · 1920x2160 · 30 FPS`) y lo que tiene el archivo real.

1. **ABRIR CARPETA**: abre el Explorador de Windows en la carpeta real del archivo y lo deja seleccionado (si falta, abre igual la carpeta).
2. Reemplazar el archivo **con el mismo nombre**.
3. **RECARGAR**: analiza el archivo nuevo (existe, formato, resolucion, FPS, duracion, alfa) y muestra **ADVERTENCIA** si algo cambio respecto del recurso anterior (ej. `ADVERTENCIA: EL VIDEO NUEVO ES 25 FPS. EL RECURSO ANTERIOR ERA 30 FPS.`). No bloquea, no convierte nada y **no manda el modulo al aire**: actualiza Preview y deja Program listo para el proximo TAKE (si el modulo esta al aire, el cambio se aplica cuando sale).

No hace falta borrar cache, reiniciar el navegador ni renombrar: cada URL de asset lleva una version derivada del archivo real (`?v=`), que cambia con el RECARGAR. El registro central de recursos (sistema → modulo → recurso, ej. `gla.tarjeta.roja`) esta en [shared/asset-registry.js](shared/asset-registry.js); el navegador solo envia ese ID, nunca una ruta.

## Actualizaciones desde `gla.futbol`

Las tablas, planteles, grupos y resultados se actualizan solo mediante los botones del Master Control; no hay polling. El servidor conserva el ultimo snapshot valido, de modo que una falla de Internet no borra la carga anterior. Los nombres y estadisticas vienen de la web, pero escudos, abreviaturas, colores e identidad grafica siempre se resuelven desde el catalogo local.

## Agregar el Program en OBS o vMix

1. En OBS: **Fuentes → + → Navegador (Browser Source)** · En vMix: **Add Input → Browser**.
2. URL: `http://127.0.0.1:4400/program` si vMix/OBS corre en esta misma PC (evitar `localhost`: agrega una demora de red real de ~300ms tras un rato inactivo, ver informe de auditoria de performance), o la "IP VMIX BROWSER" que muestra `start.bat` si vMix corre en otra PC de la misma red.
3. Ancho: `1920`, Alto: `1080`.
4. Fondo transparente (no marcar color de fondo).
5. **No** tildar "Apagar fuente cuando no este visible" (shutdown source when not visible) — si se apaga, pierde la conexion con el Master Control y no muestra graficas al volver a estar visible sin reconectar.
6. Mantener el zoom del navegador en `100%` y no agregar CSS personalizado que escale el contenido.
7. Configurar la escena y la salida de OBS/vMix en `1920x1080`. Capturar el Browser Input a una resolucion menor y ampliarlo despues produce perdida de nitidez que CSS no puede recuperar.

El Program arranca siempre vacio: ninguna grafica se muestra hasta que el operador la manda al aire desde el Master Control.

El Preview Monitor del Master Control reduce deliberadamente el Program para que entre en el panel y sirve como referencia operativa, no como control de nitidez. Para evaluar calidad usar `http://127.0.0.1:4400/program` como salida independiente a 1920x1080, zoom 100%.

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
SOFTX/ (carpeta del repo: GLA-GRAPHICS)
├── START SOFTX.bat        # Pregunta que sistema usar y arranca SOFTX
├── START GLA RELÁMPAGO.bat / START ARGENTINA STREAMERS.bat / START BAULETI VS BALANZA.bat   # Arranque directo de cada sistema
├── start.bat              # Arranque unico que usan los tres (selector, servidor, menu P/Q)
├── end.bat                # Cierra el servidor (lo mismo que hace la opcion Q de start.bat)
├── server/                # Servidor Express + WebSocket (estado autoritativo)
├── data/                  # Cache/fallback local de datos del operador (ignorada por Git)
├── shared/                # Constantes, schema de modulos, manifest de themes, registro central de recursos graficos (asset-registry.js) y utilidades compartidas
├── master-control/        # UI del operador
├── program/                # Overlay que se captura en OBS/vMix (renderers de video con alfa en program/js/renderers/)
├── assets/                 # Assets en uso, servidos en runtime:
│   ├── marcador/, eventos/, zocalos/, ...   # Assets de GRAN LIGA RELÁMPAGO (theme por defecto, ruta plana histórica)
│   ├── shared/             # Assets genuinamente compartidos entre themes (hoy: sponsors/)
│   └── themes/             # Assets propios de cada theme no-GLA (hoy: argentina-streamers/)
├── ai-gfx/                 # Archivo fuente de los assets originales (.mov/.psd/.ai) — no se sirve en runtime, ignorado por Git salvo este README
├── scripts/                # Scripts de mantenimiento/diagnóstico manual (no forman parte del runtime)
└── docs/                   # Documentacion tecnica
```

Ver el detalle tecnico de la arquitectura, el protocolo WebSocket y como agregar un modulo nuevo en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Puerto

Por defecto el servidor usa el puerto `4400`. Se puede cambiar seteando la variable de entorno `GLA_PORT` antes de correr `start.bat`.
