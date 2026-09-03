const APP_VERSION='10.0';const APP_BUILD='3 Sep 2026 19:00';
/* Kiosko · lógica de la app. El markup vive en index.html y los estilos en styles.css.
   Este archivo debe cargarse después de config.js (OC_CONFIG). */

/* ---------- API (Apps Script como backend JSON) ---------- */
/* La URL y el token viven en config.js (no en este archivo) para que
   actualizar index.html nunca obligue a volver a pegar el token. */
const API_URL=(window.OC_CONFIG||{}).API_URL||'';
const API_TOKEN=(window.OC_CONFIG||{}).API_TOKEN||'';
if(!API_URL||!API_TOKEN)console.error('Falta config.js con OC_CONFIG.API_URL y API_TOKEN');

async function api(accion,params={},body=null){
  if(!API_URL||!API_TOKEN){const e=new Error('Falta config.js en el repo (URL y token)');e.api=true;throw e;}
  const url=new URL(API_URL);
  const opts={redirect:'follow'};
  if(body){
    opts.method='POST';
    opts.headers={'Content-Type':'text/plain;charset=utf-8'}; // text/plain = sin preflight CORS
    opts.body=JSON.stringify({token:API_TOKEN,accion,...body});
  }else{
    url.search=new URLSearchParams({token:API_TOKEN,accion,...params}).toString();
  }
  const r=await fetch(url,opts);
  if(!r.ok)throw new Error('HTTP '+r.status);
  const j=await r.json();
  if(!j.ok){const e=new Error(j.error||'Error del servidor');e.api=true;throw e;}
  return j.data;
}
const apiPost=(accion,body)=>api(accion,{},body);

/* Caché stale-while-revalidate:
   1) si hay copia local (y no está marcada sucia) la pinta al instante,
   2) pide datos frescos y vuelve a pintar,
   3) si no hay red, se queda con la copia local y avisa. */
