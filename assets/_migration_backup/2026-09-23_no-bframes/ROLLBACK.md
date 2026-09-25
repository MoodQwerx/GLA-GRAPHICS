# Rollback — migración H.264 sin B-frames (2026-09-23)

Restaura el/los asset(s) productivo(s) al encode original (con B-frames), byte a byte, sin tocar código.

## Rollback de UN asset puntual

Copiar el backup sobre la ruta productiva (usar `ROLLBACK_MANIFEST.tsv` para el path exacto), ejemplo con MARCADOR:

```
cp "assets/_migration_backup/2026-09-23_no-bframes/assets/marcador/marcador-principal-alpha.mp4" "assets/marcador/marcador-principal-alpha.mp4"
```

Después: recargar Program (F5) para que el `<video>` cargue el archivo restaurado (los módulos Hot Pool mantienen el `<video>` ya cargado en memoria; el archivo en disco solo se relee en una carga nueva de página).

## Rollback de TODO el lote

```bash
cd assets/_migration_backup/2026-09-23_no-bframes
cp assets/marcador/marcador-principal-alpha.mp4 ../../../assets/marcador/marcador-principal-alpha.mp4
cp assets/eventos/tarjeta-amarilla-alpha.mp4 ../../../assets/eventos/tarjeta-amarilla-alpha.mp4
cp assets/eventos/tarjeta-roja-alpha.mp4 ../../../assets/eventos/tarjeta-roja-alpha.mp4
cp assets/eventos/tarjeta-azul-alpha.mp4 ../../../assets/eventos/tarjeta-azul-alpha.mp4
cp assets/eventos/cambios-alpha.mp4 ../../../assets/eventos/cambios-alpha.mp4
cp assets/eventos/gol-alpha.mp4 ../../../assets/eventos/gol-alpha.mp4
cp assets/mosca/mosca-localstrike-alpha.mp4 ../../../assets/mosca/mosca-localstrike-alpha.mp4
cp assets/zocalos/zocalo-largo-doble-alpha.mp4 ../../../assets/zocalos/zocalo-largo-doble-alpha.mp4
cp assets/zocalos/zocalo-corto-simple-alpha.mp4 ../../../assets/zocalos/zocalo-corto-simple-alpha.mp4
cp assets/zocalos/zocalo-corto-doble-alpha.mp4 ../../../assets/zocalos/zocalo-corto-doble-alpha.mp4
cp assets/zocalos/zocalo-vs-alpha.mp4 ../../../assets/zocalos/zocalo-vs-alpha.mp4
cp assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4 ../../../assets/zocalos/zocalo-vs-renglon-alto-alpha.mp4
cp assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4 ../../../assets/zocalos/zocalo-vs-renglon-medio-alpha.mp4
cp assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4 ../../../assets/zocalos/zocalo-vs-renglon-fino-alpha.mp4
```

## Verificación post-rollback

Comparar checksum contra la columna `md5_original` de `ROLLBACK_MANIFEST.tsv`:

```bash
md5sum assets/marcador/marcador-principal-alpha.mp4
```

No hace falta tocar `server/`, manifests ni renderers en ningún caso — todos los paths de archivo son idénticos a los de siempre, solo cambia el contenido binario del `.mp4`.
