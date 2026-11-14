/* Kiosko · Colores (panel de PC; Alex, 2026-11-13).
   Junta en un MODELO los productos que son el mismo artículo en distintos colores. Cada producto se queda como está
   (su ID, sus fotos, sus piezas): solo se le dice de qué modelo y color es. Nada se une solo: la pantalla sugiere
   grupos y Alex confirma, corrige el nombre y los colores y, si los precios difieren, elige el precio del modelo.
   Acciones del Worker: sugerenciasModelos, colores, catalogo, agruparModelo, desagruparModelo.
   armar-nueva.py copia este archivo a ocosingo/nueva/ y lo carga desde analisis.html. */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MXN = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  var dinero = function (n) { return '$' + MXN.format(Number(n) || 0); };
  var mayus = function (s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };

  var css = document.createElement('style');
  css.textContent = [
    '#p-colores.on .co-anim{animation:coEntra .32s cubic-bezier(.2,.8,.2,1) both}',
    '@keyframes coEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){#p-colores .co-anim{animation:none!important}}',
    '.co-card{padding:20px 22px;margin-top:18px}',
    '.co-sub{color:var(--gris);margin:4px 0 14px;font-size:13px}',
    '.co-grupo{border:1px solid var(--linea);border-radius:var(--r-sm);padding:14px;margin-top:12px}',
    '.co-grupo h3{margin:0 0 2px;font-size:15px}',
    '.co-cab{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;margin-bottom:10px}',
    '.co-cab label,.co-var label{font-size:12px;color:var(--gris);font-weight:600;display:block;margin-bottom:3px}',
    '#p-colores input[type=text],#p-colores input[type=number],#p-colores input[type=search]{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--r-sm);padding:9px 11px;font:inherit;outline:0;width:100%;box-sizing:border-box}',
    '#p-colores input:focus{border-color:var(--verde)}',
    '.co-vars{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}',
    '.co-var{border:1px solid var(--linea);border-radius:var(--r-sm);padding:10px;display:grid;gap:6px;transition:opacity .15s ease}',
    '.co-var.fuera{opacity:.45}',
    '.co-var img,.co-var .sinfoto{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;background:var(--linea)}',
    '.co-var .sinfoto{display:grid;place-items:center;color:var(--tenue);font-size:12px}',
    '.co-var .d{font-size:13px;line-height:1.3}',
    '.co-var .m{font-size:12px;color:var(--gris)}',
    '.co-var .inc{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:600}',
    '.co-precio{margin-top:12px;padding:10px 12px;border-radius:var(--r-sm);background:var(--naranja-bg);color:var(--naranja-ink);font-size:13px}',
    '.co-precio .ops{display:flex;flex-wrap:wrap;gap:8px 16px;margin-top:6px;align-items:center}',
    '.co-precio input[type=number]{width:110px!important}',
    '.co-err{color:var(--rojo-ink);font-weight:600;min-height:1.2em;margin-top:6px;font-size:13px}',
    '.co-vacio{color:var(--gris);padding:12px 0 4px}',
    '.co-mod{display:grid;grid-template-columns:1fr auto;gap:6px 14px;padding:12px 0;border-top:1px solid var(--linea)}',
    '.co-mod:first-child{border-top:0}',
    '.co-mod .chips{display:flex;flex-wrap:wrap;gap:6px;grid-column:1/-1}',
    '.co-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--linea);border-radius:var(--pill);padding:4px 6px 4px 10px;font-size:13px}',
    '.co-chip button{border:0;background:none;color:var(--tenue);font-size:15px;line-height:1;padding:0 4px;cursor:pointer}',
    '.co-chip button:hover{color:var(--rojo)}',
    '.co-res{max-height:240px;overflow:auto;margin-top:8px}',
    '.co-res button{display:flex;width:100%;justify-content:space-between;gap:10px;border:0;background:none;color:inherit;font:inherit;text-align:left;padding:8px 6px;border-radius:8px}',
    '.co-res button:hover{background:var(--linea)}',
  ].join('\n');
  document.head.appendChild(css);


  // Estado de lo que la persona va corrigiendo, por grupo (llave = sus productos), para que repintar la pantalla
  // (agregar a mano, juntar otro grupo) no regrese palomitas, colores ni precio a como venían (Codex, revisión 3).
  var SUG = null, CATA = null, COLORES = [], MANUAL = [], EST = {}, cargando = null, version = 0, enviando = false;
  function invalidar() { version++; SUG = null; CATA = null; cargando = null; }
  function llave(g) { return g.manual ? 'm' : g.variantes.map(function (v) { return v.pid; }).join(','); }
  function estado(k) { return EST[k] = EST[k] || { nombre: null, vars: {}, precio: null, otro: '', precios: null }; }

  function cargar() {
    if (cargando) return cargando;
    var v = version;
    var pr = Promise.all([
      K.api('sugerenciasModelos', {}, null, 30000),
      K.api('catalogo', {}, null, 30000),
      K.api('colores', {}, null, 30000),
    ]).then(function (r) {
      if (v !== version) { cargando = null; return cargar(); }
      SUG = r[0] || []; CATA = r[1] || []; COLORES = r[2] || []; cargando = null;
    }, function (e) { if (cargando === pr) cargando = null; throw e; });
    cargando = pr;
    return pr;
  }

  function cabecera() {
    return '<div class="top"><div><h1>Colores</h1><p>Junta en un modelo los productos que son lo mismo en otro color. ' +
      'Cada color conserva sus fotos y piezas; el modelo lleva un solo precio y el remate sigue siendo por color.</p></div></div>';
  }

  function abrir() {
    var p = $('p-colores');
    if (!p) return;
    if (!SUG) p.innerHTML = cabecera() + '<div class="card co-card co-vacio">Cargando…</div>';
    cargar().then(pintar, function (e) {
      p.innerHTML = cabecera() + '<div class="card co-card"><div class="co-err">' + esc(e.message) + '</div>' +
        '<div class="acciones"><button class="btn claro" data-co="recargar">Reintentar</button></div></div>';
    });
  }

  function foto(v) {
    return v.imagen ? '<img src="' + esc(v.imagen) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '<div class="sinfoto">Sin foto</div>';
  }

  function tarjetaVariante(v, k, i) {
    var e = estado(k).vars[v.pid] || {};
    var color = e.color != null ? e.color : mayus(v.color);
    var inc = e.inc != null ? e.inc : true;
    var id = 'co-c-' + k.replace(/[^A-Za-z0-9]/g, '_') + '-' + i;
    return '<div class="co-var' + (inc ? '' : ' fuera') + '" data-pid="' + esc(v.pid) + '">' + foto(v) +
      '<div class="d">' + esc(v.descripcion) + '</div>' +
      '<div class="m">' + esc(v.pid) + ' · ' + v.stock + (v.stock === 1 ? ' pieza' : ' piezas') + ' · ' + dinero(v.precio) +
      (v.antes ? ' <s>' + dinero(v.antes) + '</s> (remate)' : '') + '</div>' +
      '<label for="' + id + '">Color</label><input id="' + id + '" type="text" list="co-lista" data-campo="color" value="' + esc(color) + '" maxlength="40">' +
      '<label class="inc"><input type="checkbox" data-campo="inc"' + (inc ? ' checked' : '') + '> Va en el modelo</label></div>';
  }

  // Precio normal de cada color = el de antes del remate si está rematado. Si el Worker contestó precios_distintos,
  // se usan los que mandó (son los de la base, más confiables que los de la pantalla).
  function bloquePrecio(g, k) {
    var st = estado(k), normales = st.precios ? st.precios.slice() : [];
    if (!normales.length) g.variantes.forEach(function (v) { var n = v.antes || v.precio; if (normales.indexOf(n) < 0) normales.push(n); });
    if (normales.length < 2) return '';
    normales.sort(function (a, b) { return a - b; });
    var sel = st.precio != null ? st.precio : String(normales[0]);
    var nom = 'co-p-' + k.replace(/[^A-Za-z0-9]/g, '_');
    return '<div class="co-precio" role="radiogroup" aria-label="Precio del modelo"><b>Los colores tienen precios distintos.</b> Elige el precio del modelo (los colores en remate lo guardan como precio de antes):' +
      '<div class="ops">' + normales.map(function (n) {
        return '<label><input type="radio" name="' + nom + '" data-campo="precio" value="' + n + '"' + (String(n) === sel ? ' checked' : '') + '> ' + dinero(n) + '</label>';
      }).join('') + '<label><input type="radio" name="' + nom + '" data-campo="precio" value="otro"' + (sel === 'otro' ? ' checked' : '') + '> Otro:</label>' +
      '<input type="number" min="1" step="1" data-campo="otro" aria-label="Otro precio del modelo" value="' + esc(st.otro) + '"></div></div>';
  }

  function tarjetaGrupo(g) {
    var k = llave(g), st = estado(k);
    var nombre = st.nombre != null ? st.nombre : g.nombre;
    var id = 'co-n-' + k.replace(/[^A-Za-z0-9]/g, '_');
    return '<div class="co-grupo co-anim" data-k="' + esc(k) + '">' +
      '<div class="co-cab"><div><label for="' + id + '">Nombre del modelo</label><input id="' + id + '" type="text" data-campo="nombre" value="' + esc(nombre) + '" maxlength="120"></div>' +
      '<div class="m" style="color:var(--gris);font-size:13px">' + esc(g.categoria) + (g.origen ? ' · ' + esc(g.origen) : '') + '</div></div>' +
      '<div class="co-vars">' + g.variantes.map(function (v, i) { return tarjetaVariante(v, k, i); }).join('') + '</div>' +
      bloquePrecio(g, k) +
      '<div class="co-err" role="alert"></div>' +
      '<div class="acciones"><button class="btn pri" data-co="agrupar"' + (enviando ? ' disabled' : '') + '>Juntar en un modelo</button>' +
      (g.manual ? '<button class="btn claro" data-co="vaciar">Quitar todos</button>' : '') + '</div></div>';
  }

  // Modelos que ya existen, armados con el catálogo (solo productos con existencia).
  function modelos() {
    var m = {};
    (CATA || []).forEach(function (p) {
      if (!p.modeloId) return;
      var x = m[p.modeloId] = m[p.modeloId] || { id: p.modeloId, nombre: p.modelo, categoria: p.categoria, vars: [] };
      x.vars.push(p);
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  }

  function grupoManual() {
    return MANUAL.length ? { manual: true, nombre: '', categoria: MANUAL[0].categoria, origen: MANUAL[0].origen, variantes: MANUAL } : null;
  }

  function pintar() {
    var p = $('p-colores');
    if (!p || !SUG) return;
    var html = cabecera() + '<datalist id="co-lista">' + COLORES.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>';
    html += '<div class="card co-card co-anim"><h2>Sugerencias</h2><p class="co-sub">Productos cuyo nombre es igual salvo el color. ' +
      'Revisa que de verdad sea el mismo artículo (no "Pro" contra normal), corrige lo que haga falta y quita la palomita a lo que no va.</p>';
    html += SUG.length ? SUG.map(tarjetaGrupo).join('')
      : '<div class="co-vacio">No hay sugerencias: o ya está todo agrupado o los nombres no terminan en un color.</div>';
    html += '</div>';
    var gm = grupoManual();
    html += '<div class="card co-card co-anim"><h2>Juntar a mano</h2><p class="co-sub">Para los que la sugerencia no encontró. Busca y agrega los productos que son el mismo modelo.</p>' +
      '<label for="co-q" class="co-sub" style="display:block;margin:0 0 4px">Buscar producto</label>' +
      '<input type="search" id="co-q" placeholder="Nombre del producto…" autocomplete="off"><div class="co-res" id="co-res"></div>' +
      (gm ? tarjetaGrupo(gm) : '') + '</div>';
    var ms = modelos();
    html += '<div class="card co-card co-anim"><h2>Modelos</h2><p class="co-sub">Toca × para sacar un color de su modelo: vuelve a quedar como producto solo, con su precio y fotos.</p>';
    html += ms.length ? '<div>' + ms.map(function (m) {
      var stock = m.vars.reduce(function (s, v) { return s + v.stock; }, 0);
      return '<div class="co-mod"><div><b>' + esc(m.nombre) + '</b> <span style="color:var(--gris);font-size:13px">' + esc(m.categoria) + '</span></div>' +
        '<div style="font-size:13px;color:var(--gris)">' + stock + (stock === 1 ? ' pieza' : ' piezas') + '</div>' +
        '<div class="chips">' + m.vars.map(function (v) {
          return '<span class="co-chip">' + esc(v.color) + ' · ' + v.stock + ' · ' + dinero(v.precio) + (v.antes ? ' (remate)' : '') +
            '<button data-co="sacar" data-pid="' + esc(v.pid) + '"' + (enviando ? ' disabled' : '') + ' aria-label="Sacar ' + esc(v.color) + ' de ' + esc(m.nombre) + '">×</button></span>';
        }).join('') + '</div></div>';
    }).join('') + '</div>' : '<div class="co-vacio">Todavía no hay modelos.</div>';
    html += '</div>';
    p.innerHTML = html;
    var q = $('co-q');
    if (q) q.addEventListener('input', buscar);
  }

  function buscar() {
    var t = String($('co-q').value || '').trim().toLowerCase(), r = $('co-res');
    if (t.length < 2) { r.innerHTML = ''; return; }
    var base = MANUAL[0];
    var ya = MANUAL.map(function (v) { return v.pid; });
    var lista = (CATA || []).filter(function (p) {
      return !p.modeloId && ya.indexOf(p.pid) < 0 && p.descripcion.toLowerCase().indexOf(t) > -1 &&
        (!base || (p.categoria === base.categoria && p.origen === base.origen));
    }).slice(0, 30);
    r.innerHTML = lista.length ? lista.map(function (p) {
      return '<button data-co="sumar" data-pid="' + esc(p.pid) + '"><span>' + esc(p.descripcion) + '</span><span style="color:var(--gris)">' +
        esc(p.categoria) + ' · ' + dinero(p.precio) + '</span></button>';
    }).join('') : '<div class="co-vacio">Nada' + (base ? ' de ' + esc(base.categoria) + ' de ' + esc(base.origen) : '') + ' con ese nombre.</div>';
  }

  function grupoPorLlave(k) {
    if (k === 'm') return grupoManual();
    return (SUG || []).filter(function (g) { return llave(g) === k; })[0];
  }

  // Al terminar de juntar o sacar: datos nuevos aquí y en el resto del panel (Inventario, Resumen).
  function despues() {
    invalidar();
    if (K.recargarDespues) K.recargarDespues();
    abrir();
  }

  function agrupar(btn) {
    var caja = btn.closest('.co-grupo'), err = caja.querySelector('.co-err'), k = caja.getAttribute('data-k');
    var g = grupoPorLlave(k), st = estado(k);
    if (!g || enviando) return;
    var nombre = st.nombre != null ? st.nombre.trim() : String(g.nombre || '').trim();
    var vars = [];
    g.variantes.forEach(function (v) {
      var e = st.vars[v.pid] || {};
      if (e.inc === false) return;
      vars.push({ pid: v.pid, color: String(e.color != null ? e.color : mayus(v.color)).trim() });
    });
    err.textContent = '';
    if (!nombre) { err.textContent = 'Falta el nombre del modelo.'; return; }
    if (!vars.length) { err.textContent = 'Marca al menos un color.'; return; }
    if (vars.some(function (v) { return !v.color; })) { err.textContent = 'A un color le falta su nombre.'; return; }
    var cuerpo = { modelo: { nombre: nombre, variantes: vars } };
    if (caja.querySelector('.co-precio')) {
      var sel = caja.querySelector('[data-campo=precio]:checked');
      var pr = !sel ? 0 : sel.value === 'otro' ? Number(st.otro) : Number(sel.value);
      if (!(pr > 0)) { err.textContent = 'Escribe el precio del modelo.'; return; }
      cuerpo.modelo.precio = pr;
    }
    enviando = true; btn.disabled = true; btn.textContent = 'Juntando…';
    K.api('agruparModelo', null, cuerpo, 30000).then(function (r) {
      enviando = false;
      if (!r || !r.success) {
        if (r && r.codigo === 'precios_distintos' && r.precios) { st.precios = r.precios; st.precio = null; pintar(); }
        var c = document.querySelector('.co-grupo[data-k="' + k.replace(/"/g, '') + '"]') || caja;
        c.querySelector('.co-err').textContent = (r && r.error) || 'No se pudo juntar.';
        var b = c.querySelector('[data-co=agrupar]'); if (b) { b.disabled = false; b.textContent = 'Juntar en un modelo'; }
        return;
      }
      delete EST[k];
      if (k === 'm') MANUAL = [];
      despues();
    }, function (e) {
      enviando = false;
      var c = document.querySelector('.co-grupo[data-k="' + k.replace(/"/g, '') + '"]') || caja;
      c.querySelector('.co-err').textContent = e.message;
      var b = c.querySelector('[data-co=agrupar]'); if (b) { b.disabled = false; b.textContent = 'Juntar en un modelo'; }
    });
  }

  function sacar(btn) {
    if (enviando) return;
    var pid = btn.getAttribute('data-pid');
    enviando = true; btn.disabled = true;
    K.api('desagruparModelo', null, { pid: pid }, 30000).then(function (r) {
      enviando = false;
      if (!r || !r.success) { btn.disabled = false; alerta((r && r.error) || 'No se pudo sacar.'); return; }
      despues();
    }, function (e) { enviando = false; btn.disabled = false; alerta(e.message); });
  }
  function alerta(m) { K.abrirHTML('<h3 style="margin:0">No se pudo</h3><p class="co-sub">' + esc(m) + '</p><div class="acciones"><button class="btn pri" data-cerrar="1">Listo</button></div>'); }

  // Todo lo que se escribe o marca se guarda en EST al momento.
  function guardar(e) {
    var t = e.target, caja = t.closest && t.closest('#p-colores .co-grupo');
    if (!caja) return;
    var st = estado(caja.getAttribute('data-k')), c = t.getAttribute('data-campo');
    var v = t.closest('.co-var'), pid = v && v.getAttribute('data-pid');
    if (c === 'nombre') st.nombre = t.value;
    else if (c === 'color' && pid) (st.vars[pid] = st.vars[pid] || {}).color = t.value;
    else if (c === 'inc' && pid) { (st.vars[pid] = st.vars[pid] || {}).inc = t.checked; v.classList.toggle('fuera', !t.checked); }
    else if (c === 'precio') st.precio = t.value;
    else if (c === 'otro') {
      st.otro = t.value; st.precio = 'otro';
      var r = caja.querySelector('[data-campo=precio][value=otro]'); if (r) r.checked = true;
    }
  }
  document.addEventListener('input', guardar);
  document.addEventListener('change', guardar);

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#p-colores [data-co]');
    if (!b) return;
    var a = b.getAttribute('data-co');
    if (a === 'recargar') { invalidar(); abrir(); }
    else if (a === 'agrupar') agrupar(b);
    else if (a === 'sacar') sacar(b);
    else if (a === 'vaciar') { MANUAL = []; delete EST.m; pintar(); }
    else if (a === 'sumar') {
      var p = (CATA || []).filter(function (x) { return x.pid === b.getAttribute('data-pid'); })[0];
      if (p) {
        MANUAL.push({ pid: p.pid, descripcion: p.descripcion, color: '', precio: p.precio, antes: p.antes || 0, stock: p.stock,
          imagen: p.imagen || '', categoria: p.categoria, origen: p.origen });
        estado('m').precios = null;
        pintar();
        var q = $('co-q'); if (q) q.focus();
      }
    }
  });

  window.KIOSKO.colores = { abrir: abrir, olvidar: invalidar };
})();