const cacheKey=(a,p)=>'oc:'+a+':'+JSON.stringify(p||{});
function leerCache(k){try{const c=localStorage.getItem(k);return c?JSON.parse(c):null;}catch(e){return null;}}
function apiCached(accion,params,onData,onFail){
  const key=cacheKey(accion,params);
  const c=state.dirty?null:leerCache(key);
  if(c)onData(c.d,{stale:true});
  api(accion,params).then(d=>{
    try{localStorage.setItem(key,JSON.stringify({t:Date.now(),d}));}catch(e){}
    state.dirty=false;
    onData(d,{stale:false});
  }).catch(err=>{
    if(err.api){toast(err.message,'err');if(!c)onFail&&onFail(err);return;}
    const old=c||leerCache(key);
    if(old){if(!c)onData(old.d,{stale:true});toast('Sin conexión · datos de '+relTime(old.t));return;}
    onFail&&onFail(err);
  });
}
function relTime(t){const m=Math.round((Date.now()-t)/60000);return m<1?'hace un momento':m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} días`;}

/* Mismo producto: por ProductoID si ambos lo tienen; si no, por nombre. */
const mismoProd=(a,b)=>!!a&&!!b&&((a.pid&&b.pid)?(a.pid===b.pid&&(a.origen||'Alex')===(b.origen||'Alex')):a.descripcion===b.descripcion);

/* ---------- ICONOS / TEXTOS ---------- */
const ICONS = {
  cash:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/></svg>',
  box:'<svg viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 7.5V17l9 4 9-4V7.5"/></svg>',
  up:'<svg viewBox="0 0 24 24"><path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/></svg>',
  user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  moto:'<svg viewBox="0 0 24 24"><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h6l3-7h3M9 10h4"/></svg>',
  sum:'<svg viewBox="0 0 24 24"><path d="M18 5H6l6 7-6 7h12"/></svg>',
  clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cal:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>'
};
const ILLU = {
  box:'<svg viewBox="0 0 64 64"><path d="M10 24 32 14l22 10-22 10z"/><path d="M10 24v20l22 10 22-10V24"/><path d="M32 34v20"/><path d="M21 19l22 10"/></svg>',
  leaf:'<svg viewBox="0 0 64 64"><path d="M14 50C14 26 30 14 52 12c0 24-12 38-36 40z"/><path d="M14 50c8-12 18-20 30-26"/></svg>',
  search:'<svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="16"/><path d="m40 40 12 12"/><path d="M22 28h12"/></svg>',
  wifi:'<svg viewBox="0 0 64 64"><path d="M8 26c14-12 34-12 48 0"/><path d="M16 36c9-8 23-8 32 0"/><path d="M24 46c4-4 12-4 16 0"/><circle cx="32" cy="54" r="1.5"/></svg>'
};
const HELP = {
  hoy:'Ventas de hoy pendientes de transferir.',
  tAlex:'Ganancia de Alex en sus ventas que Irene cobró en efectivo y aún no transfiere: precio + cobro extra − motomandado (el costo lo puso Alex, así que todo eso es suyo).',
  tCosto:'Ventas de Irene o Mamá aún no liquidadas (en efectivo o a su cuenta): a Alex solo se le transfiere el costo del producto.',
  tMoto:'En ventas de Alex que el cliente pagó por transferencia, Irene puso el motomandado de su bolsa. Se descuenta de lo que transfiere.',
  gIrene:'Lo que Irene se queda de sus ventas pendientes: precio + cobro extra − costo − motomandado. No se transfiere.',
  gMama:'Lo que Mamá se queda de sus ventas pendientes: precio + cobro extra − costo − motomandado. No se transfiere.',
  moto:'Lo gastado en motomandado en las ventas de este mes, transferidas o no. Es un gasto, no dinero por transferir.',
  totalMes:'Total vendido este mes, incluidas las transferidas. La línea muestra los últimos 7 días.',
  artMes:'Artículos vendidos este mes, transferidos o no.',
  pend:'Número de ventas pendientes de liquidar.'
};
const CAT_ICONS=[
  [/aud[ií]fono|auricular|earbud|tws/,'<svg viewBox="0 0 24 24"><path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="13" width="4" height="7" rx="2"/><rect x="17" y="13" width="4" height="7" rx="2"/></svg>'],
  [/altavoz|bocina|speaker|parlante/,'<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="7.5" r="1"/></svg>'],
  [/watch|reloj/,'<svg viewBox="0 0 24 24"><rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6V3h6v3M9 18v3h6v-3"/><path d="M12 10v3l2 1"/></svg>'],
  [/herramienta|desarmador|destornillador|corta|kit/,'<svg viewBox="0 0 24 24"><path d="M14 4l6 6-9 9H5v-6z"/><path d="M12 6l6 6"/></svg>'],
  [/incubadora|huevo|pollo/,'<svg viewBox="0 0 24 24"><path d="M12 3c4 4 6 8 6 12a6 6 0 0 1-12 0c0-4 2-8 6-12z"/></svg>'],
  [/mesa|silla|mueble/,'<svg viewBox="0 0 24 24"><path d="M3 9h18M5 9v10M19 9v10M8 9v6M16 9v6"/></svg>'],
  [/tv|pantalla|tele/,'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'],
  [/bater[ií]a|power|cargador|cable/,'<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>'],
  [/espejo|maquillaje|belleza/,'<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M12 15v6M8 21h8"/></svg>'],
  [/wifi|repetidor|router/,'<svg viewBox="0 0 24 24"><path d="M3 9c5-5 13-5 18 0M6.5 12.5c3-3 8-3 11 0M10 16c1-1 3-1 4 0"/><circle cx="12" cy="19" r="1"/></svg>'],
];
const ICON_BOX='<svg viewBox="0 0 24 24"><path d="M3 7.5 12 3l9 4.5-9 4.5z"/><path d="M3 7.5V17l9 4 9-4V7.5"/><path d="M12 12v9"/></svg>';
function catIcon(cat){const c=String(cat||'').toLowerCase();for(const [re,svg] of CAT_ICONS)if(re.test(c))return svg;return ICON_BOX;}
const PH_COLORS=['#1D9E75','#F59E0B','#3B82F6','#A855F7','#E5484D','#0EA5E9','#10B981','#F97316'];
function phColor(cat){let h=0;for(const c of String(cat||''))h=(h*31+c.charCodeAt(0))>>>0;return PH_COLORS[h%PH_COLORS.length];}
/* Miniatura: si hay URL la carga en segundo plano; si falla o no hay, queda la inicial con color de categoría. */
const esDeIrene=p=>p&&p.origen==='Irene';
const tagIrene=p=>esDeIrene(p)?'<span class="tag-irene">de Irene</span>':'';
function thumb(p,cls='',src){
  const url=src!==undefined?src:p.imagen;
  const img=url?`<img src="${esc(url)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')" onerror="this.remove()">`:'';
  return`<div class="thumb ${cls}" style="--ph:${phColor(p.categoria)}">${catIcon(p.categoria).replace('<svg','<svg class="ph"')}${img}</div>`;
}
function vacio(illu,titulo,texto){return`<div class="empty">${ILLU[illu]||''}<b>${titulo}</b>${texto||''}</div>`;}

let state={usuario:null,vista:'catalogo',filtro:'todo',pin:'',producto:null,vendedor:null,metodo:null,catalogo:[],filtrado:[],ventas:[],busy:false,cat:'Todas',dueno:'todos',grid:true,paso:1,dirty:false,recientes:[],topMes:[],detalle:[],operacion:null,npN:1};

document.addEventListener('DOMContentLoaded',()=>{
  buildKeypad();
  document.getElementById('search').addEventListener('input',renderCatalogo);
  document.getElementById('qsearch').addEventListener('input',renderQuick);
  pintarToggle();
  document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.view!=='nueva'){buzz();cambiarVista(b.dataset.view);return;}
    if(state.vista==='catalogo'){buzz(12);window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>document.getElementById('search').focus(),250);}else abrirQuick();}));
  document.querySelectorAll('#filtros button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#filtros button').forEach(x=>x.classList.remove('on'));b.classList.add('on');state.filtro=b.dataset.f;renderVentas();
  }));
  setupPullToRefresh();
  setupSwipeSheets();
  entrarRecordado();
});

/* Deslizar la hoja hacia abajo para cerrarla (solo cuando está arriba del todo y el gesto es vertical). */
function setupSwipeSheets(){
  const cierres={'sheet-venta':()=>cerrarVenta(),'sheet-quick':()=>cerrarQuick(),'sheet-usuario':()=>cerrarUsuarios(),'sheet-detalle':()=>cerrarDetalle(),'sheet-exp':()=>cerrarExp(),'sheet-alta':()=>cerrarAlta(),'sheet-meta':()=>cerrarMeta()};
  document.querySelectorAll('.overlay .sheet').forEach(sh=>{
    const id=sh.parentElement.id;let y0=null,x0=0,dy=0,activo=false,decidido=false;
    sh.addEventListener('touchstart',e=>{if(sh.scrollTop>2)return;y0=e.touches[0].clientY;x0=e.touches[0].clientX;dy=0;activo=false;decidido=false;},{passive:true});
    sh.addEventListener('touchmove',e=>{
      if(y0===null)return;
      const t=e.touches[0],ddy=t.clientY-y0,ddx=t.clientX-x0;
      if(!decidido){if(Math.abs(ddy)<8&&Math.abs(ddx)<8)return;decidido=true;activo=ddy>0&&Math.abs(ddy)>Math.abs(ddx)*1.2;if(activo){sh.classList.add('drag');sh.classList.remove('snap');}}
      if(!activo)return;
      dy=Math.max(0,ddy);
      sh.style.transform=`translateY(${dy*0.85}px)`;
      sh.parentElement.style.background=`rgba(15,18,34,${Math.max(.05,.4-dy/600)})`;
      if(dy>110&&!sh.dataset.armed){sh.dataset.armed='1';buzz(10);}
      if(dy<=110)delete sh.dataset.armed;
    },{passive:true});
    const fin=()=>{
      if(y0===null)return;y0=null;
      if(!activo)return;
      sh.classList.remove('drag');sh.classList.add('snap');delete sh.dataset.armed;
      if(dy>110){buzz(18);sh.style.transform='translateY(110%)';setTimeout(()=>{cierres[id]();sh.style.transform='';sh.parentElement.style.background='';sh.classList.remove('snap');},220);}
      else{sh.style.transform='';sh.parentElement.style.background='';setTimeout(()=>sh.classList.remove('snap'),300);}
    };
    sh.addEventListener('touchend',fin);sh.addEventListener('touchcancel',fin);
  });
}

const buzz=(ms=8)=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};

/* ---------- NÚMEROS QUE RUEDAN ---------- */
/* Anima desde el último valor pintado (data-val) hasta el nuevo. */
function tick(el,val,{prefix='$',fmt=pesos,dur=800}={}){
  if(!el)return;
  const from=Number(el.dataset.val)||0,to=Number(val)||0;el.dataset.val=to;
  if(from===to||matchMedia('(prefers-reduced-motion:reduce)').matches){el.textContent=prefix+fmt(to);return;}
  const t0=performance.now();
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=prefix+fmt(from+(to-from)*e);if(p<1)requestAnimationFrame(step);};
  requestAnimationFrame(step);
}
const entero=x=>String(Math.round(x));

/* ---------- LOGIN ---------- */
function buildKeypad(){
  const k=document.getElementById('keypad');
  ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(d=>{
    const b=document.createElement('button');
    b.className='key'+(d===''||d==='⌫'?' ghost':'');b.textContent=d;
    if(d!=='')b.onclick=e=>{b.classList.remove('hit');void b.offsetWidth;b.classList.add('hit');
      const r=b.getBoundingClientRect(),w=document.createElement('i');w.className='rip';w.style.left=((e.clientX||r.left+r.width/2)-r.left)+'px';w.style.top=((e.clientY||r.top+r.height/2)-r.top)+'px';b.appendChild(w);setTimeout(()=>w.remove(),600);
      tecla(d);};
    k.appendChild(b);
  });
}
function tecla(d){
  if(state.busy)return;buzz();
  if(d==='⌫')state.pin=state.pin.slice(0,-1);else if(state.pin.length<4)state.pin+=d;
  document.getElementById('login-err').textContent='';
  pintarDots();
  if(state.pin.length===4)validarPin();
}
function pintarDots(){document.querySelectorAll('#dots span').forEach((s,i)=>s.classList.toggle('on',i<state.pin.length));}
function validarPin(){
  state.busy=true;
  apiPost('verificarPin',{pin:state.pin}).then(res=>{
    state.busy=false;
    if(res.valido){entrar(res.vendedor);}
    else{fallo('PIN incorrecto');}
  }).catch(err=>{state.busy=false;fallo(err.api?err.message:'Sin conexión ('+(err&&err.message||err)+')');});
}
function fallo(msg){
  const d=document.getElementById('dots');d.classList.add('shake');setTimeout(()=>d.classList.remove('shake'),400);
  document.getElementById('login-err').textContent=msg;state.pin='';pintarDots();
}
function entrar(u){
  state.usuario=u;
  const lg=document.getElementById('login'),app=document.getElementById('app');
  document.getElementById('dots').classList.add('ok');buzz([15,30,15]);
  lg.classList.add('bye');
  setTimeout(()=>{
    lg.classList.add('hidden');lg.classList.remove('bye');document.getElementById('dots').classList.remove('ok');
    state.pin='';pintarDots();
    app.classList.remove('hidden');app.classList.add('hello');setTimeout(()=>app.classList.remove('hello'),600);
    setUsuario(u);cambiarVista('catalogo');
  },420);
  try{localStorage.setItem('oc:usuario',u);}catch(e){}
}
/* Si este teléfono ya entró antes, salta el login */
function entrarRecordado(){
  let u=null;try{u=localStorage.getItem('oc:usuario');}catch(e){}
  if(!u)return false;
  state.usuario=u;
  document.getElementById('login').classList.add('hidden');
  const app=document.getElementById('app');app.classList.remove('hidden');app.classList.add('hello');setTimeout(()=>app.classList.remove('hello'),600);
  setUsuario(u);cambiarVista('catalogo');return true;
}
async function buscarActualizacion(){
  toast('Buscando versión nueva…');
  try{
    const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs)await r.unregister();
    const keys=await caches.keys();for(const k of keys)if(k.startsWith('ocosingo-')&&!k.includes('img'))await caches.delete(k);
  }catch(e){}
  try{const r=await fetch('app.js',{cache:'reload'});const t=await r.text();const m=t.match(/APP_VERSION='([^']+)'/);if(m&&m[1]===APP_VERSION){toast('Ya tienes la última versión (v'+APP_VERSION+'). Si acabas de subir cambios, GitHub tarda unos minutos.');return;}}catch(e){}
  location.reload();
}
function cerrarSesion(){
  try{localStorage.removeItem('oc:usuario');}catch(e){}
  cerrarUsuarios();state.usuario=null;state.ventas=[];state.ventFirma='';
  document.getElementById('app').classList.add('hidden');
  const lg=document.getElementById('login');lg.classList.remove('hidden');state.pin='';pintarDots();
}
const claseUsuario=u=>({Irene:'u-irene','Mamá':'u-mama',Alex:'u-alex'})[u]||'';
function saludo(){const h=new Date().getHours();return h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches';}
function setUsuario(u){
  state.usuario=u;setupInstall();
  document.getElementById('greeting').textContent=`${saludo()}, ${u}`;
  const a=document.getElementById('avatar');a.textContent=u[0];a.className='avatar '+claseUsuario(u);
  document.getElementById('header-date').textContent=formatDate(new Date());
}

/* ---------- NAV ---------- */
const ORDEN=['catalogo','ventas'];
function cambiarVista(v){
  const prev=state.vista;state.vista=v;
  document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
  const dir=ORDEN.indexOf(v)>=ORDEN.indexOf(prev)?'slide-l':'slide-r';
  ORDEN.forEach(x=>{const el=document.getElementById('view-'+x);el.classList.toggle('hidden',x!==v);el.classList.remove('slide-l','slide-r');if(x===v&&prev!==v){void el.offsetWidth;el.classList.add(dir);}});
  window.scrollTo({top:0});
  ({catalogo:cargarCatalogo,ventas:cargarDinero})[v]();
  const fab=document.getElementById('fab-add');if(fab)fab.style.display=(v==='catalogo'&&state.usuario==='Irene')?'':'none';
}

/* ---------- PULL TO REFRESH ---------- */
function sheetAbierta(){return[...document.querySelectorAll('.overlay')].some(o=>!o.classList.contains('hidden'))||!document.getElementById('login').classList.contains('hidden');}
function setupPullToRefresh(){
  const el=document.getElementById('ptr');let y0=null,d=0,armed=false;
  document.addEventListener('touchstart',e=>{if(window.scrollY>2||sheetAbierta()){y0=null;return;}y0=e.touches[0].clientY;d=0;armed=false;},{passive:true});
  document.addEventListener('touchmove',e=>{
    if(y0===null)return;d=e.touches[0].clientY-y0;
    if(d<=0){el.style.transform='';return;}
    const y=Math.min(d*.6,90);
    el.style.transform=`translate(-50%,${y}px) rotate(${d*1.6}deg)`;
    if(d>110&&!armed){armed=true;buzz(12);}
  },{passive:true});
  const fin=()=>{
    if(y0===null)return;
    if(d>110){el.style.setProperty('--ptr-y','70px');el.style.transform='translate(-50%,70px)';el.classList.add('spin');refrescar(()=>{el.classList.remove('spin');el.style.transform='';});}
    else el.style.transform='';
    y0=null;d=0;
  };
  document.addEventListener('touchend',fin);document.addEventListener('touchcancel',fin);
}
let _refrescando=null;
function refrescar(done){
  state.dirty=true;_refrescando=done;
  ({catalogo:cargarCatalogo,ventas:cargarDinero})[state.vista]();
}
function listo(){if(_refrescando){const f=_refrescando;_refrescando=null;setTimeout(f,350);}}

/* ---------- DINERO (fusión del dashboard y Mis ventas) ---------- */
function cargarDinero(){
  const hero=document.getElementById('dinero-hero');
  if(!hero.innerHTML)hero.innerHTML='<div class="sk" style="height:180px"></div>';
  if(!document.getElementById('ventas-list').innerHTML)document.getElementById('ventas-list').innerHTML='<div class="sk" style="height:200px;margin-top:8px"></div>';
  let pendientes=2;const fin=st=>{if(!st)pendientes--;if(pendientes<=0)listo();};
  apiCached('inicio',{usuario:state.usuario},(d,m)=>{
    if(d.dashboard&&d.dashboard.error){toast(d.dashboard.error,'err');return;}
    if(Array.isArray(d.catalogo))state.catalogo=d.catalogo;
    if(Array.isArray(d.recientes))state.recientes=d.recientes;
    if(Array.isArray(d.detalle))state.detalle=d.detalle;
    if(Array.isArray(d.ofrecer))state.ofrecer=d.ofrecer;
    if(d.operacionIrene)state.operacion=d.operacionIrene;
    if(d.impulso)state.impulso=d.impulso;
    renderDinero(d.dashboard,d.ventasMes||[],m);fin(m.stale);
  },()=>{hero.innerHTML=vacio('wifi','No se pudo cargar','Desliza hacia abajo para reintentar.');fin(false);});
  apiCached('misVentas',{vendedor:state.usuario},(d,m)=>{
    if(d.logros)renderLogros(d.logros);
    if(Array.isArray(d.ventas)){const firma=JSON.stringify(d.ventas);if(firma!==state.ventFirma){state.ventFirma=firma;state.ventas=d.ventas;renderVentas();}}
    fin(m.stale);
  },()=>{document.getElementById('ventas-list').innerHTML=vacio('wifi','No se pudieron cargar','Desliza hacia abajo para reintentar.');fin(false);});
}
function armarDinero(){
  const esIrene=state.usuario==='Irene';
  document.getElementById('dinero-hero').innerHTML=`
    <div class="hero" id="hero">
      <div class="top">
        <div class="hero-main">
          <div class="lbl tap" onclick="explicar('${esIrene?'negocio':'hero'}')">${esIrene?'Tu ganancia de '+mesActualNombre():state.usuario==='Alex'?'Irene te debe':'Le deben a Alex'} ›</div>
          <div class="val num tap" id="h-val" onclick="${esIrene?`explicar('negocio')`:`abrirDetalle('transferencia')`}">$0</div>
        </div>
      </div>
      <div class="sub" id="h-chips">${esIrene?'':'<span class="chip" id="h-pend">—</span><span class="chip tap" id="h-hoy" onclick="explicar(\'hoy\')">Hoy $0</span>'}</div>
      <div class="hbar tap" id="h-bar" onclick="abrirMeta()">
        <div class="hbar-h"><span id="h-bar-t">Meta de ${mesActualNombre()}</span><b class="num" id="h-bar-v">—</b></div>
        <div class="hbar-track"><i id="h-bar-i"></i></div>
        <div class="hbar-f" id="h-bar-f"></div>
      </div>
    </div>`;
  document.getElementById('dinero-cuenta').innerHTML=esIrene
    ?`<div class="group wrap" style="margin-top:14px"><div class="row tap" onclick="abrirDetalle('transferencia')"><div class="ico mango">${ICONS.cash}</div><div class="t"><b>Le debes a Alex</b><small id="tc-sub">del efectivo que guardas</small></div><div class="v num" id="tc-val">$0</div></div></div>`
    :`<div id="sec-quedan">
      <div class="section-title">Lo que ganan ellas</div>
      <div class="group wrap">
        ${fila('user','Ganancia de Irene','v-girene','pos','gIrene','','de lo que aún no liquida · es suya')}
        <div id="row-gmama">${fila('user','Ganancia de Mamá','v-gmama','pos','gMama','','de lo que aún no liquida · es suya')}</div>
      </div></div>`;
  document.getElementById('mes-wrap').innerHTML=esIrene?'':`
    <div class="section-title">Este mes</div>
    <div class="group">
      ${fila('sum','Ventas del mes','v-total','','totalMes','grey','<span id="v-total-cmp"></span>','','mes')}
      ${fila('box','Artículos vendidos','v-art','','artMes','grey','piezas vendidas este mes','','mes')}
      ${fila('moto','Motomandado del mes','v-moto','neg','moto','mango','gastado en envíos este mes')}
    </div>
    <div class="section-title">Historial</div>
    <div class="chart-card">
      <div class="chart-head"><b>Ventas</b><div class="chart-tabs"><button class="${state.chartTab!=='semana'?'on':''}" onclick="setChartTab('mes')">12 meses</button><button class="${state.chartTab==='semana'?'on':''}" onclick="setChartTab('semana')">7 días</button></div></div>
      <div class="chart" id="chart"><div class="sk" style="height:100%"></div></div>
    </div>`;
}
function setChartTab(t){buzz();state.chartTab=t;const c=document.getElementById('chart');if(c)c.dataset.firma='';document.querySelectorAll('.chart-tabs button').forEach((b,i)=>b.classList.toggle('on',(i===0)!==(t==='semana')));renderDinero(state._dash,state._meses,{stale:true});}
/* Compartir el producto abierto (hoja del sistema: Messenger, WhatsApp…). La foto se precarga al abrir la hoja de venta. */
function precargarFoto(p){
  state._shareFile=null;
  if(!p||!p.imagen||!navigator.canShare)return;
  api('fotoProducto',{descripcion:p.descripcion}).then(f=>{
    if(!f||!f.base64||state.producto!==p)return;
    const bin=atob(f.base64),arr=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)arr[k]=bin.charCodeAt(k);
    const file=new File([arr],(p.descripcion||'producto')+'.jpg',{type:f.mime||'image/jpeg'});
    if(navigator.canShare({files:[file]}))state._shareFile=file;
  }).catch(()=>{});
}
function compartirProducto(){
  const p=state.producto;if(!p)return;buzz(12);
  const texto=`${p.descripcion}\nPrecio: $${precio(p.precio)}`;
  if(navigator.share){
    const datos=state._shareFile?{files:[state._shareFile],text:texto}:{text:texto};
    navigator.share(datos).catch(()=>{});return;
  }
  window.open('https://wa.me/?text='+encodeURIComponent(texto),'_blank');
}
function renderDinero(d,meses,m){
  if(state._dinArmado!==state.usuario){armarDinero();state._dinArmado=state.usuario;}
  else if(!m.stale){const h=document.getElementById('hero');if(h){h.classList.remove('refresh');void h.offsetWidth;h.classList.add('refresh');}}
  const $=id=>document.getElementById(id);state._dash=d;state._meses=meses;
  const esIrene=state.usuario==='Irene',o=state.operacion;
  if(esIrene){
    tick($('h-val'),o?o.gMesTotal:0);
    $('h-chips').innerHTML=(o&&o.gMesPropio?`<span class="chip">De tu mercancía $${pesos(o.gMesPropio)}</span>`:'')+(o&&o.gMesAjeno?`<span class="chip">Vendiendo lo de Alex $${pesos(o.gMesAjeno)}</span>`:'')+rachaChip()||'<span class="chip">Aún sin ventas este mes</span>';
    tick($('tc-val'),d.porTransferir);
    $('tc-sub').textContent=`${d.totalVentas} venta${d.totalVentas===1?'':'s'} sin liquidar · toca para ver la cuenta`;
  }else{
  tick($('h-val'),d.porTransferir);
  const prev=meses.length>1?meses[meses.length-2]:null,cmp=$('v-total-cmp');
  if(cmp)cmp.textContent=prev?`${mesLargo(prev.label).split(' ')[0]} $${pesos(prev.total)} → ${mesActualNombre()} $${pesos(d.ventasTotalesMes)}`:'';
  $('h-pend').textContent=`${d.totalVentas} venta${d.totalVentas===1?'':'s'} sin liquidar`;
  $('h-hoy').textContent='Hoy $'+pesos(d.ventasHoy);
  const rc=$('h-racha');if(rc)rc.remove();$('h-chips').insertAdjacentHTML('beforeend',rachaChip());
  }
  renderMeta();
  renderNegocio();
  if(!esIrene){
  tick($('v-girene'),d.gananciaIrene);$('row-gmama').style.display=(d.gananciaMama||0)>0?'':'none';tick($('v-gmama'),d.gananciaMama||0);
  tick($('v-moto'),d.gastoMotomandado);
  tick($('v-total'),d.ventasTotalesMes);tick($('v-art'),d.articulosMesTotal!=null?d.articulosMesTotal:d.articulosMes,{prefix:'',fmt:entero});
  }
  const c=$('chart');if(!c)return;
  if(state.chartTab==='semana'){
    const D=['dom','lun','mar','mié','jue','vie','sáb'],hoy=new Date(),sem=(d.ventasSemana||[]).map((t,i)=>{const f=new Date(hoy);f.setDate(hoy.getDate()-(6-i));return{label:(i===6?'hoy':D[f.getDay()])+' ',cantidad:0,total:t};});
    const firma='s'+JSON.stringify(sem);if(c.dataset.firma!==firma){c.dataset.firma=firma;renderChart(sem,true);}return;
  }
  if(!meses.length){c.innerHTML=vacio('leaf','Sin ventas registradas aún');return;}
  const firma=JSON.stringify(meses);
  if(c.dataset.firma!==firma){c.dataset.firma=firma;renderChart(meses);}
}
/* Anillo: ventas de este mes comparadas con el mejor mes anterior (récord). Sin metas fijas. */
function renderNegocio(){
  const w=document.getElementById('neg-wrap');if(!w)return;
  const o=state.operacion;
  if(state.usuario!=='Irene'||!o){w.innerHTML='';w.dataset.firma='';return;}
  const valorVenta=state.catalogo.filter(esDeIrene).reduce((s,p)=>s+(Number(p.precio)||0)*(Number(p.stock)||0),0),recuperado=o.inversion-o.valorStock;
  const firma=JSON.stringify(o)+'|'+valorVenta;if(w.dataset.firma===firma)return;w.dataset.firma=firma;
  w.innerHTML=`<div class="section-title">Tu negocio</div>
    <div class="group wrap">
      <div class="row tap" onclick="explicar('inversion')"><div class="ico grey">${ICONS.cash}</div><div class="t"><b>Inversión en tu mercancía</b><small>${recuperado>0?`ya recuperaste $${pesos(recuperado)} vendiendo`:'todo sigue en tu inventario'}</small></div><div class="v num">$${pesos(o.inversion)}</div></div>
      <div class="row tap" onclick="explicar('stockIrene')"><div class="ico">${ICONS.box}</div><div class="t"><b>Si vendes todo tu stock</b><small>${o.piezasStock} pieza${o.piezasStock===1?'':'s'} · te costaron $${pesos(o.valorStock)} · ganarías $${pesos(valorVenta-o.valorStock)}</small></div><div class="v num pos">$${pesos(valorVenta)}</div></div>
    </div>`;
}
/* Racha: solo se muestra cuando existe. Nunca lo contrario ("llevas N días sin vender"). */
function rachaChip(){const r=(state.impulso||{}).racha||0;return r>=2?`<span class="chip" id="h-racha">🔥 ${r} días seguidos vendiendo</span>`:'';}
/* Barra del hero: la ganancia del usuario contra SU meta del mes. La distancia se dice en ventas, no solo en pesos. */
function renderMeta(){
  const $=id=>document.getElementById(id),bar=$('h-bar');if(!bar)return;
  const im=state.impulso,mes=mesActualNombre();
  if(!im){$('h-bar-t').textContent='Meta de '+mes;$('h-bar-v').textContent='—';$('h-bar-f').textContent='';return;}
  const g=im.gananciaMes||0,meta=im.meta||0;
  bar.classList.toggle('record',meta>0&&g>=meta);
  if(!meta){
    $('h-bar-t').textContent='Ponte una meta para '+mes;$('h-bar-v').textContent='›';
    $('h-bar-i').style.width='0%';
    $('h-bar-f').textContent=g>0?`Llevas $${pesos(g)} de ganancia. Una meta clara ayuda a vender más.`:'Una meta clara ayuda a vender más. Toca para elegirla.';
    return;
  }
  $('h-bar-t').textContent=`Meta de ${mes}`;
  $('h-bar-v').textContent=`$${pesos(g)} de $${pesos(meta)}`;
  $('h-bar-i').style.width=(Math.min(1,g/meta)*100)+'%';
  if(g>=meta){
    $('h-bar-f').textContent=`¡Meta cumplida! Vas $${pesos(g-meta)} arriba.`;
    const k=`oc:meta-ok:${state.usuario}:${new Date().getMonth()}`;let ya='';try{ya=localStorage.getItem(k);}catch(e){}
    if(!ya){try{localStorage.setItem(k,'1');}catch(e){}buzz([30,40,60]);confetiRapido();toast(`¡Cumpliste tu meta de ${mes}! 🎉`,'ok');}
  }else{
    const falta=meta-g,n=im.promedio>0?Math.max(1,Math.ceil(falta/im.promedio)):0;
    $('h-bar-f').textContent=`Faltan $${pesos(falta)}`+(n?` · ${n===1?'una venta más':'unas '+n+' ventas más'}`:'');
  }
}
function confetiRapido(){
  const colors=['#1D9E75','#F59E0B','#E5484D','#3B82F6','#A855F7'],w=document.createElement('div');w.className='confeti-wrap';
  w.innerHTML=Array.from({length:30},(_,i)=>`<div class="confetti" style="left:50%;top:30%;background:${colors[i%5]};--dx:${(Math.random()-.5)*420}px;--dy:${(Math.random()-.3)*420}px;animation-delay:${Math.random()*.25}s"></div>`).join('');
  document.body.appendChild(w);setTimeout(()=>w.remove(),1800);
}
/* Hoja para fijar la meta del mes */
function abrirMeta(){
  buzz();const im=state.impulso||{},mes=mesActualNombre();
  const sug=[];
  if(im.record>0){sug.push(['Igualar tu récord',Math.round(im.record)]);sug.push(['Superarlo un poco',Math.round(im.record*1.1/50)*50]);}
  else if(im.gananciaMes>0)sug.push(['El doble de lo que llevas',Math.round(im.gananciaMes*2/50)*50]);
  document.getElementById('meta-titulo').textContent=`Tu meta de ${mes}`;
  document.getElementById('meta-body').innerHTML=`
    <p class="exp-p">¿Cuánto quieres <b>ganar</b> este mes? Es tu meta, nadie más la ve. Puedes cambiarla cuando quieras.</p>
    ${sug.length?`<div class="opts" style="margin-bottom:14px">${sug.map(([t,v])=>`<button class="opt" onclick="document.getElementById('meta-monto').value=${v};buzz()">${t}<br><b>$${pesos(v)}</b></button>`).join('')}</div>`:''}
    <div class="money"><span>$</span><input id="meta-monto" type="number" inputmode="numeric" placeholder="0" value="${im.meta||''}"></div>
    ${im.gananciaMes>0?`<div class="quick-hint" style="padding-top:10px">Llevas $${pesos(im.gananciaMes)} este mes${im.promedio>0?` · ganas unos $${pesos(im.promedio)} por venta`:''}</div>`:''}
    <div style="margin-top:18px"><button class="btn primary" id="meta-btn" onclick="guardarMeta()">Guardar meta</button>${im.meta?`<button class="btn ghost" onclick="guardarMeta(0)">Quitar la meta</button>`:`<button class="btn ghost" onclick="cerrarMeta()">Ahora no</button>`}</div>`;
  document.getElementById('sheet-meta').classList.remove('hidden');
  setTimeout(()=>{const i=document.getElementById('meta-monto');if(i&&!i.value)i.focus();},350);
}
function cerrarMeta(){document.getElementById('sheet-meta').classList.add('hidden');}
function guardarMeta(v){
  const monto=v===0?0:Number(document.getElementById('meta-monto').value);
  if(!(monto>=0)){toast('Escribe un monto','err');return;}
  const b=document.getElementById('meta-btn');b.disabled=true;b.textContent='Guardando…';
  apiPost('guardarMeta',{usuario:state.usuario,monto}).then(r=>{
    if(!r.success){toast(r.error||'No se pudo guardar','err');b.disabled=false;b.textContent='Guardar meta';return;}
    state.impulso=Object.assign({},state.impulso||{},{meta:monto});state.dirty=true;
    cerrarMeta();buzz(12);toast(monto?`Meta de ${mesActualNombre()}: $${pesos(monto)}`:'Meta quitada','ok');renderMeta();
  }).catch(err=>{toast(err.api?err.message:'Sin conexión, no se guardó','err');b.disabled=false;b.textContent='Guardar meta';});
}
function fila(ico,label,id,cls,help,tone='',sub='',extra='',detalle=''){
  return `<div class="row tap" onclick="${detalle?`abrirDetalle('${detalle}')`:`explicar('${help}')`}">
    <div class="ico ${tone}">${ICONS[ico]}</div>
    <div class="t"><b>${label}</b>${sub?`<small>${sub}</small>`:''}</div>${extra}
    <div class="v ${cls} num" id="${id}">—</div></div>`;
}
function renderSpark(v){
  const s=document.getElementById('spark');if(!s)return;
  const firma=v.join(',');if(s.dataset.firma===firma)return;s.dataset.firma=firma;
  const max=Math.max(...v,1),W=72,H=26,P=3;
  const pts=v.map((x,i)=>[P+i*((W-2*P)/6),H-P-(x/max)*(H-2*P)]);
  const path=pts.map((p,i)=>{if(!i)return`M${p[0]},${p[1]}`;const q=pts[i-1],cx=(q[0]+p[0])/2;return`C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;}).join(' ');
  const l=pts[pts.length-1];
  s.innerHTML=`<path d="${path}"/><circle cx="${l[0]}" cy="${l[1]}" r="2.5"/>`;
}

