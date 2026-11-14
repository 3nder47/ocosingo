// =========================================================
// Kiosko — ayudante de fotos para la versión nueva (Cloudflare Worker + D1), 2026-11-14.
//
// Solo lo llama el Worker, con la llave compartida FOTOS_LLAVE (Propiedades del script; el valor nunca va en el
// código). No usa API_TOKEN: así sigue funcionando cuando ese token se rote en el cambio definitivo.
// Guarda la foto en la misma carpeta de Drive (FOTOS_FOLDER_ID) y la anota en la hoja IMAGENES con las mismas reglas
// que subirFoto de Código.gs: sin principal → principal; principal:true → la nueva es la principal y la anterior
// pasa a extra; si no → extra. Responde si quedó como principal, para que la base nueva diga lo mismo que la hoja.
//
// claveApp (una por foto, la pone la página) evita la foto doble si se reintenta: cada foto queda anotada en la
// hoja FOTOS_WORKER (claveApp, estado, url, archivo, fecha, principal). Estados: 'subiendo' → 'archivo' → 'hecho'.
// Drive se escribe FUERA del candado (tarda segundos y el candado frena las ventas de la app vieja); el candado solo
// cubre leer y escribir las hojas.
//
// Para activarlo, en procesar_ de Código.gs, antes de "// --- Seguridad ---":
//   if (metodo === 'POST' && String(p.accion || '').trim() === 'subirFotoWorker') return subirFotoWorker_(p);
// =========================================================

function subirFotoWorker_(p) {
  const props = PropertiesService.getScriptProperties();
  const llave = String(props.getProperty('FOTOS_LLAVE') || '').trim();
  if (llave.length < 32) return { ok: false, error: 'Falta FOTOS_LLAVE en Propiedades del script' };
  if (p._bodyInvalido) return { ok: false, error: 'No se pudo leer el envio (body invalido).' };
  if (!igualSeguro_(String(p.llave || ''), llave)) return { ok: false, error: 'No autorizado' };
  const clave = String(p.claveApp || '');
  const d = String(p.descripcion || '').trim();
  const b64 = String(p.base64 || '');
  if (!/^[\w-]{8,64}$/.test(clave)) return { ok: false, error: 'Falta claveApp' };
  if (!d || !b64) return { ok: true, data: { success: false, error: 'Faltan descripción o imagen' } };
  const folderId = props.getProperty('FOTOS_FOLDER_ID');
  if (!folderId) return { ok: true, data: { success: false, error: 'Falta configurar FOTOS_FOLDER_ID' } };

  // 1) ¿Ya existe esta foto? (con candado: dos reintentos al mismo tiempo no la suben dos veces)
  let reg = fotosLock_(function () {
    const r = registroFoto_(clave);
    if (r && r.estado === 'hecho') return r;
    if (r && r.estado === 'subiendo' && Date.now() - r.fecha < 120000) return { estado: 'ocupado' };
    if (r && r.estado === 'archivo') return r;
    if (r) { escribirRegistro_(r.fila, ['subiendo', '', '', Date.now(), '']); return { estado: 'nuevo', fila: r.fila }; }
    const sh = hojaRegistro_();
    sh.appendRow([clave, 'subiendo', '', '', Date.now(), '']);
    return { estado: 'nuevo', fila: sh.getLastRow() };
  });
  if (reg.estado === 'hecho') return { ok: true, data: { success: true, url: reg.url, archivo: reg.archivo, principal: reg.principal } };
  if (reg.estado === 'ocupado') return { ok: true, data: { success: false, error: 'Esa foto se está subiendo; vuelve a intentar en un momento' } };

  // 2) El archivo en Drive (solo si no se creó en un intento anterior). Se anota en cuanto existe, antes de
  //    compartirlo, para que un fallo después no cree otro archivo al reintentar (Codex).
  let url = reg.url, archivo = reg.archivo;
  try {
    let file;
    if (reg.estado === 'nuevo') {
      const blob = Utilities.newBlob(Utilities.base64Decode(b64), String(p.mime || 'image/jpeg'), d + '.jpg');
      file = DriveApp.getFolderById(folderId).createFile(blob);
      url = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600';
      archivo = file.getName();
      fotosLock_(function () { escribirRegistro_(reg.fila, ['archivo', url, archivo, Date.now(), '']); });
    } else {
      const m = String(url).match(/[?&]id=([\w-]+)/);
      if (!m) return { ok: true, data: { success: false, error: 'Registro de foto incompleto' } };
      file = DriveApp.getFileById(m[1]);
    }
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);   // se repite sin problema
  } catch (e) {
    return { ok: true, data: { success: false, error: 'No se pudo guardar en Drive: ' + e.message } };
  }

  // 3) La hoja IMAGENES y el registro, juntos bajo el candado
  const principal = fotosLock_(function () {
    const r = registroFoto_(clave);
    if (r && r.estado === 'hecho') return r.principal;
    const quedo = anotarImagen_(d, url, archivo, p.principal === true);
    escribirRegistro_(reg.fila, ['hecho', url, archivo, Date.now(), quedo ? 1 : 0]);
    SpreadsheetApp.flush();
    return quedo;
  });
  invalidarCache_();
  return { ok: true, data: { success: true, url: url, archivo: archivo, principal: principal } };
}

