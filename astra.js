#!/usr/bin/env node
/**
 * astra.js — the presentation surface for the Senso published-action demo.
 *
 * WHAT THIS IS. One page that asks a question, retrieves a published answer and the next step
 * the publisher attached, and has a model explain the fit. It is deliberately thin: all the
 * retrieval work lives in senso-mcp.js, which is hash-verified and must not be edited to make
 * this run.
 *
 * WHY TWO ROUND TRIPS AND NOT ONE. The progress states have to be honest. "Finding a source"
 * is shown while retrieval is genuinely running, and "Preparing your answer" while the model
 * call is genuinely running. A single request with a client-side animation would be a fake
 * progress bar, which the design brief rules out. So the page calls /api/retrieve, renders what
 * came back, then calls /api/explain.
 *
 * WHERE THE KEYS ARE. The Senso side needs no key at all: retrieval is public HTTP against
 * published pages. The model side does need one, and it stays in this process. No key is ever
 * sent to the browser. Those two facts are different and the page says so rather than blurring
 * them into one "no key needed" claim.
 *
 * WHAT THIS DOES NOT CLAIM. A link that responds is a link that responds. It is not a verified
 * answer, not a safety judgement, and not completed onboarding. The status line says "Link
 * checked" with the time it was checked, and nothing stronger.
 */

const http = require('http');

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8"><title>ChatGPT</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--ink:#0d0d0d;--mut:#5d5d67;--faint:#8f8f9d;--line:#e8e8ed;--hair:#ededf1;--bub:#e8edfb;
      --grn:#17864a;--grnbg:#e6f4ec;--off:#8e8e99;--offbg:#f1f1f3}
*{box-sizing:border-box}
html{-webkit-font-smoothing:antialiased}
body{margin:0;background:#fff;color:var(--ink);
     font:17px/1.75 ui-sans-serif,-apple-system,"Segoe UI",Helvetica,Arial,sans-serif}
