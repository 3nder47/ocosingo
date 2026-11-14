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
    // Los tokens --kn-* viven en diseno.css (sistema visual v3 de Codex, 2026-11-14).
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
    '#exp-body .kn-reint,#view-ventas .kn-reint{background:none;border:0;color:var(--kn-action);font:inherit;font-weight:600;padding:0 8px;min-height:48px;min-width:48px}' +
    '#view-ventas .kn-volver{display:flex;align-items:center;gap:6px;background:none;border:0;color:var(--kn-action);font:inherit;font-size:16px;font-weight:600;padding:14px 2px;min-height:48px}' +
    // Tres estados de Dinero: resumen, "Mis ventas" (.kn-lista) y "Mi mes" (.kn-mes).
    '#view-ventas:not(.kn-lista) .kn-solo-lista{display:none!important}' +
    '#view-ventas:not(.kn-mes) .kn-solo-mes{display:none!important}' +
    '#view-ventas:not(.kn-lista):not(.kn-mes) .kn-volver{display:none!important}' +
    '#view-ventas.kn-lista .kn-solo-resumen,#view-ventas.kn-mes .kn-solo-resumen{display:none!important}' +
    // Mini gráfica (sin ejes; se lee de un vistazo) y "Mi mes"
    '#view-ventas .kn-spark{display:block;width:100%;height:40px;margin-top:14px;overflow:visible}' +
    '#view-ventas .kn-spark polyline{fill:none;stroke:var(--kn-positive);stroke-width:2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}' +
    '#view-ventas .kn-spark line{stroke:var(--kn-divider);stroke-width:1;vector-effect:non-scaling-stroke}' +
    '#view-ventas .kn-spark-t{font-size:13px;color:var(--kn-muted);margin-top:4px}' +
    '#view-ventas .kn-mes-t{font-size:28px;font-weight:700;line-height:1.15;margin:4px 4px 2px;color:var(--kn-text)}' +
    '#view-ventas .kn-mes-p{font-size:14px;color:var(--kn-muted);margin:0 4px 14px;line-height:1.45}' +
    '#view-ventas .kn-f{display:flex;justify-content:space-between;gap:12px;font-size:16px;line-height:1.45;padding:4px 0}' +
    '#view-ventas .kn-f span:last-child{font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '#view-ventas .kn-f.kn-res{font-weight:650}' +
    '#view-ventas .kn-f.kn-sec{color:var(--kn-muted)}' +
    '#view-ventas .kn-txt{font-size:14px;line-height:1.45;color:var(--kn-muted);margin-top:6px}' +
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
    '.nav .fab.kn-vender svg{width:24px!important;height:24px!important}';
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
    volver.className = 'kn-volver';
    volver.setAttribute('onclick', 'knResumen()');
    volver.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>Dinero';
    v.insertBefore(volver, v.firstChild);
    var mesDiv = document.createElement('div');
    mesDiv.id = 'kn-mes'; mesDiv.className = 'kn-solo-mes';
    volver.insertAdjacentElement('afterend', mesDiv);
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