/* ---------- CHART: barras ---------- */
function renderChart(data,semana){
  const c=document.getElementById('chart');c.innerHTML='';
  const W=c.offsetWidth||320,H=190,P={t:22,r:6,b:26,l:6};
  const cw=W-P.l-P.r,ch=H-P.t-P.b,max=Math.max(...data.map(d=>d.total),100);
  const n=data.length,slot=cw/n,bw=Math.min(28,slot*.62);
  const bars=data.map((d,i)=>({x:P.l+i*slot+(slot-bw)/2,y:P.t+ch-(d.total/max)*ch,h:(d.total/max)*ch,d}));
  const step=(n>6&&!semana)?2:1;
  let svg=`<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="barg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--selva)" stop-opacity=".55"/><stop offset="1" stop-color="var(--selva)" stop-opacity=".2"/></linearGradient><linearGradient id="bargc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--selva)"/><stop offset="1" stop-color="var(--hero-a)"/></linearGradient></defs>`;
  bars.forEach((b,i)=>{
    svg+=`<rect class="bar ${i===n-1?'cur':''}" data-i="${i}" x="${b.x}" y="${b.y}" width="${bw}" height="${Math.max(b.h,2)}" rx="${Math.min(6,bw/2)}" style="animation-delay:${i*45}ms"/>`;
    if((n-1-i)%step===0)svg+=`<text x="${b.x+bw/2}" y="${H-6}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--muted)">${b.d.label.split(' ')[0]}</text>`;
  });
  const last=bars[n-1];
  svg+=`<text x="${last.x+bw/2}" y="${last.y-7}" text-anchor="middle" font-size="11" font-weight="800" fill="var(--selva)">$${pesos(last.d.total)}</text></svg><div class="tip" id="tip"></div>`;
  c.innerHTML=svg;
  const tip=document.getElementById('tip');let hit=null;
  const show=ev=>{
    const r=c.getBoundingClientRect(),x=(ev.touches?ev.touches[0].clientX:ev.clientX)-r.left;
    const b=bars.reduce((a,q)=>Math.abs(q.x+bw/2-x)<Math.abs(a.x+bw/2-x)?q:a);
    if(hit)hit.classList.remove('hit');hit=c.querySelector(`.bar[data-i="${bars.indexOf(b)}"]`);hit.classList.add('hit');
    tip.textContent=`${b.d.label.trim()} · $${pesos(b.d.total)}${b.d.cantidad?` · ${b.d.cantidad} art.`:''}`;
    tip.style.left=Math.max(90,Math.min(W-90,b.x+bw/2))+'px';tip.style.top='0px';tip.classList.add('on');
  };
  const hide=()=>{tip.classList.remove('on');if(hit){hit.classList.remove('hit');hit=null;}};
  c.addEventListener('touchstart',show,{passive:true});c.addEventListener('touchmove',show,{passive:true});c.addEventListener('touchend',hide);
  c.addEventListener('mousemove',show);c.addEventListener('mouseleave',hide);
}

