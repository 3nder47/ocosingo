// =========================================================
// Kiosko — API JSON v28
//   v28:   · altaPedido, imagenes, aplicarRemate y revertirRemate (archivo Alta.gs).
//          · agregarProducto (el alta de Irene) también sella la fecha de alta.
//          · getCatalogo devuelve 'agregado': la fecha en que el producto se DIO DE
//            ALTA (columna U, la escribe Alta.gs). Si la fila no la tiene —porque es
//            anterior a esta versión— se usa su fecha de compra. Sirve para destacar
//            lo recién llegado en la app.
//   v27:   · fechaDe_ ignora fechas fuera de rango (2020..año+1). Había 20 filas con
//            01/01/36 en fecha de compra que salían como "90 años parados".
//   v25:   · analisis: módulo de análisis de la mercancía de Alex (solo él lo ve). Capital
//            detenido, rotación real, margen por categoría y evolución de costos por producto.
//   v26:   · analisis con detalle por producto: piezas más viejas en stock y margen producto
//            por producto, para que cada sección se pueda ver a fondo.
//   v24:   · catalogoPublico devuelve también 'agregado' (fecha de compra más reciente de las
//            piezas en stock), para la franja de Novedades del catálogo público.
//   v23:   · catalogoPublico devuelve el WhatsApp al que escribe el cliente según de quién sea
//            la mercancía (propiedades WA_ALEX y WA_IRENE). El cliente nunca sabe de quién es:
//            solo cambia el número al que le abre el chat.
//   v22:   · catalogoPublico: única acción SIN token, para la página catalogo.html que se le manda
//            a los clientes. Devuelve solo descripción, categoría, precio, foto y si es la última
//            pieza. Nunca costos, ni cuántas quedan, ni de quién es la mercancía. Oculta lo que
//            no tiene foto.
//   v21:   · CORTES: cerrarCorte congela las ventas pendientes de la mercancía de Alex bajo un
//            número (C-0001…), escribe el bloque en la hoja Transferencias con el formato de
//            siempre y guarda el corte en la hoja CORTES. registrarPago admite abonos parciales
//            (hoja PAGOS); cuando el corte queda pagado, sus ventas pasan a "Transferido" solas.
//          · Columna S (Corte) en las hojas de mercancía. Solo Alex cierra cortes y registra pagos.
//   v20:   · La racha se mide en SEMANAS con venta, no en días. Con una venta por semana la
//            racha diaria nunca aparecía; la semanal sí, y sigue sin mostrarse nunca en negativo.
//   v19:   · Costo real = Costo final (E) y, si está vacía, Costo (D). Igual que la columna
//            Utilidad Neta de la hoja. Antes una E vacía contaba como costo cero y la ganancia
//            de esa venta salía inflada al precio completo.
//          · registrarVenta escribe las 7 celdas de la venta (J–P) en una sola operación y
//            relee la fecha: si no quedó, reescribe; si aún no, avisa a Alex por correo.
//   v18:   · ventasHoyTotal en el dashboard: todo lo vendido hoy (las dos hojas, liquidado o no).
//            El chip "Hoy" de la app dejaba en $0 las ventas de Alex por transferencia.
//   v17:   · SIN PINs por defecto: si falta la propiedad PIN_*, esa persona no entra. Nunca
//            hay un valor conocido de respaldo.
//          · Límite de intentos en verificarPin (CacheService): retraso creciente y bloqueo
//            temporal. Con el token público, un PIN de 4 dígitos ya no se adivina en minutos.
//          · Token y PINs se comparan con .trim(): un espacio invisible en la propiedad o en
//            config.js ya no tumba el acceso en silencio.
//   v16:   · PrecioLista (columna R): deshacer una venta "al costo" ya NO destruye el precio.
//          · registrarVenta acepta el ventaID que genera la app y rechaza duplicados (idempotencia).
//          · Caché por ejecución: cada hoja se lee UNA vez por petición (antes "inicio" recorría
//            las hojas 9 veces y leía IMAGENES 5). Toda escritura invalida la caché.
//          · getDashboardData / getVentasPorMes / getDashboardPorVendedor leen las DOS hojas para
//            las métricas del mes; las cuentas con Alex siguen siendo solo de su mercancía.
//   v15.3: aviso por correo a Alex cuando alguien más vende su mercancía (propiedad EMAIL_ALEX).
//   v15.2: precio de venta especial ("al costo" para la familia) y fotoProducto para compartir
//          la imagen real por Messenger/WhatsApp desde la app.
//   v15.1: "ganancia" ahora es utilidad real para TODOS (precio + extra − costo final − moto),
//          igual que la columna Utilidad Neta. Lo que se transfiere no cambia: eso se calcula aparte.
//   v15: meta mensual por usuario (hoja METAS), impulso (ganancia del mes, promedio por venta, racha)
//        y "Ofrece esto hoy" (productos con stock que más rápido se venden).
//   v14: ProductoID (columna Q) en ambas hojas, deshacer venta, editar y eliminar
//        productos de Irene desde la app.
// Regla de transferencia (efectivo cobrado por Irene, aún no transferido):
//   - Venta de Irene → a Alex se transfiere solo el COSTO FINAL; Irene se queda precio + extra − costo − moto.
//   - Venta de Alex o Mamá → se transfiere íntegro: precio + extra − moto.
// Apps Script ya no sirve HTML: responde JSON para la PWA.
// Requiere propiedad de script API_TOKEN.
//
// PRIMERA VEZ EN v16: ejecutar a mano prepararHojasV102() (Ejecutar → prepararHojasV102).
// Solo ensancha las hojas a 18 columnas y escribe el encabezado "PrecioLista" en R1. No toca datos.
// =========================================================

// Columnas: A fecha compra, B categoría, C descripción, D costo, E costo final, F precio, G cobro extra,
// H gastos ext, I utilidad, J estatus, K vendedor, L fecha venta, M estatus transferencia, N ID (OC-),
// O VentaID (uuid), P método pago, Q ProductoID, R PrecioLista, S Corte (C-0001…).
const NCOL = 19;
const COL_PID = 17;
const COL_PLISTA = 18;
const COL_CORTE = 19;

// ---------- ENTRADA ----------
function doGet(e) {
  return responder_(procesar_(e, 'GET'));
}

function doPost(e) {
  return responder_(procesar_(e, 'POST'));
}

function responder_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lee parámetros de query (?a=b) y, en POST, del body JSON (text/plain para evitar preflight CORS).
function leerParametros_(e) {
  const p = Object.assign({}, (e && e.parameter) || {});
  if (e && e.postData && e.postData.contents) {
    try {
      Object.assign(p, JSON.parse(e.postData.contents));
    } catch (err) {
      p._bodyInvalido = true;
    }
  }
  return p;
}

// Ejecuta fn con el candado del script (evita dos escrituras simultáneas sobre la misma fila).
function conLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function procesar_(e, metodo) {
  try {
    const p = leerParametros_(e);

    // --- Catálogo público: no lleva token porque no expone nada privado ---
    if (metodo === 'GET' && String(p.accion || '').trim() === 'catalogoPublico') {
      return { ok: true, data: getCatalogoPublico() };
    }

    // --- Seguridad ---
    const tokenEsperado = String(PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '').trim();
    if (!tokenEsperado) return { ok: false, error: 'Falta API_TOKEN en Propiedades del script' };
    // El body se revisa ANTES que el token: si el JSON no se pudo leer (una foto
    // demasiado grande, por ejemplo), el token sale vacio y el error decia
    // 'No autorizado', que es falso y manda a buscar el problema al lugar equivocado.
    if (p._bodyInvalido) return { ok: false, error: 'No se pudo leer el envio (body invalido). Suele ser una foto demasiado grande.' };
    if (!p.token || String(p.token).trim() !== tokenEsperado) return { ok: false, error: 'No autorizado' };

    const accion = String(p.accion || '').trim();

    // --- Rutas GET (lectura) ---
    if (metodo === 'GET') {
      switch (accion) {
        case 'ping':              return { ok: true, data: { hora: new Date().toISOString() } };
        case 'inicio':            return { ok: true, data: { dashboard: getDashboardData(), ventasMes: getVentasPorMes(null), catalogo: getCatalogo(), topMes: getTopMes(), recientes: getRecientes(), detalle: getVentasDetalle(), operacionIrene: getOperacionIrene(), impulso: getImpulso(String(p.usuario || '')), ofrecer: getOfrecer(), cortes: getCortes(false) } };
        case 'misVentas':         { const v = requerido_(p.vendedor, 'vendedor'); return { ok: true, data: { resumen: getDashboardPorVendedor(v), ventas: getVentasPorVendedor(v, Number(p.limite) || 200), logros: getLogros(v) } }; }
        case 'dashboard':         return { ok: true, data: getDashboardData() };
        case 'dashboardVendedor': return { ok: true, data: getDashboardPorVendedor(requerido_(p.vendedor, 'vendedor')) };
        case 'ventasMes':         return { ok: true, data: getVentasPorMes(p.vendedor || null) };
        case 'ventas':            return { ok: true, data: getVentasPorVendedor(p.vendedor || null, Number(p.limite) || 200) };
        case 'catalogo':          return { ok: true, data: getCatalogo() };
        case 'imagenes':          return { ok: true, data: listaImagenes() };
        case 'fotoProducto':      return { ok: true, data: getFotoProducto(String(p.descripcion || '')) };
        case 'cortes':            return { ok: true, data: getCortes(true) };
        case 'analisis':          return { ok: true, data: getAnalisis(String(p.rango || 'todo')) };
        default:                  return { ok: false, error: 'Acción GET desconocida: ' + accion };
      }
    }

    // --- Rutas POST (escritura / sensibles) ---
    switch (accion) {
      case 'subirFoto':
        return { ok: true, data: subirFoto(p) };
      case 'agregarProducto':
        return { ok: true, data: conLock_(() => agregarProducto(p.producto || {})) };
      case 'altaPedido':
        return { ok: true, data: conLock_(() => altaPedido(p.pedido || {})) };
      case 'aplicarRemate':
        return { ok: true, data: conLock_(() => aplicarRemate(p.remate || {})) };
      case 'revertirRemate':
        return { ok: true, data: conLock_(() => revertirRemate(p.remate || {})) };
      case 'editarProducto':
        return { ok: true, data: conLock_(() => editarProducto(p.producto || {})) };
      case 'eliminarProducto':
        return { ok: true, data: conLock_(() => eliminarProducto(p.producto || {})) };
      case 'anularVenta':
        return { ok: true, data: conLock_(() => anularVenta(p)) };
      case 'guardarMeta':
        return { ok: true, data: conLock_(() => guardarMeta(String(p.usuario || ''), Number(p.monto))) };
      case 'cerrarCorte':
        return { ok: true, data: conLock_(() => cerrarCorte(String(p.usuario || ''))) };
      case 'registrarPago':
        return { ok: true, data: conLock_(() => registrarPago(String(p.usuario || ''), String(p.corteID || ''), Number(p.monto), String(p.nota || ''))) };
      case 'verificarPin':
        return { ok: true, data: verificarPin(String(p.pin || '')) };
      case 'registrarVenta': {
        const v = p.venta || {};
        requerido_(v.descripcion, 'venta.descripcion');
        requerido_(v.vendedor, 'venta.vendedor');
        requerido_(v.metodoPago, 'venta.metodoPago');
        return { ok: true, data: conLock_(() => registrarVenta(v)) }; // evita doble venta del mismo artículo
      }
      default:
        return { ok: false, error: 'Acción POST desconocida: ' + accion };
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function requerido_(valor, nombre) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    throw new Error('Falta parámetro: ' + nombre);
  }
  return valor;
}

// =========================================================
// LÓGICA DE NEGOCIO
// =========================================================

// --- LÍMITE DE INTENTOS DEL PIN ---------------------------------------------
// Apps Script no expone la IP de quien llama, así que el contador es global.
// Con tres usuarios reales no estorba; para fuerza bruta convierte 10 000
// combinaciones en semanas en vez de minutos.
const PIN_MAX_FALLOS  = 8;     // fallos seguidos antes de bloquear
const PIN_BLOQUEO_SEG = 600;   // 10 minutos de bloqueo
const PIN_VENTANA_SEG = 900;   // los fallos se olvidan tras 15 min sin actividad

function verificarPin(pinIngresado) {
  const cache = CacheService.getScriptCache();

  // ¿Bloqueado ahora mismo?
  const hasta = Number(cache.get('pin_bloqueo') || 0);
  if (hasta > Date.now()) {
    const min = Math.max(1, Math.ceil((hasta - Date.now()) / 60000));
    return { valido: false, bloqueado: true,
      error: 'Demasiados intentos. Espera ' + min + ' minuto' + (min === 1 ? '' : 's') + ' e intenta otra vez.' };
  }

  // NO hay PINs por defecto. Si falta la propiedad, esa persona simplemente no entra.
  const props = PropertiesService.getScriptProperties();
  const leer = n => String(props.getProperty(n) || '').trim();
  const configurados = [['Irene', leer('PIN_IRENE')], ['Alex', leer('PIN_ALEX')], ['Mamá', leer('PIN_MAMA')]]
    .filter(x => x[1] !== '');
  if (!configurados.length) {
    return { valido: false, error: 'No hay ningún PIN configurado. Alex: Apps Script → Propiedades del script → PIN_IRENE, PIN_ALEX, PIN_MAMA.' };
  }

  const p = String(pinIngresado || '').trim();
  const acierto = p ? configurados.filter(x => x[1] === p)[0] : null;

  if (acierto) {
    cache.remove('pin_fallos');
    cache.remove('pin_bloqueo');
    return { valido: true, vendedor: acierto[0] };
  }

  const fallos = Number(cache.get('pin_fallos') || 0) + 1;
  cache.put('pin_fallos', String(fallos), PIN_VENTANA_SEG);

  if (fallos >= PIN_MAX_FALLOS) {
    cache.put('pin_bloqueo', String(Date.now() + PIN_BLOQUEO_SEG * 1000), PIN_BLOQUEO_SEG + 60);
    cache.remove('pin_fallos');
    return { valido: false, bloqueado: true,
      error: 'Demasiados intentos. Espera ' + Math.round(PIN_BLOQUEO_SEG / 60) + ' minutos e intenta otra vez.' };
  }

  // Retraso creciente: a una persona le da igual, a un script le cuesta horas.
  Utilities.sleep(Math.min(3000, fallos * 400));

  const restan = PIN_MAX_FALLOS - fallos;
  return { valido: false, restantes: restan,
    error: restan <= 3 ? ('PIN incorrecto · te quedan ' + restan + ' intento' + (restan === 1 ? '' : 's')) : 'PIN incorrecto' };
}

/**
 * EJECUTAR A MANO si alguien se quedó bloqueado por error (Ejecutar → desbloquearPin).
 * Borra el contador de fallos y el bloqueo al instante.
 */
function desbloquearPin() {
  const c = CacheService.getScriptCache();
  c.remove('pin_fallos');
  c.remove('pin_bloqueo');
  Logger.log('PIN desbloqueado');
  return 'PIN desbloqueado';
}

// Hojas de mercancía. La de Irene se crea sola la primera vez, copiando encabezados.
const HOJAS = { Alex: 'ALEX_NUEVO', Irene: 'IRENE_NUEVO' };
const PREFIJO_PID = { Alex: 'AL-', Irene: 'IR-' };

// =========================================================
// CACHÉ POR EJECUCIÓN
// Cada hoja se lee una sola vez por petición. Toda escritura llama invalidarCache_().
// =========================================================
let _filas = null, _imgs = null;

function invalidarCache_() { _filas = null; _imgs = null; }

// Si la hoja fue recortada a menos de 18 columnas, la ensancha (si no, getRange truena).
function asegurarAncho_(sh) {
  if (sh && sh.getMaxColumns() < NCOL) sh.insertColumnsAfter(sh.getMaxColumns(), NCOL - sh.getMaxColumns());
}

function hojaDe_(origen) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombre = HOJAS[origen] || HOJAS.Alex;
  let sh = ss.getSheetByName(nombre);
  if (!sh && origen === 'Irene') {
    sh = ss.insertSheet(nombre);
    asegurarAncho_(sh);
    const src = ss.getSheetByName(HOJAS.Alex);
    if (src) sh.getRange(1, 1, 1, NCOL).setValues(src.getRange(1, 1, 1, NCOL).getValues());
    sh.getRange(1, COL_PID).setValue('ProductoID');
    sh.getRange(1, COL_PLISTA).setValue('PrecioLista');
    sh.getRange(1, COL_CORTE).setValue('Corte');
    sh.setFrozenRows(1);
  }
  asegurarAncho_(sh);
  return sh;
}

