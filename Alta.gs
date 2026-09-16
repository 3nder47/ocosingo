/* ============================================================================
   Alta.gs — v2.1
   ----------------------------------------------------------------------------
   ARCHIVO NUEVO. Va como archivo aparte dentro del mismo proyecto de Apps
   Script (Archivo → Nuevo → Script, nómbralo "Alta"). Comparte los helpers de
   Código.gs. Las líneas del switch ya vienen puestas en el Código.gs v28 que
   te entrego junto con este archivo: no tienes que editar nada a mano.

   Contiene:
     · altaPedido      — alta de un pedido completo, prorrateando el cargo real
                         de la tarjeta entre las piezas. Una fila por pieza.
     · listaImagenes   — devuelve la hoja IMAGENES entera, para que la pantalla
                         de alta vea las fotos de productos ya agotados.
     · aplicarRemate   — escribe el precio de remate en TODAS las piezas sin
                         vender de un producto. Guarda el precio anterior en la
                         columna T (PrecioAntes) para poder deshacerlo.
     · revertirRemate  — devuelve el precio anterior y limpia la columna T.
     · sellarAltaDeFilas — marca a mano la fecha de alta de un rango de filas,
                         para las que se dieron de alta antes de la v2.1.

   NUNCA se escribe en la columna I: ahí vive el ARRAYFORMULA de Utilidad Neta.
   ============================================================================ */

const COL_ANTES = 20;   // T · precio antes del remate (solo lo usa el remate)
const COL_ALTA  = 21;   // U · fecha en que la pieza se dio de alta en el sistema

/* Asegura que la hoja tenga la columna U con su encabezado. */
function asegurarColumnaAlta_(sh) {
  if (sh.getMaxColumns() < COL_ALTA) sh.insertColumnsAfter(sh.getMaxColumns(), COL_ALTA - sh.getMaxColumns());
  if (String(sh.getRange(1, COL_ALTA).getValue() || '').trim() === '') sh.getRange(1, COL_ALTA).setValue('Alta');
}

/* Asegura que la hoja tenga la columna T con su encabezado. */
function asegurarColumnaAntes_(sh) {
  if (sh.getMaxColumns() < COL_ANTES) sh.insertColumnsAfter(sh.getMaxColumns(), COL_ANTES - sh.getMaxColumns());
  if (String(sh.getRange(1, COL_ANTES).getValue() || '').trim() === '') sh.getRange(1, COL_ANTES).setValue('PrecioAntes');
}

/* Última fila con descripción (columna C). No se usa getLastRow() porque el
   ARRAYFORMULA de la columna I puede derramar cadenas vacías más abajo. */
function altaUltimaFila_(sh) {
  const total = sh.getMaxRows();
  if (total < 2) return 1;
  const c = sh.getRange(1, 3, total, 1).getValues();
  for (let i = c.length - 1; i >= 0; i--) if (String(c[i][0] || '').trim() !== '') return i + 1;
  return 1;
}

/* "2026-08-30" a Date a mediodia (evita corrimientos de zona horaria). */
function altaFechaISO_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

