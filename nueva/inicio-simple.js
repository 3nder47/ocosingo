/* Inicio más simple (Alex, 2026-11-14; propuesta de Codex en el cerebro: kiosko-ui-propuesta-codex.md).
   Solo versión nueva: se carga después de app.js y reemplaza cómo se pinta la pestaña Dinero. La app vieja no cambia.

   Alex:  "Irene te debe" · "Tu ganancia de <mes>" · "Mis ventas".
   Irene: "Tu ganancia de <mes>" · racha (solo si existe) · "Por entregar a Alex" · "Mis ventas".
   Fuera del inicio: metas, logros, "Lo que ganan ellas", comparación de meses, gráfica, cortes y la lista larga
   (va a "Ver ventas"). Cerrar cortes, registrar pagos y dar de alta pedidos quedan en el panel de PC; en el celular
   la cuenta se consulta. Los datos (metas guardadas, etc.) no se borran: solo dejan de mostrarse.

   Las funciones de abajo son declaraciones globales: al cargarse después de app.js sustituyen a las de app.js, y
   app.js las llama por nombre (cargarDinero → renderDinero, misVentas → renderLogros, …). */

(function () {
  var st = document.createElement('style');
  st.textContent =
    '#view-ventas .kn-bloque{padding:18px 4px 6px}' +
    '#view-ventas .kn-bloque+.kn-bloque{border-top:1px solid var(--line,rgba(127,127,127,.18))}' +
    '#view-ventas .kn-k{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px;font-weight:600;opacity:.8}' +
    '#view-ventas .kn-v{font-size:34px;font-weight:700;letter-spacing:-.5px;margin-top:4px;font-variant-numeric:tabular-nums}' +
    '#view-ventas .kn-q{width:32px;height:32px;border-radius:50%;border:1px solid currentColor;background:none;color:inherit;' +
    'font:inherit;font-size:15px;font-weight:700;opacity:.55;display:flex;align-items:center;justify-content:center;padding:0}' +
    '#view-ventas .kn-ir{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:10px;' +
    'padding:12px 2px;background:none;border:0;color:inherit;font:inherit;font-size:16px;font-weight:600;text-align:left}' +
    '#view-ventas .kn-ir svg,#view-ventas .kn-volver svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.6}' +
    '#view-ventas .kn-racha{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:15px;font-weight:600;color:var(--green,#1D9E75)}' +
    '#view-ventas .kn-racha svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}' +
    '#view-ventas .kn-nota{font-size:13px;opacity:.65;margin-top:4px}' +
    '#view-ventas .kn-volver{display:flex;align-items:center;gap:6px;background:none;border:0;color:inherit;font:inherit;font-size:16px;font-weight:600;padding:14px 2px}' +
    '#view-ventas:not(.kn-lista) .kn-solo-lista{display:none!important}' +
    '#view-ventas.kn-lista .kn-solo-resumen{display:none!important}' +
    '#cortes-wrap,#neg-wrap,#logros,#mes-wrap{display:none!important}' +
    '.kn-panel-nota{font-size:13px;opacity:.7;text-align:center;margin:10px 0 4px}' +
    '@media (prefers-reduced-motion:no-preference){#view-ventas.kn-entra>*{animation:knEntra .18s ease-out}}' +
    '@keyframes knEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}' +
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

  // La ayuda de la ganancia de Alex ya no habla de la meta.
  if (typeof EXPLICA === 'object' && EXPLICA.gMesAlex)
    EXPLICA.gMesAlex.p = 'Lo que <b>tú</b> has ganado este mes con tus propias ventas: precio + extra − costo − moto.';
})();

var KN_CHEV = '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
var KN_RACHA = '<svg viewBox="0 0 24 24"><path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5 0 1.5 1 2.5 2 2.5-1-3 0-5 1-8z"/></svg>';

function knBloque(titulo, ayuda, idValor, accion) {
  return '<div class="kn-bloque">' +
    '<div class="kn-k"><span>' + titulo + '</span><button class="kn-q" aria-label="¿Qué es ' + titulo + '?" onclick="explicar(\'' + ayuda + '\')">?</button></div>' +
    '<div class="kn-v num" id="' + idValor + '">…</div>' +
    (accion || '') + '</div>';
}
function knIr(texto, onclick, extra) {
  return '<button class="kn-ir" onclick="' + onclick + '"><span>' + texto + '</span>' + KN_CHEV + '</button>' + (extra || '');
}
function knVerVentas() {
  buzz();
  var v = document.getElementById('view-ventas');
  v.classList.add('kn-lista'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}
function knResumen() {
  var v = document.getElementById('view-ventas');
  if (!v.classList.contains('kn-lista')) return;
  buzz();
  v.classList.remove('kn-lista'); v.classList.remove('kn-entra'); void v.offsetWidth; v.classList.add('kn-entra');
  window.scrollTo({ top: 0 });
}

function armarDinero() {
  var esIrene = state.usuario === 'Irene', mes = mesActualNombre();
  var ventas = '<div class="kn-bloque"><div class="kn-k"><span>Mis ventas</span></div>' + knIr('Ver ventas', 'knVerVentas()') + '</div>';
  var cuenta = esIrene
    ? knBloque('Por entregar a Alex', 'hero', 'h-val', knIr('Ver cuenta', "abrirDetalle('transferencia')"))
    : knBloque(state.usuario === 'Alex' ? 'Irene te debe' : 'Le deben a Alex', 'hero', 'h-val', knIr('Ver cuenta', "abrirDetalle('transferencia')"));
  var ganancia = knBloque('Tu ganancia de ' + mes, esIrene ? 'negocio' : 'gMesAlex', 'v-gmes',
    esIrene ? '<div id="kn-racha"></div>' : '');
  // id="hero" se conserva: app.js le pone la animación de "se actualizó".
  document.getElementById('dinero-hero').innerHTML = '<div id="hero">' + (esIrene ? ganancia + cuenta : cuenta + ganancia) + ventas + '</div>';
  document.getElementById('dinero-cuenta').innerHTML = '';
  document.getElementById('mes-wrap').innerHTML = '';
}

function renderDinero(d, meses, m) {
  // También se rearma si un error de red dejó el aviso "No se pudo cargar" en lugar de los bloques.
  if (state._dinArmado !== state.usuario || !document.getElementById('h-val')) { armarDinero(); state._dinArmado = state.usuario; }
  state._dash = d; state._meses = meses;
  var $ = function (id) { return document.getElementById(id); };
  var esIrene = state.usuario === 'Irene', falla = state._extrasFalla;
  tick($('h-val'), d.porTransferir);
  var g = $('v-gmes');
  if (esIrene) {
    var o = state.operacion;
    if (o) tick(g, o.gMesTotal || 0); else g.textContent = falla ? '—' : '…';
    var im = state.impulso || {}, r = im.racha || 0, w = $('kn-racha');
    // Codex: el aviso de que no se actualizó va siempre que falle, aunque haya una cifra anterior o una racha.
    if (w) w.innerHTML = (falla ? '<div class="kn-nota">' + (o ? 'Sin actualizar' : 'No se pudo actualizar') + ' · desliza hacia abajo para reintentar</div>' : '') +
      (r >= 2 ? '<div class="kn-racha">' + KN_RACHA + (im.rachaUnidad === 'semanas' ? r + ' semanas seguidas con ventas' : r + ' días seguidos con ventas') + '</div>' : '');
  } else {
    if (state.impulso) tick(g, state.impulso.gananciaMes || 0); else g.textContent = falla ? '—' : '…';
  }
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