// Filas de una o ambas hojas, cada una con su origen.
function filas_(soloOrigen) {
  if (!_filas) {
    _filas = [];
    Object.keys(HOJAS).forEach(origen => {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS[origen]);
      if (!sh || sh.getLastRow() < 2) return;
      const nc = Math.min(NCOL, sh.getMaxColumns());
      sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues().forEach((row, i) => {
        while (row.length < NCOL) row.push('');   // hojas angostas no rompen los índices
        _filas.push({ row: row, origen: origen, fila: i + 2 });
      });
    });
  }
  return soloOrigen ? _filas.filter(f => f.origen === soloOrigen) : _filas;
}

const pidDe_ = row => String(row[COL_PID - 1] || '').trim();
// Costo real de la pieza: Costo final (E) si está; si no, Costo (D). Nunca cero por una celda vacía.
const costoDe_ = row => (Number(row[4]) || Number(row[3]) || 0);
const corteDe_ = row => String(row[COL_CORTE - 1] || '').trim();
// Cuánto aporta una venta pendiente a lo que se le transfiere a Alex (misma regla que la app).
function aporteDe_(row) {
  const vend = String(row[10] || '').trim(), met = String(row[15] || '').trim();
  const precio = Number(row[5]) || 0, extra = Number(row[6]) || 0, gasto = Number(row[7]) || 0;
  if (vend === 'Alex') return met === 'Efectivo a Irene' ? precio + extra - gasto : -gasto;
  return costoDe_(row);
}

// GANANCIA = utilidad real: precio + extra − costo final − moto, sin importar quién vende.
// (Lo que se transfiere a Alex es otra cosa y se calcula aparte: en sus ventas él recibe
// también el costo, porque lo puso él, pero eso no es ganancia.)
function gananciaDe_(vendedor, precio, extra, costoFinal, gasto, origen) {
  return precio + extra - costoFinal - gasto;
}

// DASHBOARD GENERAL
// Métricas del mes (ventas, artículos, moto, semana) = las DOS hojas.
// Cuentas con Alex (por transferir, ganancias, pendientes) = SOLO su mercancía.
function getDashboardData() {
  const todas = filas_();
  if (!todas.length) return getDashboardVacio();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  let ventasHoy = 0, articulosMes = 0, porTransferir = 0;
  let gananciaIrene = 0, gananciaAlex = 0, gananciaMama = 0, gastoMotomandado = 0;
  let deAlexEfectivo = 0, costoFamilia = 0, motoPagadoIrene = 0;
  let ventasSemana = [0, 0, 0, 0, 0, 0, 0];
  let totalVentasPendientes = 0, ventasTotalesMes = 0;
  let articulosMesTotal = 0, pendienteMes = 0, ventasHoyTotal = 0, sinCorte = 0, enCorte = 0;

  todas.forEach(f => {
    const row = f.row;
    const estatus = String(row[9] || '').trim();
    const vendedorFila = String(row[10] || '').trim();
    const fecha = row[11];
    const metodoPago = String(row[15] || '').trim();
    const precio = Number(row[5]) || 0;
    const costoFinal = costoDe_(row);
    const cobroExtra = Number(row[6]) || 0;
    const gastoExt = Number(row[7]) || 0;
    const estatusTransf = String(row[12] || '').trim();

    // --- Negocio completo: las dos hojas ---
    if (estatus === 'VENDIDO' && fecha) {
      const fv = new Date(fecha);
      if (fv >= primerDiaMes) {
        ventasTotalesMes += (precio + cobroExtra);
        articulosMesTotal++;
        gastoMotomandado += gastoExt;                 // motomandado del mes (transferido o no)
        if (estatusTransf === 'No transferido') pendienteMes += (precio + cobroExtra);
      }
      const diffDias = Math.floor((hoy - fv) / (1000 * 60 * 60 * 24));
      if (diffDias >= 0 && diffDias < 7) ventasSemana[6 - diffDias] += (precio + cobroExtra);
      if (fv >= hoy) ventasHoyTotal += (precio + cobroExtra);
    }

    // --- Cuentas con Alex: su mercancía y nada más ---
    if (f.origen === 'Irene') return;
    if (estatus !== 'VENDIDO' || estatusTransf !== 'No transferido') return;
    totalVentasPendientes++;
    if (corteDe_(row)) enCorte += aporteDe_(row); else sinCorte += aporteDe_(row);
    if (fecha && new Date(fecha) >= hoy) ventasHoy += (precio + cobroExtra);
    if (fecha && new Date(fecha) >= primerDiaMes) articulosMes++;
    if (vendedorFila === 'Alex') {
      gananciaAlex += (precio + cobroExtra - gastoExt);
      if (metodoPago === 'Efectivo a Irene') { deAlexEfectivo += (precio + cobroExtra - gastoExt); porTransferir += (precio + cobroExtra - gastoExt); }
      else { motoPagadoIrene += gastoExt; porTransferir -= gastoExt; }   // el cliente ya le pagó a Alex; Irene puso el moto
    } else {
      // Irene o Mamá: se quedan su ganancia y transfieren el costo del producto
      costoFamilia += costoFinal; porTransferir += costoFinal;
      const g = precio + cobroExtra - costoFinal - gastoExt;
      if (vendedorFila === 'Irene') gananciaIrene += g; else gananciaMama += g;
    }
  });

  const r2 = x => Math.round(x * 100) / 100;
  // Lo que de verdad se debe: las ventas nuevas sin corte + el saldo de los cortes abiertos (ya con abonos).
  const abiertos = getCortes(false).filter(c => c.estado !== 'Pagado');
  const saldoCortes = abiertos.reduce((s, c) => s + c.saldo, 0);
  return {
    ventasHoy: r2(ventasHoy),
    ventasHoyTotal: r2(ventasHoyTotal),
    sinCorte: r2(sinCorte),
    enCorte: r2(enCorte),
    saldoCortes: r2(saldoCortes),
    cortesAbiertos: abiertos.length,
    porTransferirBruto: r2(porTransferir),
    articulosMes: articulosMes,
    porTransferir: r2(sinCorte + saldoCortes),
    deAlexEfectivo: r2(deAlexEfectivo),
    costoFamilia: r2(costoFamilia),
    motoPagadoIrene: r2(motoPagadoIrene),
    gananciaIrene: r2(gananciaIrene),
    gananciaAlex: r2(gananciaAlex),
    gananciaMama: r2(gananciaMama),
    gastoMotomandado: r2(gastoMotomandado),
    ventasSemana: ventasSemana.map(r2),
    totalVentas: totalVentasPendientes,
    ventasTotalesMes: r2(ventasTotalesMes),
    articulosMesTotal: articulosMesTotal,
    pendienteMes: r2(pendienteMes)
  };
}

