/* Kiosko · Alta de pedido más clara (Alex, 2026-11-13: "para una persona ajena no es intuitivo").
   Lo que pasó con las 24 mesas: puso el total en el campo grande de arriba y el alta no avanzaba porque faltaba
   "Precio después de promociones, por pieza", cuyo ejemplo "105.00" parecía un dato ya puesto, y el botón gris no
   decía qué faltaba. Cambios (solo en nueva/):
   1. Pasos en el orden en que se piensa: ① qué compraste (renglones) y ② cuánto se cobró a tu tarjeta (abajo).
   2. Ejemplos que se ven como ejemplos ("Ej. 105", tenues) y textos claros.
   3. "Dar de alta" siempre se puede tocar: si falta algo, lo marca en rojo, dice qué es y lleva a ese campo.
   4. Con UN solo producto, el precio por pieza sale solo (total ÷ piezas): con un producto el costo real es
      exactamente eso. Si se escribe a mano, se respeta. Con dos o más productos se pide en cada uno.
   armar-nueva.py lo copia a ocosingo/nueva/ y pone los ganchos en el alta de analisis.html. */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K) return;
  var $ = function (id) { return document.getElementById(id); };
  var num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
  var filas = function () { return K.alta && K.alta.filas ? K.alta.filas() : []; };

  var css = document.createElement('style');
  css.textContent = [
    '#p-alta input::placeholder{opacity:.4;font-style:italic}',
    '#p-alta .falta{outline:2px solid var(--rojo,#d1342f);outline-offset:2px;border-radius:var(--r-sm,8px)}',
    '#p-alta .falta-msg{color:var(--rojo-ink,#b42318);font-weight:700;font-size:13px;margin-top:4px}',
    '#p-alta .paso{display:flex;align-items:center;gap:10px;margin:26px 0 4px}',
    '#p-alta .paso:first-of-type{margin-top:8px}',
    '#p-alta .paso b{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--verde,#1D9E75);color:#fff;font-size:14px;flex:none}',
    '#p-alta .paso h2{margin:0}',
    '#p-alta .auto-nota{color:var(--verde-ink,#0B6B4D);font-weight:600}',
    '#b-alta.incompleto{opacity:.75}',
  ].join('\n');
  document.head.appendChild(css);

  // ---- 1. Pasos y orden: el total de la tarjeta va DESPUÉS de los productos ----
  (function ordenar() {
    var cuerpo = $('alta-cuerpo'), agregar = $('agregar'), hero = cuerpo && cuerpo.querySelector('.hero');
    var h2 = cuerpo && cuerpo.querySelector('h2');
    if (!cuerpo || !agregar || !hero || !h2) return;
    var p1 = document.createElement('div');
    p1.className = 'paso'; p1.innerHTML = '<b>1</b><h2>Qué compraste</h2>';
    h2.parentNode.replaceChild(p1, h2);
    var p2 = document.createElement('div');
    p2.className = 'paso'; p2.innerHTML = '<b>2</b><h2>Cuánto se cobró a tu tarjeta</h2>';
    var ayuda = document.createElement('p');
    ayuda.className = 'tenue'; ayuda.style.margin = '0 0 12px';
    ayuda.textContent = 'El total del cargo de todo el pedido, con envío e impuestos. La diferencia con lo que dice la tienda se reparte sola entre las piezas.';
    agregar.parentNode.insertBefore(p2, agregar.nextSibling);
    p2.parentNode.insertBefore(ayuda, p2.nextSibling);
    ayuda.parentNode.insertBefore(hero, ayuda.nextSibling);
    hero.style.marginBottom = '0';
    var lb = hero.querySelector('.lb'); if (lb) lb.textContent = 'Total cobrado a tu tarjeta (todo el pedido)';
    var pg = $('pagado'); if (pg) pg.placeholder = 'Ej. 2400';
  })();

  // ---- 2. Cada renglón: textos y ejemplos ----
  function fila(f) {
    var lab = f.costo && f.costo.closest('.campo');
    var s = lab && lab.querySelector('span');
    if (s) s.textContent = 'Precio por pieza que te cobró la tienda (ya con descuentos)';
    if (f.costo) {
      f.costo.placeholder = 'Ej. 105';
      // Manual o automático lo decide autoPrecio comparando con el último valor que puso él (Codex: un aviso aquí
      // corría DESPUÉS de calcular y volvía "manual" el valor recién recalculado al borrar el campo).
    }
    if (f.lista) f.lista.placeholder = 'Ej. 149.99';
    if (f.desc) f.desc.placeholder = 'Ej. Mesa plegable 1.80 m';
    f.el.addEventListener('input', function (e) { quitarFalta(e.target); });
    f.el.addEventListener('click', function (e) { if (e.target.closest('.chip')) quitarFalta(f.chips); });
  }
  function nota(f, texto) {
    var lab = f.costo && f.costo.closest('.campo');
    if (!lab) return;
    var n = lab.querySelector('.auto-nota');
    if (!n) { n = document.createElement('small'); n.className = 'auto-nota'; lab.appendChild(n); }
    n.textContent = texto;
  }

  // ---- 4. Un solo producto: precio por pieza = total ÷ piezas (gancho al inicio de calcular) ----
  function autoPrecio() {
    var fs = filas(), pagado = num($('pagado') && $('pagado').value);
    // Si el valor ya no es el que puso el cálculo, lo escribió la persona: se respeta (calcular corre antes que
    // el aviso del campo, por eso no basta con el evento).
    fs.forEach(function (f) { if (f.costoAuto && f.costo.value !== f.costoAutoValor) { f.costoAuto = false; nota(f, ''); } });
    if (fs.length === 1) {
      var f = fs[0], q = Math.round(num(f.q.value));
      if (pagado > 0 && q > 0 && (!f.costo.value || f.costoAuto)) {
        f.costo.value = (Math.round(pagado / q * 100) / 100).toFixed(2);
        f.costoAuto = true; f.costoAutoValor = f.costo.value;
        nota(f, 'Calculado: total ÷ ' + q + (q === 1 ? ' pieza' : ' piezas') + '. Cámbialo si quieres.');
        quitarFalta(f.costo);
      } else if (f.costoAuto && !(pagado > 0 && q > 0)) {
        f.costo.value = ''; f.costoAuto = false;
      }
      if (!f.costo.value && !f.costoAuto) nota(f, 'Si es el único producto del pedido, puedes dejarlo vacío: sale del total del paso 2.');
      return;
    }
    fs.forEach(function (f) {
      if (!f.costoAuto) return;
      f.costo.value = ''; f.costoAuto = false;
      nota(f, 'Con varios productos, escribe el precio por pieza de cada uno.');
    });
  }

  // ---- 3. Qué falta: se marca, se dice y se lleva ahí (gancho al tocar "Dar de alta") ----
  function marcar(el, faltan, texto) { if (!el) return; el.classList.add('falta'); faltan.push({ el: el, texto: texto }); }
  function quitarFalta(el) {
    if (!el || !el.classList) return;
    var c = el.closest ? (el.closest('.falta') || el) : el;
    c.classList.remove('falta');
    if (el.id === 'pagado' || (c.contains && c.contains($('pagado')))) { var h = $('p-alta').querySelector('.hero'); if (h) h.classList.remove('falta'); }
  }
  function listo() {
    document.querySelectorAll('#p-alta .falta').forEach(function (e) { e.classList.remove('falta'); });
    var faltan = [];
    filas().forEach(function (f, i) {
      var n = filas().length > 1 ? ' (producto ' + (i + 1) + ')' : '';
      if (f.modelo && !String(f.color || '').trim()) marcar(f.el.querySelector('.ac-caja'), faltan, 'Elige el color' + n);
      if (!f.desc.value.trim()) marcar(f.desc, faltan, 'Falta el nombre del producto' + n);
      if (!f.cat.value.trim()) marcar(f.chips, faltan, 'Elige la categoría' + n);
      if (!(Math.round(num(f.q.value)) > 0)) marcar(f.q.closest('.step') || f.q, faltan, 'Faltan las piezas' + n);
      if (!(num(f.costo.value) > 0)) marcar(f.costo.closest('.money') || f.costo, faltan, 'Falta el precio por pieza que te cobró la tienda' + n);
    });
    if (!(num($('pagado').value) > 0)) marcar($('p-alta').querySelector('.hero'), faltan, 'Falta el total que se cobró a tu tarjeta (paso 2)');
    if (!faltan.length) return true;
    var s = $('abot-s');
    if (s) s.textContent = faltan[0].texto + (faltan.length > 1 ? ' · y ' + (faltan.length - 1) + ' más' : '');
    var el = faltan[0].el;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    var foco = el.matches && el.matches('input') ? el : el.querySelector && el.querySelector('input:not([type=hidden]):not([readonly]),button');
    if (foco) setTimeout(function () { try { foco.focus({ preventScroll: true }); } catch (e) {} }, 350);
    return false;
  }
  var pg = $('pagado');
  if (pg) pg.addEventListener('input', function () { quitarFalta(pg); });

  K.altaClaro = { fila: fila, autoPrecio: autoPrecio, listo: listo };
})();
