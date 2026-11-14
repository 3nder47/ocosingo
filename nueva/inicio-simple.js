/* Inicio más simple (Alex, 2026-11-14; propuestas de Codex en el cerebro: kiosko-ui-propuesta-codex.md y
   kiosko-dinero-v2-codex.md). Solo versión nueva: se carga después de app.js y reemplaza cómo se pinta la pestaña
   Dinero. La app vieja no cambia.

   Alex:  "Irene te debe" · "Tu ganancia de <mes>" · "Mis ventas".
   Irene: "Tu ganancia de <mes>" (con racha si existe) · "Por entregar a Alex" · "Mis ventas".
   Tarjetas al estilo de los resúmenes de Apple Salud / One UI. Cada cifra abre "Ver desglose": sus componentes con
   números reales y la última venta incluida (textos neutrales redactados por Codex; sin fórmulas en palabras).
   Fuera del inicio: metas, logros, "Lo que ganan ellas", comparación de meses, gráfica, cortes y la lista larga
   (va a "Ver ventas"). Cerrar cortes, registrar pagos y dar de alta pedidos quedan en el panel de PC; en el celular
   la cuenta se consulta. Los datos (metas guardadas, etc.) no se borran: solo dejan de mostrarse.

   Las funciones de abajo son declaraciones globales: al cargarse después de app.js sustituyen a las de app.js, y
   app.js las llama por nombre (cargarDinero → renderDinero, misVentas → renderLogros, …). */