function getDashboardVacio() {
  return {
    ventasHoy: 0, ventasHoyTotal: 0, sinCorte: 0, enCorte: 0, saldoCortes: 0, cortesAbiertos: 0, porTransferirBruto: 0, articulosMes: 0, porTransferir: 0, deAlexEfectivo: 0, costoFamilia: 0, motoPagadoIrene: 0,
    gananciaIrene: 0, gananciaAlex: 0, gananciaMama: 0, gastoMotomandado: 0,
    ventasSemana: [0, 0, 0, 0, 0, 0, 0],
    totalVentas: 0, ventasTotalesMes: 0, articulosMesTotal: 0, pendienteMes: 0
  };
}

// DASHBOARD POR VENDEDOR (ambas hojas)
function getDashboardPorVendedor(vendedor) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  let pendientes = 0, ganancia = 0, articulosMes = 0;
  filas_().forEach(f => {
    const row = f.row;
    if (String(row[9] || '').trim() !== 'VENDIDO') return;
    if (String(row[12] || '').trim() !== 'No transferido') return;
    if (String(row[10] || '').trim() !== vendedor) return;
    const fecha = row[11];
    pendientes++;
    if (fecha && new Date(fecha) >= primerDiaMes) articulosMes++;
    ganancia += gananciaDe_(vendedor, Number(row[5]) || 0, Number(row[6]) || 0, costoDe_(row), Number(row[7]) || 0, f.origen);
  });
  return { pendientes: pendientes, ganancia: Math.round(ganancia * 100) / 100, articulosMes: articulosMes };
}

// VENTAS POR MES (ambas hojas)
function getVentasPorMes(vendedor) {
  const meses = {};
  const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  filas_().forEach(f => {
    const row = f.row;
    if (String(row[9] || '').trim() !== 'VENDIDO' || !row[11]) return;
    if (vendedor && String(row[10] || '').trim() !== vendedor) return;
    const fechaVenta = new Date(row[11]);
    const anio = fechaVenta.getFullYear();
    const mes = fechaVenta.getMonth();
    const key = anio + '-' + String(mes).padStart(2, '0');
    if (!meses[key]) {
      meses[key] = { label: nombresMeses[mes] + ' ' + anio, anio: anio, mes: mes, cantidad: 0, total: 0 };
    }
    meses[key].cantidad++;
    meses[key].total += (Number(row[5]) || 0) + (Number(row[6]) || 0);
  });
  return Object.values(meses)
    .sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mes - b.mes)
    .slice(-12)
    .map(m => ({ label: m.label, cantidad: m.cantidad, total: Math.round(m.total * 100) / 100 }));
}

// VENTAS POR VENDEDOR (ambas hojas)
function getVentasPorVendedor(vendedor, limite = 200) {
  const ventas = filas_()
    .map(f => {
      const row = f.row, origen = f.origen;
      const estatus = String(row[9] || '').trim();
      const vendedorFila = String(row[10] || '').trim();
      if (vendedor && vendedorFila !== vendedor) return null;
      if (estatus !== 'VENDIDO') return null;
      const fechaRaw = row[11];
      const fechaObj = fechaRaw ? new Date(fechaRaw) : null;
      return {
        fila: f.fila,
        origen: origen,
        id: String(row[13] || ''),
        ventaID: String(row[14] || ''),
        pid: pidDe_(row),
        descripcion: String(row[2] || ''),
        vendedor: vendedorFila,
        fecha: fechaObj ? fechaObj.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '',
        fechaTimestamp: fechaObj ? fechaObj.getTime() : 0,
        metodoPago: String(row[15] || ''),
        estatusTransferencia: String(row[12] || ''),
        precio: Number(row[5]) || 0,
        costo: Number(row[3]) || 0,
        costoFinal: costoDe_(row),
        cobroExtra: Number(row[6]) || 0,
        gastoExt: Number(row[7]) || 0,
        corte: corteDe_(row),
        aporte: Math.round(aporteDe_(row) * 100) / 100
      };
    })
    .filter(v => v !== null)
    .sort((a, b) => b.fechaTimestamp - a.fechaTimestamp)
    .slice(0, limite);
  const imgs = mapaImagenes_();
  return ventas.map(v => ({
    ...v,
    imagen: imgUrl_(imgs, v.descripcion),
    ganancia: gananciaDe_(v.vendedor, v.precio, v.cobroExtra, v.costoFinal, v.gastoExt, v.origen)
  }));
}

// CATÁLOGO (ambas hojas; cada producto sabe de quién es).
// Se agrupa por ProductoID; si una fila aún no tiene ID (antes de correr asignarProductoIDs) se agrupa por nombre.
function getCatalogo() {
  const stockPorProducto = {};
  // Fecha de alta (columna U = 21). filas_() solo lee NCOL columnas, así que se lee aparte.
  const altas = {};
  Object.keys(HOJAS).forEach(origen => {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS[origen]);
    if (!sh || sh.getLastRow() < 2 || sh.getMaxColumns() < 21) return;
    sh.getRange(2, 21, sh.getLastRow() - 1, 1).getValues().forEach((r, i) => {
      const v = r[0];
      if (v instanceof Date && !isNaN(v)) altas[origen + '|' + (i + 2)] = v.getTime();
    });
  });
  filas_().forEach(f => {
    const row = f.row;
    const descripcion = String(row[2] || '').trim();
    const categoria = String(row[1] || '').trim();
    const precio = row[5];
    const costoFinal = costoDe_(row);
    const estatus = String(row[9] || '').trim();
    if (descripcion === '' || estatus !== 'RECIBIDO') return;
    const pid = pidDe_(row);
    const clave = pid ? f.origen + '|' + pid : descripcion + ' | ' + categoria + ' | ' + f.origen;
    if (!stockPorProducto[clave]) {
      stockPorProducto[clave] = { pid, descripcion, categoria, precio, costoFinal, stock: 0, origen: f.origen, agregado: 0 };
    }
    stockPorProducto[clave].stock++;
    // Cuándo entró al inventario: la fecha de alta si existe; si no, la de compra.
    const fa = altas[f.origen + '|' + f.fila];
    const fc = fechaDe_(row[0]);
    const ts = fa || (fc ? fc.getTime() : 0);
    if (ts > stockPorProducto[clave].agregado) stockPorProducto[clave].agregado = ts;
  });
  const imgs = mapaImagenes_();
  return Object.values(stockPorProducto).filter(item => item.stock > 0)
    .map(item => ({ ...item, imagen: imgUrl_(imgs, item.descripcion), extras: imgExtras_(imgs, item.descripcion) }));
}

// =========================================================
// IMÁGENES DE PRODUCTO
// Hoja IMAGENES: A = Descripción, B = URL, C = Archivo (informativo), D = Extras
// =========================================================
function mapaImagenes_() {
  if (_imgs) return _imgs;
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IMAGENES');
  const m = {};
  if (!sh || sh.getLastRow() < 2) { _imgs = m; return m; }
  sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues().forEach(r => {
    const d = String(r[0] || '').trim(), u = String(r[1] || '').trim();
    const extras = String(r[3] || '').split(',').map(x => x.trim()).filter(Boolean);
    if (d && u) m[normalizar_(d)] = { url: u, extras: extras };
  });
  _imgs = m;
  return m;
}
const imgUrl_ = (m, d) => (m[normalizar_(d)] || {}).url || '';
const imgExtras_ = (m, d) => (m[normalizar_(d)] || {}).extras || [];

function normalizar_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp|heic|gif)$/i, '')          // quita extensión
    .replace(/[^a-z0-9]+/g, ' ')                          // símbolos → espacio
    .trim();
}

// Decide base y número de toma. Primero el nombre completo contra los productos;
// solo si no es exacto se intenta quitando un número final ("… 2", "…-3", "… (2)").
// Así "Incubadora 36" y "Zeblaze Btalk 3" no pierden su número.
function baseYToma_(nombreArchivo, clavesSet) {
  const n = normalizar_(nombreArchivo);
  if (clavesSet[n]) return { base: n, toma: 0 };
  // con separador: "morado 2", "morado-2", "morado (2)"  |  pegado: "morado2"
  const m = n.match(/^(.*?)\s*(?:[-_]\s*)?(\d{1,2})$/);
  if (m && m[1] && clavesSet[m[1].trim()]) return { base: m[1].trim(), toma: parseInt(m[2], 10) };
  return { base: n, toma: 0 };
}

// Similitud 0..1 por bigramas (Dice). Tolera pequeñas diferencias de nombre.
function similitud_(a, b) {
  if (a === b) return 1;
  const bg = s => { const r = {}; for (let i = 0; i < s.length - 1; i++) { const k = s.substr(i, 2); r[k] = (r[k] || 0) + 1; } return r; };
  const A = bg(a), B = bg(b); let inter = 0;
  Object.keys(A).forEach(k => { if (B[k]) inter += Math.min(A[k], B[k]); });
  return (2 * inter) / ((a.length - 1) + (b.length - 1) || 1);
}

/**
 * EJECUTAR A MANO desde el editor (Ejecutar → sincronizarImagenes).
 * Lee la carpeta de Drive (propiedad FOTOS_FOLDER_ID), empareja cada archivo
 * con una descripción de las hojas y llena la hoja IMAGENES.
 * Nunca borra URLs que ya existan salvo que encuentre un archivo nuevo para ese producto.
 * Al terminar muestra un reporte en el registro (Ver → Registros de ejecución).
 */
function sincronizarImagenes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folderId = PropertiesService.getScriptProperties().getProperty('FOTOS_FOLDER_ID');
  if (!folderId) throw new Error('Falta la propiedad FOTOS_FOLDER_ID (ID de la carpeta de Drive)');
  const folder = DriveApp.getFolderById(folderId);

  // 1) Productos únicos (todas las filas, vendidas o no, para que la foto sirva siempre)
  const descs = {};
  filas_().forEach(f => { const d = String(f.row[2] || '').trim(); if (d) descs[normalizar_(d)] = d; });
  const claves = Object.keys(descs);
  const clavesSet = {}; claves.forEach(k => clavesSet[k] = true);

  // 2) Archivos de la carpeta
  const files = [];
  const it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (String(f.getMimeType()).indexOf('image/') === 0) files.push(f); }

  // 3) Emparejar (varias tomas del mismo producto → la de número más bajo es la principal)
  const asignados = {}, sinProducto = [], ambiguos = [];
  files.sort((a, b) => baseYToma_(a.getName(), clavesSet).toma - baseYToma_(b.getName(), clavesSet).toma);
  files.forEach(f => {
    const n = baseYToma_(f.getName(), clavesSet).base;
    let best = null, bestS = 0, second = 0;
    claves.forEach(k => { const sc = similitud_(n, k); if (sc > bestS) { second = bestS; bestS = sc; best = k; } else if (sc > second) second = sc; });
    if (best && bestS >= 0.85 && (bestS === 1 || bestS - second >= 0.08)) {
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      const url = 'https://drive.google.com/thumbnail?id=' + f.getId() + '&sz=w600';
      if (!asignados[best]) asignados[best] = { url: url, archivo: f.getName(), extras: [] };
      else asignados[best].extras.push(url);
    } else if (best && bestS >= 0.7) {
      ambiguos.push(f.getName() + '  →  ¿' + descs[best] + '? (' + Math.round(bestS * 100) + '%)');
    } else {
      sinProducto.push(f.getName());
    }
  });

  // 4) Escribir hoja IMAGENES (conserva URLs previas)
  let sh = ss.getSheetByName('IMAGENES');
  if (!sh) { sh = ss.insertSheet('IMAGENES'); sh.appendRow(['Descripción', 'URL', 'Archivo', 'Extras']); sh.setFrozenRows(1); }
  const previas = mapaImagenes_();
  const filas = claves.sort((a, b) => descs[a].localeCompare(descs[b])).map(k => {
    const a = asignados[k];
    const p = previas[k] || {};
    return [descs[k], a ? a.url : (p.url || ''), a ? a.archivo : '', a ? a.extras.join(', ') : (p.extras || []).join(', ')];
  });
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 4).clearContent();
  if (filas.length) sh.getRange(2, 1, filas.length, 4).setValues(filas);
  invalidarCache_();

  // 5) Reporte
  const sinFoto = filas.filter(r => !r[1]).map(r => r[0]);
  const rep = [
    'Fotos en carpeta: ' + files.length,
    'Asignadas: ' + Object.keys(asignados).length + ' (tomas extra: ' + Object.values(asignados).reduce((t, a) => t + a.extras.length, 0) + ')',
    'Productos con foto: ' + (filas.length - sinFoto.length) + ' / ' + filas.length,
    '', 'AMBIGUAS (renombra el archivo con el nombre exacto del producto; tomas extra: nombre + 2, 3…): ', ...(ambiguos.length ? ambiguos : ['  ninguna']),
    '', 'ARCHIVOS SIN PRODUCTO: ', ...(sinProducto.length ? sinProducto : ['  ninguno']),
    '', 'PRODUCTOS SIN FOTO: ', ...(sinFoto.length ? sinFoto : ['  ninguno'])
  ].join('\n');
  Logger.log(rep);
  return rep;
}

