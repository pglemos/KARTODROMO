export interface Links {
  grupo: string;
  cliente: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Página de acesso ao app do cliente: tudo inline (sem dependências externas), animações respeitam reduced-motion. */
export function pagina(l: Links): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#050807">
<title>App Kartódromo de Betim — Acesso</title>
<meta name="description" content="Baixe o app do Kartódromo de Betim: ranking, carreira, reservas e corridas ao vivo.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800;1,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#050807;--bg2:#0b110e;--card:#0f1613cc;--line:#ffffff14;--txt:#f3f7f4;--sub:#9aa8a0;--neon:#2bf07a;--neon2:#00d4ff;--hot:#ffb020;--r:22px}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--txt);font:16px/1.55 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow-x:hidden;min-height:100vh}
a{color:inherit}
/* fundo: aurora + grade em perspectiva + grão */
.bg{position:fixed;inset:0;z-index:-2;overflow:hidden;pointer-events:none}
.aurora{position:absolute;width:140vmax;height:140vmax;left:50%;top:-60vmax;transform:translateX(-50%);
 background:conic-gradient(from 0deg,#2bf07a33,#00d4ff22,#0000 30%,#2bf07a22 55%,#ffb02018 70%,#0000 85%,#2bf07a33);
 filter:blur(70px);animation:gira 28s linear infinite}
@keyframes gira{to{transform:translateX(-50%) rotate(1turn)}}
.grade{position:absolute;left:-50%;right:-50%;bottom:-10%;height:70vh;transform:perspective(500px) rotateX(62deg);transform-origin:bottom;
 background-image:linear-gradient(#2bf07a2e 1px,transparent 1px),linear-gradient(90deg,#2bf07a2e 1px,transparent 1px);background-size:56px 56px;
 mask-image:linear-gradient(to top,#000 10%,transparent 85%);-webkit-mask-image:linear-gradient(to top,#000 10%,transparent 85%);animation:pista 2.4s linear infinite}
@keyframes pista{to{background-position:0 56px}}
.grao{position:absolute;inset:0;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
main{max-width:1080px;margin:0 auto;padding:max(24px,env(safe-area-inset-top)) 16px 48px}
/* topo */
.top{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.02em}
.logo{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,var(--neon),var(--neon2));color:#031;box-shadow:0 0 24px #2bf07a66}
.tag{margin-left:auto;font-size:.75rem;padding:6px 12px;border-radius:999px;border:1px solid #2bf07a55;color:var(--neon);background:#2bf07a12;display:flex;align-items:center;gap:8px}
.tag i{width:8px;height:8px;border-radius:50%;background:var(--neon);box-shadow:0 0 0 0 #2bf07a;animation:pulso 1.8s infinite}
@keyframes pulso{70%{box-shadow:0 0 0 10px #2bf07a00}100%{box-shadow:0 0 0 0 #2bf07a00}}
/* hero */
.hero{display:grid;gap:28px;align-items:center;padding:36px 0 12px}
@media(min-width:880px){.hero{grid-template-columns:1.1fr .9fr;padding:64px 0 32px}}
h1{font:italic 900 clamp(2.9rem,11vw,5.6rem)/.88 'Barlow Condensed',Impact,sans-serif;text-transform:uppercase;margin:0;letter-spacing:-.01em}
h1 .g{background:linear-gradient(90deg,var(--neon),var(--neon2) 60%,var(--neon));background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:brilho 4s linear infinite}
@keyframes brilho{to{background-position:-200% 0}}
.lead{color:var(--sub);font-size:1.08rem;max-width:34ch;margin:18px 0 22px}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{font-size:.82rem;padding:7px 12px;border-radius:999px;background:#ffffff0a;border:1px solid var(--line);transition:transform .2s,border-color .2s}
.chip:hover{transform:translateY(-2px);border-color:#2bf07a66}
.cta{display:inline-flex;align-items:center;gap:10px;margin-top:24px;padding:16px 26px;border-radius:999px;font-weight:700;text-decoration:none;color:#031;
 background:linear-gradient(135deg,var(--neon),#8dffb9);box-shadow:0 10px 40px -8px #2bf07a99,inset 0 1px 0 #fff8;transition:transform .15s,box-shadow .2s;position:relative;overflow:hidden}
.cta:hover{transform:translateY(-2px);box-shadow:0 16px 50px -8px #2bf07acc}
.cta:active{transform:scale(.97)}
.cta svg{transition:transform .2s}.cta:hover svg{transform:translateY(3px)}
/* celular 3D */
.cena{perspective:1100px;display:grid;place-items:center;min-height:440px}
.fone{width:230px;height:470px;border-radius:40px;padding:10px;background:linear-gradient(145deg,#2a322e,#0b0f0d);position:relative;
 transform:rotateY(-18deg) rotateX(8deg);transform-style:preserve-3d;box-shadow:30px 40px 80px -20px #000,0 0 0 1px #ffffff1a,0 0 80px -10px #2bf07a44;
 animation:flutua 6s ease-in-out infinite;transition:transform .2s ease-out}
@keyframes flutua{50%{translate:0 -14px}}
.tela{position:absolute;inset:10px;border-radius:31px;overflow:hidden;background:#000;padding:38px 14px 14px}
.tela::before{content:"";position:absolute;top:10px;left:50%;width:76px;height:20px;border-radius:12px;background:#000;transform:translateX(-50%);box-shadow:0 0 0 1px #222;z-index:2}
.tela h3{font:italic 900 1.6rem/1 'Barlow Condensed',sans-serif;margin:0 0 10px;text-transform:uppercase}
.seg{display:flex;gap:4px;background:#111;border-radius:999px;padding:3px;margin-bottom:10px}
.seg span{flex:1;text-align:center;font-size:.6rem;font-weight:700;padding:5px 0;border-radius:999px;color:#9aa}
.seg span.on{background:var(--neon);color:#031}
.pod{display:flex;align-items:flex-end;gap:5px;height:118px;margin:6px 0 10px}
.pod div{flex:1;border-radius:10px 10px 4px 4px;border:1px solid;display:grid;place-items:start center;padding-top:6px;font:italic 900 1.2rem 'Barlow Condensed';transform-origin:bottom;animation:sobe 1s cubic-bezier(.2,1.4,.4,1) both}
.pod .p1{height:100%;border-color:var(--hot);color:var(--hot);animation-delay:.5s}.pod .p2{height:78%;border-color:#c9d1d9;color:#c9d1d9;animation-delay:.3s}.pod .p3{height:62%;border-color:#e08a3c;color:#e08a3c;animation-delay:.7s}
@keyframes sobe{from{transform:scaleY(0)}}
.lin{display:flex;align-items:center;gap:8px;background:#0f1412;border-radius:12px;padding:8px;margin-bottom:6px;font-size:.62rem;animation:entra .6s both}
.lin:nth-child(5){animation-delay:.9s}.lin:nth-child(6){animation-delay:1.05s}.lin:nth-child(7){animation-delay:1.2s}
.lin b{color:#9aa}.lin .av{width:22px;height:22px;border-radius:50%;background:#1d2622;display:grid;place-items:center;font-weight:700;font-size:.55rem}
.lin .t{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}
@keyframes entra{from{opacity:0;transform:translateX(20px)}}
.brilhofone{position:absolute;inset:0;border-radius:40px;background:linear-gradient(115deg,#fff0 40%,#ffffff1c 50%,#fff0 60%);background-size:250% 100%;animation:reflexo 5s ease-in-out infinite;pointer-events:none}
@keyframes reflexo{0%,60%{background-position:150% 0}100%{background-position:-100% 0}}
.flag{position:absolute;right:-34px;top:40px;width:70px;height:46px;transform:translateZ(60px) rotate(12deg);border-radius:6px;
 background:conic-gradient(#fff 25%,#111 0 50%,#fff 0 75%,#111 0) 0 0/16px 16px;box-shadow:0 10px 30px #0008;animation:balanca 2.2s ease-in-out infinite}
@keyframes balanca{50%{transform:translateZ(60px) rotate(4deg) skewY(4deg)}}
.badge{position:absolute;left:-40px;bottom:70px;transform:translateZ(80px);background:#0d1512ee;border:1px solid #2bf07a55;backdrop-filter:blur(8px);border-radius:16px;padding:10px 12px;font-size:.72rem;box-shadow:0 20px 40px #0009}
.badge b{display:block;color:var(--neon);font:italic 900 1.3rem/1 'Barlow Condensed'}
/* passos */
h2.sec{font:italic 900 clamp(2rem,7vw,3rem)/.95 'Barlow Condensed',sans-serif;text-transform:uppercase;margin:48px 0 8px}
.sub{color:var(--sub);margin:0 0 22px}
.passos{display:grid;gap:16px;counter-reset:p}
@media(min-width:880px){.passos{grid-template-columns:repeat(3,1fr)}}
.passo{position:relative;border-radius:var(--r);padding:22px;background:var(--card);border:1px solid var(--line);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
 transform-style:preserve-3d;transition:transform .25s ease-out,border-color .25s;overflow:hidden}
.passo::before{content:"";position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:radial-gradient(400px circle at var(--mx,50%) var(--my,0%),#2bf07aaa,transparent 40%);
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:0;transition:opacity .3s}
.passo:hover::before{opacity:1}
.num{font:italic 900 4.4rem/.8 'Barlow Condensed';background:linear-gradient(180deg,var(--neon),#2bf07a00);-webkit-background-clip:text;background-clip:text;color:transparent;position:absolute;right:16px;top:12px;opacity:.5}
.ico{width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:#2bf07a18;border:1px solid #2bf07a44;color:var(--neon);margin-bottom:14px}
.passo h3{margin:0 0 8px;font-size:1.15rem}
.passo ol{margin:0;padding-left:18px;color:var(--sub);font-size:.95rem}.passo li{margin-bottom:6px}.passo li strong{color:var(--txt)}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:15px;border-radius:999px;font-weight:700;text-decoration:none;position:relative;overflow:hidden;
 background:linear-gradient(135deg,var(--neon),#8dffb9);color:#031;box-shadow:0 8px 30px -10px #2bf07a;transition:transform .15s,box-shadow .2s}
.btn:hover{transform:translateY(-2px);box-shadow:0 14px 36px -10px #2bf07a}
.btn:active{transform:scale(.97)}
.btn.sec2{background:#ffffff0d;color:var(--txt);border:1px solid #2bf07a66;box-shadow:none}
.onda{position:absolute;border-radius:50%;background:#fff8;transform:scale(0);animation:onda .6s ease-out;pointer-events:none}
@keyframes onda{to{transform:scale(4);opacity:0}}
.feito{display:none;align-items:center;gap:6px;margin-top:10px;font-size:.85rem;color:var(--neon)}
.passo.ok .feito{display:flex}.passo.ok{border-color:#2bf07a66}
.passo.ok .ico{background:var(--neon);color:#031}
.aviso{margin-top:12px;font-size:.85rem;color:var(--sub);background:#ffb02010;border:1px solid #ffb02033;border-radius:14px;padding:10px 12px}
.aviso b{color:var(--hot)}
details{margin-top:10px;border-radius:14px;background:#ffffff06;border:1px solid var(--line)}
summary{cursor:pointer;padding:12px 14px;font-weight:600;font-size:.9rem;list-style:none;display:flex;justify-content:space-between}
summary::after{content:"+";color:var(--neon);transition:transform .2s}details[open] summary::after{transform:rotate(45deg)}
details p{margin:0;padding:0 14px 12px;color:var(--sub);font-size:.88rem}
/* barra de progresso */
.prog{position:sticky;top:10px;z-index:5;margin:28px 0 0;padding:10px 14px;border-radius:999px;background:#0b110ecc;backdrop-filter:blur(12px);border:1px solid var(--line);display:flex;align-items:center;gap:12px;font-size:.82rem}
.prog .bar{flex:1;height:6px;border-radius:9px;background:#ffffff12;overflow:hidden}
.prog .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--neon),var(--neon2));border-radius:inherit;transition:width .6s cubic-bezier(.2,1,.3,1);box-shadow:0 0 12px var(--neon)}
/* recursos */
.rec{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:8px}
@media(min-width:880px){.rec{grid-template-columns:repeat(4,1fr)}}
.r{padding:18px;border-radius:18px;background:linear-gradient(160deg,#ffffff0a,#ffffff03);border:1px solid var(--line);transition:transform .25s}
.r:hover{transform:translateY(-4px) rotate(-.5deg)}
.r .e{font-size:1.6rem;display:inline-block;transition:transform .3s cubic-bezier(.3,2,.5,1)}.r:hover .e{transform:scale(1.25) rotate(-8deg)}
.r b{display:block;margin:6px 0 2px}.r span{color:var(--sub);font-size:.85rem}
footer{margin-top:40px;color:var(--sub);font-size:.82rem;text-align:center}
footer a{color:var(--neon)}
/* revelar ao rolar */
.rv{opacity:0;transform:translateY(26px);transition:opacity .7s,transform .7s cubic-bezier(.2,1,.3,1)}
.rv.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.rv{opacity:1;transform:none}}
</style>
</head>
<body>
<div class="bg"><div class="aurora"></div><div class="grade"></div><div class="grao"></div></div>
<main>
<header class="top">
 <span class="logo" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 15c2-6 7-9 14-9-3 2-4 4-4 6h6c0 3-3 6-8 6H6"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg></span>
 Kartódromo de Betim
 <span class="tag"><i></i>Acesso antecipado</span>
</header>

<section class="hero">
 <div class="rv">
  <h1>Sua pista.<br><span class="g">No bolso.</span></h1>
  <p class="lead">Ranking, carreira completa, reservas e corridas ao vivo no app oficial. Todas as corridas que você já fez aqui aparecem sozinhas, pelo seu CPF.</p>
  <div class="chips"><span class="chip">🏁 Ranking por traçado</span><span class="chip">⏱️ Ao vivo</span><span class="chip">📅 Reservas</span><span class="chip">🏆 Carreira</span></div>
  <a class="cta" href="#passos">Baixar no Android em 3 passos <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg></a>
 </div>
 <div class="cena rv" aria-hidden="true">
  <div class="fone" id="fone">
   <div class="tela">
    <h3>Ranking</h3>
    <div class="seg"><span>Semana</span><span>Mês</span><span class="on">Geral</span></div>
    <div class="pod"><div class="p2">2º</div><div class="p1">1º</div><div class="p3">3º</div></div>
    <div class="lin"><b>4º</b><span class="av">GM</span>Piloto 4<span class="t">1:10.749</span></div>
    <div class="lin"><b>5º</b><span class="av">BM</span>Piloto 5<span class="t">1:10.836</span></div>
    <div class="lin"><b>6º</b><span class="av">RM</span>Piloto 6<span class="t">1:10.870</span></div>
   </div>
   <div class="brilhofone"></div>
   <div class="flag"></div>
   <div class="badge"><b>+1.800</b>pilotos no ranking</div>
  </div>
 </div>
</section>

<div class="prog rv" role="status"><span id="ptxt">0 de 3 passos</span><span class="bar"><i id="pbar"></i></span></div>

<h2 class="sec rv" id="passos">3 passos. 2 minutos.</h2>
<p class="sub rv">Faça tudo <strong>no celular Android</strong>, com <strong>a mesma conta Google da Play Store</strong>.</p>

<div class="passos">
 <article class="passo rv" data-p="1">
  <span class="num">1</span>
  <div class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M17 8v6M14 11h6"/></svg></div>
  <h3>Entre no grupo de testadores</h3>
  <ol>
   <li>Toque no botão abaixo.</li>
   <li>Se pedir, entre com o <strong>Gmail do celular</strong>.</li>
   <li>Toque em <strong>Participar do grupo</strong>. A entrada é na hora.</li>
  </ol>
  <a class="btn" href="${esc(l.grupo)}" target="_blank" rel="noopener">Abrir o grupo ↗</a>
  <div class="feito">✓ Feito! Agora o passo 2.</div>
  <details><summary>Apareceu “Você não tem permissão”?</summary><p>Significa só que você ainda não entrou no grupo. Toque no botão de novo, ou em ☰ → <b>Sobre</b>, e procure <b>Participar do grupo</b>. Se o botão não aparecer, você não está logado: toque no ícone de perfil no topo e entre com sua conta Google.</p></details>
 </article>

 <article class="passo rv" data-p="2">
  <span class="num">2</span>
  <div class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg></div>
  <h3>Ative o teste</h3>
  <ol>
   <li>Volte para esta página e toque no botão.</li>
   <li>Toque em <strong>Tornar-se testador</strong> (“Become a tester”).</li>
  </ol>
  <a class="btn" href="${esc(l.cliente)}" target="_blank" rel="noopener">Ativar teste ↗</a>
  <div class="feito">✓ Feito! Agora é só instalar.</div>
  <div class="aviso"><b>Dica:</b> se a página disser que o app não está disponível, espere 1 ou 2 minutos depois do passo 1 e abra de novo.</div>
 </article>

 <article class="passo rv" data-p="3">
  <span class="num">3</span>
  <div class="ico"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M12 7v7M9 11l3 3 3-3M10 18h4"/></svg></div>
  <h3>Instale e entre</h3>
  <ol>
   <li>Na mesma página, toque em <strong>baixar no Google Play</strong> → <strong>Instalar</strong>.</li>
   <li>Abra o app e toque em <strong>Já corri no kartódromo</strong> (ou crie sua conta).</li>
   <li>Informe seu <strong>CPF</strong>. Suas corridas aparecem sozinhas.</li>
  </ol>
  <a class="btn sec2" href="${esc(l.cliente)}" target="_blank" rel="noopener">Abrir na Play Store ↗</a>
  <div class="feito">✓ Bem-vindo à pista! 🏁</div>
 </article>
</div>

<h2 class="sec rv">Problemas?</h2>
<div class="rv">
 <details><summary>“App não disponível” na Play Store</summary><p>Confira se a conta Google da Play Store é a mesma que entrou no grupo e se você tocou em “Tornar-se testador”. A liberação pode levar alguns minutos: feche a Play Store e tente de novo.</p></details>
 <details><summary>Tenho mais de uma conta Google no celular</summary><p>Na Play Store, toque na sua foto (canto de cima) e troque para a conta que entrou no grupo antes de abrir o link do passo 2.</p></details>
 <details><summary>Tenho iPhone</summary><p>No iPhone não precisa de nada disso: procure <b>Kartódromo de Betim</b> na App Store e instale.</p></details>
 <details><summary>Minhas corridas não aparecem</summary><p>Entre com o mesmo CPF do seu cadastro no kartódromo. O vínculo é feito na hora em que você confirma o e-mail. Se errou o e-mail, use “Esqueci minha senha ou e-mail” na tela de entrar.</p></details>
</div>

<h2 class="sec rv">No app</h2>
<div class="rec">
 <div class="r rv"><span class="e">🏆</span><b>Ranking</b><span>Semana, mês e geral, por traçado e categoria.</span></div>
 <div class="r rv"><span class="e">📈</span><b>Carreira</b><span>Todas as suas baterias e melhores voltas.</span></div>
 <div class="r rv"><span class="e">⏱️</span><b>Ao vivo</b><span>Acompanhe a bateria volta a volta.</span></div>
 <div class="r rv"><span class="e">📅</span><b>Reservas</b><span>Escolha o horário e pague pelo app.</span></div>
</div>

<footer>Kartódromo de Betim · Dúvidas? Fale com a recepção.</footer>
</main>
<script>
(()=>{const red=matchMedia('(prefers-reduced-motion: reduce)').matches;
// revelar ao rolar
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.rv').forEach((el,i)=>{el.style.transitionDelay=(i%4)*70+'ms';io.observe(el)});
// celular 3D segue o ponteiro / inclinação
const f=document.getElementById('fone');
if(f&&!red){addEventListener('pointermove',e=>{const x=e.clientX/innerWidth-.5,y=e.clientY/innerHeight-.5;f.style.transform='rotateY('+(-18+x*24)+'deg) rotateX('+(8-y*16)+'deg)'},{passive:true});
 addEventListener('deviceorientation',e=>{if(e.gamma==null)return;f.style.transform='rotateY('+(-18+e.gamma*.5)+'deg) rotateX('+(8-(e.beta-45)*.3)+'deg)'},{passive:true})}
// cartões: brilho da borda segue o dedo + leve tilt
document.querySelectorAll('.passo').forEach(c=>{c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
 c.style.setProperty('--mx',x+'px');c.style.setProperty('--my',y+'px');if(!red&&e.pointerType==='mouse')c.style.transform='rotateX('+((y/r.height-.5)*-6)+'deg) rotateY('+((x/r.width-.5)*6)+'deg)'});
 c.addEventListener('pointerleave',()=>c.style.transform='')});
// onda no toque + vibração
document.querySelectorAll('.btn,.cta').forEach(b=>b.addEventListener('pointerdown',e=>{const r=b.getBoundingClientRect(),s=document.createElement('span'),d=Math.max(r.width,r.height);
 s.className='onda';s.style.cssText='width:'+d+'px;height:'+d+'px;left:'+(e.clientX-r.left-d/2)+'px;top:'+(e.clientY-r.top-d/2)+'px';b.appendChild(s);setTimeout(()=>s.remove(),650);try{navigator.vibrate&&navigator.vibrate(12)}catch{}}));
// progresso dos passos (lembra no aparelho)
let feitos=[];try{feitos=JSON.parse(localStorage.getItem('passos')||'[]')}catch{}
const pinta=()=>{document.querySelectorAll('.passo').forEach(p=>p.classList.toggle('ok',feitos.includes(p.dataset.p)));
 document.getElementById('ptxt').textContent=feitos.length+' de 3 passos'+(feitos.length===3?' ✓':'');document.getElementById('pbar').style.width=(feitos.length/3*100)+'%'};
document.querySelectorAll('.passo .btn').forEach(b=>b.addEventListener('click',()=>{const p=b.closest('.passo').dataset.p;if(!feitos.includes(p)){feitos.push(p);if(p==='2'&&!feitos.includes('3')){}
 try{localStorage.setItem('passos',JSON.stringify(feitos))}catch{}}setTimeout(pinta,400)}));
pinta()})();
</script>
</body></html>`;
}
