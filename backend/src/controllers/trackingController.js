const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const interest = require('../services/interestService');

// ─── Public tracking endpoints (no auth) ───
// Website script:  <script src="https://<api>/api/track/t.js?k=<tracking_key>" async></script>
// Beacons arrive as text/plain JSON (navigator.sendBeacon → no CORS preflight).

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try { return JSON.parse(String(req.body || '{}')); } catch { return {}; }
}

const cleanId = (v) => String(v || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

function deviceOf(ua = '') {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Throttle score recomputes: at most once per lead per 30 s.
const lastRefresh = new Map();
function refreshSoon(leadId) {
  if (!leadId) return;
  const now = Date.now();
  if (now - (lastRefresh.get(leadId) || 0) < 30000) return;
  lastRefresh.set(leadId, now);
  interest.refreshLeadInterest(leadId).catch((e) => logger.error('Interest refresh failed:', e.message));
}

exports.script = async (req, res) => {
  const key = cleanId(req.query.k);
  const endpoint = `${config.apiUrl}/api/track/hit`;
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=300');
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (!key) return res.send('/* Flazyn: missing ?k= tracking key */');
  res.send(`/* Flazyn interest tracking — https://flazyn.com/privacy */
(function(){if(window.__flazyn)return;window.__flazyn=1;
var K=${JSON.stringify(key)},E=${JSON.stringify(endpoint)};
function rid(){return(Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)).slice(0,32)}
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
var vid=ls('_fz_vid');if(!vid){vid=rid();ls('_fz_vid',vid)}
var now=Date.now(),s=ls('_fz_s'),sid;try{s=JSON.parse(s)}catch(e){s=null}
sid=(s&&now-s.t<1800000)?s.id:rid();function touch(){ls('_fz_s',JSON.stringify({id:sid,t:Date.now()}))}touch();
var q=new URLSearchParams(location.search),fz=q.get('fz');if(fz)ls('_fz_lt',fz);else fz=ls('_fz_lt');
var acc=0,lastAct=Date.now(),maxScroll=0,tick=Date.now();
function scrollPct(){var h=document.documentElement,b=document.body,st=h.scrollTop||b.scrollTop,sh=(h.scrollHeight||b.scrollHeight)-h.clientHeight;return sh>0?Math.round(st/sh*100):100}
function send(ev,extra){var p={k:K,vid:vid,sid:sid,ev:ev,url:location.href,path:location.pathname,title:document.title,ref:document.referrer,secs:Math.round(acc),scroll:maxScroll,fz:fz,dev:screen.width};
for(var x in extra)p[x]=extra[x];acc=0;touch();var body=JSON.stringify(p);
try{if(navigator.sendBeacon&&navigator.sendBeacon(E,new Blob([body],{type:'text/plain'})))return}catch(e){}
try{fetch(E,{method:'POST',body:body,keepalive:true,mode:'no-cors',headers:{'Content-Type':'text/plain'}})}catch(e){}}
function count(){var t=Date.now();if(!document.hidden&&t-lastAct<30000)acc+=(t-tick)/1000;tick=t}
['mousemove','keydown','scroll','touchstart','click'].forEach(function(e){addEventListener(e,function(){lastAct=Date.now();if(e==='scroll')maxScroll=Math.max(maxScroll,scrollPct())},{passive:true})});
setInterval(function(){count();if(acc>=10)send('ping')},10000);
document.addEventListener('visibilitychange',function(){count();if(document.hidden)send('leave');else tick=Date.now()});
addEventListener('pagehide',function(){count();send('leave')});
send('view');
var push=history.pushState;history.pushState=function(){count();send('leave');push.apply(this,arguments);maxScroll=0;setTimeout(function(){send('view')},0)};
addEventListener('popstate',function(){send('view')});
document.addEventListener('submit',function(e){var f=e.target,o={};if(!f||!f.elements)return;
for(var i=0;i<f.elements.length;i++){var el=f.elements[i],n=(el.name||el.id||'').toLowerCase(),v=el.value;if(!v)continue;
if(el.type==='email'||n.indexOf('mail')>-1)o.email=v;else if(el.type==='tel'||/phone|mobile|whatsapp|tel/.test(n))o.phone=v}
if(o.email||o.phone)send('identify',o)},true);
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href*="/api/automations/lead-form/"]');if(a&&a.href.indexOf('fz_vid=')<0){a.href+=(a.href.indexOf('?')<0?'?':'&')+'fz_vid='+vid}},true);
window.flazyn={identify:function(o){send('identify',o||{})}};
})();`);
};

exports.hit = async (req, res) => {
  res.status(204).end(); // never make the visitor's page wait
  try {
    const b = parseBody(req);
    const key = cleanId(b.k);
    const visitorId = cleanId(b.vid);
    const sessionId = cleanId(b.sid);
    if (!key || !visitorId || !sessionId) return;
    const ws = (await db.query('SELECT id FROM workspaces WHERE tracking_key = $1', [key])).rows[0];
    if (!ws) return;

    // Who is this? 1) signed ?fz= token from a link we sent  2) remembered visitor  3) form identify
    let leadId = null;
    const tokenLead = interest.leadIdFromToken(b.fz);
    if (tokenLead) {
      const ok = await db.query('SELECT 1 FROM leads WHERE id = $1 AND workspace_id = $2', [tokenLead, ws.id]);
      if (ok.rows[0]) leadId = tokenLead;
    }
    if (!leadId) {
      const v = await db.query('SELECT lead_id FROM web_visitors WHERE workspace_id = $1 AND visitor_id = $2', [ws.id, visitorId]);
      leadId = v.rows[0]?.lead_id || null;
    }
    if (!leadId && b.ev === 'identify') leadId = await interest.findLeadByContact(ws.id, { email: b.email, phone: b.phone });
    if (leadId) await interest.linkVisitorToLead(ws.id, visitorId, leadId);
    else {
      await db.query(
        `INSERT INTO web_visitors (workspace_id, visitor_id) VALUES ($1,$2)
         ON CONFLICT (workspace_id, visitor_id) DO UPDATE SET last_seen_at = NOW()`, [ws.id, visitorId]
      );
    }

    const path = String(b.path || '/').slice(0, 300);
    const { session, isNewSession } = await interest.recordView({
      workspaceId: ws.id, sessionId, channel: 'web', leadId, visitorId,
      objectKey: path, url: b.url, title: b.title, seconds: b.secs, scroll: b.scroll,
      referrer: isNewSessionSafe(b.ref), device: Number(b.dev) < 768 ? 'mobile' : 'desktop',
    });
    if (session?.lead_id) {
      if (isNewSession || b.ev === 'view') await interest.alertOnceForSession(session, { what: `is on your website${b.title ? ` — ${String(b.title).slice(0, 60)}` : ''}` });
      refreshSoon(session.lead_id);
    }
  } catch (err) {
    logger.error('Tracking hit error:', err.message);
  }
};

function isNewSessionSafe(ref) {
  return ref ? String(ref).slice(0, 500) : null;
}

// ─── Tracked document viewer ───

exports.viewer = async (req, res, next) => {
  try {
    const tid = req.params.trackingId;
    const t = (await db.query('SELECT * FROM content_tracking WHERE tracking_id = $1', [tid])).rows[0];
    if (!t) return res.status(404).type('html').send('<p style="font-family:system-ui;padding:40px">This link has expired.</p>');
    await db.query(
      'UPDATE content_tracking SET first_opened_at = COALESCE(first_opened_at, NOW()), last_opened_at = NOW(), open_count = open_count + 1 WHERE id = $1',
      [t.id]
    );
    const file = (await db.query('SELECT name, url, mime_type, workspace_id FROM content_files WHERE id = $1', [t.file_id])).rows[0];
    if (!file) return res.status(404).send('File not found');
    const brand = (await db.query('SELECT * FROM workspace_branding WHERE workspace_id = $1', [file.workspace_id])).rows[0] || {};
    if (t.lead_id) refreshSoon(t.lead_id);

    const isPdf = /pdf/i.test(file.mime_type || '') || /\.pdf(\?|$)/i.test(file.url);
    const isImage = /^image\//i.test(file.mime_type || '') || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(file.url);
    const isVideo = /^video\//i.test(file.mime_type || '') || /\.(mp4|webm|ogg)(\?|$)/i.test(file.url);
    const nonce = crypto.randomBytes(16).toString('base64');
    const fileSrc = `${config.apiUrl}/api/content/track/${encodeURIComponent(tid)}/file`;
    const beat = `${config.apiUrl}/api/track/doc/${encodeURIComponent(tid)}`;

    res.set('Content-Security-Policy', [
      "default-src 'self'", `script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com`, "worker-src 'self' blob: https://cdnjs.cloudflare.com",
      "style-src 'unsafe-inline' https://fonts.googleapis.com", 'font-src https://fonts.gstatic.com', 'img-src * data: blob:',
      'media-src *', `connect-src 'self' ${config.apiUrl} https://cdnjs.cloudflare.com`, "frame-ancestors 'none'",
    ].join('; '));
    res.type('html').send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(file.name)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#2B2A26;color:#F3F1EC}
header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#16150F;border-bottom:1px solid #2E2D29}
header img{max-height:28px}header .n{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
header .p{font:12px ui-monospace,monospace;color:#A7A395}header a{color:#16150F;background:#D6F24B;border-radius:6px;padding:6px 12px;font-size:13px;font-weight:600;text-decoration:none}
#pages{display:flex;flex-direction:column;align-items:center;gap:14px;padding:18px 10px 60px}
#pages canvas,#pages img,#pages video{max-width:min(100%,980px);height:auto;background:#fff;border-radius:4px;box-shadow:0 10px 30px -12px rgba(0,0,0,.6)}
.ld{padding:60px;color:#A7A395;font-size:14px}
</style></head><body>
<header>${brand.logo_url ? `<img src="${esc(brand.logo_url)}" alt="">` : ''}<span class="n">${esc(file.name)}</span><span class="p" id="pg"></span><a href="${esc(fileSrc)}" download>Download</a></header>
<main id="pages">${isImage ? `<img src="${esc(fileSrc)}" alt="" data-page="1">` : isVideo ? `<video src="${esc(fileSrc)}" controls playsinline data-page="1"></video>` : isPdf ? '<p class="ld">Loading document…</p>' : `<p class="ld"><a style="color:#D6F24B" href="${esc(fileSrc)}">Open ${esc(file.name)}</a></p>`}</main>
${isPdf ? '<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>' : ''}
<script nonce="${nonce}">
(function(){
var sid=(Date.now().toString(36)+Math.random().toString(36).slice(2)).slice(0,32),current=1,total=${isPdf ? 0 : 1},acc=0,lastAct=Date.now(),tick=Date.now();
function beat(){var t=Date.now();if(!document.hidden&&t-lastAct<60000)acc+=(t-tick)/1000;tick=t;if(acc<1)return;
var body=JSON.stringify({sid:sid,page:current,secs:Math.round(acc),pages:total});acc=0;
try{if(navigator.sendBeacon&&navigator.sendBeacon(${JSON.stringify(beat)},new Blob([body],{type:'text/plain'})))return}catch(e){}
fetch(${JSON.stringify(beat)},{method:'POST',body:body,keepalive:true,headers:{'Content-Type':'text/plain'}}).catch(function(){})}
['mousemove','scroll','keydown','touchstart','click'].forEach(function(e){addEventListener(e,function(){lastAct=Date.now()},{passive:true})});
setInterval(beat,5000);document.addEventListener('visibilitychange',beat);addEventListener('pagehide',beat);
var pg=document.getElementById('pg');
function watch(){var io=new IntersectionObserver(function(es){var best=null;es.forEach(function(e){if(e.isIntersecting&&(!best||e.intersectionRatio>best.intersectionRatio))best=e});
if(best){var n=+best.target.getAttribute('data-page');if(n&&n!==current){beat();current=n}if(pg)pg.textContent=current+(total?' / '+total:'')}},{threshold:[0.25,0.5,0.75]});
document.querySelectorAll('[data-page]').forEach(function(el){io.observe(el)})}
${isPdf ? `
var lib=window['pdfjs-dist/build/pdf'];lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
lib.getDocument(${JSON.stringify(fileSrc)}).promise.then(function(pdf){total=pdf.numPages;var root=document.getElementById('pages');root.innerHTML='';
var w=Math.min(root.clientWidth-20,980),chain=Promise.resolve();
for(var i=1;i<=pdf.numPages;i++)(function(n){chain=chain.then(function(){return pdf.getPage(n).then(function(p){var v=p.getViewport({scale:1});var s=(w/v.width)*(window.devicePixelRatio||1);
var vp=p.getViewport({scale:s});var c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;c.style.width=(vp.width/(window.devicePixelRatio||1))+'px';c.setAttribute('data-page',n);root.appendChild(c);
return p.render({canvasContext:c.getContext('2d'),viewport:vp}).promise})})})(i);
chain.then(watch);beat()}).catch(function(){document.getElementById('pages').innerHTML='<p class="ld">Could not display this PDF here — <a style="color:#D6F24B" href=${JSON.stringify(fileSrc)}>download it</a>.</p>'});` : 'watch();'}
})();
</script></body></html>`);
  } catch (err) { next(err); }
};

exports.file = async (req, res, next) => {
  try {
    const t = (await db.query('SELECT file_id FROM content_tracking WHERE tracking_id = $1', [req.params.trackingId])).rows[0];
    if (!t) return res.status(404).end();
    const file = (await db.query('SELECT name, url, mime_type FROM content_files WHERE id = $1', [t.file_id])).rows[0];
    if (!file?.url || !/^https?:\/\//i.test(file.url)) return res.status(404).end();
    const upstream = await axios.get(file.url, { responseType: 'stream', timeout: 30000, maxRedirects: 3 });
    res.set('Content-Type', file.mime_type || upstream.headers['content-type'] || 'application/octet-stream');
    if (upstream.headers['content-length']) res.set('Content-Length', upstream.headers['content-length']);
    res.set('Content-Disposition', `inline; filename="${String(file.name || 'file').replace(/"/g, '')}"`);
    res.set('Cache-Control', 'private, max-age=600');
    upstream.data.pipe(res);
  } catch (err) {
    logger.error('Tracked file proxy error:', err.message);
    if (!res.headersSent) res.status(502).end();
  }
};

exports.docBeat = async (req, res) => {
  res.status(204).end();
  try {
    const b = parseBody(req);
    const sessionId = cleanId(b.sid);
    if (!sessionId) return;
    const t = (await db.query(
      `SELECT ct.*, cf.name AS file_name FROM content_tracking ct LEFT JOIN content_files cf ON cf.id = ct.file_id WHERE ct.tracking_id = $1`,
      [req.params.trackingId]
    )).rows[0];
    if (!t) return;
    const page = Math.max(1, Math.min(5000, parseInt(b.page, 10) || 1));
    const pages = parseInt(b.pages, 10);
    if (pages > 0 && pages !== t.page_count) await db.query('UPDATE content_tracking SET page_count = $1 WHERE id = $2', [pages, t.id]);
    const secs = Math.max(0, Math.min(Number(b.secs) || 0, 60));
    await db.query('UPDATE content_tracking SET time_spent_seconds = COALESCE(time_spent_seconds, 0) + $1 WHERE id = $2', [Math.round(secs), t.id]);
    const { session } = await interest.recordView({
      workspaceId: t.workspace_id, sessionId: `d${sessionId}`.slice(0, 64), channel: 'document', leadId: t.lead_id,
      contentTrackingId: t.id, objectKey: `doc:${t.id}:p${page}`, title: t.file_name, pageNumber: page, seconds: secs,
      device: deviceOf(req.get('user-agent')),
    });
    if (session?.lead_id) {
      await interest.alertOnceForSession(session, { what: `is reading “${t.file_name || 'your document'}” right now` });
      refreshSoon(session.lead_id);
    }
  } catch (err) {
    logger.error('Document beat error:', err.message);
  }
};

// ─── Authenticated helpers (mounted under /api/automations/tracking) ───

exports.getSetup = async (req, res, next) => {
  try {
    const ws = (await db.query('SELECT tracking_key, settings FROM workspaces WHERE id = $1', [req.workspaceId])).rows[0];
    const settings = typeof ws.settings === 'string' ? JSON.parse(ws.settings) : (ws.settings || {});
    const src = `${config.apiUrl}/api/track/t.js?k=${ws.tracking_key}`;
    const stats = (await db.query(
      `SELECT COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours') AS sessions_24h,
              COUNT(*) FILTER (WHERE lead_id IS NOT NULL AND last_seen_at > NOW() - INTERVAL '24 hours') AS identified_24h,
              MAX(last_seen_at) AS last_hit
       FROM engagement_sessions WHERE workspace_id = $1 AND channel = 'web'`, [req.workspaceId]
    )).rows[0];
    res.json({
      tracking_key: ws.tracking_key,
      website_url: settings.website_url || '',
      snippet: `<script src="${src}" async></script>`,
      stats,
    });
  } catch (err) { next(err); }
};

exports.updateSetup = async (req, res, next) => {
  try {
    const url = String(req.body.website_url || '').trim();
    if (url && !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Website URL must start with https://' });
    await db.query(`UPDATE workspaces SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('website_url', $1::text) WHERE id = $2`, [url, req.workspaceId]);
    res.json({ website_url: url });
  } catch (err) { next(err); }
};

exports.regenerateKey = async (req, res, next) => {
  try {
    const r = await db.query("UPDATE workspaces SET tracking_key = 'fz_' || replace(gen_random_uuid()::text, '-', '') WHERE id = $1 RETURNING tracking_key", [req.workspaceId]);
    res.json({ tracking_key: r.rows[0].tracking_key });
  } catch (err) { next(err); }
};