// Sistema visual v3, entrega 5: los íconos de las tarjetas son de Lucide (iconos.js), como el resto de la app.
if (typeof knIcono === 'function') {
  KN_ICO.cuenta = knIcono('wallet'); KN_ICO.tendencia = knIcono('chart-no-axes-combined');
  KN_ICO.ventas = knIcono('receipt-text'); KN_ICO.racha = knIcono('flame');
}

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
  v.classList.remove('kn-mes');
  v.classList.add('kn-lista'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
function knResumen() {
  var v = document.getElementById('view-ventas');
  if (!v.classList.contains('kn-lista') && !v.classList.contains('kn-mes')) return;
  buzz(8);
  v.classList.remove('kn-lista', 'kn-mes'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
function knVerMes() {
  buzz(8);
  var v = document.getElementById('view-ventas');
  knPintarMes();
  v.classList.remove('kn-lista');
  v.classList.add('kn-mes'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
// "Ver ventas del mes": la lista con el filtro "Este mes" ya puesto.
function knVentasDelMes() {
  var b = document.querySelector('#filtros button[data-f="mes"]');
  if (b && !b.classList.contains('on')) b.click();
  knVerVentas();
}
function knReintentar() { state._extrasFalla = false; cargarDinero(); }

// Título de la cuenta según el signo del saldo (Codex): nunca "Irene te debe" encima de un saldo negativo.
function knTituloCuenta(total) {
  if ((total || 0) < 0) return 'Saldo a favor de Irene';
  return state.usuario === 'Alex' ? 'Irene te debe' : 'Por entregar a Alex';
}
// Cuándo se obtuvieron de verdad los datos (la caché guarda la hora), no la hora en que se abre la hoja.
function knHoraDatos(accion, params) { var c = leerCache(cacheKey(accion, params)); return c && c.t ? c.t : 0; }
function knCuando(t) { return knFecha(t) + ', ' + knHora(t); }
function knSinActualizar(accion, params) {
  var t = knHoraDatos(accion, params);
  return 'Información sin actualizar.' + (t ? ' Última actualización: ' + knCuando(t) + '.' : '');
}

function armarDinero() {
  var esIrene = state.usuario === 'Irene', mes = MESES_KN[knMtyDate().getUTCMonth()];   // mes de Monterrey
  var cuenta = knTarjeta('cuenta', '<span id="kn-cuenta-t">' + knTituloCuenta(0) + '</span>',
    'knDesgloseCuenta()', 'h-val', '<div class="kn-sub" id="kn-cuenta-sub"></div>', knIr('Ver cuenta', "abrirDetalle('transferencia')"));
  var ganancia = knTarjeta('tendencia', 'Tu ganancia de ' + mes, 'knDesgloseGanancia()', 'v-gmes',
    (esIrene ? '' : '<div class="kn-sub">Ventas realizadas por Alex</div>') + '<div id="kn-racha"></div><div id="kn-spark-w"></div>',
    knIr('Ver mi mes', 'knVerMes()'));
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
  knPintarSpark();
  knRefrescarDesglose();
}

// ---- Mi mes (acción miMes del Worker; se pide al abrir Dinero, después de lo esencial) ----
var knCargarDineroBase = cargarDinero;
cargarDinero = function () {
  // "Desliza para actualizar" termina cuando acaban lo de app.js y miMes (Codex): se intercala un contador.
  var fin = null;
  try {
    // Solo una vez: si ya está nuestro contador (otra carga a media recarga), no se anida (Codex).
    if (_refrescando && !_refrescando.knContador) {
      var orig = _refrescando, k = 2;
      state._knRefOrig = orig;   // para cancelarlo de una vez al cambiar de usuario (Codex)
      fin = function () { if (--k === 0 && state._knRefOrig === orig) { state._knRefOrig = null; orig(); } };
      fin.knContador = true;
      _refrescando = fin;
    }
  } catch (e) {}
  knCargarDineroBase();
  knCargarMes(fin);
};
// Caché propia (no apiCached): apiCached oculta el fallo cuando hay datos guardados, y aquí hay que avisar que la
// información no está actualizada y desde cuándo (Codex). Primero lo guardado, luego lo nuevo.
function knCargarMes(fin) {
  // Cada petición lleva su número: una respuesta vieja no pisa una más nueva del mismo usuario (Codex).
  var req = state._knMesReq = (state._knMesReq || 0) + 1, vieja = function () { return (state._knGen || 0) !== g || state._knMesReq !== req; };
  var termina = function () { if (fin) { var f = fin; fin = null; f(); } };
  var g = state._knGen || 0, key = cacheKey('miMes', { usuario: state.usuario }), c = leerCache(key);
  var pintar = function () { knPintarSpark(); knPintarMes(); knRefrescarDesglose(); };
  if (c && !state.miMes) { state.miMes = c.d; pintar(); }
  api('miMes', { usuario: state.usuario }).then(function (d) {
    termina();
    if (vieja()) return;
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
    state.miMes = d; state._miMesFalla = false; pintar();
  }).catch(function () {
    termina();
    if (vieja()) return;
    if (!state.miMes && c) state.miMes = c.d;
    state._miMesFalla = true; pintar();
  });
}
function knReintentarMes() { state._miMesFalla = false; knPintarMes(); knCargarMes(); }
// Mini gráfica: ganancia por día del mes hasta hoy. Sin ejes ni suavizado; días sin ventas en cero; la línea tenue
// es el cero. Un solo día: un trazo plano.
function knPintarSpark() {
  var w = document.getElementById('kn-spark-w'), m = state.miMes;
  if (!w) return;
  if (!m || !Array.isArray(m.serieDiaria) || !m.serieDiaria.length) { w.innerHTML = ''; return; }
  var s = m.serieDiaria, n = s.length, max = Math.max.apply(null, s.concat([0])), min = Math.min.apply(null, s.concat([0]));
  var rango = max - min || 1, H = 40, W = 100;
  var y = function (v) { return (H - 2 - (v - min) / rango * (H - 4)).toFixed(2); };
  var x = function (i) { return n === 1 ? (i ? W : 0) : (i / (n - 1) * W).toFixed(2); };
  var pts = n === 1 ? [x(0) + ',' + y(s[0]), x(1) + ',' + y(s[0])] : s.map(function (v, i) { return x(i) + ',' + y(v); });
  var mes = (m.nombreMes || '').split(' ')[0];
  w.innerHTML = '<svg class="kn-spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Ganancia diaria de ' + mes + '">' +
    '<line x1="0" x2="' + W + '" y1="' + y(0) + '" y2="' + y(0) + '"/><polyline points="' + pts.join(' ') + '"/></svg>' +
    '<div class="kn-spark-t">Ganancia diaria · ' + mes + '</div>';
}
function knDia(f) { return Number(String(f).slice(8, 10)); }
function knRango(a) { var mes = MESES_KN[Number(String(a.desde).slice(5, 7)) - 1]; return knDia(a.desde) + '–' + knDia(a.hasta) + ' de ' + mes; }
var MESES_KN = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function knMay(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function knDif(n, dinero) {
  n = Number(n) || 0;
  var t = dinero ? '$' + money(Math.abs(n)) : String(Math.abs(n));
  return (n > 0 ? '+' : n < 0 ? '−' : '') + t;
}
function knF(et, val, cls) { return '<div class="kn-f' + (cls ? ' ' + cls : '') + '"><span>' + et + '</span><span>' + val + '</span></div>'; }
function knPintarMes() {
  var w = document.getElementById('kn-mes');
  if (!w) return;
  var m = state.miMes, esIrene = state.usuario === 'Irene';
  if (!m) {
    w.innerHTML = '<div class="kn-mes-t">Mi mes</div><div class="kn-tarjeta"><div class="kn-txt">' +
      (state._miMesFalla ? 'No se pudo cargar la información.<button class="kn-reint" onclick="knReintentarMes()">Reintentar</button>' : 'Cargando información…') + '</div></div>';
    return;
  }
  var c = m.comparacion, g = m.ganancia, p = m.piezas, ini = knDia(m.periodo.desde), fin = knDia(m.periodo.hasta);
  var mesTxt = MESES_KN[Number(m.mes.slice(5, 7)) - 1];
  var h = '<div class="kn-mes-t">Mi mes</div><div class="kn-mes-p">' + knMay(m.nombreMes) + '<br>' +
    (ini === fin ? '1 de ' + mesTxt : 'Del 1 al ' + fin + ' de ' + mesTxt) + (esIrene ? '' : '<br>Ventas realizadas por Alex') +
    (state._miMesFalla ? '<br>' + knSinActualizar('miMes', { usuario: state.usuario }) + '<button class="kn-reint" onclick="knReintentarMes()">Reintentar</button>' : '') + '</div>';
  h += '<div class="kn-tarjeta">' + knF('Ganancia del mes', knM(g.total), 'kn-res') +
    (esIrene ? knF('Mercancía propia', knM(g.propio), 'kn-sec') + knF('Mercancía de Alex', knM(g.ajeno), 'kn-sec') : '') + '</div>';
  h += '<div class="kn-tarjeta">' + knF('Piezas vendidas por ti', String(p.total), 'kn-res') +
    (esIrene ? knF('Mercancía propia', String(p.propias), 'kn-sec') + knF('Mercancía de Alex', String(p.ajenas), 'kn-sec') : '') +
    (esIrene && p.propiasPorOtros ? '<div class="kn-txt">La ganancia de mercancía propia incluye ventas realizadas por otras personas.</div>' : '') + '</div>';
  var hc = Date.parse(c.corte);
  h += '<div class="kn-tarjeta"><div class="kn-f kn-res"><span>Comparación al mismo corte</span><span></span></div>' +
    knF(knRango(c.actual), knM(c.actual.ganancia)) + knF(knRango(c.anterior), knM(c.anterior.ganancia)) +
    knF('Diferencia de ganancia', knDif(c.actual.ganancia - c.anterior.ganancia, true)) +
    knF('Diferencia de piezas vendidas', knDif(c.actual.piezas - c.anterior.piezas, false)) +
    '<div class="kn-txt">Corte: ' + knFecha(hc) + ' · ' + knHora(hc) + '</div></div>';
  h += '<div class="kn-tarjeta"><div class="kn-f kn-res"><span>Mejor mes cerrado</span><span></span></div>' +
    (m.mejorMesCerrado ? knF(knMay(m.mejorMesCerrado.nombre), knM(m.mejorMesCerrado.ganancia)) : '<div class="kn-txt">No hay meses cerrados con ventas.</div>') + '</div>';
  h += '<div class="kn-tarjeta kn-sola">' + knIr('Ver ventas del mes', 'knVentasDelMes()') + '</div>';
  w.innerHTML = h;
}

// ---- Desgloses con números reales (textos de Codex, kiosko-dinero-v2-codex.md) ----
function knM(n) { n = Number(n) || 0; return (n < 0 ? '−' : '') + '$' + money(Math.abs(n)); }
function knFila(et, val, res) { return '<div class="kn-des-f' + (res ? ' kn-res' : '') + '"><span>' + et + '</span><span>' + val + '</span></div>'; }
// Fechas y horas siempre en Monterrey (UTC-6 fijo), como los rangos del servidor, aunque el teléfono esté en otra zona (Codex).
var KN_MTY = 6 * 3600 * 1000;
function knMtyDate(ts) { return new Date((ts == null ? Date.now() : ts) - KN_MTY); }   // leer con getUTC*
function knMesMty(ts) { return knMtyDate(ts).toISOString().slice(0, 7); }
function knFecha(ts) { var d = knMtyDate(ts); return d.getUTCDate() + ' de ' + MESES_KN[d.getUTCMonth()]; }
function knHora(ts) { var d = knMtyDate(ts), h = d.getUTCHours(), mi = d.getUTCMinutes();
  return (h % 12 || 12) + ':' + (mi < 10 ? '0' : '') + mi + (h < 12 ? ' a.m.' : ' p.m.'); }
function knPeriodo() {
  var h = knMtyDate(), mes = MESES_KN[h.getUTCMonth()];
  return h.getUTCDate() === 1 ? '1 de ' + mes : 'Del 1 al ' + h.getUTCDate() + ' de ' + mes;
}
function knInicioMes() { return Date.parse(knMesMty() + '-01T00:00:00Z') + KN_MTY; }
// La hoja abierta se vuelve a pintar cuando llegan (o fallan) los datos (Codex): state._knDes = 'ganancia' | 'cuenta'.
function knAbrir(tipo, titulo, html) {
  var hoja = document.getElementById('sheet-exp'), yaAbierta = state._knDes === tipo && !hoja.classList.contains('hidden');
  if (!yaAbierta) buzz(8);
  state._knDes = tipo;
  document.getElementById('exp-titulo').textContent = titulo;
  // Marca propia: si otra explicación sustituye la hoja, el refresco ya no la pisa (Codex).
  document.getElementById('exp-body').innerHTML = '<i hidden data-kn="1"></i>' + html;
  // Estilo de recibo (2026-11-14): la cifra principal con los centavos más chicos; el tipo decide su color.
  var eb = document.getElementById('exp-body');
  eb.setAttribute('data-kn-tipo', tipo);
  eb.querySelectorAll('.kn-des-total').forEach(function (el) {
    var m = /^\s*([−-]?)\$([\d,]+)\.(\d{2})\s*$/.exec(el.textContent);
    if (m) el.innerHTML = '<span class="kn-tk-signo">' + (m[1] ? '−$' : '$') + '</span>' + m[2] + '<span class="kn-tk-cent">.' + m[3] + '</span>';
  });
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
  state.miMes = null; state._miMesFalla = false;
  var vv = document.getElementById('view-ventas'), km = document.getElementById('kn-mes');
  if (vv) vv.classList.remove('kn-lista', 'kn-mes'); if (km) km.innerHTML = '';
  // Nueva generación: toda respuesta pedida antes se descarta, aunque vuelva a entrar la misma persona (Codex).
  state._knGen = (state._knGen || 0) + 1;
  // Nada de cifras ni ventas del anterior en pantalla: cargarDinero pone esqueletos si están vacías.
  state._dinArmado = '';
  var h = document.getElementById('dinero-hero'), l = document.getElementById('ventas-list');
  if (h) h.innerHTML = ''; if (l) l.innerHTML = '';
  // Si había un "desliza para actualizar" en curso, se termina (sus respuestas ya no llegarán).
  try { if (_refrescando) listo(); } catch (e) {}
  if (state._knRefOrig) { var o = state._knRefOrig; state._knRefOrig = null; setTimeout(o, 0); }
}
var knCerrarSesionBase = cerrarSesion;
cerrarSesion = function () {
  // Mientras se mandan ventas en espera no se cambia de sesión: los reintentos leen la sesión vigente y una venta de
  // una persona podría salir con el PIN de otra (Codex, 2026-11-14).
  if (typeof _enviando !== 'undefined' && _enviando) { toast('Se están enviando ventas en espera. Intenta en unos segundos.', 'err'); return; }
  knLimpiarUsuario(); return knCerrarSesionBase.apply(this, arguments);
};
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
    knFila('Ganancia del mes', knM(total), true) + '<div class="kn-des-txt">Incluye la ganancia de tu mercancía y de tus ventas de mercancía de Alex.</div></div>';
  // miMes (entrega 2): desglose agregado de Alex y la última venta exacta del alcance de la cifra. Solo si es del mes
  // en curso y su total cuadra con la cifra de la tarjeta (si no, se usa lo de antes).
  var mm = state.miMes, mesAct = knMesMty();
  var mmOk = mm && mm.mes === mesAct && Math.abs((mm.ganancia ? mm.ganancia.total : NaN) - total) < 0.005;
  if (mmOk && !esIrene) {
    var dg = mm.desglose;
    html += '<div class="kn-des-grupo">' + knFila('Importe de las ventas', knM(dg.precio)) + knFila('Cobros adicionales', '+ ' + knM(dg.extra)) +
      knFila('Costo de la mercancía', '− ' + knM(dg.costo)) + knFila('Motomandados', '− ' + knM(dg.moto)) +
      knFila('Ganancia del mes', knM(dg.ganancia), true) + '</div>';
  }
  // La última venta del mismo alcance que la cifra. Sin miMes: Irene, sus ventas del mes (de cualquier dueño);
  // Alex, sus ventas del mes de su propia mercancía (la lista solo trae las ventas personales).
  var m0 = knInicioMes(), L = mmOk ? (mm.ultimaVenta ? [mm.ultimaVenta] : []) : (state.ventas || []).filter(function (v) {
    return v.fechaTimestamp >= m0 && (esIrene || (v.origen || 'Alex') === 'Alex');
  });
  var fallo = !state.ventFirma && !!document.querySelector('#ventas-list .empty');
  if (L.length) html += knVentaGanancia(L[0], quien) + '<button class="kn-des-ir" onclick="cerrarExp();knVerVentas()"><span>Ver ventas</span>›</button>';
  else if (mmOk) html += '<div class="kn-des-txt">No hay ventas registradas en este periodo.</div>';
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
  // Componentes de lo pendiente sin corte (miMes). Solo si cuadran exactamente con dashboard.sinCorte.
  var cs = state.miMes && state.miMes.cuentaSinCorte, cent = function (x) { return Math.round((Number(x) || 0) * 100); };
  if (cs && cent(cs.total) === cent(d.sinCorte)) {
    var efectivoCuadra = cent(cs.cobrosEfectivo) - cent(cs.motoEfectivo) === cent(cs.aporteEfectivo);
    html += '<div class="kn-des-grupo"><div class="kn-des-h">Ventas pendientes sin corte</div>' +
      (efectivoCuadra
        ? knFila('Cobros en efectivo de ventas de Alex', '+ ' + knM(cs.cobrosEfectivo)) + knFila('Motomandados de esas ventas', '− ' + knM(cs.motoEfectivo))
        : knFila('Ventas de Alex cobradas en efectivo', knM(cs.aporteEfectivo))) +
      knFila('Costo de mercancía de Alex vendida por otras personas', '+ ' + knM(cs.costos)) +
      knFila('Motomandados de ventas de Alex cobradas directamente por Alex', (cs.aporteDirecto <= 0 ? '− ' : '+ ') + knM(Math.abs(cs.aporteDirecto))) +
      knFila('Subtotal', knM(cs.total), true) + '</div>';
  }
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
  if (v) v.classList.remove('kn-lista', 'kn-mes', 'kn-entra');
  knCambiarVistaBase(vista);
  // Título grande por pestaña (como iOS): en Dinero el encabezado dice "Dinero" en vez del saludo.
  var gr = document.getElementById('greeting');
  if (gr && state.usuario) gr.textContent = vista === 'ventas' ? 'Dinero' : vista === 'catalogo' ? 'Tienda' : vista === 'calc' ? 'Calcular' : saludo() + ', ' + state.usuario;
  knHeroe();
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

/* Detalle de una venta desde Mis ventas (2026-11-14, prueba del cambio definitivo). "Deshacer venta" aparece en los
   primeros 30 minutos (contrato, decisión 8: cada quien las suyas; Alex, las de todos). El servidor tiene la última
   palabra sobre el tiempo: cuenta desde que la venta llegó, no desde la hora del teléfono. */
var KN_DESHACER_MS = 30 * 60000;
function knBuscarVenta(folio) { return (state.ventas || []).filter(function (x) { return x.id === folio; })[0] || null; }
/* Detalle de la venta como recibo (Alex, 2026-11-14: "más gráfico y con jerarquía"; referencias: ticket y factura).
   Arriba lo que identifica la venta (foto, producto, folio y estado); en medio los datos en cuadrícula; un corte de
   ticket; las cuentas alineadas y, al final, la ganancia grande con los centavos más chicos. */
function knMontoGrande(n) {
  n = Number(n) || 0;
  var s = money(Math.abs(n)), p = s.split('.');
  return '<span class="kn-tk-signo">' + (n < 0 ? '−$' : '$') + '</span>' + p[0] + '<span class="kn-tk-cent">.' + (p[1] || '00') + '</span>';
}
function knEstadoVenta(v) {
  if (v.estatusTransferencia === 'Transferido') return '<span class="kn-pill kn-pill-ok">' + knIcono('circle-check') + 'Liquidada</span>';
  if (v.estatusTransferencia === 'No aplica') return '<span class="kn-pill">Mercancía propia</span>';
  return '<span class="kn-pill kn-pill-pend">' + knIcono('clock') + 'Sin liquidar</span>';
}
function knVerVenta(folio) {
  var v = knBuscarVenta(folio);
  if (!v) return;
  var propia = state.usuario === 'Alex' || v.vendedor === state.usuario;
  var reciente = v.fechaTimestamp && Date.now() - v.fechaTimestamp < KN_DESHACER_MS;
  var dato = function (et, val) { return '<div><span>' + et + '</span><b>' + val + '</b></div>'; };
  var linea = function (et, val, cls) { return '<div class="kn-tk-l' + (cls ? ' ' + cls : '') + '"><span>' + et + '</span><b class="num">' + val + '</b></div>'; };
  var g = Number(v.ganancia) || 0;
  var html = '<div class="kn-ticket">' +
    '<div class="kn-tk-cab">' + thumb({ imagen: v.imagen, categoria: '', descripcion: v.descripcion }) +
      '<div class="kn-tk-prod"><b>' + knEsc(v.descripcion) + '</b><span class="kn-tk-folio">' + knEsc(v.id) + '</span></div></div>' +
    '<div class="kn-tk-estado">' + knEstadoVenta(v) + (v.corte ? '<span class="kn-pill">Corte ' + knEsc(v.corte) + '</span>' : '') + '</div>' +
    '<div class="kn-tk-meta">' +
      dato('Fecha', v.fechaTimestamp ? knFecha(v.fechaTimestamp) : 'Sin fecha') +
      dato('Hora', v.fechaTimestamp ? knHora(v.fechaTimestamp) : '—') +
      dato('Vendió', knEsc(v.vendedor)) +
      dato('Pago', knEsc(v.metodoPago)) +
      dato('Mercancía de', knEsc(v.origen || 'Alex')) +
    '</div>' +
    '<div class="kn-tk-corte" aria-hidden="true"></div>' +
    '<div class="kn-tk-lineas">' +
      linea('Precio de venta', knM(v.precio)) +
      (Number(v.cobroExtra) ? linea('Cobro adicional', '+ ' + knM(v.cobroExtra)) : '') +
      linea('Costo de la mercancía', '− ' + knM(v.costoFinal), 'kn-tk-resta') +
      (Number(v.gastoExt) ? linea('Motomandado', '− ' + knM(v.gastoExt), 'kn-tk-resta') : '') +
    '</div>' +
    '<div class="kn-tk-total' + (g < 0 ? ' kn-neg' : '') + '"><span>Ganancia</span><b class="num">' + knMontoGrande(g) + '</b></div>' +
  '</div>';
  if (propia && reciente && !v.corte) {
    html += '<button class="btn kn-tk-deshacer" onclick="knDeshacerVenta(\'' + knEsc(v.id) + '\',this)"><span>Deshacer venta</span></button>' +
      '<div class="kn-des-txt kn-tk-nota">Disponible durante los primeros 30 minutos. La pieza regresa al inventario.</div>';
  } else if (propia) {
    html += '<div class="kn-des-txt kn-tk-nota">' + (v.corte ? 'Esta venta ya está en el corte ' + knEsc(v.corte) + '.' : 'Pasaron más de 30 minutos desde la venta.') +
      ' Ya no se puede deshacer desde la app.</div>';
  }
  knAbrir('venta', 'Detalle de la venta', html);
}
function knDeshacerVenta(folio, b) {
  var v = knBuscarVenta(folio), et = b && b.querySelector('span');
  if (!v || !b || b.disabled) return;
  if (!b.dataset.ok) { b.dataset.ok = '1'; et.textContent = 'Toca otra vez para deshacer'; buzz(12); return; }
  b.disabled = true; et.textContent = 'Deshaciendo…';
  var gen = state._knGen;
  var regresar = function () { b.disabled = false; delete b.dataset.ok; et.textContent = 'Deshacer venta'; };
  apiPost('anularVenta', { id: v.id, ventaID: v.ventaID || '' }).then(function (r) {
    if (gen !== state._knGen) return;
    if (!r || !r.success) { toast((r && r.error) || 'No se pudo deshacer la venta', 'err'); regresar(); cargarDinero(); return; }
    state.ventas = (state.ventas || []).filter(function (x) { return x.id !== folio; });
    state.dirty = true; state.catFirma = ''; state.ventFirma = '';
    cerrarExp(); renderVentas();
    toast('Venta deshecha. La pieza regresó al inventario.', 'ok');
    cargarDinero();
  }).catch(function (err) {
    if (gen !== state._knGen) return;
    // Respuesta perdida: el servidor pudo haberla deshecho. Se vuelve a leer todo antes de afirmar nada (Codex).
    toast(err && err.api ? err.message : 'No se pudo confirmar. Revisa la lista cuando vuelva la señal.', 'err'); regresar();
    state.dirty = true; state.catFirma = ''; state.ventFirma = '';
    try { Object.keys(localStorage).filter(function (k) { return k.indexOf('kn:misVentas:') === 0 || k.indexOf('kn:catalogo:') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    cargarDinero();
  });
}

/* Tienda (sistema visual v3 de Codex, entrega 1): la bienvenida en lima es la única tarjeta de color de la pantalla y
   lleva dentro la búsqueda. El encabezado grande dice "Tienda", como "Dinero" en su pestaña. */
function knHeroe() {
  var vista = document.getElementById('view-catalogo');
  if (!vista || !state.usuario) return;
  var h = document.getElementById('kn-heroe');
  if (!h) {
    h = document.createElement('div');
    h.id = 'kn-heroe'; h.className = 'kn-heroe';
    h.innerHTML = '<span class="kn-hola" id="kn-hola"></span><span class="kn-sub">Busca un producto para vender</span>';
    vista.insertBefore(h, vista.firstChild);
    var buscar = vista.querySelector('.search');
    if (buscar) h.appendChild(buscar);
  }
  var hola = document.getElementById('kn-hola');
  if (hola) hola.textContent = saludo() + ', ' + state.usuario;
}
knHeroe();

/* Hoja de venta (sistema visual v3 de Codex, entrega 2). Solo presentación, después de pintar:
   - "Vendedor" se oculta (no se quita: refrescarOpciones cuenta los grupos): es quien entró con su PIN y se ve al revisar.
   - Etiquetas neutrales y los ajustes marcados como opcionales.
   - La ganancia negativa no se pinta de verde. */
var knPintarVentaBase = pintarVenta;
pintarVenta = function () {
  // Mientras se registra una venta, "Corregir" no reconstruye la hoja (Codex: evitaba una segunda venta).
  if (state._knReg) { state.paso = 2; toast('Registrando la venta…'); return; }
  knPintarVentaBase.apply(this, arguments);
  var body = document.getElementById('venta-body');
  if (!body) return;
  var bv = body.querySelector('button[onclick^="setVend"]'), fv = bv && bv.closest('.field');
  if (fv) fv.classList.add('kn-oculto');
  var et = { cobro: 'Cobro adicional al cliente (opcional)', gastos: 'Motomandado o gastos (opcional)' };
  Object.keys(et).forEach(function (id) {
    var i = document.getElementById(id), l = i && i.closest('.field') && i.closest('.field').querySelector('label');
    if (l) l.textContent = et[id];
  });
  // El aviso del paso 2 decía "10 segundos": desde la 13.1 se puede deshacer 30 minutos desde Mis ventas.
  body.querySelectorAll('p').forEach(function (pp) {
    if (pp.textContent.indexOf('Tendrás 10 segundos para deshacer') > -1)
      pp.textContent = pp.textContent.replace('Tendrás 10 segundos para deshacer.', 'Podrás deshacerla durante 30 minutos desde Mis ventas.');
  });
  knMarcarNegativo();
};
var knPintarCalcBase = pintarCalc;
pintarCalc = function () { knPintarCalcBase.apply(this, arguments); knMarcarNegativo(); };
function knMarcarNegativo() {
  var neg = typeof gananciaEst === 'function' && gananciaEst() < 0;
  var c = document.getElementById('calc'); if (c) c.classList.toggle('kn-neg', neg);
  var t = document.querySelector('#venta-body .review .total'); if (t) t.classList.toggle('kn-neg', neg);
}

/* Confirmar venta con un toque (sistema visual v3 de Codex, entrega 3). El paso de revisión ya es la comprobación;
   el botón se bloquea al primer toque (sin doble venta) y confirmarVenta lo rehabilita si el servidor la rechaza.
   Otros botones de mantener presionado (cerrar corte, en el panel) siguen igual: llaman setupHold con argumentos. */
var knSetupHoldBase = setupHold;
setupHold = function (fn, id) {
  if (fn || id) return knSetupHoldBase.apply(this, arguments);
  var b = document.getElementById('hold');
  if (!b) return;
  b.addEventListener('click', function () {
    if (b.disabled) return;
    b.disabled = true;
    buzz(20);
    confirmarVenta();
  });
};

// Mientras se registra una venta no se cierra la hoja ni se abre otra (la respuesta usa el producto en pantalla).
var knCerrarVentaBase = cerrarVenta;
cerrarVenta = function () { if (state._knReg) { toast('Registrando la venta…'); return; } return knCerrarVentaBase.apply(this, arguments); };
var knAbrirVentaBase = abrirVenta;
abrirVenta = function () { if (state._knReg) { toast('Registrando la venta…'); return; } return knAbrirVentaBase.apply(this, arguments); };

/* Venta registrada (sistema visual v3 de Codex, entrega 4). En vez de una pantalla completa con esferas, halos y la foto
   "volando", una hoja compacta sobre la Tienda con lo que importa, etiquetado por separado:
   - Confirmada por el servidor: verde. Guardada en el teléfono (sin señal): ámbar, "se enviará sola".
   - Ganancia con su signo real (sin "+" automático); negativa en rojo.
   - Ya no se cierra sola a los 10 s ni tiene cuenta regresiva: "Deshacer" sigue disponible mientras la hoja esté
     abierta, y después, 30 minutos desde Mis ventas. "Vender otro" vuelve a la búsqueda. */
celebrar = function (id, p, ventaID, pendiente, resumen) {
  var s = document.getElementById('success');
  s.className = 'success kn-v3' + (pendiente ? ' pend' : '');
  s.style.removeProperty('--tint');
  var g = resumen && resumen.ganancia != null ? Number(resumen.ganancia) : null;
  var signo = g == null ? '' : (g < 0 ? '−$' : '$') + money(Math.abs(g));
  s.innerHTML = '<div class="kn-ok" role="dialog" aria-modal="true" aria-labelledby="kn-ok-t">' +
    '<div class="kn-ok-cab"><span class="kn-ok-ic" aria-hidden="true">' + (pendiente ? '!' : '✓') + '</span>' +
    '<div><b id="kn-ok-t">' + (pendiente ? 'Venta guardada en el teléfono' : 'Venta registrada') + '</b>' +
    '<small>' + (pendiente ? 'Se enviará automáticamente cuando haya conexión' : knEsc(id || '')) + '</small></div></div>' +
    (p ? '<div class="kn-ok-prod">' + thumb(p) + '<b>' + knEsc(p.descripcion) + '</b></div>' : '') +
    (resumen ? '<div class="kn-ok-cifras">' +
      '<div><span>Cobro</span><b class="num">$' + money(resumen.precio) + '</b></div>' +
      (g != null ? '<div class="' + (g < 0 ? 'kn-neg' : 'kn-pos') + '"><span>Ganancia</span><b class="num">' + signo + '</b></div>' : '') +
      '</div>' : '') +
    (resumen && resumen.hito ? '<p class="kn-ok-hito">' + knEsc(resumen.hito) + '</p>' : '') +
    '<p class="kn-ok-nota">' + (pendiente ? 'Al enviarse aparecerá en Mis ventas; ahí podrás deshacerla durante 30 minutos.' : 'Puedes deshacerla durante 30 minutos desde Mis ventas.') + '</p>' +
    '<div class="kn-ok-acc"><button class="btn primary" onclick="cerrarExito()">Cerrar</button>' +
    '<button class="btn kn-ok-otro" onclick="knVenderOtro()">Registrar otra venta</button>' +
    '<button class="btn ghost" id="btn-undo" onclick="deshacerVenta()">Deshacer venta</button></div></div>';
  s.classList.remove('hidden');
  buzz([30, 40, 60]);
  if (p) delete p._fly;
  state._exito = { id: id, p: p, ventaID: ventaID, pendiente: pendiente, timer: null };
  var b = s.querySelector('.btn.primary'); if (b) b.focus({ preventScroll: true });
  // Cuando la hoja se oculta por cualquier ruta (Listo, Vender otro o Deshacer), el foco pasa al botón Vender (Codex).
  if (window.MutationObserver) {
    var obs = new MutationObserver(function () {
      if (!s.classList.contains('hidden')) return;
      obs.disconnect();
      var v = document.querySelector('.nav .fab');
      if (v && (!document.activeElement || document.activeElement === document.body || s.contains(document.activeElement))) v.focus({ preventScroll: true });
    });
    obs.observe(s, { attributes: true, attributeFilter: ['class'] });
  }
  // El foco no sale de la hoja con Tab (Codex).
  s.onkeydown = function (e) {
    if (e.key === 'Escape') { cerrarExito(); return; }
    if (e.key !== 'Tab') return;
    var f = [].slice.call(s.querySelectorAll('button:not([disabled])'));
    if (!f.length) return;
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  };
};
// Al cerrar "Venta registrada" el foco pasa al botón Vender (no se queda en un botón oculto). Al cerrarla, una venta
// guardada en el teléfono ya puede enviarse (enviarPendientes no la manda mientras su hoja está abierta).
var knCerrarExitoBase = cerrarExito;
cerrarExito = function () {
  var r = knCerrarExitoBase.apply(this, arguments);
  // A un botón, no al buscador: enfocar el buscador abriría el teclado del teléfono.
  var v = document.querySelector('.nav .fab');
  if (v) v.focus({ preventScroll: true });
  if (typeof enviarPendientes === 'function') setTimeout(enviarPendientes, 12500);
  return r;
};
function knVenderOtro() {
  cerrarExito();
  cambiarVista('catalogo');
  var q = document.getElementById('search');
  if (q) { q.value = ''; if (typeof renderCatalogo === 'function') renderCatalogo(); q.focus(); }
}

/* Agregar producto (sistema visual v3 de Codex, entrega 6): el formulario se agrupa en "Producto", "Precio y cantidad"
   y "Fotos" (solo presentación: los campos, sus id y guardarProducto no cambian). */
(function () {
  var h = document.getElementById('sheet-alta');
  if (!h || h.querySelector('.kn-grupo-t')) return;
  var grupo = function (el, texto, primero) {
    if (el) el.insertAdjacentHTML('beforebegin', '<div class="kn-grupo-t' + (primero ? ' kn-primero' : '') + '">' + texto + '</div>');
  };
  var desc = document.getElementById('np-desc'), costo = document.getElementById('np-costo'), foto = document.getElementById('np-foto');
  grupo(desc && desc.closest('.form-field'), 'Producto', true);
  var fila = costo && costo.closest('.form-field') && costo.closest('.form-field').parentElement;
  if (fila) { fila.classList.add('kn-precios'); grupo(fila, 'Precio y cantidad'); }
  grupo(foto && foto.closest('.form-field'), 'Fotos');
  var lf = foto && foto.closest('.form-field') && foto.closest('.form-field').querySelector('label');
  if (lf) lf.textContent = 'Hasta 4, opcional';
})();

/* Botón Atrás de Android (2026-11-14). Antes ninguna hoja agregaba una entrada al historial y Atrás sacaba de la app.
   Ahora cada hoja abierta (y "Mis ventas" / "Mi mes" dentro de Dinero) agrega una entrada: Atrás cierra lo de arriba con
   la misma función que su botón. Si se cierra con su botón, la entrada se quita. Si el cierre se rechaza (por ejemplo,
   una venta registrándose), la entrada vuelve a ponerse. */
(function () {
  if (!window.history || !history.pushState || !window.MutationObserver) return;
  var CIERRE = { 'sheet-venta': 'cerrarVenta', 'sheet-quick': 'cerrarQuick', 'sheet-usuario': 'cerrarUsuarios',
    'sheet-detalle': 'cerrarDetalle', 'sheet-exp': 'cerrarExp', 'sheet-alta': 'cerrarAlta', 'sheet-meta': 'cerrarMeta',
    'sheet-outbox': 'cerrarOutbox', 'sheet-corte': 'cerrarCorteSheet', 'sheet-cerrar': 'cerrarCerrar', 'sheet-cats': 'cerrarCats',
    'sheet-analisis': 'cerrarAnalisis', 'success': 'cerrarExito', 'view-ventas': 'knResumen' };
  var pila = [], ignorar = 0;
  var abierta = function (el) {
    if (!el) return false;
    if (el.id === 'view-ventas') return el.classList.contains('kn-lista') || el.classList.contains('kn-mes');
    return !el.classList.contains('hidden');
  };
  var cerrar = function (el) {
    var f = window[CIERRE[el.id]];
    if (typeof f === 'function') f(); else el.classList.add('hidden');
  };
  var cambio = function (el) {
    var i = pila.indexOf(el.id);
    if (abierta(el) && i < 0) { pila.push(el.id); history.pushState({ kn: el.id }, ''); }
    else if (!abierta(el) && i > -1) { pila.splice(i, 1); ignorar++; history.back(); }
  };
  window.addEventListener('popstate', function (e) {
    if (ignorar > 0) { ignorar--; return; }
    var id = pila.pop();
    // Entrada que quedó de antes de recargar (Codex): no hay hoja que cerrar; se sigue retrocediendo hasta una propia.
    if (!id) { if (e.state && e.state.kn) history.back(); return; }
    var el = document.getElementById(id);
    if (!abierta(el)) return;
    cerrar(el);
    if (abierta(el)) { pila.push(id); history.pushState({ kn: id }, ''); }   // el cierre se rechazó
  });
  var vigilar = function (el) {
    if (!el || el.dataset.knAtras) return;
    el.dataset.knAtras = '1';
    new MutationObserver(function () { cambio(el); }).observe(el, { attributes: true, attributeFilter: ['class'] });
  };
  Object.keys(CIERRE).forEach(function (id) { vigilar(document.getElementById(id)); });
  vigilar(document.getElementById('sheet-color'));
  // sheet-color la crea venta-colores.js; si aparece después, también se vigila.
  new MutationObserver(function () { vigilar(document.getElementById('sheet-color')); }).observe(document.body, { childList: true });
  CIERRE['sheet-color'] = '';
  // Si se recargó con una hoja abierta, el historial conserva su entrada: se regresa a la página sin hojas.
  if (history.state && history.state.kn) history.back();
})();