// LOGROS DEL VENDEDOR (histórico, para la vista Mis ventas)
function getLogros(vendedor) {
  const data = filas_();
  if (!data.length) return null;
  const N = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoy = new Date(); const y = hoy.getFullYear(), m = hoy.getMonth();
  const keyActual = y + '-' + m, keyPasado = (m === 0 ? (y - 1) : y) + '-' + (m === 0 ? 11 : m - 1);
  const meses = {}, productos = {}, dias = {};
  let total = 0, cantidad = 0, primera = null, r2 = x => Math.round(x * 100) / 100;
  data.forEach(fx => {
    const row = fx.row;
    if (String(row[9] || '').trim() !== 'VENDIDO' || String(row[10] || '').trim() !== vendedor || !row[11]) return;
    const f = new Date(row[11]);
    const precio = Number(row[5]) || 0, costoFinal = costoDe_(row), extra = Number(row[6]) || 0, gasto = Number(row[7]) || 0;
    const g = gananciaDe_(vendedor, precio, extra, costoFinal, gasto, fx.origen);
    const k = f.getFullYear() + '-' + f.getMonth();
    if (!meses[k]) meses[k] = { label: N[f.getMonth()] + ' ' + f.getFullYear(), y: f.getFullYear(), m: f.getMonth(), ganancia: 0, cantidad: 0 };
    meses[k].ganancia += g; meses[k].cantidad++;
    const d = String(row[2] || '').trim();
    const pk = pidDe_(row) ? fx.origen + '|' + pidDe_(row) : d;   // producto estrella agrupado por ID (el nombre puede cambiar)
    if (!productos[pk]) productos[pk] = { pid: pidDe_(row), descripcion: d, categoria: String(row[1] || '').trim(), cantidad: 0 };
    productos[pk].cantidad++;
    if (f > (productos[pk]._f || 0)) { productos[pk].descripcion = d; productos[pk]._f = f; }   // muestra el nombre más reciente
    if (k === keyActual) { const dk = f.getDate(); dias[dk] = (dias[dk] || 0) + precio + extra; }
    total += g; cantidad++;
    if (!primera || f < primera) primera = f;
  });
  const lista = Object.values(meses).sort((a, b) => a.y - b.y || a.m - b.m);
  const mejor = lista.reduce((a, x) => x.ganancia > a.ganancia ? x : a, { ganancia: 0, label: '', cantidad: 0 });
  const top = Object.values(productos).sort((a, b) => b.cantidad - a.cantidad)[0] || null;
  const imgs = mapaImagenes_();
  const diasArr = Object.keys(dias).map(k => ({ dia: Number(k), total: dias[k] }));
  const mejorDia = diasArr.reduce((a, x) => x.total > a.total ? x : a, { dia: 0, total: 0 });
  const fmt = x => x ? ({ label: x.label, ganancia: r2(x.ganancia), cantidad: x.cantidad }) : null;
  return {
    mesActual: fmt(meses[keyActual]), mesPasado: fmt(meses[keyPasado]),
    mejorMes: mejor.ganancia > 0 ? fmt(mejor) : null,
    topProducto: top ? { pid: top.pid, descripcion: top.descripcion, categoria: top.categoria, cantidad: top.cantidad, imagen: imgUrl_(imgs, top.descripcion) } : null,
    total: { ganancia: r2(total), cantidad: cantidad, meses: lista.length, desde: primera ? (N[primera.getMonth()] + ' ' + primera.getFullYear()) : '' },
    esteMes: { diasConVenta: diasArr.length, mejorDia: mejorDia.dia, mejorDiaTotal: r2(mejorDia.total) }
  };
}

// DETALLE PARA LAS HOJAS DEL DASHBOARD: todas las pendientes + todas las de este mes
function getVentasDetalle() {
  const hoy = new Date(); const m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1).getTime();
  return getVentasPorVendedor(null, 1000).filter(v => v.estatusTransferencia === 'No transferido' || (v.fechaTimestamp && v.fechaTimestamp >= m0));
}

// MÁS VENDIDOS DEL MES (top 3 por cantidad), agrupados por ProductoID
function getTopMes() {
  const hoy = new Date(); const m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const acc = {};
  filas_().forEach(f => { const row = f.row;
    if (String(row[9] || '').trim() !== 'VENDIDO' || !row[11] || new Date(row[11]) < m0) return;
    const d = String(row[2] || '').trim(); if (!d) return;
    const pid = pidDe_(row), k = pid ? f.origen + '|' + pid : d;
    if (!acc[k]) acc[k] = { pid: pid, origen: f.origen, descripcion: d, categoria: String(row[1] || '').trim(), cantidad: 0, total: 0 };
    acc[k].cantidad++; acc[k].total += (Number(row[5]) || 0) + (Number(row[6]) || 0);
  });
  const imgs = mapaImagenes_();
  return Object.values(acc).sort((a, b) => b.cantidad - a.cantidad || b.total - a.total).slice(0, 3)
    .map(t => ({ ...t, total: Math.round(t.total * 100) / 100, imagen: imgUrl_(imgs, t.descripcion) }));
}

// VENDIDOS RECIENTEMENTE (últimos 6 productos distintos que aún tienen stock).
// Devuelve la clave del producto: ProductoID si lo tiene, si no la descripción.
function getRecientes() {
  const todas = filas_();
  const clave = f => pidDe_(f.row) || String(f.row[2] || '').trim();
  const stock = {};
  todas.forEach(f => { if (String(f.row[9] || '').trim() === 'RECIBIDO') { const d = clave(f); stock[d] = (stock[d] || 0) + 1; } });
  const vendidos = todas.filter(f => String(f.row[9] || '').trim() === 'VENDIDO' && f.row[11])
    .map(f => ({ d: clave(f), t: new Date(f.row[11]).getTime() }))
    .sort((a, b) => b.t - a.t);
  const out = [], seen = {};
  for (const v of vendidos) { if (!seen[v.d] && stock[v.d]) { seen[v.d] = true; out.push(v.d); if (out.length >= 6) break; } }
  return out;
}

// REGISTRAR VENTA. Busca la pieza por ProductoID (si la app lo manda); si no, por descripción.
// · Idempotencia: si la app manda ventaID y ya existe, no se duplica (bandeja offline).
//   El chequeo corre dentro del lock que pone procesar_ y antes del consecutivo OC-.
// · Precio especial: guarda el precio de lista en R antes de pisar F, para que
//   anularVenta pueda devolverlo.
function registrarVenta(venta) {
  invalidarCache_();   // datos frescos dentro del lock
  const origen = venta.origen === 'Irene' ? 'Irene' : 'Alex';
  const sheet = hojaDe_(origen);
  if (!sheet) return { success: false, error: 'No se encontró la hoja de ' + origen };

  // --- Idempotencia ---
  const ventaIDCliente = String(venta.ventaID || '').trim();
  if (ventaIDCliente) {
    const ya = filas_().filter(f => String(f.row[14] || '').trim() === ventaIDCliente)[0];
    if (ya) {
      return {
        success: true, duplicado: true, mensaje: 'Esta venta ya estaba registrada',
        detalle: {
          id: String(ya.row[13] || ''), ventaID: ventaIDCliente,
          descripcion: String(ya.row[2] || ''), costo: costoDe_(ya.row),
          vendedor: String(ya.row[10] || ''),
          fecha: ya.row[11] ? new Date(ya.row[11]).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }) : '',
          estatusTransferencia: String(ya.row[12] || '')
        }
      };
    }
  }

  // --- Pieza a vender: primera RECIBIDO en orden de fila (mismo criterio que getCatalogo) ---
  const pid = String(venta.pid || '').trim();
  const libres = filas_(origen).filter(f =>
    String(f.row[9] || '').trim() === 'RECIBIDO' &&
    (pid ? pidDe_(f.row) === pid : String(f.row[2] || '').trim() === String(venta.descripcion).trim()));
  if (!libres.length) return { success: false, error: 'Producto no encontrado o sin stock en estado RECIBIDO' };
  const rowIndex = libres[0].fila, filaOriginal = libres[0].row;

  // --- Consecutivo OC-, único entre ambas hojas ---
  const numeros = filas_().map(f => String(f.row[13] || ''))
    .filter(id => id.indexOf('OC-') === 0)
    .map(id => parseInt(id.replace('OC-', ''), 10))
    .filter(n => !isNaN(n));
  const maxNumero = numeros.length ? Math.max.apply(null, numeros) : 0;
  const nuevoID = 'OC-' + String(maxNumero + 1).padStart(4, '0');

  const fechaVenta = new Date();
  // Solo queda liquidada al instante una venta de Alex cobrada por transferencia y sin motomandado.
  // Irene/Mamá siempre deben el costo; si Irene pagó el moto en una venta de Alex, ese saldo queda pendiente.
  const esTransf = String(venta.metodoPago).trim().indexOf('Transferencia') === 0;
  const gastoNum = Number(venta.gastosExt) || 0;
  // Mercancía de Irene: nunca entra al flujo de transferencias de Alex
  const estatusTransferencia = origen === 'Irene' ? 'No aplica'
    : (esTransf && String(venta.vendedor).trim() === 'Alex' && gastoNum === 0) ? 'Transferido' : 'No transferido';
  const ventaID = ventaIDCliente || Utilities.getUuid();

  // Precio especial de esta venta (p. ej. "al costo" para la familia). El precio de lista
  // se guarda en R; anularVenta lo devuelve. Solo afecta esta pieza.
  const pv = Number(venta.precioVenta);
  if (venta.precioVenta !== '' && venta.precioVenta !== null && venta.precioVenta !== undefined && pv > 0) {
    if (String(sheet.getRange(1, COL_PLISTA).getValue() || '').trim() === '') sheet.getRange(1, COL_PLISTA).setValue('PrecioLista');
    sheet.getRange(rowIndex, COL_PLISTA).setValue(Number(filaOriginal[5]) || 0);
    sheet.getRange(rowIndex, 6).setValue(pv);
  }
  if (venta.cobroExtra !== '' && venta.cobroExtra !== null && venta.cobroExtra !== undefined && !isNaN(Number(venta.cobroExtra))) {
    sheet.getRange(rowIndex, 7).setValue(Number(venta.cobroExtra));
  }
  if (venta.gastosExt !== '' && venta.gastosExt !== null && venta.gastosExt !== undefined && !isNaN(Number(venta.gastosExt))) {
    sheet.getRange(rowIndex, 8).setValue(Number(venta.gastosExt));
  }
  // J..P en una sola escritura: o entra todo, o no entra nada. Nunca una fila VENDIDO sin fecha.
  const filaVenta = ['VENDIDO', venta.vendedor, fechaVenta, estatusTransferencia, nuevoID, ventaID, venta.metodoPago];
  sheet.getRange(rowIndex, 10, 1, 7).setValues([filaVenta]);
  SpreadsheetApp.flush();
  // Verificación: si la fecha no quedó, se reescribe; si aún no, se avisa a Alex ese mismo día.
  let avisoFecha = '';
  if (!sheet.getRange(rowIndex, 12).getValue()) {
    sheet.getRange(rowIndex, 10, 1, 7).setValues([filaVenta]);
    SpreadsheetApp.flush();
    if (!sheet.getRange(rowIndex, 12).getValue()) {
      avisoFecha = 'La fecha de venta no quedó guardada en la fila ' + rowIndex + '. Revísala en la hoja.';
      avisarAlex_('Kiosko: fila ' + rowIndex + ' sin fecha de venta · ' + nuevoID,
        [avisoFecha, 'Producto: ' + String(filaOriginal[2] || ''), 'Vendió: ' + venta.vendedor, 'Fecha esperada: ' + fechaVenta.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })]);
    }
  }

  invalidarCache_();   // OBLIGATORIO antes de stockRestante_: si no, contaría la pieza recién vendida

  // Aviso a Alex cuando alguien más vende mercancía suya: qué se vendió, en cuánto y cuántas quedan.
  if (origen === 'Alex' && String(venta.vendedor).trim() !== 'Alex') {
    const desc = String(filaOriginal[2] || '');
    const restan = stockRestante_('Alex', pidDe_(filaOriginal), desc);
    const precioFinal = Number(sheet.getRange(rowIndex, 6).getValue()) || 0;
    avisarAlex_(
      (restan === 0 ? '🔴 SE AGOTÓ · ' : '') + 'Kiosko: ' + venta.vendedor + ' vendió ' + desc,
      [
        desc + ' · $' + precioFinal + (Number(venta.cobroExtra) ? ' + $' + Number(venta.cobroExtra) + ' extra' : ''),
        'Vendió: ' + venta.vendedor + ' · Pago: ' + venta.metodoPago + (gastoNum ? ' · Moto: $' + gastoNum : ''),
        restan === 0 ? 'YA NO QUEDAN PIEZAS de este producto.' : 'Quedan ' + restan + ' pieza' + (restan === 1 ? '' : 's') + ' en stock.',
        'Folio ' + nuevoID
      ]
    );
  }

  return {
    success: true,
    mensaje: 'Venta registrada correctamente',
    aviso: avisoFecha || undefined,
    detalle: {
      id: nuevoID, ventaID: ventaID,
      descripcion: String(filaOriginal[2] || ''),
      costo: costoDe_(filaOriginal),
      vendedor: venta.vendedor,
      fecha: fechaVenta.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
      estatusTransferencia: estatusTransferencia
    }
  };
}