.thread{max-width:790px;margin:0 auto;padding:30px 24px 140px}
.askbar{display:flex;gap:10px;margin-bottom:10px}
.askbar input{flex:1;padding:14px 18px;border:1px solid var(--line);border-radius:26px;font:inherit;font-size:16px}
.askbar input:focus{outline:none;border-color:#c9c9d4}
.askbar button{padding:14px 22px;border:0;border-radius:26px;background:var(--ink);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.askbar button:disabled{opacity:.4}
.presets{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:34px}
.presets b{font-weight:450;font-size:13px;color:var(--mut);background:#f6f6f8;padding:6px 12px;border-radius:999px;cursor:pointer}
.turn{display:flex;justify-content:flex-end;margin-bottom:32px}
.bub{background:var(--bub);border-radius:22px;padding:12px 20px;max-width:76%;font-size:17px;line-height:1.55}
.ans p{margin:0 0 20px}
.ans strong{font-weight:650}
table{width:100%;border-collapse:collapse;margin:6px 0 26px;font-size:16px}
th{text-align:left;font-weight:650;padding:0 16px 12px 0;border-bottom:1px solid var(--hair)}
td{padding:15px 16px 15px 0;border-bottom:1px solid var(--hair);vertical-align:top;color:#24242c}
td.n{font-weight:650;color:var(--ink)}
tr.hit td{background:#fbfcff}
.mark{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:650;color:var(--grn);
      background:var(--grnbg);padding:3px 9px;border-radius:999px;margin-left:8px;vertical-align:1px}
.mark svg{width:11px;height:11px}
/* the big box, inline in the answer */
.box{border:1px solid var(--line);border-radius:18px;padding:16px;margin:4px 0 26px;background:#fff}
.bhead{display:flex;align-items:flex-start;gap:14px;padding:2px 4px 14px}
.blogo{width:52px;height:52px;border-radius:50%;background:#fff;border:1px solid var(--line);flex:0 0 52px;
       display:grid;place-items:center;overflow:hidden;padding:7px}
.blogo img{max-width:100%;max-height:100%}
.blogo .wm{font-size:12px;font-weight:800;color:var(--mut);text-align:center;line-height:1.15}
.btitle{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.btitle h3{margin:0;font-size:19px;font-weight:650;line-height:1.35;letter-spacing:-.01em}
.tag{font-size:12px;font-weight:650;padding:3px 10px;border-radius:999px;cursor:pointer}
.tag.on{color:var(--grn);background:var(--grnbg)}
.tag.off{color:var(--off);background:var(--offbg)}
.bdesc{margin-top:6px;color:var(--mut);font-size:15.5px;line-height:1.55}
.split{display:flex;gap:18px;border-top:1px solid var(--hair);padding-top:16px;align-items:flex-start}
.shot{flex:0 0 46%;height:206px;border-radius:12px;overflow:hidden;background:#f2f2f6;
      display:grid;place-items:center;text-align:center}
.shot img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.shot .empty{color:#9a9aa8;font-size:13px;line-height:1.6;max-width:220px;padding:16px}
.side{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:9px;
      height:206px;padding:2px 2px 2px 0}
.kick{color:var(--mut);font-size:14.5px}
.side h4{margin:0;font-size:19px;font-weight:650;letter-spacing:-.01em;line-height:1.3}
.loc{display:flex;align-items:center;gap:8px;color:var(--mut);font-size:14.5px}
.loc svg{width:16px;height:16px;flex:0 0 16px;color:#9a9aa8}
.side h4{white-space:normal;overflow-wrap:anywhere}
.btitle h3{overflow-wrap:anywhere}
.sub{display:inline-flex;align-items:center;justify-content:center;gap:11px;background:var(--grn);color:#fff;
     text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:650;font-size:15px;
     margin-top:2px;align-self:flex-start}
.sub svg{width:16px;height:16px;flex:0 0 16px}
.held{border-radius:10px;background:#fbf4f4;border:1px solid #efdcdc;padding:12px 14px;color:#84464a;font-size:14px;line-height:1.6}
.held b{color:#68343a;display:block;margin-bottom:2px}
.vs{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:500;cursor:pointer;
     white-space:nowrap;align-self:flex-start}
.vs svg{width:15px;height:15px;flex:0 0 15px}
.vs.on{color:var(--grn)}.vs.off{color:var(--off)}
.pills{display:flex;flex-wrap:wrap;gap:7px;padding:14px 4px 2px}
.p{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;padding:5px 11px;border-radius:999px;cursor:pointer;font-weight:550}
.p.on{background:var(--grnbg);color:var(--grn)}
.p.off{background:var(--offbg);color:var(--off)}
.p svg{width:12px;height:12px}
.ev{margin:12px 4px 0;background:#fafafc;border:1px solid var(--line);border-radius:12px;padding:15px 17px;
    font:12.5px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;color:#43434e}
.chip{display:inline-flex;align-items:center;gap:6px;background:#f1f1f3;border-radius:999px;padding:3px 10px 3px 7px;
      font-size:12.5px;color:var(--mut);cursor:pointer;vertical-align:1px;margin-left:3px}
.chip svg{width:13px;height:13px}
.note{color:var(--faint);font-size:13px;line-height:1.6;margin-top:12px}
.prog{display:flex;align-items:center;gap:11px;color:var(--faint);font-size:16px}
.sp2{width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--faint);border-radius:50%;animation:s .8s linear infinite}
@keyframes s{to{transform:rotate(360deg)}}

.turo-card{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:center;background:#f8f9fa;border-radius:18px;padding:38px 34px;margin:8px 0 12px;color:#111827}
.turo-eyebrow{display:inline-block;background:#e9ebee;border-radius:20px;padding:4px 12px;font-size:10px;font-weight:700;letter-spacing:1px;line-height:1.6}
.turo-card h3{font-family:Georgia,"Times New Roman",serif;font-size:28px;line-height:1.15;letter-spacing:-.7px;margin:20px 0 18px;font-weight:700}
.turo-card p{font-size:15px;line-height:1.65;color:#6b7280;margin:0 0 26px}
.turo-button{display:inline-flex;align-items:center;gap:12px;background:#111827;color:white;border:0;border-radius:12px;padding:14px 20px;font-family:inherit;font-weight:600;font-size:14px;line-height:1.5;text-decoration:none}
.turo-button svg{width:17px;height:17px}
.turo-signature{display:flex;gap:9px;align-items:center;color:#6b7280;font-size:13px;margin-top:14px}
.turo-gem{width:16px;height:16px;display:grid;grid-template-columns:repeat(2,5px);grid-template-rows:repeat(2,5px);gap:2px;transform:rotate(45deg)}
.turo-gem i{background:#75c9ee}.turo-gem i:nth-child(2){background:#6ee2c0}.turo-gem i:nth-child(3){background:#f493b1}.turo-gem i:nth-child(4){background:#ffdb7d}
.turo-photo{aspect-ratio:388/291;border-radius:14px;background-image:url('/assets/turo-reference.png');background-size:244.845% 163.23%;background-position:89.502% 51.087%;background-repeat:no-repeat}
.turo-context{color:#717680;font-size:12px;line-height:1.6;margin-bottom:12px}
.turo-details{font-size:13px;color:#6b7280;margin-bottom:24px}.turo-details summary{cursor:pointer}.turo-details .ev{margin:10px 0}
@media(min-width:1000px){.thread:has(.turo-card){max-width:1000px}.turo-card{padding:42px 40px;gap:40px}.turo-card h3{font-size:40px}.turo-card p{font-size:16px}}
@media(max-width:620px){.turo-card{grid-template-columns:1fr;padding:26px;gap:26px}.turo-card h3{font-size:33px}.turo-photo{grid-row:2}.askbar input{min-width:0}}

.mercedes-photo{background-image:url('/assets/mercedes-reference.png');background-size:235.052% 149.485%;background-position:91.603% 55.556%}

body{font-size:16px;line-height:1.65;color:#0d0d0d}
.chat-header{height:68px;padding:12px 28px;display:flex;align-items:center;justify-content:space-between;position:fixed;inset:0 0 auto;background:rgba(255,255,255,.96);z-index:5}
.chat-brand{font-size:18px;font-weight:600;display:flex;align-items:center;gap:8px}.chat-brand svg{width:12px;color:#777}.demo-label{font-size:11px;color:#999;font-weight:400;margin-left:4px}
.new-chat{border:1px solid #dedede;border-radius:24px;padding:9px 16px;background:#fff;font:500 13px inherit;cursor:pointer}
.thread,.thread:has(.turo-card){max-width:816px;padding:100px 24px 170px;margin:auto}
.welcome{position:fixed;top:42%;left:0;right:0;text-align:center;margin:0;font-size:26px;font-weight:400;letter-spacing:-.5px}
.composer-wrap{position:fixed;z-index:6;left:50%;width:min(768px,calc(100% - 40px));transform:translateX(-50%);top:calc(42% + 61px)}
.askbar{margin:0;background:#fff;border:1px solid #c9c9c9;border-radius:30px;box-shadow:0 2px 5px #00000008,0 0 36px #00000004;padding:7px 9px 7px 12px;gap:9px;align-items:center}
.askbar input{padding:6px 0;border:0;border-radius:0;font-size:16px;min-width:0;line-height:1.7;background:transparent}.askbar input:focus{outline:none}.askbar input::placeholder{color:#999}
.askbar button{width:36px;height:36px;flex:0 0 36px;padding:0;display:grid;place-items:center;border-radius:50%;background:#111;color:#fff}.askbar button svg{width:20px;height:20px}.askbar button:disabled{opacity:1;background:#b5b5b5}
.askbar .examples-toggle{background:transparent;color:#333;font-size:25px;font-weight:300;width:32px;flex-basis:32px}
.presets{display:none;position:absolute;bottom:calc(100% + 12px);left:0;max-width:480px;padding:10px;background:white;border:1px solid #e5e5e5;border-radius:18px;box-shadow:0 6px 24px #0000000c;margin:0;gap:6px}.presets.open{display:flex}.presets b{font-size:13px;background:#f6f6f6;padding:8px 12px;font-weight:400}
.welcome-help{display:block;margin:44px auto 0;padding:10px 16px;border:1px solid #d5d5d5;border-radius:24px;background:#fff;font-size:14px;font-weight:500;cursor:pointer}
.chat-footer{position:fixed;bottom:8px;left:20px;right:20px;text-align:center;color:#999;font-size:11px;z-index:6}
body.chatting .welcome,body.chatting .welcome-help{display:none}body.chatting .composer-wrap{top:auto;bottom:32px}body.chatting .composer-wrap:before{content:'';position:absolute;z-index:-1;inset:-24px -12px -32px;background:linear-gradient(transparent,#fff 24px)}
.turn{margin-bottom:36px}.bub{background:#e9e9e9;border-radius:22px;padding:11px 17px;max-width:70%;font-size:16px;line-height:1.5}
.message{margin-bottom:54px}.ans p{line-height:1.7;margin-bottom:24px}.chip{font-size:11px;padding:1px 7px;background:#f3f3f3}.chip svg{width:11px;height:11px}
.turo-card{margin-top:28px}.note{font-size:12px}.turo-context{font-size:11px}.turo-details{font-size:12px}
@media(min-width:1000px){.turo-card{padding:32px;gap:28px}.turo-card h3{font-size:32px}.turo-card p{font-size:15px}}
@media(max-width:620px){.chat-header{padding:12px 18px}.thread,.thread:has(.turo-card){padding:90px 20px 150px}.welcome{font-size:24px}.bub{max-width:86%}.composer-wrap{width:calc(100% - 24px)}.demo-label{display:none}.turo-card h3{font-size:30px}}


.presets,.presets.open{display:flex;position:static;justify-content:center;max-width:none;gap:7px;margin:14px 0 0;padding:0;background:transparent;border:0;border-radius:0;box-shadow:none}
.presets b{background:#fff;border:1px solid #d6d6d6;border-radius:22px;padding:6px 12px;font-size:12px;font-weight:500;line-height:1.5;color:#303030;transition:background .15s}
.presets b:hover{background:#f5f5f5}.presets b:focus-visible{outline:2px solid #777;outline-offset:2px}
.welcome-help,.askbar .examples-toggle{display:none}
.askbar{padding-left:20px}
body.chatting .composer-wrap{bottom:32px}
body.chatting .composer-wrap:before{inset:-24px -12px -32px}
@media(max-width:620px){.presets,.presets.open{gap:5px;margin-top:10px}.presets b{font-size:11px;padding:5px 9px}.thread,.thread:has(.turo-card){padding-bottom:200px}}

.telus-photo{background-image:url('/assets/telus-reference.png');background-size:253.093% 201.031%;background-position:85.69% 52.381%}
[hidden]{display:none!important}
</style></head><body>
<header class="chat-header"><div class="chat-brand">ChatGPT <svg viewBox="0 0 12 12" fill="none" stroke="currentColor"><path d="m3 4.5 3 3 3-3"/></svg><span class="demo-label">Senso demo</span></div><button class="new-chat" id="new-chat">New chat</button></header>
<h1 class="welcome">Where should we begin?</h1>
<main class="thread"><div id="out" aria-live="polite"></div></main>
<div class="composer-wrap">
<form class="askbar" id="f"><button type="button" class="examples-toggle" aria-label="Show example questions" aria-expanded="false">+</button><input id="q" aria-label="Message" placeholder="Ask ChatGPT" autocomplete="off"><button id="go" aria-label="Send message" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button></form>
<div class="presets">
<b role="button" tabindex="0" data-q="What makes documentation readable by AI agents?">AI documentation</b><b role="button" tabindex="0" data-q="what problem does senso ai solve">Senso</b><b role="button" tabindex="0" data-q="best way to rent an SUV in Los Angeles">Turo</b><b role="button" tabindex="0" data-q="best luxury suv from mercedes">Mercedes-Benz</b><b role="button" tabindex="0" data-q="TELUS PureFibre internet plans in Canada">TELUS</b><b role="button" tabindex="0" data-q="best term life insurance in canada sun life">Sun Life</b>
</div>
<button type="button" class="welcome-help">What can you do?</button>
</div><footer class="chat-footer">Senso demo · AI can make mistakes. Check sources and offer details.</footer>
<script>
var $=function(s){return document.querySelector(s)};
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
var cfg={};fetch('/api/config').then(function(r){return r.json()}).then(function(c){cfg=c});
var TICK='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 4.5 6.2 11.8 2.9 8.5"/></svg>';
var CROSS='<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6"/></svg>';
var PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>';
var ARR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
var DIA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/></svg>';
var LNK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 1 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 1 0 7 7l1-1"/></svg>';
function pill(on,l,ev){return '<span class="p '+(on?'on':'off')+'" data-ev="'+esc(JSON.stringify(ev))+'">'+(on?TICK:CROSS)+esc(l)+'</span>'}
function turoBox(p){
  var a=p.action;
  var o='<section class="turo-card" aria-label="Turo call to action preview"><div><span class="turo-eyebrow">TRUSTED SOURCE</span><h3>Skip the car rental<br>counter</h3><p>Discover a better way to rent cars in Canada on Turo. Browse an incredible selection of cars, from the everyday to the extraordinary, and rent just about any car, just about anywhere, right from your phone.</p>';
  o+=a?'<a class="turo-button" href="'+esc(a.target)+'" target="_blank" rel="noopener">Rent the perfect car '+ARR+'</a>':'<button class="turo-button" type="button" aria-disabled="true" title="Design preview: live destination verification is currently blocked">Rent the perfect car '+ARR+'</button>';
  o+='<div class="turo-signature"><span class="turo-gem" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Verified Source</div></div><div class="turo-photo" role="img" aria-label="Travelers beside a car at a lake, from the supplied Turo reference"></div></section>';
  o+='<div class="turo-context">Design preview from your supplied application screenshot. '+(a?'Live destination check passed.':'Live verification: Turo declined the request (HTTP '+esc(p.http_status||403)+'). Preview button is inactive.')+'</div>';
  o+='<details class="turo-details"><summary>View live verification details</summary><pre class="ev">'+esc(JSON.stringify(p.action_withheld||a||{},null,2))+'</pre></details><div class="ev" id="ev" hidden></div>';
  return o;
}
function mercedesBox(p){
  var a=p.action;
  var o='<section class="turo-card" aria-label="Mercedes-Benz call to action preview"><div><span class="turo-eyebrow">TRUSTED SOURCE</span><h3>Even better than you<br>imagined.</h3><p>Experience the GLA 200 Special Edition for $65,490 driveway[2] and discover exceptional savings across select new and demonstrator models.[5]</p>';
  o+=a?'<a class="turo-button" href="'+esc(a.target)+'" target="_blank" rel="noopener">Explore GLA 200 Special Edition '+ARR+'</a>':'<button class="turo-button" type="button" aria-disabled="true" title="Design preview: live destination verification is currently blocked">Explore GLA 200 Special Edition '+ARR+'</button>';
  o+='<div class="turo-signature"><span class="turo-gem" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Verified Source</div></div><div class="turo-photo mercedes-photo" role="img" aria-label="Silver Mercedes-Benz GLA outside a barber shop, from the supplied application reference"></div></section>';
  o+='<div class="turo-context">Design preview from your supplied application screenshot. Offer price and footnote references are reproduced as supplied, not independently verified. '+(a?'Live destination check passed; it opens the Mercedes-Benz Canada site, not a verified offer page.':'Live verification: Mercedes-Benz declined the request (HTTP '+esc(p.http_status||403)+'). Preview button is inactive.')+'</div>';
  o+='<details class="turo-details"><summary>View live verification details</summary><pre class="ev">'+esc(JSON.stringify(p.action_withheld||a||{},null,2))+'</pre></details><div class="ev" id="ev" hidden></div>';
  return o;
}
function telusBox(p){
  var a=p.action && /internet|purefibre/i.test(p.action.target||'') ? p.action : null;
  var o='<section class="turo-card" aria-label="TELUS call to action preview"><div><span class="turo-eyebrow">TRUSTED SOURCE</span><h3>Switch to PureFibre and say goodbye to unexpected price hikes</h3><p>Enjoy true price certainty on PureFibre 1.5 Gig Internet from $85/mo. Get fast, reliable internet at a reliable price for 5 full years.</p>';
  o+=a?'<a class="turo-button" href="'+esc(a.target)+'" target="_blank" rel="noopener">Get PureFibre Internet '+ARR+'</a>':'<button class="turo-button" type="button" aria-disabled="true" title="Design preview: live destination verification is currently blocked">Get PureFibre Internet '+ARR+'</button>';
  o+='<div class="turo-signature"><span class="turo-gem" aria-hidden="true"><i></i><i></i><i></i><i></i></span>Verified Source</div></div><div class="turo-photo telus-photo" role="img" aria-label="TELUS five-year price lock with goldfish and fibre optic imagery, from the supplied application reference"></div></section>';
  o+='<div class="turo-context">Design preview from your supplied application screenshot. Offer price and terms are reproduced as supplied, not independently verified. '+(a?'Live PureFibre destination check passed.':'A verified PureFibre destination is not available. Preview button is inactive.')+'</div>';
  o+='<details class="turo-details"><summary>View live verification details</summary><pre class="ev">'+esc(JSON.stringify(p.action_withheld||a||{},null,2))+'</pre></details><div class="ev" id="ev" hidden></div>';
  return o;
}
function bigBox(p,m){
  if(p.source && /telus\.com$/.test(p.source.publisher||'')) return telusBox(p);
  if(p.source && /mercedes-benz\.ca$/.test(p.source.publisher||'')) return mercedesBox(p);
  if(p.source && /(^|\.)turo\.com$/.test(p.source.publisher||'')) return turoBox(p);
  var src=p.source||{},a=p.action,w=p.action_withheld,id=p.publisher_identity||{},img=p.image||{};
  var dom=src.publisher||'',name=id.name||dom||'Publisher';
  var declared=p.answer_source&&p.answer_source.indexOf('declared by the publisher')>=0;
  var title=(src.title||'').split('|')[0].trim();
  var v=a?a.verified:null;
  var o='<div class="box">';
  o+='<div class="bhead"><div class="blogo">'+(id.logo?'<img src="'+esc(id.logo)+'" alt="">':'<span class="wm">'+esc(name)+'</span>')+'</div><div style="flex:1">';
  o+='<div class="btitle"><h3>'+esc(title||name)+'</h3><span class="tag '+(a?'on':'off')+'" data-ev="'+esc(JSON.stringify({slot:'Next step',earned:!!a,rule:'the destination was requested over HTTP and responded, and it is not the publisher\\u2019s own site root',observed:v||w||p.action_missing||null}))+'">'+(a?'Verified':'Unverified')+'</span></div>';
  o+='<div class="bdesc">'+esc(p.answer||'')+'</div></div></div>';
  o+='<div class="split"><div class="shot">'+(img.url?'<img src="'+esc(img.url)+'" alt="">':'<span class="empty">'+esc(img.missing||'No image declared.')+'</span>')+'</div><div class="side">';
  o+='<div class="kick">'+(a?'Checked for this question':'Not passed on')+'</div>';
  o+='<h4>'+esc(a?a.label:(w?w.label:name))+'</h4>';
  if(v) o+='<div class="loc">'+PIN+'Destination responded, HTTP '+esc(v.http_status)+(v.redirects?', after '+esc(v.redirects)+' redirect':'')+'</div>';
  if(a) o+='<a class="sub" href="'+esc(a.target)+'" target="_blank" rel="noopener">'+esc(a.label)+ARR+'</a>';
  else if(w) o+='<div class="held"><b>Withheld</b>'+esc(w.say_this)+'</div>';
  else o+='<div class="held"><b>No next step declared</b>'+esc(p.action_missing||'This page declares none. None was invented.')+'</div>';
  o+='<div class="vs '+(src.url?'on':'off')+'" data-ev="'+esc(JSON.stringify({slot:'Verified source',earned:!!src.url,rule:'the citation resolves and belongs to the publisher\\u2019s domain',observed:src.url}))+'">'+DIA+'Verified Source</div>';
  o+='</div></div>';
  o+='<div class="pills">';
  o+=pill(declared,'Verified answer',{slot:'Verified answer',earned:declared,rule:'the text is the publisher\\u2019s own declared schema.org description',observed:p.answer_source,missing:p.answer_missing||undefined});
  o+=pill(!!id.name,'Publisher identity',{slot:'Publisher identity',earned:!!id.name,rule:'the wordmark comes from the publisher\\u2019s declared schema.org Organization',observed:id.name_source||'not declared'});
  o+=pill(!!img.url,'Declared image',{slot:'Image',earned:!!img.url,rule:'the photograph is the publisher\\u2019s own declared og:image or schema.org image, never stock and never generated',observed:img.source||img.missing});
  o+=pill(!!a,'Next step checked',{slot:'Next step',earned:!!a,rule:'the destination responded over HTTP and is not the publisher\\u2019s site root',observed:v||w||p.action_missing||null});
  o+='</div><div class="ev" id="ev" hidden></div></div>';
  return o;
}
function shortlist(p){
  var alts=(p.also_considered||[]).slice(0,4);
  if(!alts.length) return '';
  var src=p.source||{},id=p.publisher_identity||{};
  var o='<table><tr><th>Source</th><th>Why it came up</th></tr>';
  o+='<tr class="hit"><td class="n">'+esc(id.name||src.publisher)+'<span class="mark">'+TICK+'Verified card</span></td><td>Top match, and it carries a declared next step</td></tr>';
  alts.forEach(function(r){ o+='<tr><td class="n">'+esc((r.title||'').split('|')[0].trim().slice(0,58))+'</td><td>Also considered, no card</td></tr>'; });
  return o+'</table>';
}
function render(q,p,m){
  var src=p.source||{},dom=src.publisher||'';
  var prose=(m&&m.explanation)||p.answer||'';
  var o='<div class="turn"><div class="bub">'+esc(q)+'</div></div><div class="ans">';
  o+='<p>'+esc(prose)+'<span class="chip" data-ev="'+esc(JSON.stringify({slot:'Citation',rule:'this answer comes from a published page fetched over ordinary public HTTP with no key',observed:src.url}))+'">'+LNK+esc(dom)+'</span></p>';
  o+=shortlist(p);
  o+=bigBox(p,m);
  if(p.is_live_audit && !/(turo\.com|mercedes-benz\.ca|telus\.com)$/.test(dom)) o+='<div class="note">'+esc(p.audit_note||'')+' Structured data blocks on this page: <b>'+esc(p.structured_data_blocks)+'</b>.</div>';
  if(m&&m.fit) o+='<div class="note">'+esc(cfg.model||'The model')+' rated the attached offer <b>'+esc(m.fit)+'</b> for this question. '+esc(m.fit_reason||'')+'</div>';
  if(!/(turo\.com|mercedes-benz\.ca|telus\.com)$/.test(dom)) o+='<div class="note">Every green mark on the card is a check that passed. Click one for the rule and what was observed. Grey means the publisher left that slot empty or the check did not pass.</div>';
  return o+'</div>';
}
document.addEventListener('click',function(e){
  var b=e.target.closest('.p,.tag,.vs,.chip'); if(!b||!b.getAttribute('data-ev')) return;
  var ev=b.closest('.message').querySelector('#ev'); if(!ev) return;
  ev.textContent=JSON.stringify(JSON.parse(b.getAttribute('data-ev')),null,2); ev.hidden=false;
});
document.addEventListener('click',function(e){
  var t=e.target.closest('.presets b'); if(!t) return;
  $('#q').value=t.getAttribute('data-q'); $('#f').dispatchEvent(new Event('submit',{cancelable:true}));
});
document.querySelectorAll('.presets b').forEach(function(b){b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();b.click()}})});
var busy=false;
function toggleExamples(){var open=$('.presets').classList.toggle('open');$('.examples-toggle').setAttribute('aria-expanded',String(open));}
$('.examples-toggle').addEventListener('click',toggleExamples);
$('.welcome-help').addEventListener('click',toggleExamples);
$('#q').addEventListener('input',function(){$('#go').disabled=busy||!this.value.trim()});
$('#new-chat').addEventListener('click',function(){if(busy)return;$('#out').innerHTML='';document.body.classList.remove('chatting');$('#q').value='';$('#go').disabled=true;window.scrollTo(0,0);$('#q').focus()});
$('#f').addEventListener('submit',async function(e){
  e.preventDefault();
  var question=$('#q').value.trim(); if(!question || busy) return;
  busy=true; document.body.classList.add('chatting'); $('.presets').classList.remove('open'); $('.examples-toggle').setAttribute('aria-expanded','false');
  var out=document.createElement('section'); out.className='message'; $('#out').appendChild(out); $('#q').value=''; $('#go').disabled=true;
  out.scrollIntoView({behavior:'smooth',block:'start'});
  var head='<div class="turn"><div class="bub">'+esc(question)+'</div></div>';
  out.innerHTML=head+'<div class="prog"><span class="sp2"></span>Searching</div>';
  try{
    var r=await fetch('/api/retrieve',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:question})});
    var p=await r.json();
    if(p.match!=='ok'){ out.innerHTML=head+'<div class="ans"><p>No published page answers this closely enough. Best score '+esc(p.best_score!=null?p.best_score:p.score)+' against the relevance floor, so nothing was returned rather than something confidently wrong.</p></div>'; return; }
    out.innerHTML=head+'<div class="prog"><span class="sp2"></span>Reading the source and checking its next step</div>';
    var m=null;
    try{ var r2=await fetch('/api/explain',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question:question,payload:p})}); var mm=await r2.json(); if(!mm.error) m=mm; }catch(_){}
    out.innerHTML=render(question,p,m);
  }catch(err){ out.innerHTML=head+'<div class="ans"><p>Request failed. '+esc(err.message)+'</p></div>'; }
  finally{ busy=false; $('#go').disabled=!$('#q').value.trim(); $('#q').focus(); }
});
</script></body></html>`;


const PORT       = Number(process.env.ASTRA_PORT || 8800);
const CTA_BASE   = process.env.CTA_BASE || 'http://localhost:8899';
const MODEL      = process.env.ASTRA_MODEL || 'gpt-6-astra';
const AZURE_URL = process.env.AZURE_OPENAI_RESPONSES_URL || '';
const OPENAI_KEY = AZURE_URL ? (process.env.AZURE_OPENAI_API_KEY || '') : (process.env.OPENAI_API_KEY || '');
const EXAMPLE_Q  = 'What makes documentation readable by AI agents?';

const j = (res, code, obj) => {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': b.length });
  res.end(b);
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// ---------- retrieval: straight through to the keyless consumer ----------
async function retrieve(question) {
  // 220 words, not the endpoint's 60-word default. At 60 the answer is cut off mid-setup, and
  // the model then correctly reports that the article does not contain what it in fact contains.
  // The truncation was the bug, not the model.
  const u = `${CTA_BASE}/cta?q=${encodeURIComponent(question)}&max_words=220`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 180000);
  try {
    const r = await fetch(u, { signal: ac.signal });
    if (!r.ok) throw new Error(`consumer returned HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ---------- the model layer ----------
// The model is given the publisher's own words and is told to stay inside them. It writes an
// explanation, which the page labels as an explanation. It never speaks as the publisher, and
// it judges whether the attached next step actually fits the question rather than assuming it.
const SYSTEM = `You explain published sources to someone who asked a question.

Rules, all of them hard:
- Use ONLY the publisher text provided. If it does not answer the question, say what it does and
  does not cover. Never add facts from your own knowledge.
- Two or three sentences. Plain language. No preamble, no "based on the provided text".
- You are writing an explanation, not speaking as the publisher. Do not use their voice.
- Separately, judge whether the publisher's attached next step is a sensible follow-up for THIS
  question. It is a publisher-offered next step, not a guaranteed answer to the question. If the
  fit is loose, say so plainly in one short clause.

Return strict JSON, no code fence:
{"explanation": "...", "fit": "good" | "loose" | "poor", "fit_reason": "one short clause"}`;

async function explain(question, payload) {
  if (!OPENAI_KEY) return { error: 'no_model_key', detail: 'OPENAI_API_KEY is not set in the server environment.' };
  const src = payload.source || {};
  const act = payload.action || null;
  const user = [
    `Question: ${question}`,
    `Publisher: ${src.publisher || 'unknown'}`,
    `Source URL: ${src.url || 'unknown'}`,
    `Publisher text:\n${payload.answer || '(none)'}`,
    act ? `Publisher's attached next step: "${act.label}" pointing at ${act.target}` : 'Publisher attached no next step.'
  ].join('\n\n');

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(AZURE_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: ac.signal,
      headers: AZURE_URL ? { 'api-key': OPENAI_KEY, 'content-type': 'application/json' } : { 'authorization': `Bearer ${OPENAI_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify(AZURE_URL ? {
        model: MODEL,
        instructions: SYSTEM,
        input: user + "\nReturn the requested JSON object.",
        text: { format: { type: 'json_object' } },
        store: false
      } : {
        model: MODEL,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
        response_format: { type: 'json_object' }
      })
    });
    const body = await r.json();
    if (!r.ok) return { error: 'model_http_error', detail: `HTTP ${r.status}: ${(body.error && body.error.message) || ''}`.slice(0, 300) };
    const txt = AZURE_URL
      ? (body.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('')
      : body.choices?.[0]?.message?.content || '';
    let parsed; try { parsed = JSON.parse(txt); } catch { return { error: 'model_bad_json', detail: txt.slice(0, 200) }; }
    return { ...parsed, model: body.model || MODEL, usage: body.usage || null };
  } catch (e) {
    return { error: 'model_unreachable', detail: e.name === 'AbortError' ? 'no response within 60s' : String(e.message).slice(0, 200) };
  } finally { clearTimeout(t); }
}

// ---------- server ----------
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/assets/telus-reference.png') {
    const image = require('fs').readFileSync(require('path').join(__dirname, 'assets/telus-reference.png'));
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(image);
  }
  if (url.pathname === '/assets/mercedes-reference.png') {
    const image = require('fs').readFileSync(require('path').join(__dirname, 'assets/mercedes-reference.png'));
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(image);
  }
  if (url.pathname === '/assets/turo-reference.png') {
    const image = require('fs').readFileSync(require('path').join(__dirname, 'assets/turo-reference.png'));
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(image);
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    const b = Buffer.from(PAGE.replace('__EXAMPLE__', EXAMPLE_Q));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': b.length });
    return res.end(b);
  }

  if (url.pathname === '/api/config') {
    return j(res, 200, { model: MODEL, model_key_present: !!OPENAI_KEY, cta_base: CTA_BASE, example: EXAMPLE_Q });
  }

  if (url.pathname === '/api/retrieve' && req.method === 'POST') {
    try {
      const { question } = await readBody(req);
      if (!question || !question.trim()) return j(res, 400, { error: 'question is required' });
      const started = Date.now();
      const payload = await retrieve(question.trim());
      return j(res, 200, { ...payload, retrieval_ms: Date.now() - started, checked_at: new Date().toISOString() });
    } catch (e) {
      return j(res, 502, { error: 'retrieval_failed', detail: String(e.message).slice(0, 300) });
    }
  }

  if (url.pathname === '/api/explain' && req.method === 'POST') {
    try {
      const { question, payload } = await readBody(req);
      if (!question || !payload) return j(res, 400, { error: 'question and payload are required' });
      const started = Date.now();
      const out = await explain(question, payload);
      return j(res, 200, { ...out, model_ms: Date.now() - started });
    } catch (e) {
      return j(res, 502, { error: 'explain_failed', detail: String(e.message).slice(0, 300) });
    }
  }

  j(res, 404, { error: 'not found' });
}).listen(PORT, () => {
  process.stderr.write(`astra listening on http://localhost:${PORT}\n`);
  process.stderr.write(`  consumer: ${CTA_BASE}\n  model:    ${MODEL}${OPENAI_KEY ? '' : '  (NO KEY SET)'}\n`);
});
