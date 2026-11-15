/* Calcular (Kiosko 14.4, 2026-11-14). Un solo cálculo y una sola tarjeta de resultado para el teléfono (index.html) y
   el panel de PC (analisis.html), con el orden que eligió Alex (maqueta kiosko-calcular-propuesta.html):
     1 · Cuánto cuesta traerlo: precio + impuestos (sin envío de compra: cada plataforma lo cobra distinto). Cifra grande.
     2 · Si es rentable al precio de la competencia: verde rentable, ámbar margen bajo, rojo pérdida.
   Fórmulas = las del teléfono (app.js, calcPinta), que ya eran las de siempre:
     cuesta = round(precio × factor) · mínimo = cuesta + moto − cobro de envío · sugerido = cuesta × 2 redondeado a 10
     ganancia = venta + cobro de envío − cuesta − moto
   La PC calculaba distinto (moto 25 "absorbida" + cobro de envío: la ganancia salía $10 más alta); ahora usa estas.
   Solo página: no toca el Worker. */
var KCalc = (function () {
  'use strict';
  // Margen mínimo para "rentable" (ganancia ÷ precio de la competencia). Supuesto de Claude aprobado con la maqueta
  // (2026-11-14); el histórico del negocio ronda 38 %. Alex lo puede cambiar: es esta sola línea.
  var MARGEN_MIN = 0.25;

  var mx = function (n) { var v = Math.round(Number(n) || 0); return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('es-MX'); };
  var num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(/,(?=\d{3}\b)/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  var ver = function (el, si) { if (el) el.style.display = si ? '' : 'none'; };
  var visible = function (el) { return !!el && el.style.display !== 'none'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  function cuenta(o) {
    var p = num(o.precio), f = num(o.factor) >= 1 ? num(o.factor) : 1, moto = num(o.moto), cobro = num(o.cobro);
    var pz = Math.max(1, Math.round(num(o.piezas)) || 1), comp = num(o.comp), propio = num(o.propio);
    if (!(p > 0)) return null;
    var cuesta = Math.round(p * f), imp = cuesta - Math.round(p), piso = cuesta + moto - cobro;
    var sug = Math.ceil(cuesta * 2 / 10) * 10, vende = propio > 0 ? propio : sug;
    var r = { p: p, f: f, pz: pz, moto: moto, cobro: cobro, cuesta: cuesta, imp: imp, piso: piso, sug: sug, vende: vende,
      propio: propio > 0 && propio !== sug, gana: vende + cobro - cuesta - moto, comp: comp > 0 ? comp : 0 };
    if (r.comp) {
      r.gc = r.comp + cobro - cuesta - moto;
      r.mg = Math.floor(r.gc / r.comp * 100);
      r.estado = r.gc <= 0 ? 'mal' : r.gc / r.comp < MARGEN_MIN ? 'meh' : 'ok';
    }
    return r;
  }

  function veredicto(r) {
    if (!r.comp) return '';
    var t = { ok: 'Rentable al precio de la competencia', meh: 'Margen bajo al precio de la competencia',
      mal: 'No es rentable al precio de la competencia' }[r.estado];
    var g = r.gc < 0 ? 'Pérdida: ' + mx(-r.gc) + ' <small>por pieza</small>'
      : r.gc === 0 ? 'Sin ganancia' : 'Ganancia: ' + mx(r.gc) + ' <small>por pieza · ' + r.mg + ' %</small>';
    return '<div class="kc-ver kc-' + r.estado + '" role="status"><div class="kc-t">' + t + ' (' + mx(r.comp) + ')</div><div class="kc-g">' + g + '</div></div>';
  }

  // Tarjeta de resultado. conPrecio: el teléfono deja escribir un precio de venta propio dentro del desglose.
  function tarjeta(r, abierto, conPrecio) {
    var nota = (r.imp > 0 ? 'Precio e impuestos incluidos.' : 'Sin impuestos adicionales.') + ' Envío de compra no incluido.';
    var h = '<div class="kc-res">' +
      '<div class="kc-lb">Costo aproximado</div>' +
      '<div class="kc-big">' + mx(r.cuesta) + ' <small>por pieza</small></div>' +
      '<div class="kc-nota">' + nota + (r.pz > 1 ? ' ' + r.pz + ' piezas: ' + mx(r.cuesta * r.pz) + '.' : '') + '</div>' +
      veredicto(r) +
      '<div class="kc-lin' + (r.comp ? ' kc-sec' : '') + '"><span data-k="et-v">' + (r.propio ? 'Precio de venta' : 'Precio sugerido') +
        '</span><b data-k="vende-lin">' + mx(r.vende) + ' · ganancia: ' + mx(r.gana) + '</b></div>' +
      '<div class="kc-lin kc-sec"><span>Precio mínimo</span><b>' + mx(r.piso) + '</b></div>' +
      '<button type="button" class="kc-desg-btn' + (abierto ? ' abierto' : '') + '" data-ctap="1" aria-expanded="' + (abierto ? 'true' : 'false') + '">' +
        (abierto ? 'Ocultar desglose' : 'Ver desglose') + '</button>' +
      '<div class="kc-desg">' +
        '<div class="kc-d"><span>Precio en la plataforma</span><b>' + mx(r.p) + '</b></div>' +
        '<div class="kc-d"><span>Impuestos · factor ' + r.f.toFixed(2) + '</span><b>+' + mx(r.imp) + '</b></div>' +
        '<div class="kc-d kc-tot"><span>Costo aproximado</span><b>' + mx(r.cuesta) + '</b></div>' +
        (conPrecio
          ? '<div class="kc-d kc-pv"><span class="kc-pv-et">Precio de venta' + (r.propio ? ' <button type="button" class="kc-volver" data-sug="' + r.sug + '">Usar precio sugerido</button>' : '') +
            '</span><span class="kc-pv-in">$<input data-c="v" type="text" inputmode="decimal" value="' + r.vende + '" aria-label="Precio de venta"></span></div>'
          : '<div class="kc-d"><span>Precio de venta (sugerido)</span><b>' + mx(r.vende) + '</b></div>') +
        '<div class="kc-d"><span>Cobro de envío al cliente</span><b>+' + mx(r.cobro) + '</b></div>' +
        '<div class="kc-d"><span>Costo</span><b>−' + mx(r.cuesta) + '</b></div>' +
        '<div class="kc-d"><span>Motomandado</span><b>−' + mx(r.moto) + '</b></div>' +
        '<div class="kc-d kc-tot"><span>Ganancia por pieza</span><b data-k="gana-d">' + mx(r.gana) + '</b></div>' +
        '<div class="kc-f">Precio mínimo = costo + motomandado − cobro de envío: ' + mx(r.cuesta) + ' + ' + mx(r.moto) + ' − ' + mx(r.cobro) + ' = ' + mx(r.piso) + '.</div>' +
      '</div></div>';
    return h;
  }

  var CSS = [
    '.kc-res{background:var(--kn-surface);border:1px solid var(--kn-divider);border-radius:24px;padding:18px 18px 8px;margin-top:14px;color:var(--kn-text)}',
    '.kc-lb{font-size:.875rem;font-weight:650;color:var(--kn-muted)}',
    '.kc-big{font-size:2.75rem;font-weight:750;letter-spacing:-.03em;line-height:1.05;margin:2px 0;font-variant-numeric:tabular-nums}',
    '.kc-big small{font-size:1rem;font-weight:600;color:var(--kn-muted);letter-spacing:0}',
    '.kc-nota{font-size:.8125rem;color:var(--kn-muted)}',
    '.kc-ver{border-radius:16px;padding:12px 14px;margin-top:14px}',
    '.kc-ver .kc-t{font-weight:750;font-size:.9375rem}',
    '.kc-ver .kc-g{font-size:1.625rem;font-weight:750;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:2px}',
    '.kc-ver .kc-g small{font-size:.875rem;font-weight:650}',
    '.kc-ok{background:var(--kn-positive-bg);color:var(--kn-positive)}',
    '.kc-meh{background:var(--kn-warning-bg);color:var(--kn-warning)}',
    '.kc-mal{background:var(--kn-danger-bg);color:var(--kn-danger)}',
    '.kc-lin{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--kn-divider);font-size:.9375rem}',
    '.kc-lin:first-of-type{margin-top:12px}',
    '.kc-ver+.kc-lin{margin-top:12px}',
    '.kc-lin b{font-variant-numeric:tabular-nums;text-align:right}',
    '.kc-sec{color:var(--kn-muted)}',
    '.kc-desg-btn{display:block;width:100%;text-align:left;background:none;border:0;border-top:1px solid var(--kn-divider);color:var(--kn-action);font:650 .9375rem/1.2 inherit;font-family:inherit;padding:13px 0;min-height:48px;cursor:pointer}',
    '.kc-desg{display:none;padding:2px 0 10px}',
    '.kc-desg-btn.abierto+.kc-desg{display:block}',
    '.kc-d{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:7px 0;font-size:.9375rem}',
    '.kc-d b{font-variant-numeric:tabular-nums}',
    '.kc-d.kc-tot{border-top:1px solid var(--kn-divider);font-weight:700;padding-top:9px}',
    '.kc-pv{margin-top:8px}',
    '.kc-pv-in{display:inline-flex;align-items:center;gap:4px;font-weight:700}',
    // Dentro de la tarjeta del teléfono, los campos grandes (.calc-card input) tienen reglas fuertes: aquí se acotan.
    '.kc-pv-et{text-transform:none!important;letter-spacing:0!important;font-size:.9375rem!important;color:var(--kn-text)!important}',
    '.calc-card .kc-pv-in input,.kc-pv-in input{width:6.5em!important;flex:none!important;text-align:right;font:700 1rem/1.2 inherit!important;font-family:inherit!important;color:var(--kn-text)!important;background:var(--kn-surface)!important;border:1px solid var(--kn-control-border)!important;border-radius:12px!important;padding:8px 12px!important;min-height:44px!important;box-shadow:none!important}',
    '.calc-card .kc-pv-in input:focus,.kc-pv-in input:focus{outline:2px solid var(--kn-focus)!important;outline-offset:1px;border-color:var(--kn-focus)!important}',
    '.kc-volver{background:none;border:0;color:var(--kn-action);font:600 .8125rem/1 inherit;font-family:inherit;padding:0 4px 0 8px;min-height:44px;min-width:44px;cursor:pointer}',
    '.kc-f{font-size:.8125rem;color:var(--kn-muted);margin-top:6px}',
    '.kc-aj{display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%;background:var(--kn-surface);border:1px solid var(--kn-divider);border-radius:16px;padding:13px 14px;margin-top:12px;font:inherit;color:var(--kn-text);text-align:left;min-height:48px;cursor:pointer}',
    '.kc-aj span{color:var(--kn-muted);font-size:.9375rem}.kc-aj b{font-size:.9375rem;color:var(--kn-action)}',
    '.kc-total{background:var(--kn-tono);border-radius:24px;padding:16px 18px;margin-top:14px}',
    '.kc-total .kc-big{font-size:2rem}',
    '.kc-vacio{color:var(--kn-muted);padding:14px 4px}',
    '@media (prefers-reduced-motion:reduce){.kc-desg-btn{transition:none}}',
  ].join('\n');
  function estilos() {
    if (document.getElementById('kc-css')) return;
    var s = document.createElement('style'); s.id = 'kc-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------- Teléfono: sustituye cFila, calcPinta y cSoloVenta de app.js (mismos datos: cFilas, mismos campos) ---------- */
  function telefono() {
    if (typeof calcPinta !== 'function' || typeof cFilas === 'undefined') return;
    estilos();
    var abiertos = {};
    var val = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
    var datos = function (d) {
      return cuenta({ precio: d.p, piezas: d.n, comp: d.c, propio: d.v, factor: val('c-origen'), moto: val('c-moto'), cobro: val('c-cobro') });
    };
    // Un solo título ("Calcular", arriba); el de la sección y su instrucción sobran.
    var cab = document.querySelector('#view-calc .calc-head'); ver(cab, false);
    // Moto y cobro de envío, plegados: una fila con sus valores que abre los campos.
    var aj = document.querySelector('#view-calc .calc-ajustes');
    if (aj && !document.getElementById('kc-aj')) {
      ver(aj, false);
      var b = document.createElement('button');
      b.type = 'button'; b.id = 'kc-aj'; b.className = 'kc-aj'; b.setAttribute('aria-expanded', 'false');
      b.addEventListener('click', function () { ver(aj, !visible(aj)); b.setAttribute('aria-expanded', String(visible(aj))); pintarAj(); });
      aj.parentNode.insertBefore(b, aj);
    }
    function pintarAj() {
      var b = document.getElementById('kc-aj'); if (!b) return;
      b.innerHTML = '<span>Motomandado ' + mx(num(val('c-moto'))) + ' · Cobro de envío ' + mx(num(val('c-cobro'))) + '</span><b>' +
        (visible(aj) ? 'Ocultar ajustes' : 'Ajustar') + '</b>';
    }

    cFila = function (f, i) {
      return '<article class="calc-card" data-i="' + i + '">' +
        '<div class="calc-cab"><span>Producto ' + (i + 1) + '</span>' + (cFilas.length > 1 ? '<button class="calc-x" data-q="' + i + '" aria-label="Quitar producto ' + (i + 1) + '">&times;</button>' : '') + '</div>' +
        '<div class="calc-duo">' +
          '<label><span>Precio por pieza</span><span class="money"><i>$</i><input data-c="p" type="text" inputmode="decimal" placeholder="Ej. 120" value="' + esc(f.p) + '"></span></label>' +
          '<label><span>Piezas</span><input data-c="n" type="number" inputmode="numeric" min="1" step="1" value="' + esc(f.n) + '"></label>' +
        '</div>' +
        '<label><span>Precio de la competencia</span><span class="money"><i>$</i><input data-c="c" type="text" inputmode="decimal" placeholder="Opcional" value="' + esc(f.c) + '"></span></label>' +
        '<div class="calc-res"></div></article>';
    };

    calcPinta = function () {
      var out = document.getElementById('c-out'); if (!out) return;
      pintarAj();
      var con = 0, total = 0, costoTot = 0;
      document.querySelectorAll('#c-lista .calc-card').forEach(function (el) {
        var i = +el.dataset.i, d = cFilas[i], caja = el.querySelector('.calc-res');
        var bt = caja.querySelector('.kc-desg-btn'); if (bt) abiertos[i] = bt.classList.contains('abierto');
        var r = d && datos(d);
        if (!r) { caja.innerHTML = ''; return; }
        con++; total += r.p * r.pz; costoTot += r.cuesta * r.pz;
        caja.innerHTML = tarjeta(r, !!abiertos[i], true);
      });
      if (!con) { out.innerHTML = '<p class="kc-vacio">Escribe el precio por pieza para estimar el costo.</p>'; return; }
      // El total del pedido solo cuando hay 2 o más productos: con uno, repetiría el costo de arriba.
      out.innerHTML = con > 1 ? '<div class="kc-total"><div class="kc-lb">Costo aproximado del pedido</div><div class="kc-big">' +
        mx(costoTot) + '</div><div class="kc-nota">' + mx(total) + ' en productos + ' + mx(costoTot - Math.round(total)) +
        ' de impuestos. Envío de compra no incluido.</div></div>' : '';
    };

    // El precio de venta propio se escribe dentro del desglose: se actualizan las cifras en su lugar, sin redibujar
    // (redibujar quita el foco y en el teléfono solo se podría escribir un dígito).
    cSoloVenta = function (el, i) {
      var r = datos(cFilas[i]); if (!r) return;
      var a = el.querySelector('[data-k="vende-lin"]'); if (a) a.textContent = mx(r.vende) + ' · ganancia: ' + mx(r.gana);
      var g = el.querySelector('[data-k="gana-d"]'); if (g) g.textContent = mx(r.gana);
      var e = el.querySelector('[data-k="et-v"]'); if (e) e.textContent = r.propio ? 'Precio de venta' : 'Precio sugerido';
      var et = el.querySelector('.kc-pv-et'), vb = et && et.querySelector('.kc-volver');
      if (et && r.propio && !vb) et.insertAdjacentHTML('beforeend', ' <button type="button" class="kc-volver" data-sug="' + r.sug + '">Usar precio sugerido</button>');
      else if (vb && !r.propio) vb.remove();
      else if (vb) vb.setAttribute('data-sug', r.sug);
    };

    // El botón del desglose: app.js le cambia la clase "abierto" (data-ctap); aquí solo el texto y aria-expanded.
    var lista = document.getElementById('c-lista');
    if (lista && !lista.dataset.kc) {
      lista.dataset.kc = '1';
      lista.addEventListener('click', function (e) {
        var q = e.target.closest('[data-q]');
        if (q) {   // corre antes que app.js (que quita el renglón): los de abajo suben un lugar
          var k = +q.dataset.q, nuevo = {};
          Object.keys(abiertos).forEach(function (j) { j = +j; if (j < k) nuevo[j] = abiertos[j]; else if (j > k) nuevo[j - 1] = abiertos[j]; });
          abiertos = nuevo; return;
        }
        var sg = e.target.closest('[data-sug]');
        if (sg) { var ci = +sg.closest('.calc-card').dataset.i; setTimeout(function () {   // el foco vuelve al precio de venta
          var inp = document.querySelector('#c-lista .calc-card[data-i="' + ci + '"] [data-c="v"]'); if (inp) inp.focus(); }, 0); return; }
        var t = e.target.closest('.kc-desg-btn'); if (!t) return;
        setTimeout(function () {
          var on = t.classList.contains('abierto');
          t.textContent = on ? 'Ocultar desglose' : 'Ver desglose'; t.setAttribute('aria-expanded', String(on));
          var i = +t.closest('.calc-card').dataset.i; abiertos[i] = on;
        }, 0);
      });
    }
    ['c-moto', 'c-cobro'].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener('input', pintarAj); });
    var lim = document.getElementById('c-limpiar'); if (lim) lim.addEventListener('click', function () { abiertos = {}; }, true);
    if (document.querySelector('#c-lista .calc-card')) { cPintaFilas(); calcPinta(); }
  }

  /* ---------- PC: la sección Calcular del panel. El formulario viejo queda oculto (su código sigue corriendo sin que se
     vea); este arma el mismo orden que el teléfono, para un producto, más el aviso de la categoría. ---------- */
  function pc() {
    var sec = document.getElementById('p-conviene'); if (!sec) return;
    var card = sec.querySelector('.card'); if (!card || document.getElementById('kc-pc')) return;
    estilos();
    var viejo = card.querySelector('.form'), salida = document.getElementById('sim-out');
    ver(viejo, false); ver(salida, false);
    card.classList.add('kc-pc-card');
    var w = document.createElement('div'); w.id = 'kc-pc';
    w.innerHTML =
      '<div class="kc-pc-grid"><div class="kc-pc-campos">' +
        '<label class="campo"><span>Origen</span><select id="kc-origen">' +
          '<option value="1.33">China (Temu, AliExpress, TikTok, Shopee)</option>' +
          '<option value="1.00">México (Temu local, Mercado Libre)</option></select></label>' +
        '<div class="kc-pc-duo"><label class="campo"><span>Precio por pieza</span><span class="money"><i>$</i><input id="kc-p" type="text" inputmode="decimal" placeholder="Ej. 120"></span></label>' +
        '<label class="campo"><span>Piezas</span><input id="kc-n" type="number" inputmode="numeric" min="1" step="1" value="1"></label></div>' +
        '<label class="campo"><span>Precio de la competencia</span><span class="money"><i>$</i><input id="kc-c" type="text" inputmode="decimal" placeholder="Opcional"></span></label>' +
        '<label class="campo"><span>Categoría</span><select id="kc-cat"><option value="">Sin seleccionar</option></select></label>' +
        '<button type="button" class="kc-aj" id="kc-pc-aj" aria-expanded="false"></button>' +
        '<div class="kc-pc-ajustes" id="kc-pc-ajustes" style="display:none">' +
          '<label class="campo"><span>Factor</span><span class="money"><i>×</i><input id="kc-f" type="text" inputmode="decimal" value="1.33"></span></label>' +
          '<label class="campo"><span>Motomandado</span><span class="money"><i>$</i><input id="kc-moto" type="text" inputmode="decimal" value="35"></span></label>' +
          '<label class="campo"><span>Cobro de envío al cliente</span><span class="money"><i>$</i><input id="kc-cobro" type="text" inputmode="decimal" value="10"></span></label>' +
        '</div>' +
      '</div><div class="kc-pc-res" id="kc-pc-res" aria-live="polite"></div></div>';
    card.insertBefore(w, card.firstChild);
    var $ = function (id) { return document.getElementById(id); };
    var abierto = false;
    var css = document.createElement('style');
    css.textContent = '.kc-pc-card{padding:22px}.kc-pc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:24px;align-items:start}' +
      '@media (max-width:1000px){.kc-pc-grid{grid-template-columns:1fr}}.kc-pc-campos .campo{display:block;margin-bottom:12px}' +
      '.kc-pc-campos .campo>span:first-child{display:block;margin-bottom:6px}.kc-pc-campos .money input{min-height:44px}.kc-pc-campos select,.kc-pc-campos input{width:100%}' +
      '.kc-pc-duo{display:grid;grid-template-columns:1.4fr 1fr;gap:12px}.kc-pc-ajustes{margin-top:12px}.kc-pc-res .kc-res{margin-top:0}' +
      '.kc-cat{border-radius:16px;padding:12px 14px;margin-top:12px;font-size:.9375rem}';
    document.head.appendChild(css);
    function pintarAj() {
      $('kc-pc-aj').innerHTML = '<span>Factor ×' + (num($('kc-f').value) || 1).toFixed(2) + ' · Motomandado ' + mx(num($('kc-moto').value)) +
        ' · Cobro de envío ' + mx(num($('kc-cobro').value)) + '</span><b>' + (visible($('kc-pc-ajustes')) ? 'Ocultar ajustes' : 'Ajustar') + '</b>';
    }
    var firmaCat = '';
    function categorias() {
      var sel = $('kc-cat'), rot = (window.KIOSKO && KIOSKO.rotacion) ? KIOSKO.rotacion() : [];
      var firma = rot.map(function (x) { return x.categoria; }).join('|');
      if (firma === firmaCat) return rot;
      firmaCat = firma;
      var antes = sel.value;
      sel.innerHTML = '<option value="">Sin seleccionar</option>' + rot.map(function (x) { return '<option>' + esc(x.categoria) + '</option>'; }).join('');
      sel.value = rot.some(function (x) { return x.categoria === antes; }) ? antes : '';
      return rot;
    }
    var dias = function (d) { d = Math.round(Number(d) || 0); return d < 1 ? 'menos de un día' : d === 1 ? '1 día' : d + ' días'; };
    var entero = function (n) { n = Math.round(Number(n) || 0); return n; };
    function pintar() {
      pintarAj();
      var rot = categorias();
      var r = cuenta({ precio: $('kc-p').value, piezas: $('kc-n').value, comp: $('kc-c').value, factor: $('kc-f').value,
        moto: $('kc-moto').value, cobro: $('kc-cobro').value });
      var out = $('kc-pc-res');
      if (!r) { out.innerHTML = '<p class="kc-vacio">Escribe el precio por pieza para estimar el costo.</p>'; return; }
      var bt = out.querySelector('.kc-desg-btn'); if (bt) abierto = bt.classList.contains('abierto');
      var h = tarjeta(r, abierto, false);
      // Aviso de la categoría (lo que ya había en la PC): si lo que ya tienes de esa categoría no se mueve.
      var cat = $('kc-cat').value, c = null;
      rot.forEach(function (x) { if (x.categoria === cat) c = x; });
      if (c) {
        var lento = c.piezas > 0 && c.ventas >= 3 && c.diasStock > c.diasVenta * 2;
        var pzc = entero(c.piezas);
        h += '<div class="kc-cat ' + (lento ? 'kc-meh' : 'kc-ok') + '"><b>' + esc(cat) + '.</b> Venta promedio: ' + dias(c.diasVenta) + ' por pieza. ' +
          (pzc ? 'Existencias: ' + pzc + (pzc === 1 ? ' pieza' : ' piezas') + '. Antigüedad promedio: ' + dias(c.diasStock) + '.' : 'Sin existencias.') +
          (lento ? ' La categoría presenta baja rotación.' : '') + '</div>';
      }
      out.innerHTML = h;
    }
    $('kc-origen').addEventListener('change', function () { $('kc-f').value = this.value; pintar(); });
    ['kc-p', 'kc-n', 'kc-c', 'kc-f', 'kc-moto', 'kc-cobro'].forEach(function (id) { $(id).addEventListener('input', pintar); });
    $('kc-cat').addEventListener('change', pintar);
    ['focus', 'mousedown'].forEach(function (ev) { $('kc-cat').addEventListener(ev, function () { categorias(); }); });
    $('kc-pc-aj').addEventListener('click', function () {
      var a = $('kc-pc-ajustes'); ver(a, !visible(a)); this.setAttribute('aria-expanded', String(visible(a))); pintarAj();
    });
    $('kc-pc-res').addEventListener('click', function (e) {
      var t = e.target.closest('.kc-desg-btn'); if (!t) return;
      abierto = !t.classList.contains('abierto');
      t.classList.toggle('abierto', abierto); t.textContent = abierto ? 'Ocultar desglose' : 'Ver desglose'; t.setAttribute('aria-expanded', String(abierto));
    });
    // Las categorías llegan con los datos del panel: se vuelven a leer al entrar a la sección.
    document.addEventListener('click', function (e) { if (e.target.closest('[data-p="conviene"]')) setTimeout(pintar, 0); });
    pintar();
  }

  function iniciar() { if (document.getElementById('p-conviene')) pc(); else telefono(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  return { cuenta: cuenta, MARGEN_MIN: MARGEN_MIN };
})();