// ANULAR VENTA (botón "Deshacer" de la app). Solo ventas de los últimos 30 minutos, identificadas por
// su VentaID (uuid) — así nunca se toca una venta vieja por error. Regresa la fila a RECIBIDO
// y devuelve el precio de lista si la venta se hizo a precio especial.
function anularVenta(p) {
  invalidarCache_();
  const origen = p.origen === 'Irene' ? 'Irene' : 'Alex';
  const ventaID = String(p.ventaID || '').trim(), id = String(p.id || '').trim();
  if (!ventaID && !id) return { success: false, error: 'Falta el identificador de la venta' };
  const sheet = hojaDe_(origen);
  if (!sheet) return { success: false, error: 'No se encontró la hoja de ' + origen };

  const objetivo = filas_(origen).filter(f => {
    if (String(f.row[9] || '').trim() !== 'VENDIDO') return false;
    return ventaID ? String(f.row[14] || '').trim() === ventaID : String(f.row[13] || '').trim() === id;
  })[0];
  if (!objetivo) return { success: false, error: 'No se encontró la venta' };

  const rowIndex = objetivo.fila, fila = objetivo.row;
  const fecha = fila[11] ? new Date(fila[11]) : null;
  if (!fecha || (Date.now() - fecha.getTime()) > 30 * 60 * 1000) {
    return { success: false, error: 'Solo se puede deshacer una venta en los primeros 30 minutos. Pídele a Alex que la corrija en la hoja.' };
  }

  // Precio de lista: primero se restaura F, después se limpia R. Si algo truena a medias,
  // el precio sigue siendo recuperable en un segundo intento.
  const lista = fila[COL_PLISTA - 1];
  if (lista !== '' && lista !== null && lista !== undefined && Number(lista) > 0) {
    sheet.getRange(rowIndex, 6).setValue(Number(lista));
    sheet.getRange(rowIndex, COL_PLISTA).clearContent();
  }

  // Regresa la pieza al inventario: se limpian los datos de la venta (el ID OC- se conserva, como en las filas nunca vendidas)
  sheet.getRange(rowIndex, 7, 1, 2).clearContent();          // G cobro extra, H gastos
  sheet.getRange(rowIndex, 10).setValue('RECIBIDO');          // J estatus
  sheet.getRange(rowIndex, 11, 1, 3).clearContent();          // K vendedor, L fecha venta, M estatus transferencia
  sheet.getRange(rowIndex, 15, 1, 2).clearContent();          // O ventaID, P método pago
  invalidarCache_();

  if (origen === 'Alex' && String(fila[10] || '').trim() !== 'Alex') {
    avisarAlex_('Kiosko: venta deshecha · ' + String(fila[2] || ''), ['Se deshizo la venta de ' + String(fila[2] || '') + ' (folio ' + String(fila[13] || '') + '). La pieza volvió al inventario.']);
  }
  return { success: true, descripcion: String(fila[2] || ''), id: String(fila[13] || '') };
}

// =========================================================
// AVISOS POR CORREO (para que Alex no se quede ciego cuando Irene vende)
// Requiere la propiedad de script EMAIL_ALEX. Si no existe, no pasa nada.
// =========================================================
function avisarAlex_(asunto, lineas) {
  try {
    const to = PropertiesService.getScriptProperties().getProperty('EMAIL_ALEX');
    if (!to) return;
    MailApp.sendEmail(to, asunto, lineas.join('\n'));
  } catch (e) {}
}

// Piezas RECIBIDO que quedan de un producto (por ProductoID o por nombre).
function stockRestante_(origen, pid, descripcion) {
  let n = 0;
  filas_(origen).forEach(f => {
    if (String(f.row[9] || '').trim() !== 'RECIBIDO') return;
    const ok = pid ? pidDe_(f.row) === pid : String(f.row[2] || '').trim() === descripcion;
    if (ok) n++;
  });
  return n;
}

// =========================================================
// PRODUCTO ID (columna Q)
// =========================================================
// Clave de agrupación cuando no hay ID: nombre + categoría normalizados.
const claveNombre_ = row => normalizar_(row[2]) + '|' + normalizar_(row[1]);

// Siguiente ID libre para una hoja (AL-0001…, IR-0001…).
function siguientePid_(origen) {
  const pre = PREFIJO_PID[origen] || 'XX-';
  let max = 0;
  filas_(origen).forEach(f => { const s = pidDe_(f.row); if (s.indexOf(pre) === 0) { const n = parseInt(s.slice(pre.length), 10); if (!isNaN(n) && n > max) max = n; } });
  return pre + String(max + 1).padStart(4, '0');
}

/**
 * EJECUTAR A MANO UNA VEZ (Ejecutar → asignarProductoIDs). Se puede repetir sin riesgo:
 * solo llena filas que no tengan ID y respeta los que ya existan.
 * Agrupa por nombre + categoría; todas las piezas del mismo producto (vendidas o no) reciben el mismo ID.
 */
function asignarProductoIDs() {
  invalidarCache_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rep = [];
  Object.keys(HOJAS).forEach(origen => {
    const sh = ss.getSheetByName(HOJAS[origen]);
    if (!sh) return;
    asegurarAncho_(sh);
    sh.getRange(1, COL_PID).setValue('ProductoID');
    if (String(sh.getRange(1, COL_PLISTA).getValue() || '').trim() === '') sh.getRange(1, COL_PLISTA).setValue('PrecioLista');
    const last = sh.getLastRow();
    if (last < 2) return;
    const rows = sh.getRange(2, 1, last - 1, NCOL).getValues();
    const porClave = {};                     // clave nombre → ID ya asignado
    rows.forEach(r => { const s = pidDe_(r); if (s) porClave[claveNombre_(r)] = porClave[claveNombre_(r)] || s; });
    const pre = PREFIJO_PID[origen];
    let max = 0;
    rows.forEach(r => { const s = pidDe_(r); if (s.indexOf(pre) === 0) max = Math.max(max, parseInt(s.slice(pre.length), 10) || 0); });
    let nuevos = 0, filasLlenas = 0;
    const col = rows.map(r => {
      const actual = pidDe_(r);
      if (actual) return [actual];
      if (!String(r[2] || '').trim()) return [''];
      const k = claveNombre_(r);
      if (!porClave[k]) { porClave[k] = pre + String(++max).padStart(4, '0'); nuevos++; }
      filasLlenas++;
      return [porClave[k]];
    });
    sh.getRange(2, COL_PID, col.length, 1).setValues(col);
    rep.push(HOJAS[origen] + ': ' + nuevos + ' productos nuevos con ID, ' + filasLlenas + ' filas llenadas');
  });
  invalidarCache_();
  Logger.log(rep.join('\n'));
  return rep.join('\n');
}

/**
 * EJECUTAR A MANO UNA VEZ AL SUBIR A v16 (Ejecutar → prepararHojasV102).
 * Solo ensancha las hojas a 18 columnas y escribe el encabezado "PrecioLista" en R1.
 * No toca ningún dato. Se puede repetir sin riesgo.
 */
function prepararHojasV102() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rep = [];
  Object.keys(HOJAS).forEach(origen => {
    const sh = ss.getSheetByName(HOJAS[origen]);
    if (!sh) { rep.push(HOJAS[origen] + ': no existe'); return; }
    const antes = sh.getMaxColumns();
    asegurarAncho_(sh);
    if (String(sh.getRange(1, COL_PLISTA).getValue() || '').trim() === '') sh.getRange(1, COL_PLISTA).setValue('PrecioLista');
    if (String(sh.getRange(1, COL_CORTE).getValue() || '').trim() === '') sh.getRange(1, COL_CORTE).setValue('Corte');
    rep.push(HOJAS[origen] + ': columnas ' + antes + ' → ' + sh.getMaxColumns() + ', encabezado R1 listo');
  });
  invalidarCache_();
  Logger.log(rep.join('\n'));
  return rep.join('\n');
}