// =========================================================
// ALTA DE PEDIDO
// =========================================================
function altaPedido(p) {
  const pedidoID = String(p.pedidoID || '').trim();
  const cache = CacheService.getScriptCache();
  if (pedidoID) {
    const previo = cache.get('alta:' + pedidoID);
    if (previo) return JSON.parse(previo);
  }

  const pagado = Number(p.pagado);
  const productos = Array.isArray(p.productos) ? p.productos : [];
  if (!(pagado > 0)) return { success: false, error: 'Falta el cargo real de la tarjeta' };
  if (!productos.length) return { success: false, error: 'No hay productos en el pedido' };
  if (productos.length > 40) return { success: false, error: 'Maximo 40 productos distintos por pedido' };

  const limpios = [];
  for (let i = 0; i < productos.length; i++) {
    const x = productos[i] || {};
    const d = String(x.descripcion || '').trim();
    const cat = String(x.categoria || '').trim();
    const n = Math.min(50, Math.max(0, parseInt(x.cantidad, 10) || 0));
    const costo = Number(x.costo), precio = Number(x.precio), lista = Number(x.lista) || 0;
    if (!d) return { success: false, error: 'Un producto no tiene descripcion' };
    if (!cat) return { success: false, error: 'Falta la categoria de "' + d + '"' };
    if (!(n > 0)) return { success: false, error: 'Piezas invalidas en "' + d + '"' };
    if (!(costo > 0)) return { success: false, error: 'Costo invalido en "' + d + '"' };
    if (!(precio > 0)) return { success: false, error: 'Precio de venta invalido en "' + d + '"' };
    limpios.push({ d: d, cat: cat, n: n, costo: costo, precio: precio, lista: lista });
  }

  const suma = limpios.reduce((s, x) => s + x.costo * x.n, 0);
  if (!(suma > 0)) return { success: false, error: 'La suma de costos es cero' };
  const factor = pagado / suma;
  if (factor < 0.4 || factor > 3) {
    return { success: false, error: 'El reparto sale x' + factor.toFixed(2) + '. Revisa que el cargo de la tarjeta y los costos sean del mismo pedido.' };
  }

  const fecha = altaFechaISO_(p.fecha);

  invalidarCache_();
  const sh = hojaDe_('Alex');
  if (String(sh.getRange(1, COL_PID).getValue() || '').trim() === '') sh.getRange(1, COL_PID).setValue('ProductoID');
  if (String(sh.getRange(1, COL_PLISTA).getValue() || '').trim() === '') sh.getRange(1, COL_PLISTA).setValue('PrecioLista');
  if (String(sh.getRange(1, COL_CORTE).getValue() || '').trim() === '') sh.getRange(1, COL_CORTE).setValue('Corte');

  // Categoria canonica: si ya existe una igual ignorando acentos y mayusculas, se usa esa ortografia.
  const catCanon = {};
  filas_('Alex').forEach(f => { const c = String(f.row[1] || '').trim(); if (c && !catCanon[normalizar_(c)]) catCanon[normalizar_(c)] = c; });
  limpios.forEach(x => { const k = normalizar_(x.cat); if (catCanon[k]) x.cat = catCanon[k]; });

  // ProductoID: se reutiliza si nombre + categoria ya existen.
  const existentes = {};
  let max = 0;
  filas_('Alex').forEach(f => {
    const pid = pidDe_(f.row);
    if (!pid) return;
    const k = claveNombre_(f.row);
    if (!existentes[k]) existentes[k] = pid;
    const m = pid.match(/^AL-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  const nuevos = {};
  const asignar = (d, cat) => {
    const k = normalizar_(d) + '|' + normalizar_(cat);
    if (existentes[k]) return { pid: existentes[k], nuevo: false };
    if (!nuevos[k]) { max += 1; nuevos[k] = 'AL-' + String(max).padStart(4, '0'); }
    return { pid: nuevos[k], nuevo: true };
  };

  const izq = [], der = [], resumen = [];
  limpios.forEach(x => {
    const cf = Math.round(x.costo * factor * 100) / 100;
    const asignado = asignar(x.d, x.cat);
    for (let i = 0; i < x.n; i++) {
      izq.push([fecha, x.cat, x.d, x.lista > 0 ? x.lista : x.costo, cf, x.precio, '', '']);   // A..H
      der.push(['RECIBIDO', '', '', '', '', '', '', asignado.pid, '', '']);                   // J..S
    }
    resumen.push({ descripcion: x.d, categoria: x.cat, cantidad: x.n, costoFinal: cf, precio: x.precio, pid: asignado.pid, nuevo: asignado.nuevo });
  });

  asegurarColumnaAlta_(sh);
  const inicio = altaUltimaFila_(sh) + 1;
  const n = izq.length;
  const ahora = new Date();
  sh.getRange(inicio, 1, n, 8).setValues(izq);
  sh.getRange(inicio, 10, n, 10).setValues(der);
  // Columna U: cuándo entró al inventario. Es lo que ordena "Recién llegados".
  sh.getRange(inicio, COL_ALTA, n, 1).setValues(izq.map(() => [ahora]));
  SpreadsheetApp.flush();

  const leido = sh.getRange(inicio, 1, n, NCOL).getValues();
  let mal = 0;
  for (let i = 0; i < n; i++) {
    const r = leido[i] || [];
    if (String(r[2] || '').trim() !== izq[i][2]) mal++;
    else if (String(r[9] || '').trim() !== 'RECIBIDO') mal++;
    else if (String(r[COL_PID - 1] || '').trim() !== der[i][7]) mal++;
  }
  invalidarCache_();

  const res = {
    success: true, filas: n, desde: inicio, hasta: inicio + n - 1,
    factor: Math.round(factor * 10000) / 10000, pagado: pagado,
    suma: Math.round(suma * 100) / 100, productos: resumen, verificado: mal === 0
  };
  if (mal > 0) res.aviso = mal + ' fila(s) no se leyeron igual que se escribieron. Revisa la hoja a partir de la fila ' + inicio + '.';
  if (pedidoID) cache.put('alta:' + pedidoID, JSON.stringify(res), 21600);
  return res;
}

// =========================================================
// IMAGENES: la hoja completa, con existencia o sin ella
// =========================================================
function listaImagenes() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IMAGENES');
  if (!sh || sh.getLastRow() < 2) return [];
  const nc = Math.min(4, sh.getLastColumn());
  const out = [];
  sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues().forEach(row => {
    const d = String(row[0] || '').trim();
    const url = String(row[1] || '').trim();
    if (!d) return;
    const extras = String(row[3] || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!url && !extras.length) return;
    out.push({ descripcion: d, url: url, extras: extras });
  });
  return out;
}

// =========================================================
// REMATE: cambia el precio de venta de las piezas sin vender
// remate = { usuario:'Alex', items:[{ descripcion, categoria, precio }] }
// Aplica a TODAS las piezas RECIBIDO de ese producto en la hoja de Alex.
// =========================================================
function aplicarRemate(r) {
  if (String(r.usuario || '').trim() !== 'Alex') return { success: false, error: 'Solo Alex puede aplicar un remate' };
  const items = Array.isArray(r.items) ? r.items : [];
  if (!items.length) return { success: false, error: 'No hay productos en el remate' };
  if (items.length > 60) return { success: false, error: 'Maximo 60 productos por remate' };

  const limpios = [];
  for (let i = 0; i < items.length; i++) {
    const x = items[i] || {};
    const d = String(x.descripcion || '').trim();
    const precio = Number(x.precio);
    if (!d) return { success: false, error: 'Un renglon viene sin descripcion' };
    if (!(precio > 0)) return { success: false, error: 'Precio invalido en "' + d + '"' };
    limpios.push({ d: d, cat: String(x.categoria || '').trim(), precio: precio });
  }

  invalidarCache_();
  const sh = hojaDe_('Alex');
  asegurarColumnaAntes_(sh);

  const last = altaUltimaFila_(sh);
  if (last < 2) return { success: false, error: 'La hoja esta vacia' };
  const nFilas = last - 1;
  const colF = sh.getRange(2, 6, nFilas, 1).getValues();
  const colT = sh.getRange(2, COL_ANTES, nFilas, 1).getValues();
  const datos = sh.getRange(2, 1, nFilas, NCOL).getValues();

  const porClave = {};
  limpios.forEach(x => { porClave[normalizar_(x.d)] = x; });

  let tocadas = 0;
  const cuenta = {};
  for (let i = 0; i < nFilas; i++) {
    const row = datos[i];
    if (String(row[9] || '').trim() !== 'RECIBIDO') continue;
    const d = String(row[2] || '').trim();
    if (!d) continue;
    const x = porClave[normalizar_(d)];
    if (!x) continue;
    if (x.cat && normalizar_(String(row[1] || '')) !== normalizar_(x.cat)) continue;
    const actual = Number(colF[i][0]) || 0;
    if (actual === x.precio) continue;
    if (!colT[i][0]) colT[i][0] = actual;
    colF[i][0] = x.precio;
    tocadas++;
    if (!cuenta[x.d]) cuenta[x.d] = { descripcion: x.d, piezas: 0, antes: actual, ahora: x.precio };
    cuenta[x.d].piezas++;
  }

  if (!tocadas) return { success: false, error: 'No se encontro ninguna pieza sin vender con esos nombres, o ya tenian ese precio' };

  sh.getRange(2, 6, nFilas, 1).setValues(colF);
  sh.getRange(2, COL_ANTES, nFilas, 1).setValues(colT);
  SpreadsheetApp.flush();

  const rele = sh.getRange(2, 6, nFilas, 1).getValues();
  let mal = 0;
  for (let i = 0; i < nFilas; i++) if (Number(rele[i][0]) !== Number(colF[i][0])) mal++;
  invalidarCache_();

  const resumen = [];
  Object.keys(cuenta).forEach(k => resumen.push(cuenta[k]));
  const res = { success: true, piezas: tocadas, productos: resumen, verificado: mal === 0 };
  if (mal > 0) res.aviso = mal + ' fila(s) no quedaron con el precio nuevo. Revisa la hoja.';
  return res;
}

/* Deshacer: devuelve el precio guardado en la columna T y la limpia.
   Si no mandas items, revierte TODO lo que tenga precio anterior guardado. */
function revertirRemate(r) {
  if (String(r.usuario || '').trim() !== 'Alex') return { success: false, error: 'Solo Alex puede revertir un remate' };
  invalidarCache_();
  const sh = hojaDe_('Alex');
  asegurarColumnaAntes_(sh);
  const last = altaUltimaFila_(sh);
  if (last < 2) return { success: false, error: 'La hoja esta vacia' };
  const nFilas = last - 1;
  const colF = sh.getRange(2, 6, nFilas, 1).getValues();
  const colT = sh.getRange(2, COL_ANTES, nFilas, 1).getValues();
  const datos = sh.getRange(2, 1, nFilas, NCOL).getValues();

  const items = Array.isArray(r.items) ? r.items : [];
  const filtro = {};
  items.forEach(x => { const d = String(x.descripcion || '').trim(); if (d) filtro[normalizar_(d)] = true; });
  const soloAlgunos = Object.keys(filtro).length > 0;

  let n = 0;
  for (let i = 0; i < nFilas; i++) {
    if (String(datos[i][9] || '').trim() !== 'RECIBIDO') continue;
    const antes = Number(colT[i][0]);
    if (!(antes > 0)) continue;
    if (soloAlgunos && !filtro[normalizar_(String(datos[i][2] || ''))]) continue;
    colF[i][0] = antes;
    colT[i][0] = '';
    n++;
  }
  if (!n) return { success: false, error: 'No hay precios de remate que revertir' };
  sh.getRange(2, 6, nFilas, 1).setValues(colF);
  sh.getRange(2, COL_ANTES, nFilas, 1).setValues(colT);
  invalidarCache_();
  return { success: true, piezas: n };
}

/* ---------------------------------------------------------------------------
   Marcar la fecha de alta de filas que ya existían antes de la v2.1.
   Úsalo UNA vez desde el editor: cambia los números y dale Ejecutar.
   Ejemplo: sellarAltaDeFilas(671, 681) marca esas filas con la fecha de hoy.
   --------------------------------------------------------------------------- */
function sellarAltaDeFilas(desde, hasta, fecha) {
  const sh = hojaDe_('Alex');
  asegurarColumnaAlta_(sh);
  const d = Math.max(2, Number(desde) || 0), hs = Math.max(d, Number(hasta) || 0);
  const n = hs - d + 1;
  if (n < 1) return 'Rango inválido';
  const f = fecha instanceof Date ? fecha : new Date();
  sh.getRange(d, COL_ALTA, n, 1).setValues(Array.from({ length: n }, () => [f]));
  invalidarCache_();
  return 'Marcadas ' + n + ' filas (' + d + ' a ' + hs + ') con ' + f.toLocaleDateString('es-MX');
}