(function () {
  var st = document.createElement('style');
  st.textContent =
    // Tokens de Codex (kiosko-dinero-v2-codex.md), solo para Dinero y sus desgloses mientras llega el rediseño completo.
    ':root{--kn-surface:#FFFFFF;--kn-text:#191B20;--kn-muted:#5C6069;--kn-divider:#E1E3E8;--kn-action:#245BCC;' +
    '--kn-positive:#237044;--kn-positive-bg:#E8F4EC;--kn-tono:#ECEEF2;--kn-warning:#895500}' +
    '@media (prefers-color-scheme:dark){:root{--kn-surface:#1C1D20;--kn-text:#F5F5F7;--kn-muted:#B4B7C0;' +
    '--kn-divider:#383A41;--kn-action:#9BBCFF;--kn-positive:#86D9A5;--kn-positive-bg:#193529;--kn-tono:#292B30;--kn-warning:#F0CA80}}' +
    '#view-ventas .kn-tarjeta{background:var(--kn-surface);color:var(--kn-text);border-radius:24px;padding:20px;margin-bottom:12px}' +
    '@media (prefers-color-scheme:dark){#view-ventas .kn-tarjeta{border:1px solid var(--kn-divider)}}' +
    '#view-ventas .kn-cab{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;margin:-8px 0 0;padding:0;' +
    'background:none;border:0;color:inherit;font:inherit;text-align:left}' +
    '#view-ventas .kn-cab .kn-t{flex:1;font-size:16px;line-height:1.35;font-weight:600}' +
    '#view-ventas .kn-cab .kn-d{font-size:14px;color:var(--kn-action);font-weight:600;white-space:nowrap}' +
    '#view-ventas .kn-ico{width:30px;height:30px;border-radius:9px;background:var(--kn-tono);display:flex;align-items:center;justify-content:center;flex:none}' +
    '#view-ventas .kn-ico svg,#view-ventas .kn-ir svg,#view-ventas .kn-volver svg,#view-ventas .kn-racha svg{width:18px;height:18px;' +
    'stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '#view-ventas .kn-v{font-size:36px;line-height:1.1;font-weight:650;margin-top:6px;font-variant-numeric:tabular-nums}' +
    '#view-ventas .kn-sub{font-size:14px;line-height:1.4;color:var(--kn-muted);margin-top:4px}' +
    '#view-ventas .kn-ir{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;margin:14px 0 -8px;' +
    'padding:0;border:0;border-top:1px solid var(--kn-divider);background:none;color:inherit;font:inherit;font-size:16px;font-weight:600;text-align:left}' +
    '#view-ventas .kn-ir svg{opacity:.5}' +
    '#view-ventas .kn-sola .kn-ir{border-top:0;margin-top:2px}' +
    '#view-ventas .kn-racha{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:14px;font-weight:600;color:var(--kn-positive)}' +
    '#view-ventas .kn-nota{font-size:14px;color:var(--kn-warning);margin-top:8px}' +
    '#view-ventas .kn-nota button{background:none;border:0;color:var(--kn-action);font:inherit;font-weight:600;padding:0 8px;min-height:48px;min-width:48px}' +
    '#exp-body .kn-reint{background:none;border:0;color:var(--kn-action);font:inherit;font-weight:600;padding:0 8px;min-height:48px;min-width:48px}' +
    '#view-ventas .kn-volver{display:flex;align-items:center;gap:6px;background:none;border:0;color:var(--kn-action);font:inherit;font-size:16px;font-weight:600;padding:14px 2px;min-height:48px}' +
    '#view-ventas:not(.kn-lista) .kn-solo-lista{display:none!important}' +
    '#view-ventas.kn-lista .kn-solo-resumen{display:none!important}' +
    '#cortes-wrap,#neg-wrap,#logros,#mes-wrap{display:none!important}' +
    '.kn-panel-nota{font-size:13px;opacity:.7;text-align:center;margin:10px 0 4px}' +
    // Desglose (en la hoja de explicaciones existente, con los mismos tokens)
    '#sheet-exp .sheet{background:var(--kn-surface);color:var(--kn-text)}' +
    '#exp-body .kn-des-per{font-size:14px;color:var(--kn-muted)}' +
    '#exp-body .kn-des-total{font-size:32px;font-weight:650;font-variant-numeric:tabular-nums;margin:4px 0 14px}' +
    '#exp-body .kn-des-grupo{border-top:1px solid var(--kn-divider);padding:10px 0 4px}' +
    '#exp-body .kn-des-h{font-size:14px;font-weight:600;color:var(--kn-muted);margin:4px 0 6px}' +
    '#exp-body .kn-des-f{display:flex;justify-content:space-between;gap:12px;font-size:16px;line-height:1.45;padding:3px 0}' +
    '#exp-body .kn-des-f span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '#exp-body .kn-des-f.kn-res{font-weight:650;border-top:1px solid var(--kn-divider);margin-top:4px;padding-top:7px}' +
    '#exp-body .kn-des-txt{font-size:14px;line-height:1.45;color:var(--kn-muted);margin:6px 0}' +
    '#exp-body .kn-des-ir{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:48px;margin-top:6px;' +
    'background:none;border:0;border-top:1px solid var(--kn-divider);color:var(--kn-action);font:inherit;font-size:16px;font-weight:600;padding:0}' +
    '@media (prefers-reduced-motion:no-preference){#view-ventas.kn-entra>*{animation:knEntra .18s ease-out}' +
    '#view-ventas .kn-cab:active,#view-ventas .kn-ir:active{opacity:.6;transition:opacity .1s}}' +
    '@keyframes knEntra{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
    // Botón central con texto visible "Vender" (Codex): de círculo a píldora.
    '.nav .fab.kn-vender{width:auto!important;height:48px!important;border-radius:999px!important;display:flex!important;' +
    'flex-direction:row!important;align-items:center;justify-content:center;gap:4px;padding:0 14px!important;font-size:.875rem;margin:0 auto}' +
    '.nav .fab.kn-vender svg{width:20px!important;height:20px!important}';
  document.head.appendChild(st);
  var fabV = document.querySelector('.nav .fab[data-view="nueva"]');
  if (fabV) { fabV.classList.add('kn-vender'); fabV.insertAdjacentText('beforeend', 'Vender'); fabV.removeAttribute('aria-label'); }

  // La lista de ventas (título, filtros y lista) solo se ve al tocar "Ver ventas".
  var v = document.getElementById('view-ventas'), filtros = document.getElementById('filtros');
  if (v && filtros) {
    var tit = filtros.previousElementSibling;
    if (tit && tit.classList.contains('section-title')) { tit.textContent = 'Mis ventas'; tit.classList.add('kn-solo-lista'); }
    filtros.classList.add('kn-solo-lista');
    document.getElementById('ventas-list').classList.add('kn-solo-lista');
    var volver = document.createElement('button');
    volver.className = 'kn-volver kn-solo-lista';
    volver.setAttribute('onclick', 'knResumen()');
    volver.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>Dinero';
    v.insertBefore(volver, v.firstChild);
    ['dinero-hero', 'dinero-cuenta'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.add('kn-solo-resumen'); });
  }
  // La hoja de explicaciones se cierra con "Cerrar" (texto neutral).
  var cerrar = document.querySelector('#sheet-exp .btn.ghost');
  if (cerrar) cerrar.textContent = 'Cerrar';
})();