// =========================================================
// ANÁLISIS (solo mercancía de Alex). Todo se calcula aquí para no mandar 670 filas al teléfono.
// rango: 'todo' = historial completo · '12m' = últimos 12 meses de ventas.
// =========================================================
function mediana_(l) {
  if (!l.length) return 0;
  const s = l.slice().sort(function (a, b) { return a - b; });
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
// Una fecha fuera de rango (celdas mal capturadas como 01/01/36 → 1936) envenena todo el
// análisis: se ignora en vez de reportar piezas con 90 años parados.
function fechaDe_(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  const a = d.getFullYear();
  if (a < 2020 || a > new Date().getFullYear() + 1) return null;
  return d;
}

function getAnalisis(rango) {
  const r2 = function (x) { return Math.round(x * 100) / 100; };
  const hoy = new Date();
  const desde12 = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate());
  const filas = filas_('Alex');

  let vendido = 0, utilidad = 0, nVentas = 0, primera = null;
  const capital = {}, rota = {}, anti = {}, marg = {}, compras = {};
  const stockProd = {}, margProd = {};

  filas.forEach(function (f) {
    const row = f.row;
    const cat = String(row[1] || '').trim() || 'Sin categoría';
    const desc = String(row[2] || '').trim();
    const est = String(row[9] || '').trim();
    const c = costoDe_(row), precio = Number(row[5]) || 0, extra = Number(row[6]) || 0, gasto = Number(row[7]) || 0;
    const fc = fechaDe_(row[0]), fv = fechaDe_(row[11]);

    // Evolución de costos: una entrada por compra (todas las filas, vendidas o no)
    if (fc && c > 0 && desc) {
      if (!compras[desc]) compras[desc] = { descripcion: desc, categoria: cat, puntos: {} };
      const k = fc.getFullYear() + '-' + fc.getMonth() + '-' + fc.getDate();
      if (!compras[desc].puntos[k]) compras[desc].puntos[k] = { t: fc.getTime(), suma: 0, n: 0 };
      compras[desc].puntos[k].suma += c; compras[desc].puntos[k].n++;
    }

    if (est === 'RECIBIDO') {
      if (!capital[cat]) capital[cat] = { categoria: cat, capital: 0, piezas: 0 };
      capital[cat].capital += c; capital[cat].piezas++;
      const dS = fc ? Math.round((hoy - fc) / 864e5) : 0;
      if (fc) { if (!anti[cat]) anti[cat] = []; anti[cat].push(dS); }
      if (desc) {
        if (!stockProd[desc]) stockProd[desc] = { descripcion: desc, categoria: cat, piezas: 0, capital: 0, dias: 0, precio: precio };
        stockProd[desc].piezas++; stockProd[desc].capital += c;
        if (dS > stockProd[desc].dias) stockProd[desc].dias = dS;
      }
      return;
    }
    if (est !== 'VENDIDO') return;
    if (rango === '12m' && (!fv || fv < desde12)) return;
    if (fv && (!primera || fv < primera)) primera = fv;

    const ing = precio + extra, ut = ing - c - gasto;
    if (precio > 0) {
      vendido += ing; utilidad += ut; nVentas++;
      if (!marg[cat]) marg[cat] = { categoria: cat, ingreso: 0, utilidad: 0, ventas: 0 };
      marg[cat].ingreso += ing; marg[cat].utilidad += ut; marg[cat].ventas++;
      if (desc) {
        if (!margProd[desc]) margProd[desc] = { descripcion: desc, categoria: cat, ingreso: 0, utilidad: 0, ventas: 0 };
        margProd[desc].ingreso += ing; margProd[desc].utilidad += ut; margProd[desc].ventas++;
      }
    }
    if (fc && fv) { const dd = Math.round((fv - fc) / 864e5); if (dd >= 0 && dd < 2000) (rota[cat] = rota[cat] || []).push(dd); }
  });

  const capL = Object.keys(capital).map(function (c) {
    return { categoria: c, capital: r2(capital[c].capital), piezas: capital[c].piezas, diasStock: Math.round(mediana_(anti[c] || [])) };
  }).sort(function (a, b) { return b.capital - a.capital; });

  const rotL = Object.keys(capital).concat(Object.keys(rota)).filter(function (v, i, a) { return a.indexOf(v) === i; })
    .map(function (c) {
      return { categoria: c, diasVenta: Math.round(mediana_(rota[c] || [])), ventas: (rota[c] || []).length,
        diasStock: Math.round(mediana_(anti[c] || [])), piezas: capital[c] ? capital[c].piezas : 0 };
    }).filter(function (x) { return x.ventas > 0 || x.piezas > 0; })
    .sort(function (a, b) { return b.diasStock - a.diasStock; });

  const marL = Object.keys(marg).map(function (c) {
    const m = marg[c];
    return { categoria: c, ingreso: r2(m.ingreso), utilidad: r2(m.utilidad), ventas: m.ventas,
      margen: m.ingreso ? r2(m.utilidad / m.ingreso * 100) : 0, porVenta: r2(m.utilidad / m.ventas) };
  }).sort(function (a, b) { return b.utilidad - a.utilidad; });

  // Solo productos con 3 o más compras en fechas distintas: menos que eso no cuenta una historia.
  const cosL = Object.keys(compras).map(function (d) {
    const p = compras[d];
    const serie = Object.keys(p.puntos).map(function (k) { return { t: p.puntos[k].t, costo: r2(p.puntos[k].suma / p.puntos[k].n) }; })
      .sort(function (a, b) { return a.t - b.t; });
    return { descripcion: d, categoria: p.categoria, serie: serie };
  }).filter(function (p) { return p.serie.length >= 3; })
    .map(function (p) {
      const a = p.serie[0].costo, b = p.serie[p.serie.length - 1].costo;
      p.cambio = a ? r2((b - a) / a * 100) : 0; p.primero = a; p.ultimo = b; p.compras = p.serie.length;
      return p;
    }).sort(function (a, b) { return Math.abs(b.cambio) - Math.abs(a.cambio); });

  const viejos = Object.keys(stockProd).map(function (d) {
    const x = stockProd[d];
    return { descripcion: d, categoria: x.categoria, piezas: x.piezas, capital: r2(x.capital), dias: x.dias, precio: r2(x.precio) };
  }).sort(function (a, b) { return b.dias - a.dias || b.capital - a.capital; }).slice(0, 25);

  const prodMar = Object.keys(margProd).map(function (d) {
    const x = margProd[d];
    return { descripcion: d, categoria: x.categoria, ventas: x.ventas, utilidad: r2(x.utilidad),
      margen: x.ingreso ? r2(x.utilidad / x.ingreso * 100) : 0, porVenta: r2(x.utilidad / x.ventas) };
  }).sort(function (a, b) { return b.utilidad - a.utilidad; });

  return {
    rango: rango,
    viejos: viejos,
    productos: prodMar.slice(0, 30),
    productosFlojos: prodMar.filter(function (x) { return x.ventas >= 3; })
      .sort(function (a, b) { return a.margen - b.margen; }).slice(0, 10),
    resumen: { vendido: r2(vendido), utilidad: r2(utilidad), ventas: nVentas,
      margen: vendido ? r2(utilidad / vendido * 100) : 0,
      porVenta: nVentas ? r2(utilidad / nVentas) : 0,
      desde: primera ? primera.getTime() : 0 },
    capital: capL,
    capitalTotal: r2(capL.reduce(function (s, x) { return s + x.capital; }, 0)),
    piezasTotal: capL.reduce(function (s, x) { return s + x.piezas; }, 0),
    rotacion: rotL,
    margen: marL,
    costos: cosL
  };
}

// =========================================================
// CATÁLOGO PÚBLICO (catalogo.html · el link que se le manda al cliente)
// Solo lo que un cliente necesita ver. Sin costos, sin stock, sin origen.
// Se ocultan los productos sin foto: una foto es lo que vende.
// =========================================================
function getCatalogoPublico() {
  const acc = {};
  filas_().forEach(f => {
    const row = f.row;
    if (String(row[9] || '').trim() !== 'RECIBIDO') return;
    const d = String(row[2] || '').trim();
    if (!d) return;
    const pid = pidDe_(row), k = pid ? f.origen + '|' + pid : d;
    if (!acc[k]) acc[k] = { descripcion: d, categoria: String(row[1] || '').trim(), precio: Number(row[5]) || 0, n: 0, origen: f.origen, agregado: 0 };
    acc[k].n++;
    if (row[0]) { const fc = new Date(row[0]).getTime(); if (fc > acc[k].agregado) acc[k].agregado = fc; }
    // Si las piezas tienen precios distintos, se muestra el más bajo.
    const pr = Number(row[5]) || 0;
    if (pr > 0 && pr < acc[k].precio) acc[k].precio = pr;
  });
  const props = PropertiesService.getScriptProperties();
  const waAlex = String(props.getProperty('WA_ALEX') || '525614842235').trim();
  const waIrene = String(props.getProperty('WA_IRENE') || '529191212558').trim();
  const imgs = mapaImagenes_();
  return Object.values(acc)
    .map(p => ({ descripcion: p.descripcion, categoria: p.categoria, precio: p.precio,
      imagen: imgUrl_(imgs, p.descripcion), extras: imgExtras_(imgs, p.descripcion), ultima: p.n === 1, agregado: p.agregado,
      wa: p.origen === 'Irene' ? waIrene : waAlex }))
    .filter(p => p.precio > 0 && p.imagen)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descripcion.localeCompare(b.descripcion));
}

// =========================================================
// CORTES: congelar lo pendiente, registrar abonos, marcar transferido al liquidar
// Hoja CORTES: A CorteID, B Fecha cierre, C Total, D Ventas, E Pagado, F Estado, G Cerrado por
// Hoja PAGOS:  A CorteID, B Fecha, C Monto, D Nota, E Registrado por
// =========================================================
function hojaCortes_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('CORTES');
  if (!sh) { sh = ss.insertSheet('CORTES'); sh.appendRow(['CorteID', 'Fecha cierre', 'Total', 'Ventas', 'Pagado', 'Estado', 'Cerrado por']); sh.setFrozenRows(1); }
  return sh;
}
function hojaPagos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('PAGOS');
  if (!sh) { sh = ss.insertSheet('PAGOS'); sh.appendRow(['CorteID', 'Fecha', 'Monto', 'Nota', 'Registrado por']); sh.setFrozenRows(1); }
  return sh;
}
function pagosPorCorte_() {
  const sh = hojaPagos_(); const m = {};
  if (sh.getLastRow() < 2) return m;
  sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(r => {
    const id = String(r[0] || '').trim(); if (!id) return;
    (m[id] = m[id] || []).push({ fecha: r[1] ? new Date(r[1]).getTime() : 0, monto: Number(r[2]) || 0, nota: String(r[3] || ''), por: String(r[4] || '') });
  });
  return m;
}
function estadoCorte_(total, pagado) { return pagado >= total - 0.005 ? 'Pagado' : (pagado > 0 ? 'Parcial' : 'Por pagar'); }

// Lista de cortes, del más reciente al más viejo. conVentas=true incluye las ventas de cada uno.
function getCortes(conVentas) {
  const sh = hojaCortes_();
  if (sh.getLastRow() < 2) return [];
  const pagos = pagosPorCorte_();
  const r2 = x => Math.round(x * 100) / 100;
  const ventasPor = {};
  if (conVentas) getVentasPorVendedor(null, 5000).forEach(v => { if (v.corte) (ventasPor[v.corte] = ventasPor[v.corte] || []).push(v); });
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues()
    .filter(r => String(r[0] || '').trim())
    .map(r => {
      const id = String(r[0]).trim(), total = Number(r[2]) || 0, ps = pagos[id] || [];
      const pagado = r2(ps.reduce((s, p) => s + p.monto, 0));
      return { id: id, fecha: r[1] ? new Date(r[1]).getTime() : 0, total: r2(total), n: Number(r[3]) || 0,
        pagado: pagado, saldo: r2(Math.max(0, total - pagado)), estado: estadoCorte_(total, pagado),
        por: String(r[6] || ''), pagos: ps, ventas: ventasPor[id] || [] };
    })
    .sort((a, b) => b.fecha - a.fecha);
}

