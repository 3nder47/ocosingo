/* Kiosko · Color en el alta de pedido (panel de PC; Alex, 2026-11-13; planteamiento revisado por Codex).
   En cada renglón: "¿Es otro color de un modelo que ya tienes?". Al elegir modelo y color, el nombre y la categoría
   quedan bloqueados (los pone el modelo), el precio es el del modelo y se comparte entre sus renglones, y las fotos
   que se muestran son las de ese color (nunca las de un producto "parecido"). "Quitar modelo" regresa al alta normal.
   La identidad la decide el Worker por modelo + color (altaPedido con modeloId y color); lo escrito no cuenta.
   armar-nueva.py copia este archivo a ocosingo/nueva/ y pone los ganchos en el alta de analisis.html:
   K.altaColor.fila(f) al crear un renglón, K.altaColor.detectar(f) en vez de la detección por parecido, y
   modeloId/color en armar(). La app vieja (raíz) no lo carga. */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var mayus = function (s) { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  var MX = function (n) { return '$' + (Number(n) || 0).toLocaleString('es-MX'); };

  var css = document.createElement('style');
  css.textContent = [
    '.ac-caja{border:1px dashed var(--linea);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:10px;font-size:13px}',
    '.ac-caja.on{border-style:solid;border-color:var(--verde);background:var(--verde-bg)}',
    '.ac-caja .fila{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
    '.ac-caja input[type=search],.ac-caja input[type=text]{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--r-sm);padding:8px 10px;font:inherit;outline:0;min-width:200px}',
    '.ac-caja input:focus{border-color:var(--verde)}',
    '.ac-res{max-height:200px;overflow:auto;margin-top:6px;display:grid;gap:2px}',
    '.ac-res button{display:flex;justify-content:space-between;gap:10px;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:7px 6px;border-radius:8px;cursor:pointer}',
    '.ac-res button:hover{background:var(--linea)}',
    '.ac-tenue{color:var(--gris)}',
    '.ac-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.reng input[readonly]{opacity:.75;cursor:not-allowed}',
  ].join('\n');
  document.head.appendChild(css);

  var MODELOS = null, COLORES = [], cargando = null;
  // Se vuelve a leer al entrar al alta y después de cada alta que entró (precios y colores cambian: Codex/prueba).
  function cargar(forzar) {
    if (cargando && !forzar) return cargando;
    cargando = Promise.all([K.api('modelos', {}, null, 30000), K.api('colores', {}, null, 30000)]).then(function (r) {
      MODELOS = r[0] || []; COLORES = r[1] || [];
      var dl = document.getElementById('ac-colores');
      if (!dl) { dl = document.createElement('datalist'); dl.id = 'ac-colores'; document.body.appendChild(dl); }
      dl.innerHTML = COLORES.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('');
      // Los renglones que ya tienen modelo toman los datos nuevos (precio, colores); si el modelo ya no existe, se
      // quita. Un precio que la persona escribió a mano se respeta.
      filas().forEach(function (f) {
        if (!f.modelo) return;
        var m = modeloPorId(f.modelo.id);
        if (!m) { quitar(f); return; }
        f.modelo = m;
        if (!f.acPrecioManual) f.precioVal = m.precio;
        if (f.color) { var v = variante(m, f.color); if (v) f.desc.value = v.descripcion; }
        pintar(f); detectar(f);
      });
      recalcular();
      return MODELOS;
    }, function (e) { cargando = null; throw e; });
    return cargando;
  }
  function modeloPorId(id) { return (MODELOS || []).filter(function (m) { return m.id === id; })[0] || null; }
  function variante(m, color) { var n = norm(color); return m.variantes.filter(function (v) { return norm(v.color) === n; })[0] || null; }
  // Variante cuyo nombre es exactamente lo escrito (para proponer el modelo; nunca se elige solo).
  function porNombre(desc) {
    var n = norm(desc), out = null;
    (MODELOS || []).forEach(function (m) { m.variantes.forEach(function (v) { if (norm(v.descripcion) === n) out = { m: m, v: v }; }); });
    return out;
  }
  function filas() { return K.alta && K.alta.filas ? K.alta.filas() : []; }
  // Precio del modelo para un renglón: el de otro renglón del mismo modelo si ya lo tocaron; si no, el del modelo.
  function precioCompartido(f) {
    var otra = filas().filter(function (o) { return o !== f && o.modelo && o.modelo.id === f.modelo.id && o.tocado; })[0];
    return otra ? otra.precioVal : f.modelo.precio;
  }

  function caja(f) { return f.el.querySelector('.ac-caja'); }

  function pintar(f) {
    var c = caja(f);
    if (!c) return;
    if (!f.modelo) {
      var prop = f.propuesta;
      c.className = 'ac-caja';
      c.innerHTML = (prop ? '<div class="fila"><span>Es el color <b>' + esc(prop.v.color) + '</b> de <b>' + esc(prop.m.nombre) + '</b>.</span>' +
          '<button type="button" class="sug" data-ac="usar">Usar el modelo</button></div>' : '') +
        '<div class="fila"' + (prop ? ' style="margin-top:6px"' : '') + '><button type="button" class="sug" data-ac="abrir">¿Es otro color de un modelo que ya tienes?</button></div>' +
        (f.acBuscando ? '<div style="margin-top:8px"><input type="search" data-ac="q" placeholder="Busca el modelo…" aria-label="Buscar modelo" autocomplete="off"><div class="ac-res" data-ac="res"></div></div>' : '');
      if (f.acBuscando) { var q = c.querySelector('[data-ac=q]'); q.addEventListener('input', function () { resultados(f); }); resultados(f); setTimeout(function () { q.focus(); }, 20); }
      return;
    }
    var m = f.modelo, elegido = f.color ? variante(m, f.color) : null;
    c.className = 'ac-caja on';
    c.innerHTML = '<div class="fila"><span>Modelo <b>' + esc(m.nombre) + '</b> <span class="ac-tenue">· ' + esc(m.categoria) + ' · ' + MX(m.precio) + '</span></span>' +
      '<button type="button" class="sug" data-ac="quitar">Quitar modelo</button></div>' +
      '<div class="ac-chips" role="group" aria-label="Color">' + m.variantes.map(function (v) {
        var on = elegido && elegido.pid === v.pid;
        return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-ac="color" data-c="' + esc(v.color) + '">' + esc(v.color) +
          ' <span class="ac-tenue">' + v.stock + '</span></button>';
      }).join('') + '<button type="button" class="chip' + (f.color && !elegido ? ' on' : '') + '" data-ac="otro">+ Otro color</button></div>' +
      (f.acOtro || (f.color && !elegido) ? '<div class="fila" style="margin-top:8px"><input type="text" data-ac="nuevo" list="ac-colores" maxlength="40" placeholder="Color nuevo, ej. Azul marino" aria-label="Color nuevo" value="' + esc(f.color && !elegido ? f.color : '') + '">' +
        '<span class="ac-tenue">Se crea "' + esc(m.nombre) + ' ' + esc(mayus(f.color && !elegido ? f.color : '…')) + '" dentro del modelo</span></div>' : '');
    var nuevo = c.querySelector('[data-ac=nuevo]');
    if (nuevo) nuevo.addEventListener('input', function () { elegirColor(f, nuevo.value, true); });
  }

  function resultados(f) {
    var c = caja(f), r = c.querySelector('[data-ac=res]'), t = norm(c.querySelector('[data-ac=q]').value);
    if (!MODELOS) { r.innerHTML = '<span class="ac-tenue">Cargando modelos…</span>'; return; }
    var lista = MODELOS.filter(function (m) { return !t || norm(m.nombre).indexOf(t) > -1; }).slice(0, 30);
    r.innerHTML = lista.length ? lista.map(function (m) {
      return '<button type="button" data-ac="modelo" data-id="' + m.id + '"><span>' + esc(m.nombre) + '</span><span class="ac-tenue">' +
        esc(m.categoria) + ' · ' + m.variantes.map(function (v) { return esc(v.color); }).join(', ') + '</span></button>';
    }).join('') : '<span class="ac-tenue">' + (MODELOS.length ? 'Ningún modelo con ese nombre.' : 'Aún no hay modelos: júntalos en Colores.') + '</span>';
  }

  // Bloquea o libera lo que pone el modelo.
  function bloquear(f, si) {
    f.desc.readOnly = si;
    var catCampo = f.chips && f.chips.parentElement;
    if (catCampo) catCampo.style.display = si ? 'none' : '';
  }

  function elegirModelo(f, m, color) {
    f.modelo = m; f.color = ''; f.acBuscando = false; f.acOtro = false; f.propuesta = null;
    f.antesModelo = f.antesModelo || { desc: f.desc.value, cat: f.cat.value, catManual: f.catManual };
    f.cat.value = m.categoria; f.catManual = true;
    f.tocado = true; f.precioVal = precioCompartido(f);
    bloquear(f, true);
    if (color) elegirColor(f, color); else { f.desc.value = m.nombre; pintar(f); detectar(f); recalcular(); }
  }
  function elegirColor(f, color, escribiendo) {
    f.color = String(color || '').trim();
    var v = f.color ? variante(f.modelo, f.color) : null;
    f.desc.value = v ? v.descripcion : f.modelo.nombre + (f.color ? ' ' + mayus(f.color) : '');
    if (!escribiendo) pintar(f);
    else { var s = caja(f).querySelector('.ac-tenue:last-child'); if (s) s.textContent = 'Se crea "' + f.desc.value + '" dentro del modelo'; }
    detectar(f); recalcular();
  }
  function quitar(f) {
    var a = f.antesModelo || { desc: '', cat: '', catManual: false };
    f.modelo = null; f.color = ''; f.acOtro = false; f.antesModelo = null; f.tocado = false; f.acPrecioManual = false;
    f.desc.value = a.desc; f.cat.value = a.cat; f.catManual = a.catManual;
    bloquear(f, false); f.noHeredar = false;
    pintar(f);
    if (f.detectarOriginal) f.detectarOriginal();
    if (f.pintarChips) f.pintarChips();
    recalcular();
  }
  function recalcular() { if (K.alta && K.alta.calcular) K.alta.calcular(); }

  // Con modelo: fotos del color elegido (o ninguna si es color nuevo); nunca las de un producto parecido (Codex).
  function detectar(f) {
    var v = f.modelo && f.color ? variante(f.modelo, f.color) : null;
    f.gemelo = null; f.parcial = false;
    f.fotosDrive = v && v.imagen ? [v.imagen] : [];
    if (f.pintarGaleria) f.pintarGaleria();
  }

  // Gancho: al crear un renglón.
  function fila(f) {
    var cuerpo = f.el.querySelector('.cuerpo');
    if (!cuerpo || caja(f)) return;
    var c = document.createElement('div');
    c.className = 'ac-caja';
    cuerpo.insertBefore(c, cuerpo.firstChild);
    c.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ac]');
      if (!b) return;
      var a = b.getAttribute('data-ac');
      if (a === 'abrir') { f.acBuscando = !f.acBuscando; pintar(f); if (!MODELOS) cargar().then(function () { if (f.acBuscando) resultados(f); }, function () {}); }
      else if (a === 'modelo') { var m = modeloPorId(Number(b.getAttribute('data-id'))); if (m) elegirModelo(f, m); }
      else if (a === 'usar' && f.propuesta) elegirModelo(f, f.propuesta.m, f.propuesta.v.color);
      else if (a === 'color') { f.acOtro = false; elegirColor(f, b.getAttribute('data-c')); }
      else if (a === 'otro') { f.acOtro = true; f.color = ''; f.desc.value = f.modelo.nombre; pintar(f); var n = caja(f).querySelector('[data-ac=nuevo]'); if (n) n.focus(); }
      else if (a === 'quitar') quitar(f);
    });
    // Propuesta (nunca elección automática) cuando lo escrito es justo el nombre de un color de un modelo.
    var t;
    f.desc.addEventListener('input', function () {
      if (f.modelo) return;
      clearTimeout(t);
      t = setTimeout(function () { (MODELOS ? Promise.resolve() : cargar()).then(function () { f.propuesta = porNombre(f.desc.value); pintar(f); }, function () {}); }, 400);
    });
    pintar(f);
  }

  // Precio compartido: lo que se escribe en un renglón del modelo pasa a sus otros renglones.
  document.addEventListener('input', function (e) {
    if (!e.target.matches || !e.target.matches('.reng [data-k=precio]')) return;
    var f = filas().filter(function (o) { return o.el.contains(e.target); })[0];
    if (!f || !f.modelo) return;
    f.acPrecioManual = true;
    filas().forEach(function (o) {
      if (o === f || !o.modelo || o.modelo.id !== f.modelo.id) return;
      o.tocado = true; o.precioVal = Number(e.target.value) || 0; o.acPrecioManual = true;
      var i = o.calculo && o.calculo.querySelector('[data-k=precio]');
      if (i) i.value = e.target.value;
    });
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches && e.target.matches('.reng [data-k=precio]')) recalcular();
  });

  // Antes de mandar: un renglón con modelo debe tener color.
  function faltaColor() {
    return filas().filter(function (f) { return f.modelo && !String(f.color || '').trim(); }).length > 0;
  }

  K.altaColor = { fila: fila, detectar: detectar, cargar: cargar, faltaColor: faltaColor };
  cargar().then(function () {}, function () {});
})();
