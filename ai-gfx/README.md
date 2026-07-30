# AI GFX — Paquete gráfico de nueva generación (La Gran Liga de Creadores)

> **Paquete fuente externo:** el repositorio de código conserva este catálogo,
> pero excluye los binarios de `ai-gfx/`. Los originales MOV/PSD/AI y las
> referencias deben respaldarse en un repositorio privado o almacenamiento de
> diseño separado. Ningún archivo de esta carpeta es necesario para ejecutar
> `npm install` y `npm start`; los medios de runtime están en `assets/`.

Esta carpeta es el **staging area** del próximo paquete de gráficas (assets `.mov` con alfa + `.png` + fuentes `.psd`/`.ai`). Todavía **no está conectado al software** (no se tocó `assets/`, `program/` ni ningún módulo del código): esta es la etapa de organización y limpieza previa a la implementación.

## Cómo se armó esta estructura

El material llegó como dos `.zip` exportados (2.7GB, 51 archivos) más un video demostrativo (`_referencia/video-demostrativo.mp4`) y un PDF de pedido (`_referencia/pedido-grafico-gran-liga-creadores.pdf`). Cada archivo se identificó cruzando tres fuentes:

1. El **PDF de pedido** (`_referencia/pedido-grafico-gran-liga-creadores.pdf`) — lista oficial de piezas pedidas, agrupadas por categoría.
2. El **video demostrativo** (`_referencia/video-demostrativo.mp4`, 129s) — se extrajeron contact sheets y frames puntuales con `ffmpeg` para ver cada pieza en uso real (con datos cargados) y confirmar su identidad.
3. El **nombre de archivo original** — cuando ninguna de las dos referencias anteriores era concluyente.

Los nombres de archivo se normalizaron a **kebab-case en español, sin mayúsculas ni espacios** (ej. `MARCADOR_ADICIONAL.mov` → `marcador-tiempo-adicional.mov`), agrupados en carpetas por módulo. Cada carpeta de módulo puede tener una subcarpeta `source/` con los `.psd`/`.ai` editables — esos archivos **no los usa el software**, son para seguir editando el diseño en Photoshop/Illustrator.

## Estructura

```
ai-gfx/
├── _referencia/            Video demostrativo + PDF de pedido (no son assets)
├── placas-mid-full/
│   ├── formacion/          Alineación con suplentes
│   └── vs-equipos/         VS prepartido / con resultado
├── marcador/                Marcador principal, tiempo adicional, entretiempo, penales, shootout
├── eventos/                 Tarjetas, cambios, gol
├── var/                     Chequeo VAR
├── replay/                  Zocalito de replay con sponsor
├── zocalos/                  Zócalos largos/cortos + familia "VS compacto" + variantes vs
├── mosca/                    Mosca LocalStrike
└── placa-l/                  PNG y fuentes PSD conservados de la Placa en L
```

## Inventario y nivel de confianza

Cada archivo fue clasificado con un nivel de confianza sobre su identidad real. **Alta** = confirmado visualmente en el video demostrativo. **Media** = coincide con el nombre original y el PDF pero no se vio un frame confirmando el detalle exacto. **Baja** = mejor conjetura razonable, requiere confirmación antes de usarlo en el módulo definitivo.

### Placas mid full (`placas-mid-full/`)
| Archivo | Original | Confianza |
|---|---|---|
| `formacion/formacion.mov` | FORMACION.mov | **Alta** — confirmado (cancha con posiciones + panel de suplentes) |
| `formacion/formacion.mov` | FORMACION.mov | Media — variante/base de la formación, no distinguida puntualmente en el demo |
| `vs-equipos/vs-prepartido.mov` | CUADRO_VS.mov | **Alta** — confirmado ("GRAN LIGA RELÁMPAGO #2 - PARTIDO 3", escudos, sin resultado) |
| `vs-equipos/vs-resultado.mov` | CUADRO_VS_RESULTADO.mov | Media — el sufijo coincide con el pedido, no se vio el frame con resultado cargado |

**Pendiente (en el PDF, sin asset en este envío):** VS de equipos — Entretiempo, y todo el bloque de Estadísticas (tiros, tiros al arco, posesión, amarillas, rojas). También se vio en el demo una tabla de **posiciones/grupo** ("GRUPO B", equipos + puntos) que no tiene un archivo correspondiente todavía.

### Marcador (`marcador/`)
| Archivo | Original | Confianza |
|---|---|---|
| `marcador-principal.mov` | MARCADOR.mov | **Alta** — confirmado (escudos, colores, ACT 0-0 ACT, 1T, 00:00) |
| `marcador-tiempo-adicional.mov` | MARCADOR_ADICIONAL.mov | Media |
| `source/marcador-tiempo-adicional_v2.ai` | MARCADOR2_adicional_v2.ai | Fuente editable del anterior (Illustrator) |
| `marcador-entretiempo.mov` | entretiempo_marcador.mov | Media |
| `marcador-shootout.mov` | SHOOTOUT_2.mov | Media — "1 penal para cada equipo" según el PDF |
| `marcador-penales.mov` | PENALES.mov | **Alta** — confirmado (2 filas, 3 círculos numerados c/u) |
| `penal-convertido.png` | P_VERDE.png | Media — punto verde, probablemente para marcar en vivo cada penal convertido sobre el marcador/shootout |
| `penal-fallado.png` | P_ROJO.png | Media — punto rojo, penal errado |