// CERRAR CORTE: congela todas las ventas pendientes de la mercancía de Alex que aún no tienen corte.
function cerrarCorte(usuario) {
  if (usuario !== 'Alex') return { success: false, error: 'Solo Alex puede cerrar un corte' };
  invalidarCache_();
  const sh = hojaDe_('Alex');
  if (String(sh.getRange(1, COL_CORTE).getValue() || '').trim() === '') sh.getRange(1, COL_CORTE).setValue('Corte');
  const pend = filas_('Alex').filter(f => String(f.row[9] || '').trim() === 'VENDIDO' && String(f.row[12] || '').trim() === 'No transferido' && !corteDe_(f.row));
  if (!pend.length) return { success: false, error: 'No hay ventas nuevas que cortar' };
  const shC = hojaCortes_();
  let max = 0;
  if (shC.getLastRow() > 1) shC.getRange(2, 1, shC.getLastRow() - 1, 1).getValues().forEach(r => { const m = String(r[0] || '').match(/^C-(\d+)$/); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  const id = 'C-' + String(max + 1).padStart(4, '0');
  // Columna S completa en una sola escritura
  const last = sh.getLastRow();
  const col = sh.getRange(2, COL_CORTE, last - 1, 1).getValues();
  const marcar = {}; pend.forEach(f => marcar[f.fila] = true);
  for (let i = 0; i < col.length; i++) if (marcar[i + 2]) col[i][0] = id;
  sh.getRange(2, COL_CORTE, last - 1, 1).setValues(col);
  const r2 = x => Math.round(x * 100) / 100;
  const total = r2(pend.reduce((s, f) => s + aporteDe_(f.row), 0));
  const fecha = new Date();
  shC.appendRow([id, fecha, total, pend.length, 0, 'Por pagar', usuario]);
  escribirTransferencias_(id, fecha, pend);
  invalidarCache_();
  return { success: true, corte: { id: id, fecha: fecha.getTime(), total: total, n: pend.length, pagado: 0, saldo: total, estado: 'Por pagar' } };
}

// Bloque en la hoja Transferencias, con el formato que Alex ya usa a mano.
function escribirTransferencias_(id, fecha, pend) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('Transferencias');
  if (!sh) sh = ss.insertSheet('Transferencias');
  const M = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const r2 = x => Math.round(x * 100) / 100;
  const filas = [];
  filas.push([id + ' · ' + M[fecha.getMonth()] + ' ' + fecha.getFullYear(), '', '', '', '', '', '', '', '']);
  filas.push(['FECHA DE VENTA', 'PRODUCTO', 'COSTO', 'PRECIO', 'COBRO EXTRA', 'MOTOMANDADO', 'VENDEDOR', 'ALEX', 'Irene']);
  let tA = 0, tI = 0;
  pend.forEach(f => {
    const r = f.row, vend = String(r[10] || '').trim();
    const precio = Number(r[5]) || 0, extra = Number(r[6]) || 0, gasto = Number(r[7]) || 0, costo = costoDe_(r);
    const a = r2(aporteDe_(r)); tA += a;
    const gi = vend !== 'Alex' ? r2(precio + extra - costo - gasto) : '';
    if (gi !== '') tI += gi;
    filas.push([r[11] ? new Date(r[11]) : '', String(r[2] || ''), costo, precio, extra || '', gasto || '', vend, a, gi]);
  });
  filas.push(['', '', '', '', '', '', 'TOTAL', r2(tA), r2(tI)]);
  const start = sh.getLastRow() + 2;
  sh.getRange(start, 1, filas.length, 9).setValues(filas);
  sh.getRange(start, 1).setFontWeight('bold');
  sh.getRange(start + 1, 1, 1, 9).setFontWeight('bold');
  sh.getRange(start + filas.length - 1, 7, 1, 2).setFontWeight('bold').setBackground('#FFFF00');
}

// REGISTRAR PAGO (abono o total). Al completarse el corte, sus ventas pasan a "Transferido".
function registrarPago(usuario, corteID, monto, nota) {
  if (usuario !== 'Alex') return { success: false, error: 'Solo Alex puede registrar pagos' };
  if (!corteID) return { success: false, error: 'Falta el corte' };
  if (!(monto > 0)) return { success: false, error: 'El monto debe ser mayor que cero' };
  const c = getCortes(false).filter(x => x.id === corteID)[0];
  if (!c) return { success: false, error: 'No existe el corte ' + corteID };
  if (c.saldo <= 0) return { success: false, error: 'Ese corte ya está pagado' };
  const r2 = x => Math.round(x * 100) / 100;
  hojaPagos_().appendRow([corteID, new Date(), r2(monto), nota, usuario]);
  const pagado = r2(c.pagado + monto), estado = estadoCorte_(c.total, pagado);
  const shC = hojaCortes_();
  const ids = shC.getRange(2, 1, shC.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0] || '').trim() === corteID) { shC.getRange(i + 2, 5, 1, 2).setValues([[pagado, estado]]); break; }
  let liquidadas = 0;
  if (estado === 'Pagado') {
    invalidarCache_();
    const sh = hojaDe_('Alex'), last = sh.getLastRow();
    const S = sh.getRange(2, COL_CORTE, last - 1, 1).getValues();
    const M = sh.getRange(2, 13, last - 1, 1).getValues();
    for (let i = 0; i < S.length; i++) if (String(S[i][0] || '').trim() === corteID && String(M[i][0] || '').trim() === 'No transferido') { M[i][0] = 'Transferido'; liquidadas++; }
    if (liquidadas) sh.getRange(2, 13, last - 1, 1).setValues(M);
  }
  invalidarCache_();
  return { success: true, liquidadas: liquidadas, corte: { id: c.id, fecha: c.fecha, total: c.total, n: c.n, pagado: pagado, saldo: r2(Math.max(0, c.total - pagado)), estado: estado } };
}

// =========================================================
// PRODUCTOS DE IRENE (alta, edición, baja desde la app)
// =========================================================

// AGREGAR PRODUCTO (solo a la hoja de Irene). Si ya existe un producto con el mismo
// nombre y categoría, las piezas nuevas toman su mismo ProductoID.
function agregarProducto(p) {
  if (p.origen !== 'Irene') return { success: false, error: 'Solo se pueden agregar productos de Irene desde la app' };
  const d = String(p.descripcion || '').trim(), cat = String(p.categoria || '').trim();
  const costo = Number(p.costo), precio = Number(p.precio), n = Math.min(50, Math.max(1, parseInt(p.cantidad, 10) || 1));
  if (!d || !cat || !(costo > 0) || !(precio > 0)) return { success: false, error: 'Faltan datos: descripción, categoría, costo y precio' };
  invalidarCache_();
  const sh = hojaDe_('Irene');
  if (String(sh.getRange(1, COL_PID).getValue() || '').trim() === '') sh.getRange(1, COL_PID).setValue('ProductoID');
  if (String(sh.getRange(1, COL_PLISTA).getValue() || '').trim() === '') sh.getRange(1, COL_PLISTA).setValue('PrecioLista');
  const k = normalizar_(d) + '|' + normalizar_(cat);
  let pid = '';
  filas_('Irene').forEach(f => { if (!pid && claveNombre_(f.row) === k) pid = pidDe_(f.row); });
  if (!pid) pid = siguientePid_('Irene');
  const hoy = new Date();
  const filas = [];
  for (let i = 0; i < n; i++) filas.push([hoy, cat, d, costo, costo, precio, '', '', '', 'RECIBIDO', '', '', '', '', '', '', pid, '', '']);
  const filaInicio = sh.getLastRow() + 1;
  sh.getRange(filaInicio, 1, n, NCOL).setValues(filas);
  // Columna U (21): cuándo entró al inventario. Ordena "Recién llegados" en la app.
  if (sh.getMaxColumns() < 21) sh.insertColumnsAfter(sh.getMaxColumns(), 21 - sh.getMaxColumns());
  if (String(sh.getRange(1, 21).getValue() || '').trim() === '') sh.getRange(1, 21).setValue('Alta');
  sh.getRange(filaInicio, 21, n, 1).setValues(filas.map(() => [hoy]));
  invalidarCache_();
  return { success: true, agregados: n, descripcion: d, pid: pid };
}

// EDITAR PRODUCTO DE IRENE. Cambia nombre, categoría, costo y precio SOLO en las piezas sin vender
// (las ventas registradas no se tocan). "cantidad" es el stock deseado: agrega o quita piezas sin vender.
// Si cambia el nombre, se renombra su entrada en IMAGENES para no perder la foto.
function editarProducto(p) {
  if (p.origen !== 'Irene') return { success: false, error: 'Solo se pueden editar productos de Irene desde la app' };
  const pid = String(p.pid || '').trim();
  if (!pid) return { success: false, error: 'Falta el ID del producto (corre asignarProductoIDs)' };
  const d = String(p.descripcion || '').trim(), cat = String(p.categoria || '').trim();
  const costo = Number(p.costo), precio = Number(p.precio);
  if (!d || !cat || !(costo > 0) || !(precio > 0)) return { success: false, error: 'Faltan datos: descripción, categoría, costo y precio' };
  invalidarCache_();
  const sh = hojaDe_('Irene');
  const libres = filas_('Irene').filter(f => pidDe_(f.row) === pid && String(f.row[9] || '').trim() === 'RECIBIDO');
  if (!libres.length && !(parseInt(p.cantidad, 10) > 0)) return { success: false, error: 'Ese producto ya no tiene piezas sin vender' };
  const nombreAnterior = libres.length ? String(libres[0].row[2] || '').trim() : '';
  libres.forEach(f => {
    sh.getRange(f.fila, 2, 1, 5).setValues([[cat, d, costo, costo, precio]]);   // B categoría, C descripción, D costo, E costo final, F precio
  });
  // Ajuste de stock
  let agregadas = 0, quitadas = 0;
  if (p.cantidad !== undefined && p.cantidad !== null && p.cantidad !== '') {
    const deseado = Math.min(50, Math.max(0, parseInt(p.cantidad, 10) || 0));
    if (deseado > libres.length) {
      agregadas = deseado - libres.length;
      const hoy = new Date(), filas = [];
      for (let i = 0; i < agregadas; i++) filas.push([hoy, cat, d, costo, costo, precio, '', '', '', 'RECIBIDO', '', '', '', '', '', '', pid, '', '']);
      sh.getRange(sh.getLastRow() + 1, 1, agregadas, NCOL).setValues(filas);
    } else if (deseado < libres.length) {
      quitadas = libres.length - deseado;
      libres.slice(libres.length - quitadas).map(f => f.fila).sort((a, b) => b - a).forEach(r => sh.deleteRow(r));  // de abajo hacia arriba
    }
  }
  if (nombreAnterior && nombreAnterior !== d) renombrarImagen_(nombreAnterior, d);
  invalidarCache_();
  return { success: true, pid: pid, descripcion: d, agregadas: agregadas, quitadas: quitadas };
}

// ELIMINAR PRODUCTO DE IRENE: borra solo las piezas sin vender. Las ventas registradas se conservan.
function eliminarProducto(p) {
  if (p.origen !== 'Irene') return { success: false, error: 'Solo se pueden eliminar productos de Irene desde la app' };
  const pid = String(p.pid || '').trim();
  if (!pid) return { success: false, error: 'Falta el ID del producto (corre asignarProductoIDs)' };
  invalidarCache_();
  const sh = hojaDe_('Irene');
  const libres = filas_('Irene').filter(f => pidDe_(f.row) === pid && String(f.row[9] || '').trim() === 'RECIBIDO');
  if (!libres.length) return { success: false, error: 'Ese producto no tiene piezas sin vender' };
  const desc = String(libres[0].row[2] || '');
  libres.map(f => f.fila).sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
  invalidarCache_();
  return { success: true, eliminadas: libres.length, descripcion: desc };
}

// Si el producto cambia de nombre, la fila de IMAGENES lo sigue (la foto se busca por nombre).
function renombrarImagen_(viejo, nuevo) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('IMAGENES');
  if (!sh || sh.getLastRow() < 2) return;
  const k = normalizar_(viejo);
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (normalizar_(vals[i][0]) === k) { sh.getRange(i + 2, 1).setValue(nuevo); _imgs = null; return; }
}

