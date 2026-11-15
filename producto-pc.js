/* Hoja de un producto en el panel de PC (Kiosko 14.5, 2026-11-14; plan revisado por Codex).
   En Inventario, tocar un producto de tu mercancía abre sus números (existencia, compras con su costo, ventas por mes)
   y, abajo, editar nombre, categoría y precio normal, y poner o quitar la rebaja de temporada.
   Servidor: src/producto.js (productoDetalle, editarMiProducto, ponerRebaja, quitarRebaja). Nada aquí toca el costo
   ni las existencias. Usa el puente del panel (window.KIOSKO: api, abrirHTML, recargar). */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K || !document.getElementById('p-inventario')) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var mx = function (n) { n = Number(n) || 0; var s = Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); return (n < 0 ? '−$' : '$') + s; };
  var num = function (v) { var n = parseFloat(String(v == null ? '' : v).replace(/[$\s,]/g, '')); return isFinite(n) ? n : 0; };
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var mesTxt = function (m) { var p = String(m || '').split('-'); return p.length === 2 ? MESES[+p[1] - 1] + ' ' + p[0] : m; };
  var fechaTxt = function (f) { var p = String(f || '').split('-'); return p.length === 3 ? +p[2] + ' ' + MESES[+p[1] - 1] + ' ' + p[0] : (f || '—'); };
  var hace = function (ms) { if (!ms) return '—'; var d = Math.max(0, Math.floor((Date.now() - ms) / 86400000)); return d === 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días'; };
  var abierto = '', apertura = 0;   // pid y número de la hoja abierta: una respuesta vieja no pisa otra hoja
  var visible = function (n) { var mo = document.getElementById('mo'); return n === apertura && !!document.getElementById('kp') && !!mo && mo.classList.contains('on'); };

  var css = document.createElement('style');
  css.textContent = [
    '.kn-tap{cursor:pointer;border-radius:12px}.kn-tap:hover b{text-decoration:underline;text-underline-offset:3px}',
    '.kn-tap:focus-visible{outline:2px solid var(--kn-focus,#245BCC);outline-offset:4px}',
    '.kp-cab{display:flex;gap:14px;align-items:center;margin-bottom:14px}.kp-cab img,.kp-cab .kp-sin{width:64px;height:64px;border-radius:14px;object-fit:cover;background:var(--kn-tono,#EAEDE5);flex:none}',
    '.kp-cab h3{margin:0;font-size:20px}.kp-cab small{display:block;color:var(--gris)}',
    '.kp-cifras{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:6px 0 16px}',
    '@media (max-width:700px){.kp-cifras{grid-template-columns:repeat(2,minmax(0,1fr))}}',
    '.kp-c{border:1px solid var(--linea);border-radius:14px;padding:10px 12px}.kp-c span{display:block;font-size:12px;color:var(--gris);font-weight:600}',
    '.kp-c b{font-size:18px;font-variant-numeric:tabular-nums}',
    '.kp-sec{margin:18px 0 6px;font-size:14px;font-weight:750}',
    '.kp-t{width:100%;border-collapse:collapse;font-size:13.5px}.kp-t th{text-align:left;color:var(--gris);font-weight:650;padding:6px 8px;border-bottom:1px solid var(--linea)}',
    '.kp-t td{padding:7px 8px;border-bottom:1px solid var(--linea)}.kp-t .n{text-align:right;font-variant-numeric:tabular-nums}',
    '.kp-barra{display:inline-block;height:8px;border-radius:4px;background:var(--verde);vertical-align:middle;margin-right:6px}',
    '.kp-form{display:grid;grid-template-columns:2fr 1.2fr 1fr;gap:10px;align-items:end}@media (max-width:700px){.kp-form{grid-template-columns:1fr}}',
    '.kp-form label span{display:block;font-size:12px;font-weight:650;color:var(--gris);margin-bottom:4px}',
    '.kp-form input{width:100%;box-sizing:border-box;border:1px solid var(--kn-control-border,#77826F);border-radius:12px;padding:10px 12px;background:var(--card);color:var(--ink);font:inherit;min-height:44px}',
    '.kp-acc{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:flex-end}',
    '.kp-lab span{display:block;font-size:12px;font-weight:650;color:var(--gris);margin-bottom:4px}',
    '.kp-lab input{box-sizing:border-box;border:1px solid var(--kn-control-border,#77826F);border-radius:12px;padding:10px 12px;background:var(--card);color:var(--ink);font:inherit;min-height:44px}',
    '.kp-reb{border-radius:16px;padding:12px 14px;margin-top:8px;background:var(--kn-warning-bg,#FFF0CF);color:var(--kn-warning,#795000)}',
    '.kp-msg{margin-top:10px;font-weight:650}.kp-msg.ok{color:var(--verde)}.kp-msg.mal{color:var(--rojo)}',
    '.kp-nota{color:var(--gris);font-size:13px;margin-top:6px}',
  ].join('\n');
  document.head.appendChild(css);

  function abrir(pid) {
    abierto = pid; var n = ++apertura;
    K.abrirHTML('<div id="kp" data-pid="' + esc(pid) + '"><div class="cargando"><div class="spin"></div>Cargando…</div></div>');
    K.api('productoDetalle', { pid: pid }).then(function (d) {
      if (!visible(n)) return;
      if (!d || d.success === false) { document.getElementById('kp').innerHTML = '<p class="menos">' + esc((d && d.error) || 'No se pudo abrir el producto') + '</p>'; return; }
      pintar(d, n);
    }).catch(function (e) {
      if (!visible(n)) return;
      document.getElementById('kp').innerHTML = '<p class="menos">' + esc(e.message || 'Sin conexión') + '</p>';
    });
  }

  function pintar(d, n) {
    var v = d.ventas, maxN = Math.max.apply(null, v.porMes.map(function (m) { return m.n; }).concat([1]));
    var colores = d.modelo ? d.modelo.colores.length : 0;
    var h = '<div class="kp-cab">' + (d.imagen ? '<img src="' + esc(d.imagen) + '" alt="">' : '<div class="kp-sin"></div>') +
      '<div><h3>' + esc(d.descripcion) + '</h3><small>' + esc(d.categoria) + ' · ' + esc(d.pid) +
      (d.modelo ? ' · color de ' + esc(d.modelo.nombre) + ' (' + colores + (colores === 1 ? ' color' : ' colores') + ')' : '') +
      (d.deAlex ? '' : ' · de ' + esc(d.dueno)) + '</small></div></div>';
    h += '<div class="kp-cifras">' +
      '<div class="kp-c"><span>Precio</span><b>' + mx(d.precio) + '</b>' + (d.rebaja ? ' <s class="kn-antes">' + mx(d.normal) + '</s>' : '') + '</div>' +
      '<div class="kp-c"><span>Existencia' + (d.modelo ? ' del modelo' : '') + '</span><b>' + d.existencia + '</b> pzas</div>' +
      '<div class="kp-c"><span>Vendidas en 12 meses</span><b>' + v.ultimos12 + '</b></div>' +
      '<div class="kp-c"><span>Última venta</span><b>' + (v.ultima ? hace(v.ultima) : (v.sinFecha ? 'sin fecha' : 'nunca')) + '</b></div></div>';
    if (d.modelo) h += '<p class="kp-nota">Las cifras son del modelo completo: ' + d.modelo.colores.map(function (c) {
      return esc(c.color || 'sin color') + ' ' + c.stock + (c.rebaja ? ' (rebaja ' + mx(c.rebaja) + ')' : ''); }).join(' · ') + '.</p>';

    // Orden: lo que más se usa (rebaja y editar) va justo después de las cifras; los historiales, al final.
    var ventasH = '<div class="kp-sec">Ventas por mes (últimos 12 meses)</div>' + (v.porMes.length ?
      '<table class="kp-t"><thead><tr><th>Mes</th><th>Piezas</th><th class="n">Vendido</th><th class="n">Ganancia</th></tr></thead><tbody>' +
      v.porMes.map(function (m) {
        return '<tr><td>' + esc(mesTxt(m.mes)) + '</td><td><span class="kp-barra" style="width:' + Math.max(4, Math.round(m.n / maxN * 120)) + 'px"></span>' + m.n +
          '</td><td class="n">' + mx(m.ingreso) + '</td><td class="n ' + (m.ganancia >= 0 ? 'mas' : 'menos') + '">' + mx(m.ganancia) + '</td></tr>';
      }).join('') + '</tbody></table>' : '<p class="kp-nota">Sin ventas en los últimos 12 meses.</p>');
    var VISIBLES = 6;
    var fila = function (c, i) { return '<tr' + (i >= VISIBLES ? ' class="kp-mas" hidden' : '') + '><td>' + esc(fechaTxt(c.fecha)) + '</td><td class="n">' + c.piezas +
      '</td><td class="n">' + mx(c.costo) + '</td><td class="n">' + c.quedan + '</td></tr>'; };
    var comprasH = '<div class="kp-sec">Compras</div>' + (d.compras.length ?
      '<table class="kp-t"><thead><tr><th>Fecha</th><th class="n">Piezas</th><th class="n">Costo por pieza</th><th class="n">Quedan</th></tr></thead><tbody>' +
      d.compras.map(fila).join('') + '</tbody></table>' +
      (d.compras.length > VISIBLES ? '<button class="btn claro" id="kp-vertodas" style="margin-top:8px">Ver todas (' + d.compras.length + ')</button>' : '') +
      (d.existencia ? '<p class="kp-nota">Costo promedio de lo que hay: ' + mx(d.costoPromedio) + ' por pieza.</p>' : '') : '<p class="kp-nota">Sin compras registradas.</p>');

    if (!d.deAlex) {
      h += '<p class="kp-nota" style="margin:4px 0 6px">Mercancía de ' + esc(d.dueno) + ': se edita desde su teléfono.</p>';
    } else {
      h += '<div class="kp-sec">Rebaja de temporada' + (d.modelo ? ' (solo este color)' : '') + '</div>';
      h += (d.rebaja ? '<div class="kp-reb">En rebaja: <b>' + mx(d.rebaja) + '</b> · precio normal ' + mx(d.normal) + '.</div>' : '') +
        '<div class="kp-acc"><label class="kp-lab"><span>' + (d.rebaja ? 'Cambiar la rebaja a' : 'Precio de rebaja') + '</span>' +
        '<input id="kp-reb" inputmode="decimal" placeholder="Menor que ' + mx(d.normal) + '" style="width:12em"></label>' +
        '<button class="btn pri" id="kp-poner">' + (d.rebaja ? 'Cambiar rebaja' : 'Poner rebaja') + '</button>' +
        (d.rebaja ? '<button class="btn claro" id="kp-quitar">Quitar rebaja</button>' : '') + '</div>' +
        '<p class="kp-nota">La rebaja se ve en la app de venta, en el catálogo y en el enlace de Muse. Las ventas ya hechas no cambian.</p>';
      h += '<div class="kp-sec">Editar</div><div class="kp-form">' +
        '<label><span>Nombre</span><input id="kp-nom" maxlength="120" value="' + esc(d.descripcion) + '"></label>' +
        '<label><span>Categoría</span><input id="kp-cat" maxlength="60" list="kp-cats" value="' + esc(d.categoria) + '"' + (d.modelo ? ' disabled title="Es un color de un modelo"' : '') + '></label>' +
        '<label><span>Precio normal</span><input id="kp-pre" inputmode="decimal" value="' + esc(d.normal) + '"></label></div>' +
        '<datalist id="kp-cats">' + d.categorias.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>' +
        (d.modelo ? '<p class="kp-nota">El precio normal cambia en los ' + colores + ' colores del modelo; sus rebajas se conservan. La categoría se cambia sacándolo del modelo en Colores.</p>' : '') +
        '<div class="kp-acc"><button class="btn pri" id="kp-guardar">Guardar cambios</button></div>';
      h += '<div id="kp-msg" class="kp-msg" role="status"></div>';
    }
    h += ventasH + comprasH + '<div class="acciones" style="margin-top:14px"><button class="btn claro" data-cerrar="1">Cerrar</button></div>';
    var cont = document.getElementById('kp');
    cont.innerHTML = h;
    var vt = document.getElementById('kp-vertodas');
    if (vt) vt.addEventListener('click', function () { cont.querySelectorAll('.kp-mas').forEach(function (r) { r.hidden = false; }); vt.remove(); });
    if (!d.deAlex) return;

    var msg = function (t, ok) { var m = document.getElementById('kp-msg'); if (m) { m.textContent = t; m.className = 'kp-msg ' + (ok ? 'ok' : 'mal'); } };
    var enviar = function (b, accion, cuerpo, ok) {
      if (b.disabled) return;
      var pid = d.pid, texto = b.textContent;
      b.disabled = true; b.textContent = 'Guardando…';
      K.api(accion, null, cuerpo).then(function (r) {
        if (r && r.success && K.recargar) K.recargar();       // el inventario se actualiza aunque la hoja ya esté cerrada
        if (!visible(n)) return;
        if (!r || !r.success) { b.disabled = false; b.textContent = texto; msg((r && r.error) || 'No se pudo guardar', false); return; }
        abrir(pid);
        var m2 = apertura;
        setTimeout(function () { if (visible(m2)) msg(ok, true); }, 600);
      }).catch(function (e) {
        if (!visible(n)) return;
        // Respuesta perdida: pudo haberse guardado. Se vuelve a leer antes de afirmar nada.
        b.disabled = false; b.textContent = texto; msg('No se pudo confirmar. Vuelve a abrir el producto para ver si se guardó.', false);
      });
    };
    document.getElementById('kp-guardar').addEventListener('click', function () {
      var pre = num(document.getElementById('kp-pre').value);
      if (!(pre > 0)) { msg('Escribe el precio normal.', false); return; }
      enviar(this, 'editarMiProducto', { producto: { pid: d.pid, descripcion: document.getElementById('kp-nom').value,
        categoria: document.getElementById('kp-cat').value, precio: pre } }, 'Cambios guardados.');
    });
    document.getElementById('kp-poner').addEventListener('click', function () {
      var r = num(document.getElementById('kp-reb').value);
      if (!(r > 0) || r >= d.normal) { msg('La rebaja debe ser menor que el precio normal (' + mx(d.normal) + ').', false); return; }
      enviar(this, 'ponerRebaja', { pid: d.pid, precio: r }, 'Rebaja guardada: ' + mx(r) + '.');
    });
    var q = document.getElementById('kp-quitar');
    if (q) q.addEventListener('click', function () {
      if (!q.dataset.ok) { q.dataset.ok = '1'; q.textContent = 'Toca otra vez para volver a ' + mx(d.normal); return; }
      enviar(q, 'quitarRebaja', { pid: d.pid }, 'Rebaja quitada: vuelve a ' + mx(d.normal) + '.');
    });
  }

  // Tocar (o Enter / espacio sobre) un producto de la tabla de Inventario. Las casillas de remate siguen igual.
  var tabla = document.getElementById('i-tabla');
  if (!tabla) return;
  tabla.addEventListener('click', function (e) {
    if (e.target.closest('.chk')) return;
    var t = e.target.closest('.kn-tap[data-pid]');
    if (t) abrir(t.dataset.pid);
  });
  tabla.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target.closest('.kn-tap[data-pid]');
    if (t) { e.preventDefault(); abrir(t.dataset.pid); }
  });
})();
