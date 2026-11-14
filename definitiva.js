/* Cambio definitivo de Kiosko (2026-11-14, revisión de Codex). Se carga antes que cualquier otro script en index.html,
   analisis.html y alta.html de la raíz (armar-nueva.py --definitiva).

   1 · Una sola vez por teléfono: lo que la versión de prueba (nueva/) dejó guardado con prefijo kn: (sesión, cachés,
       cola) era de datos de prueba. Se borra para que la app arranque limpia sobre los datos copiados de la hoja.
       Las operaciones en espera (kn:outbox, kn:pagoPend:*) NO se mandan: se guardan aparte con prefijo kn-prueba:.
   2 · Si la app vieja dejó ventas sin enviar (oc:outbox), se muestra un aviso fijo con su detalle. No se borran ni se
       envían solas: Alex decide cómo registrarlas. */
(function () {
  var MARCA = 'kn:migracion', VALOR = 'definitiva-2026-11';
  try {
    if (localStorage.getItem(MARCA) !== VALOR) {
      var borrar = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k.indexOf('kn:') !== 0 || k === MARCA) continue;
        if (k === 'kn:outbox' || k.indexOf('kn:pagoPend:') === 0) {
          var v = localStorage.getItem(k);
          if (v && v !== '[]' && v !== 'null') localStorage.setItem('kn-prueba:' + k.slice(3), v);
        }
        borrar.push(k);
      }
      for (var j = 0; j < borrar.length; j++) localStorage.removeItem(borrar[j]);
      localStorage.setItem(MARCA, VALOR);
      if (localStorage.getItem(MARCA) !== VALOR) throw new Error('sin marca');
    }
  } catch (e) {
    // Sin almacenamiento la app no puede guardar ventas en espera: se avisa en vez de seguir como si nada.
    var falla = function () {
      var d = document.createElement('div');
      d.setAttribute('role', 'alert');
      d.style.cssText = 'position:fixed;inset:0;z-index:10000;background:#111214;color:#F5F5F7;display:grid;place-items:center;padding:24px;text-align:center;font:16px/1.5 system-ui,sans-serif';
      d.textContent = 'Este navegador no permite guardar datos de Kiosko (por ejemplo, en modo incógnito). Abre Kiosko desde el ícono o en una ventana normal.';
      document.body.appendChild(d);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', falla); else falla();
    return;
  }

  var viejas = [];
  try { viejas = JSON.parse(localStorage.getItem('oc:outbox') || '[]') || []; } catch (e) { viejas = []; }
  if (!viejas.length) return;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pintar() {
    if (document.getElementById('kn-aviso-viejas')) return;
    var filas = viejas.map(function (x) {
      var v = x.venta || {}, p = x.prod || {}, f = x.creada ? new Date(x.creada - 6 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ') : '';
      var extra = (Number(v.cobroExtra) ? ' · cobro extra $' + esc(v.cobroExtra) : '') + (Number(v.gastosExt) ? ' · moto $' + esc(v.gastosExt) : '');
      return '<li>' + esc(p.descripcion || v.descripcion) + ' · $' + esc(v.precioVenta || p.precio) + ' · ' + esc(v.metodoPago)
        + (v.vendedor ? ' · ' + esc(v.vendedor) : '') + extra + (f ? ' · ' + esc(f) : '')
        + '<br><small style="opacity:.75">Clave ' + esc(String(x.ventaID || v.ventaID || '').slice(0, 8)) + (x.error ? ' · ' + esc(x.error) : '') + '</small></li>';
    }).join('');
    var d = document.createElement('div');
    d.id = 'kn-aviso-viejas';
    d.setAttribute('role', 'alert');
    d.style.cssText = 'position:fixed;left:12px;right:12px;top:calc(env(safe-area-inset-top,0px) + 12px);z-index:9999;'
      + 'background:#3A2A12;color:#FFE7B8;border-radius:16px;padding:14px 16px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)';
    d.innerHTML = '<b>' + viejas.length + (viejas.length === 1 ? ' venta de la versión anterior quedó sin confirmar.' : ' ventas de la versión anterior quedaron sin confirmar.')
      + '</b><br>Se conservan en este teléfono. Pudieron haberse guardado o no: muéstrale este aviso a Alex para que las revise antes de registrarlas.'
      + '<ul style="margin:8px 0 0;padding-left:18px">' + filas + '</ul>'
      + '<button type="button" style="margin-top:10px;background:none;border:1px solid #FFE7B8;color:#FFE7B8;border-radius:999px;padding:6px 14px;font:inherit">Ocultar hasta volver a abrir</button>';
    d.querySelector('button').onclick = function () { d.remove(); };
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar); else pintar();
})();