// FOTO SUBIDA DESDE LA APP: se guarda en la carpeta de Drive con el nombre del
// producto y la URL queda escrita de una vez en la hoja IMAGENES.
function subirFoto(p) {
  const d = String(p.descripcion || '').trim();
  const b64 = String(p.base64 || '');
  if (!d || !b64) return { success: false, error: 'Faltan descripción o imagen' };
  if (b64.length > 4.5 * 1024 * 1024) return { success: false, error: 'La foto es demasiado grande' };
  const folderId = PropertiesService.getScriptProperties().getProperty('FOTOS_FOLDER_ID');
  if (!folderId) return { success: false, error: 'Falta configurar FOTOS_FOLDER_ID' };
  let file;
  try {
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), String(p.mime || 'image/jpeg'), d + '.jpg');
    file = DriveApp.getFolderById(folderId).createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { return { success: false, error: 'No se pudo guardar en Drive: ' + e.message }; }
  const url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
  // upsert en IMAGENES
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('IMAGENES');
  if (!sh) { sh = ss.insertSheet('IMAGENES'); sh.appendRow(['Descripción', 'URL', 'Archivo', 'Extras']); sh.setFrozenRows(1); }
  const clave = normalizar_(d);
  let fila = -1;
  if (sh.getLastRow() > 1) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) if (normalizar_(vals[i][0]) === clave) { fila = i + 2; break; }
  }
  if (fila === -1) { sh.appendRow([d, url, file.getName(), '']); }
  else if (p.principal) {   // desde "Editar": la foto nueva pasa a ser la principal; la anterior queda como toma extra
    const actual = String(sh.getRange(fila, 2).getValue() || '').trim();
    const ex = String(sh.getRange(fila, 4).getValue() || '').trim();
    sh.getRange(fila, 2, 1, 3).setValues([[url, file.getName(), actual ? (ex ? actual + ', ' + ex : actual) : ex]]);
  }
  else {
    const actual = String(sh.getRange(fila, 2).getValue() || '').trim();
    if (!actual) sh.getRange(fila, 2, 1, 2).setValues([[url, file.getName()]]);
    else {   // ya había principal: esta entra como toma extra
      const ex = String(sh.getRange(fila, 4).getValue() || '').trim();
      sh.getRange(fila, 4).setValue(ex ? ex + ', ' + url : url);
    }
  }
  invalidarCache_();
  return { success: true, url: url };
}

// FOTO DE UN PRODUCTO EN BASE64 (para compartirla como imagen real desde la app;
// el navegador no puede leerla directo de Drive por CORS).
function getFotoProducto(descripcion) {
  if (!descripcion) return { base64: '' };
  const url = imgUrl_(mapaImagenes_(), descripcion);
  const m = url.match(/[?&]id=([\w-]+)/);
  if (!m) return { base64: '' };
  try {
    const blob = DriveApp.getFileById(m[1]).getBlob();
    if (blob.getBytes().length > 3.5 * 1024 * 1024) return { base64: '' };   // demasiado grande para mandarla
    return { base64: Utilities.base64Encode(blob.getBytes()), mime: blob.getContentType() || 'image/jpeg' };
  } catch (e) { return { base64: '' }; }
}

// OPERACIÓN COMPLETA DE IRENE (mercancía propia + lo que vende de Alex)
function getOperacionIrene() {
  const hoy = new Date(); const m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  let inversion = 0, valorStock = 0, piezasStock = 0, gMesPropio = 0, gMesAjeno = 0, motoMes = 0, piezasMesPropio = 0;
  filas_().forEach(f => {
    const row = f.row;
    const estatus = String(row[9] || '').trim();
    const vendedor = String(row[10] || '').trim();
    const fecha = row[11];
    const precio = Number(row[5]) || 0, costoFinal = costoDe_(row), extra = Number(row[6]) || 0, gasto = Number(row[7]) || 0;
    if (f.origen === 'Irene') {
      if (estatus === 'RECIBIDO' || estatus === 'VENDIDO') inversion += costoFinal;
      if (estatus === 'RECIBIDO') { valorStock += costoFinal; piezasStock++; }
    }
    if (estatus !== 'VENDIDO' || !fecha || new Date(fecha) < m0) return;
    if (f.origen === 'Irene') { gMesPropio += precio + extra - costoFinal - gasto; motoMes += gasto; piezasMesPropio++; }
    else if (vendedor === 'Irene') { gMesAjeno += precio + extra - costoFinal - gasto; }
  });
  const r2 = x => Math.round(x * 100) / 100;
  return { inversion: r2(inversion), valorStock: r2(valorStock), piezasStock: piezasStock,
    gMesPropio: r2(gMesPropio), gMesAjeno: r2(gMesAjeno), gMesTotal: r2(gMesPropio + gMesAjeno), motoMes: r2(motoMes), piezasMesPropio: piezasMesPropio };
}

// =========================================================
// IMPULSO: lo que anima a vender (meta propia, distancia en ventas, racha)
// =========================================================
// Hoja METAS: A usuario, B mes (YYYY-MM), C monto. Se crea sola.
function hojaMetas_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('METAS');
  if (!sh) { sh = ss.insertSheet('METAS'); sh.appendRow(['Usuario', 'Mes', 'Meta']); sh.setFrozenRows(1); }
  return sh;
}
const mesKey_ = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
function getMeta_(usuario, mes) {
  const sh = hojaMetas_();
  if (sh.getLastRow() < 2) return 0;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][0]).trim() === usuario && String(vals[i][1]).trim() === mes) return Number(vals[i][2]) || 0;
  return 0;
}
// Guarda (o reemplaza) la meta del mes actual. monto 0 la quita.
function guardarMeta(usuario, monto) {
  if (!usuario) return { success: false, error: 'Falta usuario' };
  if (!(monto >= 0) || monto > 1000000) return { success: false, error: 'Monto inválido' };
  const sh = hojaMetas_(), mes = mesKey_(new Date());
  let fila = -1;
  if (sh.getLastRow() > 1) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim() === usuario && String(vals[i][1]).trim() === mes) { fila = i + 2; break; }
  }
  if (fila === -1) sh.appendRow([usuario, mes, monto]); else sh.getRange(fila, 3).setValue(monto);
  return { success: true, meta: monto, mes: mes };
}

// Ganancia del mes, promedio por venta (últimos 90 días), racha de días con venta y meta, para un usuario.
// Para Irene cuenta su mercancía (la venda quien la venda) más lo que gana vendiendo lo de Alex.
function getImpulso(usuario) {
  if (!usuario) return null;
  const hoy = new Date(); const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const m0 = new Date(hoy.getFullYear(), hoy.getMonth(), 1), d90 = new Date(hoy0.getTime() - 90 * 864e5);
  let gMes = 0, nMes = 0, g90 = 0, n90 = 0; const semanas = {}, meses = {};
  // Clave de semana: el lunes de esa semana. Así "3 semanas seguidas" es lunes a domingo, no ventanas de 7 días.
  const wk = d => { const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getFullYear() + '-' + t.getMonth() + '-' + t.getDate(); };
  filas_().forEach(f => {
    const row = f.row;
    if (String(row[9] || '').trim() !== 'VENDIDO' || !row[11]) return;
    const vendedor = String(row[10] || '').trim();
    const precio = Number(row[5]) || 0, costoFinal = costoDe_(row), extra = Number(row[6]) || 0, gasto = Number(row[7]) || 0;
    let g = null;
    if (usuario === 'Irene') { if (f.origen === 'Irene' || vendedor === 'Irene') g = precio + extra - costoFinal - gasto; }
    else if (vendedor === usuario && f.origen !== 'Irene') g = gananciaDe_(vendedor, precio, extra, costoFinal, gasto, f.origen);
    if (g === null) return;
    const fv = new Date(row[11]);
    if (fv >= m0) { gMes += g; nMes++; }
    if (fv >= d90) { g90 += g; n90++; }
    semanas[wk(fv)] = true;
    const mk = fv.getFullYear() + '-' + fv.getMonth(); meses[mk] = (meses[mk] || 0) + g;
  });
  let racha = 0; const d = new Date(hoy0);
  if (!semanas[wk(d)]) d.setDate(d.getDate() - 7);        // si esta semana aún no vende, la racha sigue viva
  while (semanas[wk(d)]) { racha++; d.setDate(d.getDate() - 7); }
  const mkActual = hoy.getFullYear() + '-' + hoy.getMonth();
  const record = Object.keys(meses).filter(k => k !== mkActual).reduce((a, k) => Math.max(a, meses[k]), 0);
  const r2 = x => Math.round(x * 100) / 100;
  return { gananciaMes: r2(gMes), ventasMes: nMes, promedio: r2(n90 ? g90 / n90 : (nMes ? gMes / nMes : 0)), racha: racha, rachaUnidad: 'semanas', record: r2(record), meta: getMeta_(usuario, mesKey_(hoy)) };
}

// OFRECE ESTO HOY: productos con stock, ordenados por lo rápido que se venden (ventas en 60 días).
function getOfrecer() {
  const d60 = Date.now() - 60 * 864e5;
  const info = {}, stock = {}, vel = {};
  filas_().forEach(f => {
    const row = f.row, d = String(row[2] || '').trim(); if (!d) return;
    const pid = pidDe_(row), k = pid ? f.origen + '|' + pid : d;
    const est = String(row[9] || '').trim();
    if (est === 'RECIBIDO') {
      stock[k] = (stock[k] || 0) + 1;
      info[k] = { pid: pid, origen: f.origen, descripcion: d, categoria: String(row[1] || '').trim(), precio: Number(row[5]) || 0 };
    } else if (est === 'VENDIDO' && row[11] && new Date(row[11]).getTime() >= d60) vel[k] = (vel[k] || 0) + 1;
  });
  const imgs = mapaImagenes_();
  return Object.keys(stock).sort((a, b) => (vel[b] || 0) - (vel[a] || 0) || stock[b] - stock[a]).slice(0, 6)
    .map(k => ({ ...info[k], stock: stock[k], vendidos60: vel[k] || 0, imagen: imgUrl_(imgs, info[k].descripcion) }));
}

// MANTENIMIENTO (ejecutar manualmente desde el editor)
// Nunca inventa fechas: una venta sin fecha se queda sin fecha (los reportes la ignoran).
// NO PROGRAMAR CON ACTIVADOR: escribe en la hoja sin que nadie se lo pida.
function mantenimientoVentas() {
  invalidarCache_();
  Object.keys(HOJAS).forEach(o => { const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJAS[o]); if (sh) mantenimientoHoja_(sh); });
  invalidarCache_();
}
function mantenimientoHoja_(sh) {
  asegurarAncho_(sh);
  const last = sh.getLastRow();
  if (last < 2) return;
  const rows = sh.getRange(2, 1, last - 1, NCOL).getValues();
  for (let i = 0; i < rows.length; i++) {
    const r = i + 2;
    const estatus  = String(rows[i][9]  || "");
    const vendedor = String(rows[i][10] || "");
    const fecha    = rows[i][11];
    const mTransf  = String(rows[i][12] || "");
    const ventaID  = String(rows[i][14] || "");
    const metodo   = String(rows[i][15] || "");
    const fechaVacia = (fecha === "" || fecha == null);
    if (estatus === "RECIBIDO" && vendedor !== "" && metodo !== ""
        && ventaID.trim() === "" && fechaVacia && mTransf === "") {
      sh.getRange(r, 10).setValue("VENDIDO");
      sh.getRange(r, 13).setValue(metodo.indexOf("Transferencia") === 0 ? "Transferido" : "No transferido");
      sh.getRange(r, 15).setValue(Utilities.getUuid());
      continue;
    }
    if (estatus === "VENDIDO" && vendedor !== "") {
      if (ventaID.trim() === "") sh.getRange(r, 15).setValue(Utilities.getUuid());
    }
    for (let c = 4; c <= 8; c++) {
      const v = rows[i][c - 1];
      if (typeof v === "string" && v.trim() !== "") {
        const s = v.replace(/[$ ]/g, "");
        const t = (s.indexOf(",") > -1 && s.indexOf(".") > -1) ? s.replace(/,/g, "") : s.replace(",", ".");
        if (!isNaN(Number(t))) sh.getRange(r, c).setValue(Number(t));
      }
    }
  }
}

function autorizarApp() {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ALEX_NUEVO').getLastRow();
}