var KN_CHEV = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
var KN_ICO = {
  cuenta: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/></svg>',
  tendencia: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  ventas: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></svg>',
  racha: '<svg viewBox="0 0 24 24"><path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5 0 1.5 1 2.5 2 2.5-1-3 0-5 1-8z"/></svg>'
};

function knEsc(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s); }
function knTarjeta(ico, titulo, desglose, idValor, cuerpo, accion) {
  var cab = desglose
    ? '<button class="kn-cab" onclick="' + desglose + '"><span class="kn-ico">' + KN_ICO[ico] + '</span><span class="kn-t">' + titulo +
      '</span><span class="kn-d">Ver desglose ›</span></button>'
    : '<div class="kn-cab"><span class="kn-ico">' + KN_ICO[ico] + '</span><span class="kn-t">' + titulo + '</span></div>';
  return '<div class="kn-tarjeta' + (idValor ? '' : ' kn-sola') + '">' + cab +
    (idValor ? '<div class="kn-v num" id="' + idValor + '">…</div>' : '') + (cuerpo || '') + (accion || '') + '</div>';
}
function knIr(texto, onclick) {
  return '<button class="kn-ir" onclick="' + onclick + '"><span>' + texto + '</span>' + KN_CHEV + '</button>';
}
function knVerVentas() {
  buzz(8);
  var v = document.getElementById('view-ventas');
  v.classList.add('kn-lista'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
function knResumen() {
  var v = document.getElementById('view-ventas');
  if (!v.classList.contains('kn-lista')) return;
  buzz(8);
  v.classList.remove('kn-lista'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
function knReintentar() { state._extrasFalla = false; cargarDinero(); }

// Título de la cuenta según el signo del saldo (Codex): nunca "Irene te debe" encima de un saldo negativo.
function knTituloCuenta(total) {
  if ((total || 0) < 0) return 'Saldo a favor de Irene';
  return state.usuario === 'Alex' ? 'Irene te debe' : 'Por entregar a Alex';
}
// Cuándo se obtuvieron de verdad los datos (la caché guarda la hora), no la hora en que se abre la hoja.
function knHoraDatos(accion, params) { var c = leerCache(cacheKey(accion, params)); return c && c.t ? c.t : 0; }
function knCuando(t) { var d = new Date(t); return knFecha(t) + ', ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); }
function knSinActualizar(accion, params) {
  var t = knHoraDatos(accion, params);
  return 'Información sin actualizar.' + (t ? ' Última actualización: ' + knCuando(t) + '.' : '');
}

function armarDinero() {
  var esIrene = state.usuario === 'Irene', mes = mesActualNombre();
  var cuenta = knTarjeta('cuenta', '<span id="kn-cuenta-t">' + knTituloCuenta(0) + '</span>',
    'knDesgloseCuenta()', 'h-val', '<div class="kn-sub" id="kn-cuenta-sub"></div>', knIr('Ver cuenta', "abrirDetalle('transferencia')"));
  var ganancia = knTarjeta('tendencia', 'Tu ganancia de ' + mes, 'knDesgloseGanancia()', 'v-gmes',
    (esIrene ? '' : '<div class="kn-sub">Ventas realizadas por Alex</div>') + '<div id="kn-racha"></div>');
  var ventas = knTarjeta('ventas', 'Mis ventas', '', '', '', knIr('Ver ventas', 'knVerVentas()'));
  // id="hero" se conserva: app.js le pone la animación de "se actualizó".
  document.getElementById('dinero-hero').innerHTML = '<div id="hero">' +
    (esIrene ? ganancia + cuenta : cuenta + ganancia) + ventas + '</div>';
  document.getElementById('dinero-cuenta').innerHTML = '';
  document.getElementById('mes-wrap').innerHTML = '';
}

function renderDinero(d, meses, m) {
  // También se rearma si un error de red dejó el aviso "No se pudo cargar" en lugar de las tarjetas.
  if (state._dinArmado !== state.usuario || !document.getElementById('h-val')) { armarDinero(); state._dinArmado = state.usuario; }
  state._dash = d; state._meses = meses;
  var $ = function (id) { return document.getElementById(id); };
  var esIrene = state.usuario === 'Irene', falla = state._extrasFalla, total = d.porTransferir || 0;
  tick($('h-val'), Math.abs(total));
  $('kn-cuenta-t').textContent = knTituloCuenta(total);
  $('kn-cuenta-sub').textContent = !total ? 'Sin saldo pendiente' : '';
  var g = $('v-gmes'), dato = esIrene ? state.operacion : state.impulso;
  if (dato) tick(g, (esIrene ? dato.gMesTotal : dato.gananciaMes) || 0); else g.textContent = falla ? '—' : '…';
  var im = state.impulso || {}, r = esIrene ? (im.racha || 0) : 0, w = $('kn-racha');
  // Codex: el aviso de que no se actualizó va siempre que falle, aunque haya una cifra anterior o una racha.
  if (w) w.innerHTML = (falla ? '<div class="kn-nota">' + (dato ? knSinActualizar('inicioExtras', { usuario: state.usuario }) : 'No se pudo cargar la información.') +
      '<button onclick="knReintentar()">Reintentar</button></div>' : '') +
    (r >= 2 ? '<div class="kn-racha">' + KN_ICO.racha + r + (im.rachaUnidad === 'semanas' ? ' semanas consecutivas con ventas' : ' días consecutivos con ventas') + '</div>' : '');
  knRefrescarDesglose();
}

// ---- Desgloses con números reales (textos de Codex, kiosko-dinero-v2-codex.md) ----
function knM(n) { n = Number(n) || 0; return (n < 0 ? '−' : '') + '$' + money(Math.abs(n)); }
function knFila(et, val, res) { return '<div class="kn-des-f' + (res ? ' kn-res' : '') + '"><span>' + et + '</span><span>' + val + '</span></div>'; }
function knFecha(ts) { try { return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } }
function knPeriodo() {
  var h = new Date(), mes = mesActualNombre();
  return h.getDate() === 1 ? '1 de ' + mes : 'Del 1 al ' + h.getDate() + ' de ' + mes;
}
function knInicioMes() { var m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0); return m0.getTime(); }
// La hoja abierta se vuelve a pintar cuando llegan (o fallan) los datos (Codex): state._knDes = 'ganancia' | 'cuenta'.
function knAbrir(tipo, titulo, html) {
  var hoja = document.getElementById('sheet-exp'), yaAbierta = state._knDes === tipo && !hoja.classList.contains('hidden');
  if (!yaAbierta) buzz(8);
  state._knDes = tipo;
  document.getElementById('exp-titulo').textContent = titulo;
  // Marca propia: si otra explicación sustituye la hoja, el refresco ya no la pisa (Codex).
  document.getElementById('exp-body').innerHTML = '<i hidden data-kn="1"></i>' + html;
  hoja.classList.remove('hidden');
}
function knRefrescarDesglose() {
  var hoja = document.getElementById('sheet-exp');
  if (!state._knDes || !hoja || hoja.classList.contains('hidden')) return;
  if (!document.querySelector('#exp-body [data-kn]')) { state._knDes = ''; return; }
  if (state._knDes === 'ganancia') knDesgloseGanancia(); else if (state._knDes === 'cuenta') knDesgloseCuenta();
}
var knCerrarExpBase = cerrarExp;
cerrarExp = function () { state._knDes = ''; knCerrarExpBase(); };
var knRenderVentasBase = renderVentas;
renderVentas = function () { knRenderVentasBase(); knRefrescarDesglose(); };
var knListoBase = listo;
// Al cambiar de usuario (o volver a entrar) no se arrastran la hoja ni los datos del anterior (Codex).
var knSetUsuarioBase = setUsuario;
setUsuario = function (u) {
  if (u !== state.usuario) knLimpiarUsuario();
  knSetUsuarioBase(u);
};
// Al cerrar sesión también (entrar y entrarRecordado asignan el usuario antes de setUsuario) (Codex).
function knLimpiarUsuario() {
  if (state._knDes) cerrarExp();
  state._dash = null; state.operacion = null; state.impulso = null; state.detalle = []; state._extrasFalla = false;
  // Nueva generación: toda respuesta pedida antes se descarta, aunque vuelva a entrar la misma persona (Codex).
  state._knGen = (state._knGen || 0) + 1;
  // Nada de cifras ni ventas del anterior en pantalla: cargarDinero pone esqueletos si están vacías.
  state._dinArmado = '';
  var h = document.getElementById('dinero-hero'), l = document.getElementById('ventas-list');
  if (h) h.innerHTML = ''; if (l) l.innerHTML = '';
  // Si había un "desliza para actualizar" en curso, se termina (sus respuestas ya no llegarán).
  try { if (_refrescando) listo(); } catch (e) {}
}
var knCerrarSesionBase = cerrarSesion;
cerrarSesion = function () { knLimpiarUsuario(); return knCerrarSesionBase.apply(this, arguments); };
// Una respuesta que llega después de cambiar de usuario o de cerrar sesión se descarta: no rellena la pantalla del
// usuario nuevo con datos del anterior (Codex; el caso ya existía en la app vieja).
var knApiCachedBase = apiCached;
apiCached = function (accion, params, onData, onFail) {
  var g = state._knGen || 0;
  return knApiCachedBase(accion, params,
    function (d, m) { if ((state._knGen || 0) === g) onData(d, m); },
    function (e) { if ((state._knGen || 0) === g && onFail) onFail(e); });
};
listo = function () { knListoBase(); knRefrescarDesglose(); };
function knReintentarBtn() { return '<button class="kn-reint" onclick="knReintentar()">Reintentar</button>'; }

function knVentaGanancia(v, quien) {
  return '<div class="kn-des-grupo"><div class="kn-des-h">Última venta incluida</div>' +
    '<div class="kn-des-txt">' + knEsc(v.descripcion) + ' · ' + knFecha(v.fechaTimestamp) + '<br>Mercancía de ' + knEsc(v.origen || 'Alex') +
    (quien === 'Irene' ? '<br>Venta realizada por ' + knEsc(v.vendedor) : '') + '</div>' +
    knFila('Precio de venta', knM(v.precio)) + knFila('Cobro adicional', '+ ' + knM(v.cobroExtra)) +
    knFila('Costo de la mercancía', '− ' + knM(v.costoFinal)) + knFila('Motomandado', '− ' + knM(v.gastoExt)) +
    knFila('Ganancia de ' + quien, knM(v.ganancia), true) + '</div>';
}
function knDesgloseGanancia() {
  var esIrene = state.usuario === 'Irene', quien = esIrene ? 'Irene' : 'Alex', titulo = 'Ganancia de ' + quien;
  var dato = esIrene ? state.operacion : state.impulso;
  var html = '<div class="kn-des-per">' + knPeriodo() + (esIrene ? '' : '<br>Ventas realizadas por Alex') + '</div>';
  if (!dato) {
    knAbrir('ganancia', titulo, html + '<div class="kn-des-txt">' + (state._extrasFalla ? 'No se pudo cargar la información.' + knReintentarBtn() : 'Cargando información…') + '</div>');
    return;
  }
  var total = esIrene ? dato.gMesTotal : dato.gananciaMes;
  html += '<div class="kn-des-total num">' + knM(total) + '</div>';
  if (state._extrasFalla) html += '<div class="kn-des-txt">' + knSinActualizar('inicioExtras', { usuario: state.usuario }) + knReintentarBtn() + '</div>';
  if (esIrene) html += '<div class="kn-des-grupo">' + knFila('Mercancía propia', knM(dato.gMesPropio)) + knFila('Mercancía de Alex', knM(dato.gMesAjeno)) +
    knFila('Ganancia del mes', knM(total), true) + '<div class="kn-des-txt">Incluye la ganancia de la mercancía de Irene y la ganancia de sus ventas de mercancía de Alex.</div></div>';
  // La última venta del mismo alcance que la cifra: Irene, sus ventas del mes (de cualquier dueño);
  // Alex, sus ventas del mes de su propia mercancía. La lista solo trae las ventas personales.
  var m0 = knInicioMes(), L = (state.ventas || []).filter(function (v) {
    return v.fechaTimestamp >= m0 && (esIrene || (v.origen || 'Alex') === 'Alex');
  });
  var fallo = !state.ventFirma && !!document.querySelector('#ventas-list .empty');
  if (L.length) html += knVentaGanancia(L[0], quien) + '<button class="kn-des-ir" onclick="cerrarExp();knVerVentas()"><span>Ver ventas</span>›</button>';
  else if (fallo) html += '<div class="kn-des-txt">No se pudo cargar la información.' + knReintentarBtn() + '</div>';
  else if (!state.ventFirma) html += '<div class="kn-des-txt">Cargando información…</div>';
  // Codex: si hay ganancia pero ninguna venta personal (p. ej. mercancía de Irene vendida por otra persona),
  // no se afirma que no hubo ventas.
  else html += '<div class="kn-des-txt">' + (total ? 'No hay una venta disponible para mostrar el ejemplo.' : 'No hay ventas registradas en este periodo.') + '</div>';
  knAbrir('ganancia', titulo, html);
}
function knDesgloseCuenta() {
  var d = state._dash;
  if (!d) {
    // Si falló la primera carga, app.js deja su aviso en lugar de las tarjetas (Codex).
    var fallo = !document.getElementById('h-val') && !!document.querySelector('#dinero-hero .empty');
    knAbrir('cuenta', knTituloCuenta(0), '<div class="kn-des-txt">' + (fallo ? 'No se pudo cargar la información.' + knReintentarBtn() : 'Cargando información…') + '</div>');
    return;
  }
  var total = d.porTransferir || 0, titulo = knTituloCuenta(total);
  var t = knHoraDatos('inicio', { usuario: state.usuario, partes: 'base' });
  var html = '<div class="kn-des-per">' + (t ? 'Saldo al ' + knCuando(t).replace(', ', ' · ') : 'Saldo') + '</div>' +
    '<div class="kn-des-total num">' + knM(Math.abs(total)) + '</div>' +
    (!total ? '<div class="kn-des-txt">Sin saldo pendiente</div>' : '') +
    '<div class="kn-des-grupo">' + knFila('Ventas pendientes sin corte', knM(d.sinCorte)) + knFila('Saldo de cortes', knM(d.saldoCortes)) +
    knFila(total < 0 ? 'Saldo a favor de Irene' : 'Saldo total', knM(Math.abs(total)), true) + '</div>';
  // Última venta pendiente (sin corte): el importe que incorporó a la cuenta es el guardado (aporte).
  var L = (state.detalle || []).filter(function (v) { return v.estatusTransferencia === 'No transferido' && !v.corte; })
    .sort(function (a, b) { return (b.fechaTimestamp || 0) - (a.fechaTimestamp || 0); });
  if (L.length) {
    var v = L[0], tipo = aporte(v).tipo;
    html += '<div class="kn-des-grupo"><div class="kn-des-h">Última venta pendiente</div>' +
      '<div class="kn-des-txt">' + knEsc(v.descripcion) + ' · ' + knFecha(v.fechaTimestamp) + '<br>Venta realizada por ' + knEsc(v.vendedor) +
      '<br>Forma de pago: ' + knEsc(v.metodoPago || '') + '</div>' +
      knFila('Precio de venta', knM(v.precio)) + knFila('Cobro adicional', knM(v.cobroExtra)) +
      knFila('Costo de la mercancía', knM(v.costoFinal)) + knFila('Motomandado', knM(v.gastoExt)) +
      knFila('Importe incorporado a la cuenta', knM(v.aporte), true) +
      '<div class="kn-des-txt">' + (tipo === 'a' ? 'El importe incorporado a la cuenta es el cobro recibido menos el motomandado.'
        : tipo === 'b' ? 'El importe incorporado a la cuenta corresponde al costo de la mercancía.'
          : 'El motomandado se descuenta del saldo de la cuenta.') + '</div></div>';
  } else html += '<div class="kn-des-txt">No hay ventas pendientes para mostrar un ejemplo.</div>';
  html += '<button class="kn-des-ir" onclick="cerrarExp();abrirDetalle(\'transferencia\')"><span>Ver cuenta</span>›</button>';
  knAbrir('cuenta', titulo, html);
}

// Fuera del inicio (los datos siguen guardados).
function renderMeta() {}
function renderLogros() {}
function renderNegocio() {}
function renderCortes() {}
function renderChipsCortes() {}

// Al cambiar de pestaña, Dinero vuelve al resumen. Alex ya no da de alta pedidos desde el celular (es del panel).
var knCambiarVistaBase = cambiarVista;
cambiarVista = function (vista) {
  var v = document.getElementById('view-ventas');
  if (v) v.classList.remove('kn-lista', 'kn-entra');
  knCambiarVistaBase(vista);
  // Título grande por pestaña (como iOS): en Dinero el encabezado dice "Dinero" en vez del saludo.
  var gr = document.getElementById('greeting');
  if (gr && state.usuario) gr.textContent = vista === 'ventas' ? 'Dinero' : saludo() + ', ' + state.usuario;
  var fab = document.getElementById('fab-add');
  if (fab && state.usuario === 'Alex') fab.style.display = 'none';
};
// Si la vista ya se pintó antes de cargar este archivo (no debería: app.js arranca en DOMContentLoaded).
(function () { var fab = document.getElementById('fab-add'); if (fab && state.usuario === 'Alex') fab.style.display = 'none'; })();

// En el celular la cuenta se consulta; cerrar cortes y registrar pagos se hace en el panel de PC.
var knAbrirDetalleBase = abrirDetalle;
abrirDetalle = function (tipo, copiar) {
  knAbrirDetalleBase(tipo, copiar);
  if (tipo !== 'transferencia') return;
  // Codex: la sección Cortes salió del inicio; los cortes ya pagados (y sus pagos) se consultan aquí.
  var body = document.getElementById('detalle-body'), pagados = (state.cortes || []).filter(function (c) { return c.estado === 'Pagado'; });
  if (body && pagados.length && typeof filaCorte === 'function')
    body.insertAdjacentHTML('beforeend', '<div class="det-sub" style="padding-top:14px">Cortes pagados</div><div class="group">' + pagados.map(filaCorte).join('') + '</div>');
  if (state.usuario !== 'Alex') return;
  var b = document.querySelector('#detalle-body button[onclick="abrirCerrar()"]');
  if (!b) return;
  var cont = b.parentNode;
  b.remove();
  var c = cont.querySelector('button'); if (c) { c.classList.remove('ghost'); c.classList.add('primary'); }
  cont.insertAdjacentHTML('afterend', '<div class="kn-panel-nota">Para cerrar el corte, usa el panel de la PC.</div>');
};
var knPintarCorteBase = pintarCorte;
pintarCorte = function (c) {
  knPintarCorteBase(c);
  if (state.usuario !== 'Alex') return;
  var b = document.getElementById('pago-btn');
  var f = b && b.closest('.field');
  if (f) f.outerHTML = '<div class="kn-panel-nota">Los pagos se registran en el panel de la PC.</div>';
};
