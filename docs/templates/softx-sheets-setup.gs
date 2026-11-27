/**
 * SOFTX - SUPERCOPA - DATA BROADCAST: arma la planilla en un solo paso.
 * Uso: planilla nueva > Extensiones > Apps Script > pegar este archivo >
 * Ejecutar "setupSoftx" (pide autorizar SOLO esta planilla, una vez).
 * Se puede volver a ejecutar: no borra filas, solo reaplica formatos y reglas.
 * No guarda credenciales ni se conecta a nada fuera de la planilla.
 */
const ZOC_HEAD = ['ID', 'ACTIVO', 'TIPO', 'LINEA_1', 'LINEA_2', 'CATEGORIA', 'ORDEN', 'NOTAS'];
const CATEGORIAS = ['GENERAL', 'PARTIDO', 'RESULTADO', 'INFORMACION', 'SPONSOR', 'URGENTE', 'OTRO'];
const EJEMPLOS = [
  ['ZOC-001', 'SI', 'CORTO', 'NOMBRE APELLIDO', 'RELATOR', 'GENERAL', 1, 'Ejemplo: reemplazar por el nombre real'],
  ['ZOC-002', 'SI', 'CORTO', 'NOMBRE APELLIDO', 'COMENTARISTA', 'GENERAL', 2, ''],
  ['ZOC-003', 'SI', 'CORTO', 'NOMBRE APELLIDO', '', 'GENERAL', 3, 'Sin LINEA_2 = placa CORTO SIMPLE'],
  ['ZOC-004', 'SI', 'DOBLE', 'GLA SUPERCOPA', 'EL TORNEO DE LOS CAMPEONES', 'INFORMACION', 4, ''],
  ['ZOC-005', 'SI', 'DOBLE', 'SEMIFINAL 1', 'EQUIPO A vs EQUIPO B', 'PARTIDO', 5, ''],
  ['ZOC-006', 'SI', 'DOBLE', 'FINAL DEL PRIMER TIEMPO', '', 'RESULTADO', 6, 'Sin LINEA_2 = placa LARGO SIMPLE'],
  ['ZOC-007', 'SI', 'DOBLE', 'MARCA SPONSOR', 'PRESENTA ESTA TRANSMISIÓN', 'SPONSOR', 7, ''],
  ['ZOC-008', 'SI', 'DOBLE', 'ÚLTIMO MOMENTO', 'TEXTO DE LA NOTICIA', 'URGENTE', 8, ''],
  ['ZOC-009', 'SI', 'DOBLE', 'INFORMACIÓN', 'TEXTO SECUNDARIO', 'OTRO', 9, ''],
  ['ZOC-010', 'NO', 'CORTO', 'ZÓCALO INACTIVO', 'NO APARECE POR DEFECTO', 'GENERAL', 10, 'ACTIVO=NO: queda en la planilla pero no en la lista operativa'],
];

function setupSoftx() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('SOFTX - SUPERCOPA - DATA BROADCAST');
  setupZocalos_(ss);
  setupConfig_(ss);
  // La hoja vacía que trae una planilla nueva ("Hoja 1" / "Sheet1").
  for (const sh of ss.getSheets()) {
    if (!['ZOCALOS', 'CONFIG'].includes(sh.getName()) && sh.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(sh);
  }
  ss.setActiveSheet(ss.getSheetByName('ZOCALOS'));
}

function header_(sh, head) {
  sh.getRange(1, 1, 1, head.length).setValues([head])
    .setFontWeight('bold').setFontColor('#ffffff').setBackground('#202124').setHorizontalAlignment('center');
  sh.setFrozenRows(1);
}

// Planillas en español (es_*, pt_*...) separan argumentos con ";".
function sep_(ss) {
  return /^(en|ja|zh|ko|th|he)/.test(ss.getSpreadsheetLocale() || 'en') ? ',' : ';';
}

function setupZocalos_(ss) {
  const S = sep_(ss);
  const sh = ss.getSheetByName('ZOCALOS') || ss.insertSheet('ZOCALOS', 0);
  const empty = sh.getLastRow() <= 1;
  header_(sh, ZOC_HEAD);
  if (empty) sh.getRange(2, 1, EJEMPLOS.length, ZOC_HEAD.length).setValues(EJEMPLOS);
  const rows = sh.getMaxRows() - 1;
  const list = (values) => SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  sh.getRange(2, 2, rows, 1).setDataValidation(list(['SI', 'NO'])).setHorizontalAlignment('center');
  sh.getRange(2, 3, rows, 1).setDataValidation(list(['CORTO', 'DOBLE'])).setHorizontalAlignment('center');
  sh.getRange(2, 6, rows, 1).setDataValidation(list(CATEGORIAS));
  sh.getRange(2, 7, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(false)
    .setHelpText('ORDEN: número (1, 2, 3...).').build()).setNumberFormat('0').setHorizontalAlignment('center');
  // ID único: no deja escribir uno repetido y, si ya hay, lo pinta de rojo.
  sh.getRange(2, 1, rows, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=COUNTIF($A$2:$A' + S + 'A2)<=1').setAllowInvalid(false).setHelpText('ID repetido: cada zócalo necesita un ID único.').build());
  const dup = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=AND($A2<>""' + S + 'COUNTIF($A$2:$A' + S + '$A2)>1)')
    .setBackground('#f4c7c3').setFontColor('#a50e0e').setRanges([sh.getRange(2, 1, rows, 1)]).build();
  const off = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$B2="NO"')
    .setFontColor('#9aa0a6').setRanges([sh.getRange(2, 1, rows, ZOC_HEAD.length)]).build();
  sh.setConditionalFormatRules([dup, off]);
  [110, 80, 90, 360, 360, 130, 70, 280].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(2, 4, rows, 2).setWrap(true);
  sh.getRange(2, 8, rows, 1).setWrap(true).setFontColor('#5f6368');
  sh.getRange(1, 1, sh.getMaxRows(), ZOC_HEAD.length).setVerticalAlignment('middle');
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), ZOC_HEAD.length).createFilter();
}

function setupConfig_(ss) {
  const sh = ss.getSheetByName('CONFIG') || ss.insertSheet('CONFIG');
  const empty = sh.getLastRow() <= 1;
  header_(sh, ['CLAVE', 'VALOR']);
  if (empty) sh.getRange(2, 1, 3, 2).setValues([['AUTO_SYNC', 'NO'], ['AUTO_SYNC_SECONDS', 60], ['DEFAULT_CATEGORY', 'GENERAL']]);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 160);
}