/* ---------- CATÁLOGO ---------- */
const SVG_GRID='<svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>';
const SVG_LIST='<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
function pintarToggle(){document.getElementById('toggle').innerHTML=state.grid?SVG_LIST:SVG_GRID;}
function toggleVista(){buzz();state.grid=!state.grid;pintarToggle();renderCatalogo();}
function abrirAlta(){
  state.editando=null;prepararAlta();
  document.getElementById('np-titulo').innerHTML='Agregar producto <span class="tag-irene">tuyo</span>';
  document.getElementById('np-cant-lbl').textContent='Cantidad de piezas';
  document.getElementById('np-btn').textContent='Agregar a mi inventario';
  document.getElementById('np-del').classList.add('hidden');document.getElementById('np-del-conf').classList.add('hidden');
  document.getElementById('sheet-alta').classList.remove('hidden');
  setTimeout(()=>document.getElementById('np-desc').focus(),350);
}
/* Editar un producto de Irene: mismo formulario, relleno. Los cambios solo tocan las piezas sin vender. */
function abrirEdicion(){
  const p=state.producto;if(!p||!esDeIrene(p))return;
  if(!p.pid){toast('Falta correr asignarProductoIDs en la hoja para poder editar','err');return;}
  state.editando=p;cerrarVenta();prepararAlta();
  document.getElementById('np-titulo').textContent='Editar producto';
  document.getElementById('np-desc').value=p.descripcion;document.getElementById('np-cat').value=p.categoria||'';
  document.getElementById('np-costo').value=p.costoFinal||'';document.getElementById('np-precio').value=p.precio||'';
  state.npN=Number(p.stock)||1;document.getElementById('np-n').textContent=state.npN;
  document.getElementById('np-cant-lbl').textContent='Piezas sin vender';
  if(p.imagen){const fb=document.getElementById('np-foto-btn');fb.classList.add('ok');fb.innerHTML=`<img src="${esc(p.imagen)}" alt=""><span id="np-foto-txt">Foto actual · toca para cambiarla</span>`;}
  document.getElementById('np-btn').textContent='Guardar cambios';
  document.getElementById('np-del').classList.remove('hidden');document.getElementById('np-del-conf').classList.add('hidden');
  document.getElementById('sheet-alta').classList.remove('hidden');
}
function prepararAlta(){
  buzz();state.npN=1;document.getElementById('np-n').textContent='1';npFotoData=null;
  const fb=document.getElementById('np-foto-btn');fb.classList.remove('ok');fb.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span id="np-foto-txt">Tomar o elegir foto</span>';document.getElementById('np-foto').value='';
  ['np-desc','np-cat','np-costo','np-precio'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cats-list').innerHTML=[...new Set(state.catalogo.map(p=>p.categoria))].sort().map(c=>`<option value="${esc(c)}">`).join('');
  document.getElementById('np-btn').disabled=false;
}
function cerrarAlta(){document.getElementById('sheet-alta').classList.add('hidden');}
let npFotoData=null;
/* Comprime la foto en el teléfono (máx 1280px, JPEG) antes de mandarla. */
function npFoto(inp){
  const f=inp.files&&inp.files[0];if(!f)return;
  const btn=document.getElementById('np-foto-btn'),txt=document.getElementById('np-foto-txt');
  txt.textContent='Preparando foto…';
  const img=new Image();
  img.onload=()=>{
    const max=1280,k=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    const dataUrl=c.toDataURL('image/jpeg',0.82);
    npFotoData=dataUrl.split(',')[1];
    btn.classList.add('ok');btn.innerHTML=`<img src="${dataUrl}" alt=""><span>Foto lista · toca para cambiar</span>`;
    URL.revokeObjectURL(img.src);
  };
  img.onerror=()=>{txt.textContent='No se pudo leer la foto, intenta otra';npFotoData=null;};
  img.src=URL.createObjectURL(f);
}
function npCant(d){buzz();state.npN=Math.min(50,Math.max(1,state.npN+d));document.getElementById('np-n').textContent=state.npN;}
function guardarProducto(){
  const v=id=>document.getElementById(id).value.trim();
  const ed=state.editando;
  const producto={origen:'Irene',pid:ed?ed.pid:'',descripcion:v('np-desc'),categoria:v('np-cat'),costo:v('np-costo'),precio:v('np-precio'),cantidad:state.npN};
  const etiqueta=ed?'Guardar cambios':'Agregar a mi inventario';
  if(!producto.descripcion||!producto.categoria||!(Number(producto.costo)>0)||!(Number(producto.precio)>0)){toast('Llena descripción, categoría, costo y precio','err');return;}
  const b=document.getElementById('np-btn');b.disabled=true;b.textContent='Guardando…';
  apiPost(ed?'editarProducto':'agregarProducto',{producto}).then(async r=>{
    if(!r.success){toast(r.error||'No se pudo guardar','err');b.disabled=false;b.textContent=etiqueta;return;}
    if(npFotoData){
      b.textContent='Subiendo foto…';
      try{const rf=await apiPost('subirFoto',{descripcion:producto.descripcion,base64:npFotoData,mime:'image/jpeg',principal:!!ed});if(!rf.success)toast('Producto guardado, pero la foto no: '+(rf.error||''),'err');}
      catch(e){toast('Producto guardado; la foto no subió, puedes intentar luego','err');}
    }
    cerrarAlta();buzz([20,30,20]);
    toast(ed?`Cambios guardados en "${producto.descripcion}"`:`${r.agregados} pieza${r.agregados===1?'':'s'} de "${producto.descripcion}" en tu inventario`,'ok');
    state.editando=null;state.producto=null;
    state.dirty=true;state.catFirma='';cargarCatalogo();
  }).catch(err=>{toast(err.api?err.message:'Sin conexión, no se guardó','err');b.disabled=false;b.textContent=etiqueta;});
}
function pedirEliminar(){buzz();const p=state.editando;if(!p)return;
  document.getElementById('np-del-txt').textContent=`Se quitan ${p.stock} pieza${Number(p.stock)===1?'':'s'} sin vender de "${p.descripcion}". Las ventas ya registradas no cambian.`;
  document.getElementById('np-del').classList.add('hidden');document.getElementById('np-del-conf').classList.remove('hidden');
  document.querySelector('#sheet-alta .sheet').scrollTo({top:9999,behavior:'smooth'});}
function cancelarEliminar(){document.getElementById('np-del').classList.remove('hidden');document.getElementById('np-del-conf').classList.add('hidden');}
function eliminarProducto(){
  const p=state.editando;if(!p)return;buzz(20);
  const b=document.getElementById('np-del-si');b.disabled=true;b.textContent='Eliminando…';
  apiPost('eliminarProducto',{producto:{origen:'Irene',pid:p.pid}}).then(r=>{
    if(!r.success){toast(r.error||'No se pudo eliminar','err');b.disabled=false;b.textContent='Sí, eliminar';return;}
    state.catalogo=state.catalogo.filter(x=>x!==p);state.editando=null;state.producto=null;
    cerrarAlta();toast(`"${p.descripcion}" eliminado de tu inventario`,'ok');state.dirty=true;state.catFirma='';cargarCatalogo();
  }).catch(err=>{toast(err.api?err.message:'Sin conexión, no se eliminó','err');b.disabled=false;b.textContent='Sí, eliminar';});
}
function cargarCatalogo(){
  const l=document.getElementById('catalogo-list');
  if(state.catalogo.length){renderCats();renderCatalogo();}
  else l.innerHTML='<div class="sk" style="height:60px;margin-top:16px"></div><div class="sk" style="height:180px;margin-top:10px"></div>';
  apiCached('inicio',{usuario:state.usuario},(d,m)=>{
    if(d.dashboard&&d.dashboard.error){toast(d.dashboard.error,'err');return;}
    if(Array.isArray(d.recientes))state.recientes=d.recientes;
    if(Array.isArray(d.detalle))state.detalle=d.detalle;
    if(Array.isArray(d.ofrecer))state.ofrecer=d.ofrecer;
    if(d.operacionIrene)state.operacion=d.operacionIrene;
    if(d.impulso)state.impulso=d.impulso;
    state._dash=d.dashboard;state._meses=d.ventasMes||[];
    if(Array.isArray(d.catalogo)){const firma=JSON.stringify(d.catalogo);if(firma!==state.catFirma){state.catFirma=firma;state.catalogo=d.catalogo;renderCats();renderCatalogo();}else renderStrips(document.getElementById('search').value.trim().toLowerCase());}
    if(!m.stale)listo();
  },()=>{l.innerHTML=vacio('wifi','No se pudo cargar','Desliza hacia abajo para reintentar.');listo();});
}
function renderDuenos(){
  const w=document.getElementById('duenos');if(!w)return;
  const hayIrene=state.catalogo.some(p=>p.origen==='Irene'),hayAlex=state.catalogo.some(p=>p.origen!=='Irene');
  if(!hayIrene||!hayAlex){w.innerHTML='';if(state.dueno!=='todos')state.dueno='todos';return;}
  const yo=state.usuario;
  const ops=[['todos','Todo'],['Irene',yo==='Irene'?'Mi mercancía':'De Irene'],['Alex',yo==='Irene'?'De Alex':(yo==='Alex'?'Mi mercancía':'De Alex')]];
  w.innerHTML=ops.map(([v,l])=>`<button class="cat ${state.dueno===v?'on':''}" onclick="setDueno('${v}')">${l}</button>`).join('');
}
function setDueno(v){buzz();state.dueno=v;renderDuenos();renderCats();renderCatalogo();}
function filtroDueno(p){return state.dueno==='todos'||(state.dueno==='Irene'?p.origen==='Irene':p.origen!=='Irene');}
function renderCats(){
  renderDuenos();
  const base=state.catalogo.filter(filtroDueno);
  const counts={};base.forEach(p=>counts[p.categoria]=(counts[p.categoria]||0)+p.stock);
  const cats=['Todas',...Object.keys(counts).sort()];
  if(!cats.includes(state.cat))state.cat='Todas';
  document.getElementById('cats').innerHTML=cats.map(c=>`<button class="cat ${state.cat===c?'on':''}" onclick="setCat('${c.replace(/'/g,"\\'")}')">${esc(c)}<span class="n">${c==='Todas'?base.reduce((a,p)=>a+p.stock,0):counts[c]}</span></button>`).join('');
}
function setCat(c){buzz();state.cat=c;renderCats();renderCatalogo();document.querySelector('.cat.on')?.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});}
function stockDots(n,sinNum){const m=Math.min(n,5);return`<div class="stock">${Array.from({length:5},(_,i)=>`<i class="${i<m?'':'off'}"></i>`).join('')}${sinNum?'':`<small>${n}</small>`}</div>`;}
function miniCard(p,tag){
  return`<button class="mini" onclick="venderProducto('${p.descripcion.replace(/'/g,"\\'")}')">${thumb(p)}${tag||''}<div class="mi"><b>${esc(p.descripcion)}</b><small>$${precio(p.precio)}</small></div></button>`;
}
function renderStrips(q){
  const w=document.getElementById('cat-strips');if(!w)return;
  if(q||state.cat!=='Todas'||!state.catalogo.length){w.innerHTML='';w.dataset.firma='';return;}
  const baseD=state.catalogo.filter(filtroDueno);
  const bajos=baseD.filter(p=>p.stock<=2).sort((a,b)=>a.stock-b.stock||b.precio-a.precio);
  // "Sale rápido": lo que más se ha vendido en 60 días y sigue en stock (viene del backend)
  const rapidos=(state.ofrecer||[]).filter(p=>p.vendidos60>0).map(p=>baseD.find(x=>mismoProd(x,p))&&Object.assign({},baseD.find(x=>mismoProd(x,p)),{vendidos60:p.vendidos60})).filter(Boolean).slice(0,8);
  const firma=JSON.stringify([bajos.map(p=>p.descripcion+p.stock),rapidos.map(p=>p.descripcion+p.stock)]);
  if(w.dataset.firma===firma)return;w.dataset.firma=firma;
  w.innerHTML=(rapidos.length?`<div class="section-title">Sale rápido <span class="hint">Toca para vender o compartir</span></div>
    <div class="strip-h stagger">${rapidos.map(p=>miniCard(p,`<span class="tag n">${p.vendidos60} en 60 días</span>`)).join('')}</div>`:'')+
    (bajos.length?`<div class="section-title">Por agotarse <span class="hint">${bajos.length} producto${bajos.length===1?'':'s'}</span></div>
    <div class="strip-h stagger">${bajos.map(p=>miniCard(p,p.stock===1?'<span class="tag">Última</span>':'<span class="tag two">Quedan 2</span>')).join('')}</div>`:'')+
    ((rapidos.length||bajos.length)?`<div class="section-title" style="padding-top:14px">Todo el catálogo</div>`:'');
}
function venderProducto(desc){
  const p=state.catalogo.find(x=>x.descripcion===desc);if(!p){toast('Sin stock','err');return;}
  buzz(12);state.producto=p;state.vendedor=state.usuario;state.metodo=null;state.paso=1;abrirVenta();
}
function renderCatalogo(){
  const q=document.getElementById('search').value.trim().toLowerCase();
  renderStrips(q);
  state.filtrado=state.catalogo.filter(p=>filtroDueno(p)&&(state.cat==='Todas'||p.categoria===state.cat)&&(p.descripcion.toLowerCase().includes(q)||p.categoria.toLowerCase().includes(q)));
  const l=document.getElementById('catalogo-list');
  if(!state.filtrado.length){l.innerHTML=q?vacio('search','Nada con ese nombre','Prueba con otra palabra.'):vacio('box','Sin stock','Todo está vendido.');return;}
  if(state.grid){
    l.innerHTML=`<div class="grid stagger">${state.filtrado.map((p,i)=>`
      <button class="tile" onclick="elegir(${i})" style="text-align:left">
        ${thumb(p)}${Number(p.stock)===1?'<span class="low">Última</span>':''}${tagIrene(p)}
        <div class="info"><b>${esc(p.descripcion)}</b><span class="p num">$${precio(p.precio)}</span>${stockDots(p.stock)}</div>
      </button>`).join('')}</div>`;
    return;
  }
  const cats={};state.filtrado.forEach((p,i)=>{(cats[p.categoria]=cats[p.categoria]||[]).push(i);});
  l.innerHTML=Object.keys(cats).sort().map(cat=>`
    ${state.cat==='Todas'?`<div class="section-title">${esc(cat)}</div>`:'<div style="height:6px"></div>'}
    <div class="group stagger">${cats[cat].map(i=>{const p=state.filtrado[i];return`
      <div class="row plain tap" onclick="elegir(${i})">
        ${thumb(p)}<div class="t"><b>${esc(p.descripcion)}${tagIrene(p)}</b>${stockDots(p.stock)}</div>
        <div class="v pos num">$${precio(p.precio)}</div>
      </div>`}).join('')}</div>`).join('');
}
function elegir(i,lista){buzz(12);const p=(lista||state.filtrado)[i];state.producto=p;state.vendedor=state.usuario;state.metodo=null;state.paso=1;cerrarQuick();abrirVenta();}

