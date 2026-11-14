/* Kiosko · Colores en la venta del celular (Alex, 2026-11-13; planteamiento revisado por Codex).
   El catálogo muestra UNA tarjeta por modelo (con sus colores y existencias); los productos sin modelo, como siempre.
   Al tocar un modelo: si solo un color tiene existencia se abre su venta; si hay varios, primero "Elige el color"
   (nunca se preselecciona: la foto representativa no dice qué color pidió el cliente). En la venta, "cambiar" permite
   pasar a otro color sin perder vendedor, método, extras ni gastos.
   Todo se vende por VARIANTE (pid): state.catalogo, state.filtrado, elegir(), la cola sin conexión y el descuento
   local no cambian. Las tarjetas se rehacen en cada render desde state.catalogo y la elección se resuelve contra el
   catálogo vigente (Codex: nunca vender desde una referencia vieja).
   armar-nueva.py lo copia a ocosingo/nueva/, lo carga en index.html después de app.js, lo precachea en sw.js y pone
   los ganchos en app.js (renderCatalogo y pintarVenta). La app vieja (raíz) no lo carga. */
(function () {
  'use strict';
  if (typeof state === 'undefined' || typeof renderCatalogo !== 'function') return;

  var COLOR_CSS = { negro: '#1f2328', blanco: '#f4f4f2', gris: '#8b9096', plata: '#c4c8cc', plateado: '#c4c8cc',
    dorado: '#d4a72c', oro: '#d4a72c', rojo: '#d1342f', azul: '#2f6fd1', 'azul marino': '#1f2f5c', celeste: '#7cc4ee',
    verde: '#2f9e5a', amarillo: '#f2c94c', naranja: '#f08a24', rosa: '#f29cb7', rosado: '#f29cb7', morado: '#8a4fc7',
    lila: '#b79ae0', violeta: '#7b4fc7', cafe: '#7a5233', marron: '#7a5233', beige: '#d9c7a3', crema: '#efe6cf',
    turquesa: '#2bb3a7', vino: '#7a1f33', 'rosa dorado': '#e3b2a0', 'oro rosa': '#e3b2a0', 'gris espacial': '#55595e' };
  var normC = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' '); };
  function punto(color) {
    var c = COLOR_CSS[normC(color)];
    return '<i class="vc-dot' + (c ? '' : ' otro') + '"' + (c ? ' style="background:' + c + '"' : '') + ' aria-hidden="true"></i>';
  }

  var css = document.createElement('style');
  css.textContent = [
    '.vc-cols{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:.75rem;color:var(--muted);font-weight:600}',
    '.vc-cols span{display:inline-flex;align-items:center;gap:4px}',
    '.vc-dot{width:10px;height:10px;border-radius:50%;display:inline-block;box-shadow:inset 0 0 0 1px rgba(127,127,127,.45)}',
    '.vc-dot.otro{background:conic-gradient(#d1342f,#f2c94c,#2f9e5a,#2f6fd1,#8a4fc7,#d1342f)}',
    '.vc-color{display:flex;align-items:center;gap:8px;margin:10px 0 2px;font-weight:600}',
    '.vc-color button{border:0;background:none;color:var(--accent,#1D9E75);font:inherit;font-weight:700;padding:4px 6px;cursor:pointer}',
    '.vc-desde{font-size:.7em;font-weight:600;opacity:.8;margin-right:2px}',
  ].join('\n');
  document.head.appendChild(css);

  var hoja = document.createElement('div');
  hoja.id = 'sheet-color'; hoja.className = 'overlay hidden';
  hoja.innerHTML = '<div class="sheet"><div class="handle"></div><h3 id="vc-t">Elige el color</h3><div id="vc-list"></div></div>';
  hoja.addEventListener('click', function (e) { if (e.target === hoja) cerrar(); });
  document.body.appendChild(hoja);
  function cerrar() { hoja.classList.add('hidden'); }

  var clave = function (p) { return (p.origen || 'Alex') + '|' + p.modeloId; };
  // Colores con existencia de un modelo, desde el catálogo VIGENTE (ya con la cola sin conexión aplicada).
  function colores(k) {
    return state.catalogo.filter(function (p) { return p.modeloId && clave(p) === k && Number(p.stock) > 0; })
      .sort(function (a, b) { return b.stock - a.stock || String(a.color).localeCompare(String(b.color)); });
  }

  // Tarjetas: primero dueño y categoría (como el catálogo de siempre), luego se agrupa por modelo y la búsqueda se
  // aplica al grupo completo (buscar "negro" muestra el modelo con TODOS sus colores, Codex punto 2).
  function tarjetas(q) {
    var base = state.catalogo.filter(function (p) { return filtroDueno(p) && (state.cat === 'Todas' || p.categoria === state.cat); });
    var grupos = {}, out = [];
    base.forEach(function (p) {
      if (!p.modeloId) { out.push({ tipo: 'p', p: p }); return; }
      var k = clave(p);
      if (!grupos[k]) { grupos[k] = { tipo: 'm', k: k, nombre: p.modelo, categoria: p.categoria, origen: p.origen, vars: [] }; out.push(grupos[k]); }
      grupos[k].vars.push(p);
    });
    return out.filter(function (t) {
      if (!q) return true;
      if (t.tipo === 'p') return t.p.descripcion.toLowerCase().indexOf(q) > -1 || t.p.categoria.toLowerCase().indexOf(q) > -1;
      return [t.nombre, t.categoria].concat(t.vars.map(function (v) { return v.descripcion + ' ' + (v.color || ''); }))
        .some(function (s) { return String(s).toLowerCase().indexOf(q) > -1; });
    }).map(function (t) {
      if (t.tipo !== 'm') return t;
      t.vars.sort(function (a, b) { return b.stock - a.stock; });
      t.rep = t.vars[0];
      t.stock = t.vars.reduce(function (s, v) { return s + Number(v.stock); }, 0);
      var precios = t.vars.map(function (v) { return Number(v.precio); });
      t.precio = Math.min.apply(null, precios);
      t.desde = precios.some(function (x) { return x !== t.precio; });
      return t;
    });
  }

  function lineaColores(t) {
    return '<div class="vc-cols">' + t.vars.map(function (v) {
      return '<span>' + punto(v.color) + esc(v.color || '') + ' ' + v.stock + '</span>';
    }).join('') + '</div>';
  }
  function precioTarjeta(t) { return (t.desde ? '<span class="vc-desde">desde</span>' : '') + '$' + precio(t.precio); }
  function toque(t) {
    return t.tipo === 'm' ? 'vcTocar(this.dataset.k)" data-k="' + esc(t.k)
      : 'vcVariante(this.dataset.pid,this.dataset.o)" data-pid="' + esc(t.p.pid || '') + '" data-o="' + esc(t.p.origen || '');
  }

  // Gancho en renderCatalogo (después de calcular state.filtrado). Devuelve false si no hay modelos: catálogo de siempre.
  window.vcRender = function (q) {
    if (!state.catalogo.some(function (p) { return p.modeloId; })) return false;
    var ts = tarjetas(q), l = document.getElementById('catalogo-list');
    if (!ts.length) { l.innerHTML = q ? vacio('search', 'Nada con ese nombre', 'Prueba con otra palabra.') : vacio('box', 'Sin stock', 'Todo está vendido.'); return true; }
    if (state.grid) {
      l.innerHTML = '<div class="grid stagger">' + ts.map(function (t) {
        var p = t.tipo === 'm' ? t.rep : t.p, n = t.tipo === 'm' ? t.stock : Number(p.stock);
        return '<button class="tile" onclick="' + toque(t) + '" style="text-align:left">' + thumb(p) +
          (n === 1 ? '<span class="low">Última</span>' : '') + tagIrene(p) +
          '<div class="info"><b>' + esc(t.tipo === 'm' ? t.nombre : p.descripcion) + '</b><span class="p num">' +
          (t.tipo === 'm' ? precioTarjeta(t) : '$' + precio(p.precio)) + '</span>' +
          (t.tipo === 'm' ? lineaColores(t) : stockDots(n)) + '</div></button>';
      }).join('') + '</div>';
      return true;
    }
    var cats = {};
    ts.forEach(function (t) { var c = t.tipo === 'm' ? t.categoria : t.p.categoria; (cats[c] = cats[c] || []).push(t); });
    l.innerHTML = Object.keys(cats).sort().map(function (cat) {
      return (state.cat === 'Todas' ? '<div class="section-title">' + esc(cat) + '</div>' : '<div style="height:6px"></div>') +
        '<div class="group stagger">' + cats[cat].map(function (t) {
          var p = t.tipo === 'm' ? t.rep : t.p;
          return '<div class="row plain tap" onclick="' + toque(t) + '">' + thumb(p) +
            '<div class="t"><b>' + esc(t.tipo === 'm' ? t.nombre : p.descripcion) + tagIrene(p) + '</b>' +
            (t.tipo === 'm' ? lineaColores(t) : stockDots(p.stock)) + '</div>' +
            '<div class="v pos num">' + (t.tipo === 'm' ? precioTarjeta(t) : '$' + precio(p.precio)) + '</div></div>';
        }).join('') + '</div>';
    }).join('');
    return true;
  };

  function abrirVariante(p) { buzz(12); state.producto = p; state.vendedor = state.usuario; state.metodo = null; state.paso = 1; abrirVenta(); }
  var modoCambiar = false;
  function pintarHoja(k, titulo) {
    var vs = colores(k);
    document.getElementById('vc-t').textContent = titulo;
    document.getElementById('vc-list').innerHTML = '<div class="group stagger">' + vs.map(function (v) {
      var actual = modoCambiar && state.producto && v.pid === state.producto.pid;
      return '<div class="row plain tap" data-pid="' + esc(v.pid) + '" data-o="' + esc(v.origen || '') + '" onclick="vcElegir(this.dataset.pid,this.dataset.o)">' +
        thumb(v) + '<div class="t"><b>' + punto(v.color) + ' ' + esc(v.color || v.descripcion) + (actual ? ' <small>· el actual</small>' : '') + '</b>' +
        '<small>' + v.stock + (Number(v.stock) === 1 ? ' disponible' : ' disponibles') + '</small></div>' +
        '<div class="v pos num">$' + precio(v.precio) + (v.antes ? ' <small style="text-decoration:line-through;opacity:.6">$' + precio(v.antes) + '</small>' : '') + '</div></div>';
    }).join('') + '</div>';
    hoja.classList.remove('hidden');
    hoja.querySelector('.sheet').scrollTo({ top: 0 });
  }

  // Tocar la tarjeta de un modelo.
  window.vcTocar = function (k) {
    var vs = colores(k);
    if (!vs.length) { toast('Ya no hay piezas de ese modelo', 'err'); renderCatalogo(); return; }
    if (vs.length === 1) { abrirVariante(vs[0]); return; }
    buzz(); modoCambiar = false;
    pintarHoja(k, vs[0].modelo + ' · elige el color');
  };
  // Tocar un producto sin modelo (por pid, nunca por nombre).
  window.vcVariante = function (pid, o) {
    var p = state.catalogo.filter(function (x) { return x.pid === pid && (x.origen || 'Alex') === (o || 'Alex'); })[0];
    if (!p) { toast('Sin stock', 'err'); renderCatalogo(); return; }
    abrirVariante(p);
  };
  window.vcElegir = function (pid, o) {
    var p = state.catalogo.filter(function (x) { return x.pid === pid && (x.origen || 'Alex') === (o || 'Alex') && Number(x.stock) > 0; })[0];
    cerrar();
    if (!p) { toast('Ese color ya no tiene piezas', 'err'); renderCatalogo(); return; }
    if (modoCambiar) {
      // Cambiar de color dentro de la venta: se conservan vendedor, método, extras y gastos (Codex punto 4).
      modoCambiar = false;
      if (typeof guardarInputs === 'function') guardarInputs();
      buzz(12); state.producto = p; state._shareFile = null; state.paso = 1; pintarVenta();
      return;
    }
    abrirVariante(p);
  };
  window.vcCambiar = function () {
    var p = state.producto;
    if (!p || !p.modeloId) return;
    modoCambiar = true;
    pintarHoja(clave(p), 'Cambiar color · ' + p.modelo);
  };

  // Gancho después de pintarVenta: muestra el color y, si hay otros con existencia, "cambiar".
  window.vcDecorar = function () {
    var p = state.producto, body = document.getElementById('venta-body');
    if (!p || !p.modeloId || state.paso !== 1 || !body || body.querySelector('.vc-color')) return;
    var otros = colores(clave(p)).filter(function (v) { return v.pid !== p.pid; }).length;
    var div = document.createElement('div');
    div.className = 'vc-color';
    div.innerHTML = punto(p.color) + '<span>Color: <b>' + esc(p.color || '') + '</b></span>' +
      (otros ? '<button type="button" onclick="vcCambiar()">cambiar</button>' : '');
    var prod = body.querySelector('.prod');
    if (prod && prod.parentNode) prod.parentNode.insertBefore(div, prod.nextSibling); else body.insertBefore(div, body.firstChild);
  };
})();
