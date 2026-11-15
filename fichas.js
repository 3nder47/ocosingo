/* Kiosko · Fichas técnicas (panel de PC; Alex, 2026-11-14; plan revisado por Codex).
   Muestra qué dice cada ficha de su producto y cuánto tomaría revisarlas, para que Alex decida si aparta tiempo.
   Sin aprobar, Abi, la app y el catálogo usan solo los datos y lo que incluye; aprobada, también las promesas, como
   "según el fabricante". Una ficha sale solo en los productos con liga confirmada.
   Cada cambio se guarda al momento sobre la versión que se mostró (si cambió en otra pantalla, pide recargar).
   Acciones del Worker: fichas, guardarFicha, ligarFicha. armar-nueva.py lo copia y lo carga desde analisis.html. */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var css = document.createElement('style');
  css.textContent = [
    '.fi-card{padding:20px 22px;margin-top:18px}',
    '.fi-sub{color:var(--gris);margin:4px 0 0;font-size:13px}',
    '.fi-res{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
    '.fi-res .n{font-size:26px;font-weight:700;line-height:1.1}',
    '.fi-res .t{font-size:13px;color:var(--gris)}',
    '.fi-filtros{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}',
    '.fi-filtros button{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--pill);padding:7px 14px;font:inherit;font-size:14px;cursor:pointer}',
    '.fi-filtros button[aria-pressed=true]{border-color:var(--verde);background:var(--verde-bg);color:var(--verde-ink);font-weight:600}',
    '.fi-f{border:1px solid var(--linea);border-radius:var(--r-sm);margin-top:12px;background:var(--card)}',
    '.fi-f>summary{list-style:none;cursor:pointer;padding:14px 16px;display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:center}',
    '.fi-f>summary::-webkit-details-marker{display:none}',
    '.fi-f>summary b{font-size:15px}',
    '.fi-f>summary .m{grid-column:1/-1;font-size:13px;color:var(--gris)}',
    '.fi-est{font-size:12px;font-weight:700;border-radius:var(--pill);padding:3px 10px;white-space:nowrap}',
    '.fi-est.ok{background:var(--verde-bg);color:var(--verde-ink)}',
    '.fi-est.bo{background:var(--naranja-bg);color:var(--naranja-ink)}',
    '.fi-cuerpo{padding:0 16px 16px;display:grid;gap:14px}',
    '.fi-cuerpo h4{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--gris)}',
    '.fi-cuerpo ul{margin:0;padding:0;list-style:none;display:grid;gap:4px}',
    '.fi-l{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;padding:6px 8px;border-radius:8px;font-size:14px;line-height:1.4}',
    '.fi-l:hover{background:var(--linea)}',
    '.fi-l .b{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}',
    '.fi-l button,.fi-chip button{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--pill);padding:2px 10px;font:inherit;font-size:12px;cursor:pointer}',
    '.fi-l button:disabled,.fi-chip button:disabled{opacity:.5;cursor:default}',
    '.fi-l button.x,.fi-chip button.x{border:0;background:none;color:var(--tenue);font-size:16px;padding:0 6px}',
    '.fi-l button.x:hover,.fi-chip button.x:hover{color:var(--rojo)}',
    '.fi-pro .fi-l{background:var(--naranja-bg)}',
    '.fi-rev .fi-l{color:var(--gris)}',
    '.fi-nota{font-size:13px;color:var(--gris);border-left:3px solid var(--linea);padding-left:10px}',
    '.fi-chips{display:flex;flex-wrap:wrap;gap:6px}',
    '.fi-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--linea);border-radius:var(--pill);padding:4px 6px 4px 10px;font-size:13px}',
    '.fi-chip.pend{border-style:dashed;border-color:var(--naranja)}',
    '.fi-chip .s{color:var(--gris)}',
    '.fi-busca input{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--r-sm);padding:8px 11px;font:inherit;width:100%;box-sizing:border-box;margin-top:8px}',
    '.fi-busca input:focus{border-color:var(--verde);outline:0}',
    '.fi-resb{max-height:220px;overflow:auto;margin-top:6px}',
    '.fi-resb button{display:flex;width:100%;justify-content:space-between;gap:10px;border:0;background:none;color:inherit;font:inherit;font-size:14px;text-align:left;padding:7px 6px;border-radius:8px;cursor:pointer}',
    '.fi-resb button:hover{background:var(--linea)}',
    '.fi-acc{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
    '.fi-err{color:var(--rojo-ink);font-weight:600;font-size:13px;min-height:1.2em}',
    '.fi-vacio{color:var(--gris);padding:12px 0 4px}',
  ].join('\n');
  document.head.appendChild(css);

  var LOTE = 40;   // tope de productos por envío en ligarFicha
  var D = null, cargando = null, filtro = 'pend', abiertas = {}, ocupado = false;

  function cargar() {
    if (cargando) return cargando;
    cargando = K.api('fichas', {}, null, 30000).then(function (r) { D = r; cargando = null; }, function (e) { cargando = null; throw e; });
    return cargando;
  }
  function cabecera() {
    return '<div class="top"><div><h1>Fichas técnicas</h1><p>Características técnicas según la página del vendedor. ' +
      'El enlace de Muse utiliza los datos y los elementos incluidos únicamente cuando la asociación con el producto está confirmada. ' +
      'Al aprobar la ficha, también incorpora las afirmaciones del vendedor con la indicación “según el fabricante, sin confirmar”.</p></div></div>';
  }
  function abrir() {
    var p = $('p-fichas');
    if (!p) return;
    if (!D) p.innerHTML = cabecera() + '<div class="card fi-card fi-vacio">Cargando…</div>';
    cargar().then(pintar, function (e) {
      p.innerHTML = cabecera() + '<div class="card fi-card"><div class="fi-err">' + esc(e.message) + '</div>' +
        '<div class="fi-acc"><button class="btn claro" data-fi="recargar">Reintentar</button></div></div>';
    });
  }

  function plural(n, uno, varios) { return n + ' ' + (n === 1 ? uno : varios); }
  function ficha(id) { return (D.fichas || []).filter(function (f) { return f.id === id; })[0]; }

  function resumen() {
    var r = D.resumen;
    var t = r.pendientes ? 'Tiempo estimado para revisar las fichas pendientes: ' + plural(r.minutos, 'minuto', 'minutos') + '.' : 'No hay fichas pendientes.';
    return '<div class="card fi-card"><div class="fi-res">' +
      '<div><div class="n">' + r.pendientes + '</div><div class="t">' + (r.pendientes === 1 ? 'ficha sin revisar' : 'fichas sin revisar') + ' de ' + r.total + '</div></div>' +
      '<div><div class="n">' + r.lineasPorConfirmar + '</div><div class="t">' + (r.lineasPorConfirmar === 1 ? 'punto por confirmar' : 'puntos por confirmar') + '</div></div>' +
      '<div><div class="n">' + r.ligasPorConfirmar + '</div><div class="t">' + (r.ligasPorConfirmar === 1 ? 'asociación por confirmar' : 'asociaciones por confirmar') + '</div></div>' +
      '</div><p class="fi-sub" style="margin-top:12px">' + t + ' La ficha solo se utiliza para los productos cuya asociación esté confirmada.</p></div>';
  }

  function linea(f, i, tipo) {
    var c = f.contenido, txt, botones = '';
    var dis = ocupado ? ' disabled' : '';
    if (tipo === 'car') {
      var x = c.caracteristicas[i];
      txt = x.texto;
      botones = '<button data-fi="tipo" data-i="' + i + '"' + dis + '>' + (x.tipo === 'dato' ? 'Marcar como promesa' : 'Marcar como dato') + '</button>';
    } else txt = c[tipo === 'inc' ? 'incluye' : 'revisar'][i];
    return '<li class="fi-l"><span>' + esc(txt) + '</span><span class="b">' + botones +
      '<button class="x" data-fi="quitar" data-tipo="' + tipo + '" data-i="' + i + '" aria-label="Quitar línea"' + dis + '>×</button></span></li>';
  }
  function lista(titulo, cls, items, tipo, f) {
    if (!items.length) return '';
    return '<div class="' + cls + '"><h4>' + titulo + '</h4><ul>' + items.map(function (it) { return linea(f, it.i, tipo); }).join('') + '</ul></div>';
  }

  function tarjeta(f) {
    var c = f.contenido, dis = ocupado ? ' disabled' : '';
    if (!f.valida) {
      return '<details class="fi-f" data-id="' + f.id + '"><summary><b>' + esc(f.nombre) + '</b><span class="fi-est bo">Con error</span>' +
        '<span class="m">El contenido de esta ficha tiene un formato inválido y no se incorpora al documento de Muse.</span></summary></details>';
    }
    var car = c.caracteristicas.map(function (x, i) { return { x: x, i: i }; });
    var datos = car.filter(function (o) { return o.x.tipo === 'dato'; }), prom = car.filter(function (o) { return o.x.tipo === 'promesa'; });
    var inc = c.incluye.map(function (x, i) { return { i: i }; }), rev = c.revisar.map(function (x, i) { return { i: i }; });
    var pend = f.productos.filter(function (p) { return !p.confirmada; });
    var aprobada = f.estado === 'aprobada';
    var meta = [plural(datos.length, 'dato', 'datos'), plural(prom.length, 'promesa', 'promesas'),
      plural(rev.length, 'punto por confirmar', 'puntos por confirmar'), plural(f.productos.length, 'producto', 'productos') +
      (pend.length ? ' (' + plural(pend.length, 'asociación', 'asociaciones') + ' por confirmar)' : '')].join(' · ');
    var h = '<details class="fi-f" data-id="' + f.id + '"' + (abiertas[f.id] ? ' open' : '') + '><summary><b>' + esc(f.nombre) + '</b>' +
      '<span class="fi-est ' + (aprobada ? 'ok">Aprobada' : 'bo">Sin revisar') + '</span><span class="m">' + esc(meta) +
      (f.tienda && f.tienda !== 'otra' ? ' · Fuente: ' + esc(f.tienda) : '') + (c.info_incompleta ? ' · Página con información incompleta' : '') + '</span></summary><div class="fi-cuerpo">';
    h += lista('Datos', '', datos, 'car', f);
    h += lista('Promesas del vendedor' + (aprobada ? ' (se muestran como del fabricante, sin confirmar)' : ' (no se muestran mientras no esté aprobada)'), 'fi-pro', prom, 'car', f);
    h += lista('Incluye', '', inc, 'inc', f);
    h += lista('Por confirmar (solo para revisión; no se muestra)', 'fi-rev', rev, 'rev', f);
    if (f.notas.length) h += '<div><h4>Correcciones anteriores</h4>' + f.notas.map(function (n) { return '<div class="fi-nota">' + esc(n) + '</div>'; }).join('') + '</div>';
    h += '<div><h4>Productos</h4>';
    h += f.productos.length ? '<div class="fi-chips">' + f.productos.map(function (p) {
      return '<span class="fi-chip' + (p.confirmada ? '' : ' pend') + '">' + esc(p.descripcion) + ' <span class="s">' + esc(p.pid) + ' · ' + p.stock +
        (p.deIrene ? ' · de Irene' : '') + '</span>' + (p.confirmada ? '' : '<button data-fi="confirmar" data-pid="' + esc(p.pid) + '"' + dis + '>Confirmar asociación</button>') +
        '<button class="x" data-fi="desligar" data-pid="' + esc(p.pid) + '" aria-label="Quitar ' + esc(p.descripcion) + ' de esta ficha"' + dis + '>×</button></span>';
    }).join('') + '</div>' : '<div class="fi-vacio">Esta ficha no tiene productos asociados y no se incorpora al documento de Muse.</div>';
    if (pend.length > 1) h += '<div class="fi-acc" style="margin-top:8px"><button class="btn claro" data-fi="confirmarTodos"' + dis + '>' +
      (pend.length > LOTE ? 'Confirmar los siguientes ' + LOTE + ' productos' : 'Confirmar los ' + pend.length + ' productos') + '</button></div>';
    h += '<div class="fi-busca"><input type="search" data-fi-busca="' + f.id + '" placeholder="Agregar otro producto a esta ficha" aria-label="Buscar producto para agregar"><div class="fi-resb"></div></div></div>';
    h += '<div class="fi-err" role="status"></div><div class="fi-acc">' +
      (aprobada ? '<button class="btn claro" data-fi="estado" data-v="borrador"' + dis + '>Regresar a borrador</button>'
        : '<button class="btn pri" data-fi="estado" data-v="aprobada"' + dis + '>Aprobar ficha</button>') + '</div>';
    return h + '</div></details>';
  }

  function pintar() {
    var p = $('p-fichas');
    if (!p || !D) return;
    var fs = (D.fichas || []).filter(function (f) { return filtro === 'todas' || (filtro === 'ok') === (f.estado === 'aprobada'); });
    var b = function (k, t) { return '<button data-fi="filtro" data-v="' + k + '" aria-pressed="' + (filtro === k) + '">' + t + '</button>'; };
    p.innerHTML = cabecera() + resumen() +
      '<div class="fi-filtros">' + b('pend', 'Sin revisar') + b('ok', 'Aprobadas') + b('todas', 'Todas') + '</div>' +
      (fs.length ? fs.map(tarjeta).join('') : '<div class="card fi-card fi-vacio">No hay fichas en esta vista.</div>');
  }

  function error(id, m) {
    var d = document.querySelector('#p-fichas .fi-f[data-id="' + id + '"] .fi-err');
    if (d) d.textContent = m; else K.abrirHTML('<h3 style="margin:0">No se pudo guardar</h3><p>' + esc(m) + '</p><div class="acciones"><button class="btn pri" data-cerrar="1">Listo</button></div>');
  }
  // Todo cambio: se manda, y con la respuesta se recarga la lista (así la versión y el resumen quedan al día).
  function enviar(id, accion, cuerpo) {
    if (ocupado) return;
    ocupado = true; pintar();
    K.api(accion, null, cuerpo, 30000).then(function (r) {
      if (!r || !r.success) throw new Error((r && r.error) || 'No se pudo guardar.');
      ocupado = false;
      if (K.recargarDespues) K.recargarDespues();
      return cargar().then(function () { pintar(); if (r.aviso) error(id, r.aviso); });
    }).catch(function (e) {
      ocupado = false;
      var recargar = /cambió desde que la abriste/.test(e.message);
      (recargar ? cargar() : Promise.resolve()).then(function () { pintar(); error(id, e.message); }, function () { pintar(); error(id, e.message); });
    });
  }
  function guardarContenido(f, c) { enviar(f.id, 'guardarFicha', { id: f.id, version: f.version, contenido: c }); }
  function copia(c) { return JSON.parse(JSON.stringify(c)); }

  function buscar(inp) {
    var id = Number(inp.getAttribute('data-fi-busca')), t = String(inp.value || '').trim().toLowerCase(), r = inp.nextElementSibling;
    if (t.length < 2) { r.innerHTML = ''; return; }
    var lista = (D.productos || []).filter(function (p) { return p.fichaId !== id && p.descripcion.toLowerCase().indexOf(t) > -1; }).slice(0, 30);
    r.innerHTML = lista.length ? lista.map(function (p) {
      var otra = p.fichaId ? ficha(p.fichaId) : null;
      return '<button data-fi="ligar" data-pid="' + esc(p.pid) + '"' + (otra ? ' disabled title="Ya tiene otra ficha"' : '') + '><span>' + esc(p.descripcion) + '</span><span style="color:var(--gris)">' +
        esc(p.pid) + ' · ' + p.stock + (otra ? ' · ficha: ' + esc(otra.nombre) : '') + '</span></button>';
    }).join('') : '<div class="fi-vacio">No se encontraron productos.</div>';
  }

  document.addEventListener('toggle', function (e) {
    var d = e.target;
    if (d && d.classList && d.classList.contains('fi-f')) abiertas[d.getAttribute('data-id')] = d.open;
  }, true);
  document.addEventListener('input', function (e) {
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-fi-busca')) buscar(e.target);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#p-fichas [data-fi]');
    if (!b || b.disabled) return;
    var a = b.getAttribute('data-fi');
    if (a === 'recargar') { D = null; abrir(); return; }
    if (a === 'filtro') { filtro = b.getAttribute('data-v'); pintar(); return; }
    var caja = b.closest('.fi-f'), f = caja && ficha(Number(caja.getAttribute('data-id')));
    if (!f || ocupado) return;
    var i = Number(b.getAttribute('data-i')), c;
    if (a === 'tipo') {
      c = copia(f.contenido); c.caracteristicas[i].tipo = c.caracteristicas[i].tipo === 'dato' ? 'promesa' : 'dato'; guardarContenido(f, c);
    } else if (a === 'quitar') {
      c = copia(f.contenido);
      var campo = { car: 'caracteristicas', inc: 'incluye', rev: 'revisar' }[b.getAttribute('data-tipo')];
      c[campo].splice(i, 1); guardarContenido(f, c);
    } else if (a === 'estado') {
      enviar(f.id, 'guardarFicha', { id: f.id, version: f.version, estado: b.getAttribute('data-v') });
    } else if (a === 'confirmar' || a === 'desligar' || a === 'ligar') {
      enviar(f.id, 'ligarFicha', { fichaId: f.id, paso: a === 'desligar' ? 'quitar' : a, pids: [b.getAttribute('data-pid')] });
    } else if (a === 'confirmarTodos') {
      enviar(f.id, 'ligarFicha', { fichaId: f.id, paso: 'confirmar', pids: f.productos.filter(function (p) { return !p.confirmada; }).map(function (p) { return p.pid; }).slice(0, LOTE) });
    }
  });

  window.KIOSKO.fichas = { abrir: abrir, olvidar: function () { D = null; } };
})();