### Eventos del partido (`eventos/`)
| Archivo | Original | Confianza |
|---|---|---|
| `tarjeta-azul.mov` | TARJETAS_AZUL.mov | **Alta** — confirmado (escudo + "19. PABLO NONIS" + chip azul) |
| `tarjeta-amarilla.mov` | TARJETAS_AMARILLA.mov | Alta (mismo template, color visto en el demo aunque no en zoom) |
| `tarjeta-roja.mov` | TARJETAS_ROJA.mov | Alta (idem) |
| `cambios.mov` | CAMBIOS.mov | Media — no se vio en el demo, nombre inequívoco |
| `gol.mov` | GOL.mov | Media — no está listado explícitamente en el PDF bajo "Eventos del partido", pero es claramente un evento de gol |

### VAR (`var/`)
| Archivo | Original | Confianza |
|---|---|---|
| `var-chequeo.mov` | ZOCALOS_VAR.mov | **Alta** — confirmado (tag "VAR CHEQUEO" con ícono de monitor) |

### Replay (`replay/`)
| Archivo | Original | Confianza |
|---|---|---|
| `replay-sponsor.mov` | ZOCALOS_REPLAY.mov | Media-alta — se vio un tag "REPLAY" con sponsor Betano en el demo, coincide con el pedido |

### Zócalos (`zocalos/`)
| Archivo | Original | Confianza |
|---|---|---|
| `zocalo-corto-simple.mov` | ZOCALO_CORTO_SIMPLE.mov | Alta — nombre inequívoco, coincide 1:1 con el PDF |
| `zocalo-corto-doble.mov` | ZOCALO_RELATOR.mov | **Alta** — confirmado (tag "@IGNALOPEZ32 / NOTERO - CAMPO DE JUEGO") |
| `zocalo-largo-doble.mov` | ZOCALO_RELATOR_LARGO.mov | Baja — se renombró asumiendo que es la variante ancha del corto doble ("largo" está en el nombre original), pero no se confirmó puntualmente. **Requiere confirmación.** |
| `zocalo-largo-simple.mov` | ZOCALO_GRANDE.mov | Baja — mejor conjetura por descarte, no confirmado |
| `zocalos-chicos.mov` | ZOCALOS_chicos.mov | Baja — posible compilado o variante de los zócalos cortos. **Requiere confirmación.** |
| `vs-compacto/zocalo-vs.mov` + `-renglon-alto/medio/fino.mov` | ZOCALO_VS*.mov | Media — familia consistente de un mismo zócalo VS compacto en 3 alturas de renglón |
| `vs-varios/vs-base.mov`, `vs-varios/vs-vacio.mov` | VS.mov, VS_VACIO.mov | Baja — relación con `vs-equipos/` no confirmada. **Requiere confirmación.** |

### Mosca (`mosca/`)
| Archivo | Original | Confianza |
|---|---|---|
| `mosca-localstrike.mov` | MOSCA.mov | **Alta** — confirmado (escudo GLA + "LocalStrike" + reloj + badge "VIVO", esquina superior derecha) |

### Placa en L (`placa-l/`)
| Archivo | Original | Confianza |
|---|---|---|
| `vs-l.png` / `source/vs-l.psd` | VS_L.png/psd | Baja — uso dentro del composite de la Placa en L, no confirmado |
| `resultados.png` / `source/resultados.psd` | RESULTADOS.png/psd | Baja — propósito no confirmado. **Requiere confirmación.** |
| `source/recuadros-l.psd` | PSD/RECUADROS_L.psd (24 jul) | Fuente editable, la más reciente de las dos |
| `source/recuadros-l_2026-07-22.psd` | RECUADROS_L.psd, raíz (22 jul) | Fuente editable más antigua — **no son el mismo archivo** (tamaños distintos), se conservan ambas por las dudas hasta confirmar cuál es la vigente |

**Pendiente (PDF, sin asset en este envío):** tabla de goleadores, tabla de asistidores, tabla de mejores jugadores, brackets (resultados y próximos encuentros), sponsors exportados para escalar.

### Fondos de estudio (`studio-backgrounds/`)
| Archivo | Original | Confianza |
|---|---|---|
| `fondo.mp4` | FONDO.mp4 | Media — fondo de estudio (no tiene alfa, es opaco a diferencia del resto del paquete) |
| `fondo-logo.mp4` | FONDO_LOGO.mp4 | Media — igual que el anterior, con logo |

## Limpieza ya realizada

- Se eliminaron los dos `.zip` originales (2.7GB) después de verificar que sus 51 archivos coinciden en cantidad y tamaño exacto (byte a byte) con lo ya extraído — quedaban 100% redundantes.
- Por decisión de producción se retiraron las fuentes de Transiciones, Placas Fullscreen y los cuatro MOV de Placa-L, junto con su carpeta de revisión.
- Se eliminó `zocalo-vivo.mov` porque era idéntico por SHA-256 a `mosca/mosca-localstrike.mov`; se conserva únicamente el original identificado.
- Los dos `RECUADROS_L.psd` se conservan: son versiones distintas y el pedido exige mantener las fuentes PSD de Placa-L.

## Próximos pasos (fuera del alcance de esta tarea)

1. Confirmar con el diseñador los items marcados "Requiere confirmación" arriba.
2. Recién ahí: mover cada asset a `assets/` (o donde corresponda), transcodificar cada `.mov` ProRes 4444 a una versión H.264 + matte de alfa reproducible en navegador (mismo procedimiento que se uso para el Marcador actual — ver `docs/ARCHITECTURE.md` del proyecto raíz), y programar los renderers/módulos nuevos.