// Mismas reglas que subirFoto (Código.gs). Devuelve true si la foto quedó como principal.
function anotarImagen_(d, url, archivo, comoPrincipal) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('IMAGENES');
  if (!sh) { sh = ss.insertSheet('IMAGENES'); sh.appendRow(['Descripción', 'URL', 'Archivo', 'Extras']); sh.setFrozenRows(1); }
  const k = normalizar_(d);
  let fila = -1;
  if (sh.getLastRow() > 1) {
    const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < vals.length; i++) if (normalizar_(vals[i][0]) === k) { fila = i + 2; break; }
  }
  if (fila === -1) { sh.appendRow([d, url, archivo, '']); return true; }
  const actual = String(sh.getRange(fila, 2).getValue() || '').trim();
  const ex = String(sh.getRange(fila, 4).getValue() || '').trim();
  // Si un intento anterior ya la anotó (y falló después), no se vuelve a mover nada (Codex).
  if (actual === url) return true;
  if (ex.split(',').map(function (s) { return s.trim(); }).indexOf(url) > -1) return false;
  if (!actual) { sh.getRange(fila, 2, 1, 2).setValues([[url, archivo]]); return true; }
  if (comoPrincipal) {
    sh.getRange(fila, 2, 1, 3).setValues([[url, archivo, ex ? actual + ', ' + ex : actual]]);
    return true;
  }
  sh.getRange(fila, 4).setValue(ex ? ex + ', ' + url : url);
  return false;
}

function hojaRegistro_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('FOTOS_WORKER');
  if (!sh) {
    sh = ss.insertSheet('FOTOS_WORKER');
    sh.appendRow(['claveApp', 'Estado', 'URL', 'Archivo', 'Fecha (ms)', 'Principal']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function registroFoto_(clave) {
  const sh = hojaRegistro_();
  if (sh.getLastRow() < 2) return null;
  const c = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(clave).matchEntireCell(true).findNext();
  if (!c) return null;
  const v = sh.getRange(c.getRow(), 1, 1, 6).getValues()[0];
  return { fila: c.getRow(), estado: String(v[1]), url: String(v[2]), archivo: String(v[3]), fecha: Number(v[4]) || 0, principal: v[5] === 1 || v[5] === '1' };
}

function escribirRegistro_(fila, valores) {
  hojaRegistro_().getRange(fila, 2, 1, 5).setValues([valores]);
}

// Candado del script, solo por el tiempo de leer y escribir las hojas (menos de un segundo).
function fotosLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// Compara sin cortar en el primer carácter distinto (no deja adivinar la llave por el tiempo de respuesta).
function igualSeguro_(a, b) {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
