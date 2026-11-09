/* Kiosko · La cuenta (panel de PC, fase 1; Alex, 2026-11-08).
   Lo que se debe a Alex por ventas de su mercancía: lo que aún no entra a un corte, los cortes abiertos con sus abonos
   y el historial. Usa las acciones del Worker `cuenta`, `historialCortes`, `cortes` (detalle por id), `cerrarCorte` y
   `registrarPago`. armar-nueva.py copia este archivo a ocosingo/nueva/ y lo carga desde analisis.html.
   Abonos: misma clave pendiente que la app del celular (kn:pagoPend:CORTE), así un abono sin confirmar en un lado se
   respeta en el otro y reintentar nunca lo duplica. */
(function () {
  'use strict';
  var K = window.KIOSKO;
  if (!K) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MXN = new Intl.NumberFormat('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var MXN0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  var dinero = function (n) { return '$' + MXN.format(Number(n) || 0); };
  var dinero0 = function (n) { return '$' + MXN0.format(Math.round(Number(n) || 0)); };
  var FECHA = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Monterrey', day: 'numeric', month: 'short', year: 'numeric' });
  var fecha = function (ms) { return ms ? FECHA.format(new Date(ms)).replace('.', '') : '—'; };
  var ESTADO = { 'Por pagar': 'por', 'Parcial': 'par', 'Pagado': 'ok', 'A favor': 'fav' };

  /* ---------- estilos propios (con las variables de ui.css) ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '#p-cuenta.on .cu-anim{animation:cuEntra .32s cubic-bezier(.2,.8,.2,1) both}',
    '#p-cuenta.on .cu-anim:nth-child(2){animation-delay:.04s}#p-cuenta.on .cu-anim:nth-child(3){animation-delay:.08s}',
    '@keyframes cuEntra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '@media (prefers-reduced-motion:reduce){#p-cuenta .cu-anim{animation:none!important}.cu-fila{transition:none!important}}',
    '.cu-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;margin-top:18px}',
    '@media (max-width:1100px){.cu-grid{grid-template-columns:1fr}}',
    '.cu-card{padding:20px 22px}',
    '.cu-card h2{font-size:15px;font-weight:700;margin:0;display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
    '.cu-card h2 .num{font-family:var(--mono);font-size:15px}',
    '.cu-sub{color:var(--gris);margin:4px 0 14px;font-size:13px}',
    '.cu-vend{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}',
    '.cu-vend span{border:1px solid var(--linea);border-radius:var(--pill);padding:5px 11px;font-weight:600;font-size:13px}',
    '.cu-vend b{font-family:var(--mono);margin-left:6px}',
    '.cu-lista{display:flex;flex-direction:column}',
    '.cu-fila{display:grid;grid-template-columns:1fr auto;gap:2px 14px;align-items:center;padding:11px 10px;margin:0 -10px;border-radius:var(--r-sm);border:0;background:none;text-align:left;width:calc(100% + 20px);color:inherit;font:inherit;transition:background .15s ease}',
    'button.cu-fila{cursor:pointer}button.cu-fila:hover{background:var(--hover)}',
    '.cu-fila+.cu-fila{box-shadow:inset 0 1px 0 var(--linea)}',
    '.cu-fila .t{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cu-fila .d{color:var(--gris);font-size:13px;grid-column:1}',
    '.cu-fila .m{font-family:var(--mono);font-weight:700;grid-row:1/3;grid-column:2;text-align:right}',
    '.cu-fila .m small{display:block;font-family:var(--sans);font-weight:600;font-size:12px;color:var(--gris)}',
    '.cu-est{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;border-radius:var(--pill);padding:2px 8px;margin-left:8px;vertical-align:1px}',
    '.cu-est.por{background:var(--naranja-bg);color:var(--naranja-ink)}.cu-est.par{background:var(--azul-bg);color:var(--azul-ink)}',
    '.cu-est.ok{background:var(--verde-bg);color:var(--verde-ink)}.cu-est.fav{background:var(--azul-bg);color:var(--azul-ink)}',
    '.cu-vacio{color:var(--gris);padding:18px 0 6px}',
    '.cu-buscar{display:flex;gap:10px;margin:0 0 10px}',
    '.cu-buscar input{flex:1;border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--r-sm);padding:9px 12px;font:inherit;outline:0;transition:border-color .15s}',
    '.cu-buscar input:focus{border-color:var(--verde)}',
    '.cu-mas{margin-top:10px}',
    '.cu-tot{display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin:14px 0;padding:14px 16px;border:1px solid var(--linea);border-radius:var(--r-sm)}',
    '.cu-tot span{color:var(--gris)}.cu-tot b{font-family:var(--mono);text-align:right}',
    '.cu-tot .s{color:var(--ink);font-weight:700}.cu-tot .s+b{font-size:18px}',
    '.cu-form{display:grid;grid-template-columns:180px 1fr auto;gap:10px;align-items:center;margin:4px 0 6px}',
    '@media (max-width:700px){.cu-form{grid-template-columns:1fr}}',
    '.cu-form input{border:1px solid var(--linea);background:var(--card);color:var(--ink);border-radius:var(--r-sm);padding:10px 12px;font:inherit;outline:0}',
    '.cu-form input:focus{border-color:var(--verde)}.cu-form .monto{font-family:var(--mono);font-weight:700}',
    '.cu-h3{font-size:13px;font-weight:700;color:var(--gris);text-transform:uppercase;letter-spacing:.04em;margin:18px 0 4px}',
    '.cu-err{color:var(--rojo-ink);font-weight:600;min-height:1.2em;margin-top:6px}',
    '.cu-hero .acc{display:flex;flex-direction:column;align-items:flex-end;gap:8px}',
    '.cu-hero .btn.pri:not(:disabled){transition:transform .12s ease}.cu-hero .btn.pri:not(:disabled):active{transform:scale(.97)}',
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- ventana (modal de analisis.html) accesible ---------- */
  var antesDelModal = null, nuestro = false;   // solo las ventanas de La cuenta reciben estos ajustes
  function modal(html) {
    var mo = $('mo');
    if (!mo.classList.contains('on')) antesDelModal = document.activeElement;
    K.abrirHTML(html);
    nuestro = true;
    enfocar();
    var t = $('mo-in').querySelector('h3');
    if (t) { t.id = 'cu-mo-t'; mo.setAttribute('aria-labelledby', 'cu-mo-t'); }
    mo.setAttribute('role', 'dialog'); mo.setAttribute('aria-modal', 'true');
  }
  function enfocar() {
    var f = $('mo-in').querySelector('input:not([readonly]),button:not([disabled])');
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function cerrarModal() { $('mo').classList.remove('on'); }
  if ($('mo')) new MutationObserver(function () {
    var mo = $('mo');
    if (mo.classList.contains('on') || !nuestro) return;
    nuestro = false;
    mo.removeAttribute('role'); mo.removeAttribute('aria-modal'); mo.removeAttribute('aria-labelledby');
    // Si el control de antes ya no existe (la pantalla se volvió a pintar), el foco va al título de La cuenta.
    var dest = antesDelModal && document.body.contains(antesDelModal) ? antesDelModal : document.querySelector('#p-cuenta h1');
    if (dest) { if (!dest.hasAttribute('tabindex') && dest.tagName === 'H1') dest.setAttribute('tabindex', '-1'); try { dest.focus(); } catch (e) {} }
    antesDelModal = null;
  }).observe($('mo'), { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('keydown', function (e) {
    var mo = $('mo');
    if (e.key !== 'Tab' || !nuestro || !mo || !mo.classList.contains('on')) return;
    var fs = [].slice.call($('mo-in').querySelectorAll('button:not([disabled]),input,a[href]'));
    if (!fs.length) return;
    var a = fs[0], z = fs[fs.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  });

  /* ---------- estado ---------- */
  var DATOS = null, HIST = { q: '', pagina: 0, cortes: [], mas: false, cargando: false, gen: 0 };
  var cargando = null, version = 0;
  // Cada escritura invalida: una lectura que empezó antes no puede volver a mostrar saldos viejos (Codex).
  function invalidar() { version++; DATOS = null; cargando = null; HIST.cortes = []; HIST.pagina = 0; HIST.mas = false; HIST.cargando = false; HIST.gen++; }

  function saldoAbierto(cortes) {
    return (cortes || []).reduce(function (s, c) { return s + (c.estado === 'Pagado' ? 0 : Number(c.saldo) || 0); }, 0);
  }
  function porCobrar() { return DATOS ? (Number(DATOS.pendiente.total) || 0) + saldoAbierto(DATOS.cortes) : 0; }

  function badge() {
    var b = $('nav-cuenta');
    if (!b) return;
    if (!DATOS) { cargar().then(badge, function () {}); return; }
    var v = porCobrar();
    b.textContent = v > 0 ? dinero0(v) : '';
  }

  function cargar() {
    if (cargando) return cargando;
    var v = version;
    var pr = K.api('cuenta', {}, null, 30000).then(function (d) {
      if (v !== version) return cargar();   // hubo una escritura mientras tanto: se lee de nuevo
      DATOS = d; cargando = null; return d;
    }, function (e) { if (cargando === pr) cargando = null; throw e; });
    cargando = pr;
    return pr;
  }

  /* ---------- pantalla ---------- */
  function abrir() {
    var p = $('p-cuenta');
    if (!p) return;
    if (!DATOS) p.innerHTML = cabecera() + '<div class="card cu-card cu-vacio">Cargando…</div>';
    cargar().then(function () { pintar(); badge(); if (!HIST.cortes.length && !HIST.cargando) historial(true); },
      function (e) { p.innerHTML = cabecera() + '<div class="card cu-card"><div class="cu-err">' + esc(e.message) + '</div>' +
        '<div class="acciones"><button class="btn claro" data-cu="recargar">Reintentar</button></div></div>'; });
  }

  function cabecera() {
    return '<div class="top"><div><h1>La cuenta</h1><p>Saldo por cobrar a vendedores y control de cortes.</p></div></div>';
  }

  function pintar() {
    var p = $('p-cuenta'), d = DATOS, pen = d.pendiente;
    var abiertos = d.cortes.filter(function (c) { return c.estado !== 'Pagado'; });
    var pagados = d.cortes.filter(function (c) { return c.estado === 'Pagado'; });
    var html = cabecera();
    html += '<div class="hero cu-hero cu-anim"><div><div class="lb">Por cobrar</div><div class="big">' + dinero(porCobrar()) + '</div>' +
      '<div class="sub">' + pen.n + (pen.n === 1 ? ' venta sin corte' : ' ventas sin corte') + ' · ' +
      abiertos.length + (abiertos.length === 1 ? ' corte abierto' : ' cortes abiertos') + '</div></div>' +
      '<div class="acc"><button class="btn pri" data-cu="cerrar"' + (pen.n ? '' : ' disabled') + '>Cerrar corte</button></div></div>';
    html += '<div class="cu-grid">';
    // Sin corte
    html += '<div class="card cu-card cu-anim"><h2>Sin corte <span class="num">' + dinero(pen.total) + '</span></h2>' +
      '<p class="cu-sub">Ventas de tu mercancía que entrarán al próximo corte.</p>';
    if (pen.porVendedor.length > 1) {
      html += '<div class="cu-vend">' + pen.porVendedor.map(function (v) {
        return '<span>' + esc(v.vendedor) + '<b>' + dinero(v.total) + '</b></span>'; }).join('') + '</div>';
    }
    html += pen.ventas.length ? '<div class="cu-lista">' + pen.ventas.map(filaVenta).join('') + '</div>'
      : '<div class="cu-vacio">No hay ventas pendientes de corte.</div>';
    html += '</div>';
    // Cortes
    html += '<div class="card cu-card cu-anim"><h2>Cortes abiertos</h2><p class="cu-sub">Toca un corte para ver sus ventas o registrar un abono.</p>';
    html += abiertos.length ? '<div class="cu-lista">' + abiertos.map(filaCorte).join('') + '</div>'
      : '<div class="cu-vacio">Todos los cortes están pagados.</div>';
    if (pagados.length) html += '<div class="cu-h3">Pagados recientes</div><div class="cu-lista">' + pagados.slice(0, 3).map(filaCorte).join('') + '</div>';
    html += '</div></div>';
    // Historial
    html += '<div class="card cu-card cu-anim" style="margin-top:18px"><h2>Historial de cortes</h2><p class="cu-sub">Busca por número (C-0002) o por fecha (2026-11).</p>' +
      '<form class="cu-buscar" data-cu-form="buscar"><input id="cu-q" aria-label="Buscar corte por número o fecha" placeholder="Número o fecha" autocomplete="off" value="' + esc(HIST.q) + '">' +
      '<button class="btn claro" type="submit">Buscar</button></form><div id="cu-hist"></div></div>';
    p.innerHTML = html;
    pintarHistorial();
  }

  function filaVenta(v) {
    return '<div class="cu-fila"><div class="t">' + esc(v.descripcion) + '</div>' +
      '<div class="d">' + esc(v.vendedor) + ' · ' + fecha(v.fechaTimestamp) + ' · ' + esc(v.metodoPago || '') + '</div>' +
      '<div class="m">' + dinero(v.aporte) + '<small>vendida en ' + dinero(v.precio) + '</small></div></div>';
  }

  function filaCorte(c) {
    var est = '<span class="cu-est ' + (ESTADO[c.estado] || 'por') + '">' + esc(c.estado) + '</span>';
    var m = c.estado === 'Pagado' ? dinero(c.total) : dinero(c.saldo) + '<small>de ' + dinero(c.total) + '</small>';
    return '<button class="cu-fila" data-cu-corte="' + esc(c.id) + '"><div class="t">' + esc(c.id) + est + '</div>' +
      '<div class="d">' + fecha(c.fecha) + ' · ' + c.n + (c.n === 1 ? ' venta' : ' ventas') + '</div><div class="m">' + m + '</div></button>';
  }

  /* ---------- historial ---------- */
  // Cada búsqueda lleva su número: la respuesta de una búsqueda anterior se descarta (Codex). La página avanza solo
  // cuando llega bien.
  function historial(nuevo) {
    if (!nuevo && HIST.cargando) return;
    var gen = nuevo ? ++HIST.gen : HIST.gen;
    var pagina = nuevo ? 0 : HIST.pagina + 1;
    if (nuevo) { HIST.cortes = []; HIST.mas = false; }
    HIST.cargando = true; pintarHistorial();
    K.api('historialCortes', { q: HIST.q, pagina: pagina }, null, 30000).then(function (r) {
      if (gen !== HIST.gen) return;
      HIST.pagina = pagina; HIST.cortes = HIST.cortes.concat(r.cortes || []); HIST.mas = !!r.mas; HIST.cargando = false; pintarHistorial();
    }, function (e) { if (gen !== HIST.gen) return; HIST.cargando = false; pintarHistorial(e.message); });
  }

  function pintarHistorial(error) {
    var h = $('cu-hist');
    if (!h) return;
    var html = HIST.cortes.length ? '<div class="cu-lista">' + HIST.cortes.map(filaCorte).join('') + '</div>'
      : (HIST.cargando ? '' : '<div class="cu-vacio">' + (HIST.q ? 'Sin resultados para «' + esc(HIST.q) + '».' : 'Aún no hay cortes.') + '</div>');
    if (HIST.cargando) html += '<div class="cu-vacio">Cargando…</div>';
    else if (HIST.mas) html += '<button class="btn claro chico cu-mas" data-cu="mas">Cargar más</button>';
    if (error) html += '<div class="cu-err">' + esc(error) + '</div>';
    h.innerHTML = html;
  }

  /* ---------- detalle de un corte y abonos ---------- */
  var pendKey = function (id) { return 'kn:pagoPend:' + id; };
  function pendLeer(id) { try { return JSON.parse(localStorage.getItem(pendKey(id)) || 'null'); } catch (e) { return null; } }
  function pendBorrar(id, pid) { try { var pp = pendLeer(id); if (pp && pp.pid === pid) localStorage.removeItem(pendKey(id)); } catch (e) {} }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  function pendClave(id, monto) {
    var pp = pendLeer(id);
    if (pp && pp.monto === monto) return pp.pid;
    var pid = uuid();
    try { localStorage.setItem(pendKey(id), JSON.stringify({ pid: pid, monto: monto })); } catch (e) {}
    var ok = pendLeer(id);
    return ok && ok.pid === pid ? pid : null;
  }

  function buscarCorte(id) {
    var todos = (DATOS ? DATOS.cortes : []).concat(HIST.cortes);
    for (var i = 0; i < todos.length; i++) if (todos[i].id === id) return todos[i];
    return null;
  }

  function abrirCorte(id) {
    var c = buscarCorte(id);
    modal(detalleHTML(c || { id: id, estado: '', total: 0, pagado: 0, saldo: 0, n: 0, pagos: [] }, null));
    K.api('cortes', { id: id }, null, 30000).then(function (L) {
      var full = (L || [])[0];
      if (full && $('cu-det') && $('cu-det').dataset.id === id) { $('mo-in').innerHTML = detalleHTML(full, full.ventas || []); enfocar(); }
    }, function (e) { var v = $('cu-det-ventas'); if (v) v.innerHTML = '<div class="cu-err">' + esc(e.message) + '</div>'; });
  }

  function detalleHTML(c, ventas) {
    var pp = pendLeer(c.id);
    var abierto = c.estado !== 'Pagado' && Number(c.saldo) > 0;
    var montoIni = pp ? pp.monto : (Number(c.saldo) || '');
    var html = '<div id="cu-det" data-id="' + esc(c.id) + '"><h3 id="cu-mo-t" style="margin:0">Corte ' + esc(c.id) +
      (c.estado ? '<span class="cu-est ' + (ESTADO[c.estado] || 'por') + '">' + esc(c.estado) + '</span>' : '') + '</h3>' +
      '<p class="cu-sub" style="margin-bottom:0">' + (c.fecha ? 'Cerrado el ' + fecha(c.fecha) + (c.por ? ' por ' + esc(c.por) : '') + ' · ' : '') +
      c.n + (c.n === 1 ? ' venta' : ' ventas') + '</p>' +
      '<div class="cu-tot"><span>Total</span><b>' + dinero(c.total) + '</b><span>Pagado</span><b>' + dinero(c.pagado) + '</b>' +
      '<span class="s">' + (c.estado === 'A favor' ? 'A favor del vendedor' : 'Saldo') + '</span><b>' + dinero(c.estado === 'A favor' ? -c.total : c.saldo) + '</b></div>';
    if (abierto) {
      html += '<div class="cu-h3">Registrar abono</div>' +
        (pp ? '<div class="nota warn" style="margin:6px 0 10px">Hay un abono de ' + dinero(pp.monto) + ' sin confirmar. Regístralo de nuevo: si ya había entrado, no se duplica.</div>' : '') +
        '<form class="cu-form" data-cu-form="abono" data-id="' + esc(c.id) + '">' +
        '<input class="monto" id="cu-monto" type="number" inputmode="decimal" step="0.01" min="0.01" value="' + esc(montoIni) + '"' + (pp ? ' readonly' : '') + ' aria-label="Monto">' +
        '<input id="cu-nota" placeholder="Nota (opcional)" maxlength="300" autocomplete="off" aria-label="Nota">' +
        '<button class="btn pri" id="cu-abonar" type="submit">Registrar abono</button></form><div class="cu-err" id="cu-err"></div>';
    }
    if ((c.pagos || []).length) {
      html += '<div class="cu-h3">Abonos</div><div class="cu-lista">' + c.pagos.map(function (p) {
        return '<div class="cu-fila"><div class="t">' + fecha(p.fecha) + (p.por ? ' · ' + esc(p.por) : '') + '</div>' +
          '<div class="d">' + esc(p.nota || 'Sin nota') + '</div><div class="m">' + dinero(p.monto) + '</div></div>'; }).join('') + '</div>';
    }
    html += '<div class="cu-h3">Ventas</div><div id="cu-det-ventas">' + (ventas == null ? '<div class="cu-vacio">Cargando…</div>'
      : (ventas.length ? '<div class="cu-lista">' + ventas.map(filaVenta).join('') + '</div>' : '<div class="cu-vacio">Sin ventas.</div>')) + '</div>';
    html += '<div class="acciones"><button class="btn claro" data-cerrar="1">Cerrar</button></div></div>';
    return html;
  }

  function registrarAbono(id) {
    var mi = $('cu-monto'), b = $('cu-abonar'), err = $('cu-err');
    var monto = Math.round(Number(mi.value) * 100) / 100, nota = ($('cu-nota').value || '').trim();
    err.textContent = '';
    if (!(monto > 0)) { err.textContent = 'Escribe el monto recibido.'; return; }
    var pp = pendLeer(id);
    if (pp && pp.monto !== monto) { mi.value = pp.monto; err.textContent = 'Primero confirma el abono de ' + dinero(pp.monto) + '.'; return; }
    var pid = pendClave(id, monto);
    if (!pid) { err.textContent = 'El navegador no permitió guardar el abono. No se envió nada.'; return; }
    b.disabled = true; b.textContent = 'Registrando…';
    K.api('registrarPago', null, { corteID: id, monto: monto, nota: nota, pagoID: pid }, 30000).then(function (r) {
      pendBorrar(id, pid);
      if (!r || !r.success) { b.disabled = false; b.textContent = 'Registrar abono'; err.textContent = (r && r.error) || 'No se pudo registrar.'; return; }
      invalidar();
      try { Object.keys(localStorage).filter(function (k) { return k.indexOf('kn:cortes:') === 0; }).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      modal('<h3 style="margin:0">Abono registrado</h3><p class="cu-sub">' + esc(id) + ' · ' +
        (r.corte.estado === 'Pagado' ? 'pagado por completo.' : 'saldo pendiente: ' + dinero(r.corte.saldo) + '.') + '</p>' +
        '<div class="acciones"><button class="btn pri" data-cerrar="1">Listo</button></div>');
      if (window.KIOSKO.recargarDespues) window.KIOSKO.recargarDespues();
      abrir();
    }, function (e) {
      // Solo se olvida la clave si el servidor dijo con certeza que no guardó nada.
      if (e && e.codigo && (e.codigo === 'sin_sesion' || e.codigo === 'sin_permiso')) pendBorrar(id, pid);
      b.disabled = false; b.textContent = 'Registrar abono';
      err.textContent = 'No se confirmó el abono (' + e.message + '). Vuelve a registrarlo: si ya había entrado, no se duplica.';
      mi.readOnly = true;
    });
  }

  /* ---------- cerrar corte ---------- */
  function confirmarCierre() {
    var pen = DATOS.pendiente;
    modal('<h3 style="margin:0">Cerrar corte</h3><p class="cu-sub">Se agruparán ' + pen.n + (pen.n === 1 ? ' venta' : ' ventas') +
      ' por ' + dinero(pen.total) + '. Las ventas posteriores entrarán al siguiente corte.</p>' +
      (pen.porVendedor.length ? '<div class="cu-tot">' + pen.porVendedor.map(function (v) {
        return '<span>' + esc(v.vendedor) + ' · ' + v.n + (v.n === 1 ? ' venta' : ' ventas') + '</span><b>' + dinero(v.total) + '</b>'; }).join('') + '</div>' : '') +
      '<div class="cu-err" id="cu-err"></div><div class="acciones"><button class="btn pri" id="cu-cerrar-ok" data-cu="cerrar-ok">Cerrar corte</button>' +
      '<button class="btn claro" data-cerrar="1">Cancelar</button></div>');
  }

  function cerrarCorte() {
    var b = $('cu-cerrar-ok');
    if (!b || b.disabled) return;
    b.disabled = true; b.textContent = 'Cerrando…';
    K.api('cerrarCorte', null, {}, 30000).then(function (r) {
      if (!r || !r.success) { b.disabled = false; b.textContent = 'Cerrar corte'; $('cu-err').textContent = (r && r.error) || 'No se pudo cerrar.'; return; }
      invalidar();
      modal('<h3 style="margin:0">Corte ' + esc(r.corte.id) + ' cerrado</h3><p class="cu-sub">' + r.corte.n + (r.corte.n === 1 ? ' venta' : ' ventas') +
        ' por ' + dinero(r.corte.total) + '.</p><div class="acciones"><button class="btn pri" data-cerrar="1">Listo</button></div>');
      if (window.KIOSKO.recargarDespues) window.KIOSKO.recargarDespues();
      abrir();
    }, function (e) {
      // Cerrar corte no se reintenta solo: si la respuesta se perdió, recargar muestra si el corte quedó cerrado.
      // Sin respuesta cierta no se deja reintentar: el corte pudo haberse cerrado. Se recarga y se confirma de nuevo.
      invalidar();
      $('cu-err').textContent = 'No se confirmó el cierre (' + e.message + '). Recarga para ver si el corte quedó cerrado.';
      var acc = b.parentNode;
      if (acc) acc.innerHTML = '<button class="btn pri" data-cu="recargar">Recargar</button><button class="btn claro" data-cerrar="1">Cerrar</button>';
    });
  }

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-cu]');
    if (a) {
      var q = a.dataset.cu;
      if (q === 'cerrar' && DATOS && DATOS.pendiente.n) confirmarCierre();
      else if (q === 'cerrar-ok') cerrarCorte();
      else if (q === 'mas') historial(false);
      else if (q === 'recargar') { cerrarModal(); invalidar(); abrir(); }
      return;
    }
    var c = e.target.closest('[data-cu-corte]');
    if (c) abrirCorte(c.dataset.cuCorte);
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('[data-cu-form]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.cuForm === 'buscar') { HIST.q = ($('cu-q').value || '').trim(); historial(true); }
    else if (f.dataset.cuForm === 'abono') registrarAbono(f.dataset.id);
  });

  window.KIOSKO.cuenta = { abrir: abrir, badge: badge, olvidar: function () { DATOS = null; } };
  if ($('app') && !$('app').classList.contains('oculto')) badge();
})();