/* ---------- VENTA RÁPIDA (+) ---------- */
function abrirQuick(){
  buzz();document.getElementById('qsearch').value='';
  document.getElementById('sheet-quick').classList.remove('hidden');
  const go=()=>{renderQuick();setTimeout(()=>document.getElementById('qsearch').focus(),350);};
  if(state.catalogo.length)go();else{document.getElementById('quick-list').innerHTML='<div class="sk" style="height:200px"></div>';apiCached('catalogo',{},d=>{if(!d.error){state.catalogo=d;go();}},()=>document.getElementById('quick-list').innerHTML=vacio('wifi','Sin conexión','No se pudo cargar el catálogo.'));}
}
let quickLista=[];
function renderQuick(){
  const q=document.getElementById('qsearch').value.trim().toLowerCase();
  const l=document.getElementById('quick-list');
  const fila=(p,i)=>`<div class="row plain tap" onclick="elegir(${i},quickLista)">
      ${thumb(p)}<div class="t"><b>${esc(p.descripcion)}${tagIrene(p)}</b><small>${esc(p.categoria)} · ${p.stock} disp.</small></div>
      <div class="v pos num">$${precio(p.precio)}</div></div>`;
  if(q){
    quickLista=state.catalogo.filter(p=>(p.descripcion.toLowerCase().includes(q)||p.categoria.toLowerCase().includes(q))).sort((a,b)=>b.stock-a.stock).slice(0,30);
    if(!quickLista.length){l.innerHTML=vacio('search','Nada con ese nombre');return;}
    l.innerHTML=`<div class="quick-hint">Resultados</div><div class="group stagger">${quickLista.map(fila).join('')}</div>`;return;
  }
  const rec=state.recientes.map(d=>state.catalogo.find(p=>p.pid===d||p.descripcion===d)).filter(Boolean);
  const masStock=[...state.catalogo].filter(p=>!rec.includes(p)).sort((a,b)=>b.stock-a.stock).slice(0,8);
  quickLista=[...rec,...masStock];
  if(!quickLista.length){l.innerHTML=vacio('box','Sin stock','Todo está vendido.');return;}
  l.innerHTML=(rec.length?`<div class="quick-hint">Vendidos recientemente</div><div class="group stagger">${rec.map((p,i)=>fila(p,i)).join('')}</div>`:'')+
    (masStock.length?`<div class="quick-hint" style="padding-top:14px">Con más stock</div><div class="group stagger">${masStock.map((p,i)=>fila(p,i+rec.length)).join('')}</div>`:'');
}
function cerrarQuick(){document.getElementById('sheet-quick').classList.add('hidden');}

/* ---------- VENTA ---------- */
/* Precio efectivo de esta venta: normal, o al costo cuando es para la familia. */
function precioVenta(){const p=state.producto;return state.precioTipo==='costo'?(Number(p.costoFinal)||0):p.precio;}
/* Ganancia = utilidad real, para todos: precio + extra − costo − moto. */
function gananciaEst(){
  const p=state.producto,extra=Number(state.cobro)||0,g=Number(state.gastos)||0;
  return precioVenta()+extra-(Number(p.costoFinal)||0)-g;
}
/* Lo que Irene le pasa a Alex por esta venta (solo ventas de Alex cobradas en efectivo): incluye el costo que él puso. */
function transferEst(){
  const p=state.producto,extra=Number(state.cobro)||0,g=Number(state.gastos)||0;
  if(esDeIrene(p)||state.vendedor!=='Alex'||state.metodo!=='Efectivo a Irene')return null;
  return precioVenta()+extra-g;
}
function abrirVenta(){
  if(!state.producto){abrirQuick();return;}
  precargarFoto(state.producto);
  state.precioTipo='normal';state.paso=1;pintarVenta();
  document.getElementById('sheet-venta').classList.remove('hidden');
}
function stockLinea(p){
  const n=Number(p.stock)||0,low=n<=1;
  return`<div class="stock-line ${low?'low':''}">${stockDots(n,true)}<span>${n===1?'Última pieza':n+' en stock'}</span></div>`;
}
function pintarVenta(){
  const p=state.producto,body=document.getElementById('venta-body'),foot=document.getElementById('venta-foot');
  if(state.paso===1){
    document.getElementById('venta-titulo').textContent='Registrar venta';
    const fotos=[p.imagen,...(p.extras||[])].filter(Boolean);
    const gal=`<div class="gal"><div class="gal-track" id="gal" onscroll="galDots(this)">${(fotos.length?fotos:['']).map(u=>thumb(p,'',u)).join('')}</div>
        ${fotos.length>1?`<div class="gal-dots" id="gal-dots">${fotos.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('')}</div><span class="badge">${fotos.length} fotos</span>`:''}</div>`;
    const outer=document.getElementById('venta-titulo');
    outer.style.display=fotos.length?'none':'';outer.previousElementSibling.style.display=fotos.length?'none':'';
    body.innerHTML=`
      ${fotos.length?`<div class="gal-wrap" id="gal-wrap"><div class="gal-bg" id="gal-bg" style="background-image:url('${esc(fotos[0])}')"></div><div class="gal-tint"></div><div class="gal-fade"></div><div class="handle"></div><h3>Registrar venta</h3>${gal}</div>`:gal}
      <div class="prod compact"><div style="min-width:0;flex:1"><b>${esc(p.descripcion)}</b><small style="display:block;color:var(--muted);font-weight:600;font-size:0.8125rem;margin-top:2px">Costo $${money(p.costoFinal)}</small>${stockLinea(p)}<div class="prod-actions"><button class="edit-link" onclick="compartirProducto()">↗ Compartir con foto</button>${esDeIrene(p)&&state.usuario==='Irene'?`<button class="edit-link" onclick="abrirEdicion()">✎ Editar o eliminar</button>`:''}</div></div><span class="p num">$${money(p.precio)}</span></div>
      <div class="field"><label>Vendedor</label><div class="opts">${['Irene','Mamá','Alex'].map(v=>`<button class="opt ${state.vendedor===v?'on':''}" onclick="setVend('${v}')">${v}</button>`).join('')}</div></div>
      <div class="field"><label>Método de pago</label><div class="opts">
        <button class="opt ${state.metodo==='Efectivo a Irene'?'on':''}" onclick="setMetodo('Efectivo a Irene')">${esDeIrene(p)?'Efectivo':'Efectivo a Irene'}</button>
        <button class="opt ${state.metodo===(esDeIrene(p)?'Transferencia a Irene':'Transferencia directa a Alex')?'on':''}" onclick="setMetodo('${esDeIrene(p)?'Transferencia a Irene':'Transferencia directa a Alex'}')">Transferencia</button>
      </div></div>
      ${Number(p.costoFinal)<p.precio?`<div class="field"><label>Precio</label><div class="opts" data-p="1">
        <button class="opt ${state.precioTipo!=='costo'?'on':''}" id="pt-n" onclick="setPrecioTipo('normal')">Normal · $${precio(p.precio)}</button>
        <button class="opt ${state.precioTipo==='costo'?'on':''}" id="pt-c" onclick="setPrecioTipo('costo')">Al costo · $${precio(p.costoFinal)}<br><small style="font-weight:600">para la familia</small></button>
      </div></div>`:''}
      <div class="field"><label>Cobro extra</label><div class="money"><span>$</span><input id="cobro" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${state.cobro||''}" oninput="guardarInputs();pintarCalc()"></div></div>
      <div class="field"><label>Motomandado / gastos</label><div class="money"><span>$</span><input id="gastos" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${state.gastos||''}" oninput="guardarInputs();pintarCalc()"></div></div>
      <div class="calc" id="calc"></div>`;
    pintarCalc();if(fotos.length)tintDesde(fotos[0],document.getElementById('gal-wrap'));
    foot.innerHTML=`<button class="btn primary" id="btn-next" onclick="revisar()" ${state.vendedor&&state.metodo?'':'disabled'}>Revisar venta</button><button class="btn ghost" onclick="cerrarVenta()">Cancelar</button>`;
  }else{
    const outer=document.getElementById('venta-titulo');outer.style.display='';outer.previousElementSibling.style.display='';outer.textContent='¿Confirmar venta?';
    const extra=Number(state.cobro)||0,g=Number(state.gastos)||0;
    const r=(a,b,cls='')=>`<div class="row ${cls}"><div class="t"><b>${a}</b></div><div class="v num">${b}</div></div>`;
    body.innerHTML=`<div class="prod compact rev-head">${thumb(p,'lg')}<div style="min-width:0;flex:1"><b>${esc(p.descripcion)}</b><small style="display:block;color:var(--muted);font-weight:600;font-size:0.8125rem;margin-top:2px">${esc(p.categoria||'')}</small></div><span class="p num">$${money(precioVenta())}</span></div>
    <div class="review">
      ${r('Precio','$'+money(precioVenta())+(state.precioTipo==='costo'?' <small style="font-weight:700;color:var(--mango)">al costo · familia</small>':''))}
      ${extra?r('Cobro extra','+$'+money(extra)):''}
      ${g?r('Motomandado','−$'+money(g)):''}
      ${r('Costo','$'+money(p.costoFinal))}
      ${r('Vendedor',state.vendedor)}
      ${r('Pago',state.metodo==='Efectivo a Irene'?(esDeIrene(p)?'Efectivo':'Efectivo a Irene'):(esDeIrene(p)?'Transferencia a Irene':'Transferencia a Alex'))}
      ${transferEst()!=null?r('Irene te transfiere','$'+money(transferEst())+' <small style="font-weight:600;color:var(--muted)">incluye tu costo</small>'):''}
      ${r('Ganancia '+(esDeIrene(p)?'Irene':state.vendedor),'$'+money(gananciaEst()),'total')}
    </div>
    <p style="font-size:0.8125rem;color:var(--muted);font-weight:600;text-align:center;margin-top:14px">${esDeIrene(p)?'Mercancía de Irene: la ganancia completa es suya y no entra a las cuentas con Alex. ':''}Se descuenta 1 pieza del inventario${Number(p.stock)===1?' (es la última)':''}. Tendrás 10 segundos para deshacer.</p>`;
    foot.innerHTML=`<button class="hold" id="hold"><div class="fill"></div><svg class="hold-ring" viewBox="0 0 24 24"><circle class="a" cx="12" cy="12" r="10"/><circle class="b" cx="12" cy="12" r="10"/></svg><span>Mantén presionado para confirmar</span></button><button class="btn ghost" onclick="state.paso=1;pintarVenta()">← Corregir</button>`;
    setupHold();
  }
}
function galDots(t){const i=Math.round(t.scrollLeft/t.clientWidth);document.querySelectorAll('#gal-dots i').forEach((d,k)=>d.classList.toggle('on',k===i));const bg=document.getElementById('gal-bg'),img=t.children[i]&&t.children[i].querySelector('img');if(bg&&img&&bg.dataset.src!==img.src){bg.dataset.src=img.src;bg.style.backgroundImage=`url('${img.src}')`;tintDesde(img.src,document.getElementById('gal-wrap'));}}
/* Color dominante de la foto (si el servidor permite leerla desde canvas); si no, no pasa nada. */
const tintCache={};
function tintDesde(url,el){
  if(!el)return;
  if(tintCache[url]){el.style.setProperty('--tint',tintCache[url]);return;}
  try{
    const im=new Image();im.crossOrigin='anonymous';
    im.onload=()=>{try{
      const c=document.createElement('canvas');c.width=c.height=24;const x=c.getContext('2d');x.drawImage(im,0,0,24,24);
      const d=x.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;
      for(let i=0;i<d.length;i+=4){const R=d[i],G=d[i+1],B=d[i+2],mx=Math.max(R,G,B),mn=Math.min(R,G,B);const sat=mx?(mx-mn)/mx:0,lum=mx/255;const w=0.05+sat*sat*2*(lum>0.12?1:0.2);r+=R*w;g+=G*w;b+=B*w;n+=w;}
      if(!n)return;const col=`rgb(${r/n|0},${g/n|0},${b/n|0})`;tintCache[url]=col;if(document.body.contains(el))el.style.setProperty('--tint',col);
    }catch(e){}};
    im.src=url;
  }catch(e){}
}
function pintarCalc(){const c=document.getElementById('calc');if(!c||!state.vendedor)return;const t=transferEst();c.innerHTML=`<span>Ganancia estimada</span><b class="num" id="calc-v"></b>`+(t!=null?`</div><div class="calc"><span>Irene te pasa (con tu costo)</span><b class="num">$${money(t)}</b>`:'');tick(document.getElementById('calc-v'),gananciaEst(),{dur:350});}
function guardarInputs(){state.cobro=document.getElementById('cobro')?.value||'';state.gastos=document.getElementById('gastos')?.value||'';}
/* Cambios de vendedor / método: solo actualizan lo afectado, sin reconstruir la hoja (evita reflash de la galería). */
function setVend(v){buzz();state.vendedor=v;refrescarOpciones();}
function setMetodo(m){buzz();state.metodo=m;refrescarOpciones();}
function setPrecioTipo(t){buzz();state.precioTipo=t;const n=document.getElementById('pt-n'),c=document.getElementById('pt-c');if(n)n.classList.toggle('on',t!=='costo');if(c)c.classList.toggle('on',t==='costo');pintarCalc();}
function refrescarOpciones(){
  document.querySelectorAll('#venta-body .opts:not([data-p])').forEach((g,gi)=>{
    g.querySelectorAll('.opt').forEach(b=>{
      const val=gi===0?b.textContent.trim():(b.textContent.trim()==='Transferencia'?(esDeIrene(state.producto)?'Transferencia a Irene':'Transferencia directa a Alex'):'Efectivo a Irene');
      b.classList.toggle('on',gi===0?state.vendedor===val:state.metodo===val);
    });
  });
  pintarCalc();
  const n=document.getElementById('btn-next');if(n)n.disabled=!(state.vendedor&&state.metodo);
}
function revisar(){if(!state.vendedor||!state.metodo)return;buzz(12);guardarInputs();state.paso=2;pintarVenta();document.querySelector('#sheet-venta .sheet').scrollTo({top:0});}
function cerrarVenta(){const o=document.getElementById('venta-titulo');o.style.display='';o.previousElementSibling.style.display='';document.getElementById('sheet-venta').classList.add('hidden');state.cobro='';state.gastos='';state.paso=1;state.precioTipo='normal';}
function setupHold(){
  const b=document.getElementById('hold');let t,tics=[];
  const down=e=>{e.preventDefault();if(b.disabled)return;buzz(15);b.classList.add('go');
    tics=[300,600].map(ms=>setTimeout(()=>buzz(6),ms));
    t=setTimeout(()=>{b.disabled=true;buzz(45);confirmarVenta();},900);};
  const up=()=>{clearTimeout(t);tics.forEach(clearTimeout);b.classList.remove('go');};
  b.addEventListener('pointerdown',down);b.addEventListener('pointerup',up);b.addEventListener('pointerleave',up);b.addEventListener('pointercancel',up);
  // Bloquea el menú contextual del navegador (Samsung Internet / Chrome) al mantener presionado
  b.addEventListener('contextmenu',e=>e.preventDefault());
  b.addEventListener('touchstart',e=>e.preventDefault(),{passive:false});
}
function confirmarVenta(){
  const b=document.getElementById('hold');b.querySelector('span').textContent='Registrando…';
  const venta={descripcion:state.producto.descripcion,pid:state.producto.pid||'',precioVenta:state.precioTipo==='costo'?(Number(state.producto.costoFinal)||0):'',vendedor:state.vendedor,metodoPago:state.metodo,cobroExtra:state.cobro||'',gastosExt:state.gastos||'',origen:state.producto.origen||'Alex'};
  const galImg=document.querySelector('#gal .thumb img.ok')||document.querySelector('#venta-body .thumb img.ok');
  const origen=galImg?{rect:galImg.getBoundingClientRect(),src:galImg.src}:null;
  apiPost('registrarVenta',{venta}).then(r=>{
    cerrarVenta();
    if(r.success){
      const vendido=state.producto;if(origen)vendido._fly=origen;
      state.dirty=true;state.catFirma='';   // fuerza datos frescos en la siguiente carga
      // descuenta 1 localmente para que el catálogo se vea al día aunque tarde la red
      const it=state.catalogo.find(x=>mismoProd(x,state.producto)&&x.categoria===state.producto.categoria);
      if(it){it.stock--;if(it.stock<=0)state.catalogo=state.catalogo.filter(x=>x!==it);}
      celebrar(r.detalle.id,vendido,r.detalle.ventaID);state.producto=null;state.vendedor=null;state.metodo=null;
    }else{toast(r.error||'No se pudo registrar','err');}
  }).catch(err=>{b.disabled=false;b.classList.remove('go');b.querySelector('span').textContent='Mantén presionado para confirmar';toast(err.api?err.message:'Sin conexión, la venta no se guardó','err');});
}
function celebrar(id,p,ventaID){
  const s=document.getElementById('success');
  const colors=['#1D9E75','#F59E0B','#E5484D','#3B82F6','#A855F7'];
  const visual=p?`${thumb(p,'hero-img')}<div class="badge-ok"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>`
    :`<div class="check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>`;
  s.innerHTML=Array.from({length:26},(_,i)=>`<div class="confetti" style="left:50%;top:45%;background:${colors[i%5]};--dx:${(Math.random()-.5)*360}px;--dy:${(Math.random()-.5)*360}px;animation-delay:${Math.random()*.2}s"></div>`).join('')+
    `${visual}<h3>Venta registrada</h3><p>${p?esc(p.descripcion)+' · ':''}${esc(id)}</p>
    <div class="undo-row"><button class="btn ghost" id="btn-undo" onclick="deshacerVenta()">Deshacer · <span id="undo-n">10</span></button><button class="btn primary" onclick="cerrarExito()">Listo</button></div>`;
  s.classList.remove('hidden');buzz([30,40,60]);
  // la foto "vuela" desde la hoja de venta hasta su lugar en la pantalla de éxito
  const fly=p&&p._fly,dest=s.querySelector('.hero-img');
  if(fly&&dest&&!matchMedia('(prefers-reduced-motion:reduce)').matches){
    delete p._fly;dest.classList.add('wait');
    const f=document.createElement('div');f.className='fly';const a=fly.rect;
    Object.assign(f.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px',backgroundImage:`url('${fly.src}')`});
    document.body.appendChild(f);
    requestAnimationFrame(()=>{const b=dest.getBoundingClientRect();Object.assign(f.style,{left:b.left+'px',top:b.top+'px',width:b.width+'px',height:b.height+'px',borderRadius:'28px'});});
    setTimeout(()=>{dest.classList.remove('wait');f.remove();},520);
  }
  // ventana de 10 s para deshacer; al terminar se cierra sola
  let n=10;state._exito={id,p,ventaID,timer:setInterval(()=>{n--;const e=document.getElementById('undo-n');if(e)e.textContent=n;if(n<=0)cerrarExito();},1000)};
}
function cerrarExito(){
  const x=state._exito;if(x){clearInterval(x.timer);state._exito=null;}
  document.getElementById('success').classList.add('hidden');cambiarVista(state.vista||'catalogo');
}
function deshacerVenta(){
  const x=state._exito;if(!x)return;clearInterval(x.timer);buzz(12);
  const b=document.getElementById('btn-undo');b.disabled=true;b.textContent='Deshaciendo…';
  apiPost('anularVenta',{id:x.id,ventaID:x.ventaID||'',origen:(x.p&&x.p.origen)||'Alex'}).then(r=>{
    if(!r.success){toast(r.error||'No se pudo deshacer','err');b.disabled=false;b.textContent='Deshacer';return;}
    if(x.p){x.p.stock=(Number(x.p.stock)||0)+1;if(!state.catalogo.includes(x.p))state.catalogo.push(x.p);}
    state.dirty=true;state.catFirma='';state.ventFirma='';
    state._exito=null;document.getElementById('success').classList.add('hidden');
    toast('Venta deshecha, la pieza volvió al inventario','ok');cambiarVista(state.vista||'catalogo');
  }).catch(err=>{toast(err.api?err.message:'Sin conexión, no se pudo deshacer','err');b.disabled=false;b.textContent='Deshacer';});
}

/* ---------- LISTA DE VENTAS (dentro de Dinero) ---------- */
const LG_ICONS={
  cal:'<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  trophy:'<svg class="ic" viewBox="0 0 24 24"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/></svg>',
  rocket:'<svg class="ic" viewBox="0 0 24 24"><path d="M12 3c4 2 6 6 6 10l-3 3H9l-3-3c0-4 2-8 6-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-2 5M15 16l2 5"/></svg>',
  sun:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>'
};
const MESES_LARGO={Ene:'enero',Feb:'febrero',Mar:'marzo',Abr:'abril',May:'mayo',Jun:'junio',Jul:'julio',Ago:'agosto',Sep:'septiembre',Oct:'octubre',Nov:'noviembre',Dic:'diciembre'};
function mesLargo(label){if(!label)return'';const [m,y]=String(label).split(' ');return (MESES_LARGO[m]||m.toLowerCase())+(y?' '+y:'');}
function mesActualNombre(){return MESES_LARGO[['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][new Date().getMonth()]];}
const pz=n=>`${n} pieza${n===1?'':'s'}`;
function renderLogros(L){
  const w=document.getElementById('logros');if(!w)return;
  const firma=JSON.stringify(L)+state.usuario;if(w.dataset.firma===firma)return;w.dataset.firma=firma;
  if(!L||!L.total||!L.total.cantidad){w.innerHTML='';return;}
  const c=[],mesA=mesActualNombre();
  const card=(cls,ico,k,cuerpo,ayuda)=>`<div class="lgc ${cls} tap" onclick="explicarAyuda(${(state._ayudas=state._ayudas||[]).push({t:k,p:ayuda})-1})">${ico||''}<div class="k">${k}</div><div class="d big">${cuerpo}</div></div>`;
  state._ayudas=[];
  if(L.mejorMes)c.push(card('selva',LG_ICONS.trophy,'Tu récord',
    `Tu mejor mes fue <b>${mesLargo(L.mejorMes.label)}</b>: <b class="num" data-v="${L.mejorMes.ganancia}">$0</b> de ganancia con ${pz(L.mejorMes.cantidad)}.`,
    `El mes en que más ganancia has tenido desde que empezaste a vender.`));
  c.push(card('tinta',LG_ICONS.rocket,'Tu trayectoria',
    `Vendes desde <b>${mesLargo(L.total.desde)||'el inicio'}</b>. Llevas <b class="num" data-v="${L.total.cantidad}" data-int="1">0</b> piezas vendidas y <b>$${pesos(L.total.ganancia)}</b> de ganancia en ${L.total.meses} mes${L.total.meses===1?'':'es'}.`,
    `Todo lo que has vendido y ganado desde tu primera venta registrada.`));
  w.innerHTML=`<div class="logros-title"><div class="section-title">Tus logros</div><small>Toca para saber más</small></div><div class="logros stagger">${c.join('')}</div>`;
  w.querySelectorAll('.num[data-v]').forEach(el=>tick(el,Number(el.dataset.v),el.dataset.int?{prefix:'',fmt:entero,dur:900}:{dur:900}));
}
function diaLabel(ts){
  const d=new Date(ts),h=new Date();h.setHours(0,0,0,0);
  const diff=Math.round((h-new Date(d.getFullYear(),d.getMonth(),d.getDate()))/864e5);
  if(diff===0)return'Hoy';if(diff===1)return'Ayer';
  const D=['dom','lun','mar','mié','jue','vie','sáb'],M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return`${D[d.getDay()]} ${d.getDate()} ${M[d.getMonth()]}${d.getFullYear()!==h.getFullYear()?' '+d.getFullYear():''}`;
}
function renderVentas(){
  const l=document.getElementById('ventas-list');
  const m0=new Date();m0.setDate(1);m0.setHours(0,0,0,0);
  let v=state.ventas;
  if(state.filtro==='pendiente')v=v.filter(x=>x.estatusTransferencia==='No transferido');
  if(state.filtro==='transferido')v=v.filter(x=>x.estatusTransferencia==='Transferido');
  if(state.filtro==='mes')v=v.filter(x=>x.fechaTimestamp>=m0.getTime());
  if(!v.length){l.innerHTML=vacio('leaf','Nada por aquí','No hay ventas con este filtro.');return;}
  const grupos={};v.forEach(x=>{const k=x.fechaTimestamp?new Date(x.fechaTimestamp).toDateString():'sin';(grupos[k]=grupos[k]||[]).push(x);});
  l.innerHTML=Object.keys(grupos).map(k=>{const g=grupos[k],tot=g.reduce((a,x)=>a+x.precio+x.cobroExtra,0);return`
    <div class="day"><b>${k==='sin'?'Sin fecha':diaLabel(g[0].fechaTimestamp)}</b><span class="num">${g.length} · $${pesos(tot)}</span></div>
    <div class="group stagger">${g.map(x=>{const ok=x.estatusTransferencia==='Transferido';const hh=x.fechaTimestamp?new Date(x.fechaTimestamp).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'';return`
      <div class="vrow">
        ${thumb(x)}<div class="name">${esc(x.descripcion)}</div>
        <div class="amt num">$${pesos(x.precio+x.cobroExtra)}</div>
        <div class="meta"><span class="status ${x.estatusTransferencia==='No aplica'?'selva':ok?'selva':'mango'}">${x.estatusTransferencia==='No aplica'?'Tuya':ok?'Liquidada':'Sin liquidar'}</span><span>${hh}</span><span>${x.id}</span>${x.gastoExt?`<span>moto $${pesos(x.gastoExt)}</span>`:''}</div>
        <div class="gain num">+$${pesos(x.ganancia)}</div>
      </div>`}).join('')}</div>`}).join('');
}

/* ---------- EXPLICACIONES VISUALES ---------- */
const ficha=(v,lbl,cls='')=>`<span class="f ${cls}">${v}${lbl?`<small>${lbl}</small>`:''}</span>`;
const op=o=>`<span class="op">${o}</span>`;
function formulaVenta(v,mini){ // fichas con números reales de una venta
  const $=x=>'$'+money(x);const partes=[ficha($(v.precio),'precio')];
  if(v.cobroExtra)partes.push(op('+'),ficha($(v.cobroExtra),'extra'));
  partes.push(op('−'),ficha($(v.costoFinal),'costo','neg'));
  if(v.gastoExt)partes.push(op('−'),ficha($(v.gastoExt),'moto','neg'));
  partes.push(op('='),ficha($(v.ganancia),'ganancia','res'));
  return`<div class="formula ${mini?'mini':''}">${partes.join('')}</div>`;
}
function ejemploVenta(f){return(state.detalle||[]).find(f)||null;}
const EXPLICA={
  tAlex:{t:'Ventas de Alex en efectivo',p:'Cuando <b>Alex</b> vende y el cliente paga en efectivo, Irene guarda ese dinero. Alex puso el costo del producto, así que <b>todo lo que queda después del moto se le transfiere</b> (su costo de vuelta + su ganancia).',
    f:()=>[ficha('precio','pagó el cliente'),op('+'),ficha('extra'),op('−'),ficha('moto','envío','neg'),op('='),ficha('a Alex','se transfiere','res')],ej:null},
  tCosto:{t:'Costo de lo vendido por Irene y Mamá',p:'Cuando vende <b>Irene o Mamá</b>, ellas se quedan la ganancia. A Alex solo le regresan <b>el costo del producto</b>, que fue lo que él invirtió.',
    f:()=>[ficha('precio','pagó el cliente'),op('−'),ficha('ganancia','de ella','neg'),op('−'),ficha('moto','envío','neg'),op('='),ficha('costo','a Alex','res')],ej:v=>v.vendedor!=='Alex'},
  tMoto:{t:'Moto que puso Irene',p:'Si el cliente le pagó a <b>Alex por transferencia</b>, Irene pagó el envío de su bolsa. Ese monto <b>se le descuenta</b> a Alex en la siguiente transferencia.',
    f:()=>[ficha('$0','Irene ya no cobra nada'),op('−'),ficha('moto','lo puso Irene','neg'),op('='),ficha('−moto','se descuenta','res')],ej:v=>v.vendedor==='Alex'&&v.metodoPago!=='Efectivo a Irene'},
  gIrene:{t:'Ganancia de Irene',p:'Lo que Irene <b>se queda</b> de sus ventas que aún no liquida. Es suya.',
    f:()=>[ficha('precio'),op('+'),ficha('extra'),op('−'),ficha('costo','a Alex','neg'),op('−'),ficha('moto','envío','neg'),op('='),ficha('ganancia','de Irene','res')],ej:v=>v.vendedor==='Irene'},
  gMama:{t:'Ganancia de Mamá',p:'Igual que Irene: Mamá <b>se queda</b> la ganancia de lo que vende y a Alex le regresa el costo.',
    f:()=>[ficha('precio'),op('+'),ficha('extra'),op('−'),ficha('costo','a Alex','neg'),op('−'),ficha('moto','envío','neg'),op('='),ficha('ganancia','de Mamá','res')],ej:v=>v.vendedor==='Mamá'},
  hoy:{t:'Hoy',p:'Suma de las ventas registradas <b>hoy</b> que aún no se liquidan (precio + extra).',f:null},
  moto:{t:'Motomandado del mes',p:'Todo lo gastado en envíos este mes. <b>Es un gasto</b>: ese dinero ya se le pagó al repartidor.',f:null},
  totalMes:{t:'Ventas del mes',p:'Todo lo vendido este mes (precio + extra), liquidado o no. La línea muestra los últimos 7 días. <b>Toca la fila para ver la lista.</b>',f:null},
  artMes:{t:'Artículos vendidos',p:'Cuántas piezas se vendieron este mes, liquidadas o no.',f:null},
  ring:{t:'Tu meta del mes',p:'Tu ganancia de este mes comparada con la meta que tú elegiste. "Unas N ventas más" se calcula con lo que sueles ganar por venta.',f:null},
  negocio:{t:'Tu ganancia del mes',p:'Suma de <b>tu mercancía</b> (precio + extra − costo − moto, porque el costo lo pagaste tú) más lo que ganas <b>vendiendo la mercancía de Alex</b> (precio + extra − costo − moto; el costo se le regresa a él). Todo esto es tuyo.',f:null},
  inversion:{t:'Inversión en tu mercancía',p:'La suma de lo que <b>has pagado</b> por todos tus productos, vendidos o en stock. Cada vez que vendes una pieza recuperas lo que te costó; lo demás es ganancia.',f:null},
  stockIrene:{t:'Si vendes todo tu stock',p:'Lo que cobrarías vendiendo <b>todas</b> tus piezas al precio que les pusiste. Abajo dice cuánto te costaron y cuánto ganarías: la diferencia entre las dos.',f:null},
  hero:{t:()=>state.usuario==='Alex'?'Irene te debe':'Le debes a Alex',p:'Es la suma de: ganancia de Alex en sus ventas en efectivo <b>+</b> costo de lo que vendieron Irene y Mamá <b>−</b> moto que puso Irene. <b>Toca el monto</b> para ver venta por venta.',f:()=>[ficha('ganancia Alex','efectivo'),op('+'),ficha('costo','Irene y Mamá'),op('−'),ficha('moto','puso Irene','neg'),op('='),ficha('total','por transferir','res')]}
};
function explicar(k){
  const e=EXPLICA[k];if(!e){return;}buzz();
  document.getElementById('exp-titulo').textContent=typeof e.t==='function'?e.t():e.t;
  const ej=e.ej?ejemploVenta(e.ej):null;
  document.getElementById('exp-body').innerHTML=`<p class="exp-p">${typeof e.p==='function'?e.p():e.p}</p>${e.f?`<div class="formula">${e.f().join('')}</div>`:''}${ej?`<div class="exp-ej">Ejemplo real · ${esc(ej.descripcion)}</div>${formulaVenta(ej)}`:''}`;
  document.getElementById('sheet-exp').classList.remove('hidden');
}
function cerrarExp(){document.getElementById('sheet-exp').classList.add('hidden');}
/* Explicación de texto simple (tarjetas de logros). Antes era un toast que desaparecía a los 2.8 s: ilegible para un lector lento. */
function explicarTexto(t,p){buzz();document.getElementById('exp-titulo').textContent=t;document.getElementById('exp-body').innerHTML=`<p class="exp-p">${p}</p>`;document.getElementById('sheet-exp').classList.remove('hidden');}
function explicarAyuda(i){const a=(state._ayudas||[])[i];if(a)explicarTexto(a.t,a.p);}

/* ---------- HOJAS DE DETALLE ---------- */
function aporte(v){ // cuánto aporta una venta pendiente a "por transferir" y por qué
  const efectivo=v.metodoPago==='Efectivo a Irene';
  if(v.vendedor==='Alex')return efectivo?{tipo:'a',monto:v.precio+v.cobroExtra-v.gastoExt}:{tipo:'c',monto:-v.gastoExt};
  return{tipo:'b',monto:v.costoFinal};
}
function filaVenta(v,monto,sub,fichas,gan){
  return`<div class="row plain" style="align-items:flex-start">${thumb(v)}<div class="t"><b>${esc(v.descripcion)}</b><small>${esc(sub)}</small>${fichas||''}</div><div class="v num ${monto<0?'neg':''}">${monto<0?'−':''}$${pesos(Math.abs(monto))}${gan!=null?`<small class="gan">+$${pesos(gan)} ganancia</small>`:''}</div></div>`;
}
function fichasAporte(v){ // qué se transfiere de esta venta, en fichas
  const $=x=>'$'+pesos(x),p=[];
  if(v.vendedor==='Alex'&&v.metodoPago==='Efectivo a Irene'){p.push(ficha($(v.precio+v.cobroExtra)+' cobrado'));if(v.gastoExt)p.push(op('−'),ficha($(v.gastoExt)+' moto','','neg'));}
  else if(v.vendedor==='Alex'){p.push(ficha('ya pagado a Alex'),op('−'),ficha($(v.gastoExt)+' moto','','neg'));}
  else{p.push(ficha($(v.precio+v.cobroExtra)+' cobrado'),op('−'),ficha($(v.ganancia)+' suya','','neg'));if(v.gastoExt)p.push(op('−'),ficha($(v.gastoExt)+' moto','','neg'));}
  return`<div class="formula mini">${p.join('')}</div>`;
}
function donutHTML(A,B,C,T){
  const L=251.3,base=(A+B+C)||1;let off=0;
  const seg=(v,cls)=>{const len=Math.max(0,v/base*L-(v?2:0));const h=`<circle class="${cls}" cx="50" cy="50" r="40" stroke-dasharray="${len} ${L-len}" stroke-dashoffset="${-off}"/>`;off+=v/base*L;return h;};
  const it=(cls,t,sub,v,k,neg)=>`<div class="it ${neg?'neg':''}" onclick="explicar('${k}')"><span class="sw" style="background:var(${cls})"></span><div class="t">${t}<small>${sub}</small></div><div class="v num">${neg?'−':''}$${pesos(v)}</div></div>`;
  return`<div class="donut-card"><div class="donut"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="40"/>${seg(A,'s1')}${seg(B,'s2')}${seg(C,'s3')}</svg><div class="ctr"><b class="num">$${pesos(T)}</b><small>total</small></div></div>
    <div class="dleg">${A?it('--selva','Ventas de Alex en efectivo','precio completo · el costo era suyo',A,'tAlex'):''}${B?it('--ink','Costo de lo de Irene y Mamá','ellas se quedan la ganancia',B,'tCosto'):''}${C?it('--mango','Moto que puso Irene','se descuenta',C,'tMoto',true):''}</div></div>
    <div style="font-size:0.7188rem;font-weight:600;color:var(--muted);text-align:center;margin:8px 0 4px">Toca un renglón para ver cómo se calcula</div>`;
}
function abrirDetalle(tipo,copiar){
  buzz();const body=document.getElementById('detalle-body'),t=document.getElementById('detalle-titulo');
  const L=state.detalle||[];
  if(tipo==='transferencia'){
    const pend=L.filter(v=>v.estatusTransferencia==='No transferido');
    const g={a:[],b:[],c:[]};pend.forEach(v=>{const x=aporte(v);if(x.monto||x.tipo!=='c')g[x.tipo].push({v,monto:x.monto});});
    const sum=k=>g[k].reduce((s,x)=>s+x.monto,0);const A=sum('a'),B=sum('b'),C=-sum('c'),T=A+B-C,base=A+B+C||1;
    const esAlex=state.usuario==='Alex';
    t.textContent=esAlex?'Irene te debe':'Le debes a Alex';
    const grupo=(k,titulo,sub,fn)=>g[k].length?`<div class="det-sub">${titulo}<b>${k==='c'?'−':''}$${pesos(Math.abs(sum(k)))}</b></div><div class="group">${g[k].map(x=>filaVenta(x.v,x.monto,fn(x.v),fichasAporte(x.v))).join('')}</div>`:'';
    body.innerHTML=`
      <div class="det-total"><div><small>${pend.length} venta${pend.length===1?'':'s'} sin liquidar</small>Total</div><b class="num">$${pesos(T)}</b></div>
      ${donutHTML(A,B,C,T)}
      <div class="det-btn"><button class="btn primary" onclick="copiarResumen()">Copiar resumen</button><button class="btn ghost" onclick="cerrarDetalle()">Cerrar</button></div>
      ${grupo('a','Ventas de Alex en efectivo','',v=>`${v.vendedor} · ${diaLabel(v.fechaTimestamp)}`)}
      ${grupo('b','Costo de lo vendido por Irene y Mamá','',v=>`${v.vendedor} · ${diaLabel(v.fechaTimestamp)}`)}
      ${grupo('c','Moto que puso Irene · se descuenta','',v=>`Alex · pagado por transferencia · ${diaLabel(v.fechaTimestamp)}`)}
      ${pend.length?'':vacio('leaf','Nada pendiente','Todo está liquidado.')}`;
    state._resumen={A,B,C,T,n:pend.length,g};
    if(copiar){copiarResumen();return;}
  }else{
    const m0=new Date();m0.setDate(1);m0.setHours(0,0,0,0);
    const mes=L.filter(v=>v.fechaTimestamp>=m0.getTime()).sort((a,b)=>b.fechaTimestamp-a.fechaTimestamp);
    t.textContent='Ventas de '+mesActualNombre();
    const por={};mes.forEach(v=>{(por[v.vendedor]=por[v.vendedor]||[]).push(v);});
    const tot=mes.reduce((s,v)=>s+v.precio+v.cobroExtra,0);
    const prev=(state._meses||[]).length>1?state._meses[state._meses.length-2]:null;
    const totAlex=mes.filter(v=>v.origen!=='Irene').reduce((s,v)=>s+v.precio+v.cobroExtra,0);
    const totIrene=tot-totAlex;
    body.innerHTML=`<div class="det-total"><div><small>${mes.length} artículo${mes.length===1?'':'s'}${totIrene?` · incluye $${pesos(totIrene)} de mercancía de Irene`:''}${prev?` · ${mesLargo(prev.label).split(' ')[0]}: $${pesos(prev.total)}`:''}</small>Total vendido</div><b class="num">$${pesos(tot)}</b></div>`+
      (['Irene','Alex','Mamá'].filter(u=>por[u]).map(u=>{const l=por[u],tv=l.reduce((s,v)=>s+v.precio+v.cobroExtra,0),tg=l.reduce((s,v)=>s+v.ganancia,0);return`
        <div class="vend-head"><div class="avatar ${claseUsuario(u)}">${u[0]}</div><div class="vh"><b>${u}</b><small>${l.length} artículo${l.length===1?'':'s'}</small></div><div class="vt"><b class="num">$${pesos(tv)}</b><small>+$${pesos(tg)} ganancia</small></div></div>
        <div class="group">${l.map(v=>filaVenta(v,v.precio+v.cobroExtra,`${diaLabel(v.fechaTimestamp)} · ${v.origen==='Irene'?'mercancía de Irene':v.estatusTransferencia==='Transferido'?'liquidada':'sin liquidar'}`,'',v.ganancia)).join('')}</div>`;}).join('')||vacio('leaf','Sin ventas este mes'));
  }
  document.getElementById('sheet-detalle').classList.remove('hidden');document.querySelector('#sheet-detalle .sheet').scrollTo({top:0});
}
function cerrarDetalle(){document.getElementById('sheet-detalle').classList.add('hidden');}
function copiarResumen(){
  const r=state._resumen;if(!r)return;
  const lin=(k,tit)=>r.g[k].length?`\n${tit}:\n`+r.g[k].map(x=>`• ${x.v.descripcion} (${x.v.vendedor}) ${x.monto<0?'−':''}$${money(Math.abs(x.monto))}`).join('\n'):'';
  const txt=`Kiosko · ${formatDate(new Date())}\nPor transferir a Alex: $${money(r.T)} (${r.n} ventas)`+lin('a','Ventas de Alex en efectivo')+lin('b','Costo de lo vendido por Irene y Mamá')+lin('c','Moto que puso Irene (se descuenta)');
  (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>{buzz(12);toast('Resumen copiado, pégalo en WhatsApp');}).catch(()=>toast('No se pudo copiar','err'));
}

/* ---------- USUARIO ---------- */
function abrirUsuarios(){
  const u=[['Irene','Vendedora principal'],['Mamá','Ventas ocasionales'],['Alex','Administrador']];
  document.getElementById('user-list').innerHTML=u.map(([n,d])=>`
    <button class="user ${state.usuario===n?'on':''}" onclick="cambiarUsuario('${n}')" style="width:100%;text-align:left">
      <div class="avatar ${claseUsuario(n)}">${n[0]}</div><div><b>${n}</b><small>${d}</small></div></button>`).join('')+
    `<button class="btn ghost" style="margin-top:8px" onclick="cerrarSesion()">Cerrar sesión en este teléfono</button>
     <div class="ver">Kiosko v${APP_VERSION} · ${APP_BUILD}<button onclick="buscarActualizacion()">Buscar actualización</button></div>`;
  document.getElementById('sheet-usuario').classList.remove('hidden');
}
function cambiarUsuario(u){buzz();state.impulso=null;state._dinArmado='';try{localStorage.setItem('oc:usuario',u);}catch(e){}setUsuario(u);state.ventas=[];state.ventFirma='';const lw=document.getElementById('logros');if(lw){lw.innerHTML='';lw.dataset.firma='';}cerrarUsuarios();cambiarVista('catalogo');}
function cerrarUsuarios(){document.getElementById('sheet-usuario').classList.add('hidden');}

/* ---------- UTILS ---------- */
function money(n){return(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});}
/* Resúmenes sin centavos: menos dígitos, lectura más rápida. Los centavos quedan solo en el detalle de cada venta. */
function pesos(n){return Math.round(Number(n)||0).toLocaleString('es-MX',{maximumFractionDigits:0});}
/* Precio de producto: quita solo el .00 (un precio con centavos reales se respeta). */
function precio(n){return money(n).replace(/\.00$/,'');}
function formatDate(d){const D=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],M=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return`${D[d.getDay()]} ${d.getDate()} ${M[d.getMonth()]}`;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
let toastT;
function toast(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type;clearTimeout(toastT);toastT=setTimeout(()=>t.classList.add('hidden'),2800);}

/* ---------- PWA ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

/* ---------- INSTALAR COMO APP ----------
   Si se abre en el navegador (no instalada), sugiere instalarla una vez iniciada sesión.
   Chrome/Edge dan el diálogo nativo (beforeinstallprompt); otros navegadores ven instrucciones. */
let _bip=null,_installListo=false;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_bip=e;if(state.usuario)mostrarInstall();});
window.addEventListener('appinstalled',()=>{cerrarInstall(true);toast('Kiosko instalada, búscala en tu pantalla de inicio','ok');});
function instalada(){return matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;}
function setupInstall(){
  if(_installListo||instalada())return;_installListo=true;
  let hasta=0;try{hasta=Number(localStorage.getItem('oc:install-no')||0);}catch(e){}
  if(Date.now()<hasta)return;
  setTimeout(mostrarInstall,3000);   // deja que cargue el inicio antes de pedir algo
}
function mostrarInstall(){
  if(instalada())return;
  const el=document.getElementById('install');if(!el||!el.classList.contains('hidden'))return;
  document.getElementById('install-btn').textContent=_bip?'Instalar':'Cómo';
  el.classList.remove('hidden');
}
function instalar(){
  buzz();
  if(_bip){_bip.prompt();_bip.userChoice.then(r=>{if(r.outcome!=='accepted')cerrarInstall();});return;}
  const ua=navigator.userAgent,ios=/iPhone|iPad/.test(ua),samsung=/SamsungBrowser/.test(ua);
  explicarTexto('Cómo instalar Kiosko',
    ios?'En Safari toca el botón de <b>compartir</b> (el cuadrito con la flecha) y luego <b>"Agregar a pantalla de inicio"</b>.':
    samsung?'Samsung Internet no deja instalarla bien. Abre esta misma dirección en <b>Chrome</b>, toca el menú <b>⋮</b> y elige <b>"Instalar app"</b> o <b>"Agregar a la pantalla principal"</b>.':
    'Toca el menú <b>⋮</b> del navegador y elige <b>"Instalar app"</b> o <b>"Agregar a la pantalla principal"</b>.');
}
function cerrarInstall(silencio){
  document.getElementById('install').classList.add('hidden');
  if(!silencio)try{localStorage.setItem('oc:install-no',String(Date.now()+7*864e5));}catch(e){}  // vuelve a preguntar en una semana
}
