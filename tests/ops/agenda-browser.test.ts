import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright';
let server: Server, browser: Browser, page: Page, origin: string;
let atrasar = false, falhaGrupos = false, falhaBaterias = false;
let consultas = 0;
const errors: string[] = [];
const bat = {id:394,dataHora:'2026-11-05T19:20',nome:'TESTE CODEX',produtoId:11,produto:'BALCÃO - LOCAÇÃO PADRÃO',categoria:'Indoor',preco:17500,vagas:30,disponiveis:15,inscritos:15,pagos:0,status:'aberta',autoAtendimento:false,reservaFechada:true,tipoKart:'light',saldoCentavos:217500};
const g = {id:87,bateriaId:394,inicio:bat.dataHora,bateria:bat.nome,responsavel:'TESTE CODEX',responsavelTelefone:'31999999999',modo:'sinal',preco:14500,sinalPct:0,sinal:0,n:15,vagas:30,disponiveis:15,cadastrados:0,pagos:0,prontos:0,total:217500,pago:0,falta:217500,codigo:'GTESTE',pagamentos:[],pilotos:Array.from({length:15},(_,i)=>({id:i+1,inscricaoId:71935+i,ordem:i+1,nome:i?'':'TESTE CODEX',responsavel:i===0,telefone:'31999999999',menor:false,cadastro:'pendente',falta:[],pago:false,valorPago:0,falta_centavos:14500,link:'http://example.invalid'}))};
function json(route: Route, data: unknown, status=200) {return route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});}
async function apiRoute(route: Route) {
 const u=new URL(route.request().url());
 if(u.pathname.endsWith('/minhas-permissoes'))return json(route,{admin:true,acessoTotal:true,configurado:true,fecharBateria:true});
 if(u.pathname==='/api/saude')return json(route,{ops:{ok:true,ms:1},crono:{ok:true,ms:1}});
 if(u.pathname.endsWith('/baterias')) {
  if(falhaBaterias)return json(route,{error:'TESTE CODEX indisponível'},503);
  const n=++consultas;if(atrasar)await new Promise(r=>setTimeout(r,n===1?400:10));
  const d=u.searchParams.get('data')||'2026-11-05';
  if(d>'2026-11-05')return json(route,[{...bat,id:Number(d.replace(/-/g,'')),dataHora:d+'T19:20',reservaFechada:false,autoAtendimento:true}]);
  return json(route,[bat]);
 }
 if(u.pathname.endsWith('/grupos/pendencias'))return json(route,{grupos:[],candidatos:[]});
 if(u.pathname.endsWith('/grupos'))return falhaGrupos?json(route,{error:'TESTE CODEX grupos indisponíveis'},503):json(route,[g]);
 if(u.pathname.endsWith('/grupos/87') || u.pathname.endsWith('/grupos/87/links'))return json(route,g);
 if(u.pathname.endsWith('/reservas'))return json(route,g.pilotos.map(p=>({id:p.inscricaoId,clienteId:p.id,cliente:'TESTE CODEX '+p.ordem,status:'reservada',pago:false,total:14500,aprovada:true})));
 if(u.pathname.endsWith('/agenda'))return json(route,[]);
 return json(route,[]);
}
beforeAll(async()=>{
 const root=resolve('workers/admin/public');server=createServer(async(req,res)=>{
  try {const file=decodeURIComponent(new URL(req.url||'/', 'http://local').pathname); const p=resolve(root,'.'+(file==='/'?'/index.html':file));if(!p.startsWith(root+'/'))throw Error();const data=await readFile(p);res.setHeader('content-type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html');res.end(data);}catch {res.statusCode=404;res.end();}
 });await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+((server.address() as {port:number}).port);browser=await chromium.launch({headless:true});
},30000);
beforeEach(async()=>{
 atrasar=false;falhaGrupos=false;falhaBaterias=false;consultas=0;errors.length=0;
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-05T16:00:00Z')});
 await page.addInitScript(()=>{localStorage.setItem('kib-tour-TESTE CODEX','1');localStorage.setItem('kib-admin-token','TESTE CODEX');localStorage.setItem('kib-admin-usuario',JSON.stringify({id:1,nome:'TESTE CODEX',admin:true}));});
 await page.route('**/api/**',apiRoute);await page.goto(origin+'/#/agenda');await page.locator('#calendario [data-sel="394"]').first().waitFor();
});
afterAll(async()=>{await browser?.close();await new Promise<void>(r=>server?.close(()=>r()));});
describe('Agenda: integração real do frontend sem dados de produção',()=>{
 it('mostra saldo contratado e bloqueia novo grupo em bateria exclusiva',async()=>{
  expect(await page.locator('#aPagar').innerText()).toContain('2.175');
  await page.locator('#calendario [data-sel="394"]').first().click();await page.locator('[data-grupo-abrir]').first().waitFor();
  expect(await page.locator('[data-acao="novaReserva"]').count()).toBe(0);expect(errors).toEqual([]);await page.close();
 });
 it('não oferece cobrança de sinal zero e calcula capacidade líquida do grupo',async()=>{
  await page.route(/\/api\/office\/grupos\/87(\?.*)?$/,route=>json(route,{...g,disponiveis:10}));
  await page.locator('#calendario [data-sel="394"]').first().click();await page.locator('[data-grupo-abrir]').first().click();await page.locator('[data-cancelar-grupo]').waitFor();
  expect(await page.locator('[data-cobrar=""]').count()).toBe(0);expect(await page.locator('#camada').innerText()).toContain('até 25');expect(errors).toEqual([]);await page.close();
 });
 it('erro de grupos não vira lista de avulsos',async()=>{
  falhaGrupos=true;await page.locator('#calendario [data-sel="394"]').first().click();await page.locator('#corpoBateria [data-reabrir]').waitFor();
  expect(await page.locator('#corpoBateria').innerText()).toContain('Não foi possível conferir os grupos');expect(await page.locator('[data-ag-mover]').count()).toBe(0);await page.close();
 });
 it('descarta resposta antiga ao mudar o período rapidamente',async()=>{
  await page.locator('[data-vista="lista"]').click();await page.locator('#calendario [data-sel]').first().waitFor();consultas=0;atrasar=true;
  await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('[data-nav="1"]')!.click();document.querySelector<HTMLButtonElement>('[data-nav="1"]')!.click();});
  await page.waitForTimeout(650);expect(await page.locator('#periodo').innerText()).toBe('19/11 a 25/11');
  const text=await page.locator('#calendario').innerText();expect(text).toContain('19/11');expect(text).not.toContain('12/11');expect(errors).toEqual([]);await page.close();
 });
 it('falha de carga tem recuperação explícita',async()=>{
  falhaBaterias=true;await page.locator('[data-nav="1"]').click();await page.locator('[data-ag-repetir]').waitFor();
  falhaBaterias=false;await page.locator('[data-ag-repetir]').click();await page.locator('#calendario [data-sel]').first().waitFor();expect(errors).toEqual([]);await page.close();
 });
 it('não oferece bateria de status fechado mesmo sem flag de exclusividade',async()=>{
  await page.route('**/api/office/baterias?**',route=>json(route,[{...bat,status:'fechada',reservaFechada:false,autoAtendimento:true}]));
  await page.locator('[data-nova]').click();await page.locator('.horariosEscolha .esqueleto').waitFor({state:'detached'});
  expect(await page.locator('[data-escolher="394"]').count()).toBe(0);expect(errors).toEqual([]);await page.close();
 });
 it('nova reserva aceita data distante e segunda baseada na disponibilidade',async()=>{
  await page.locator('[data-nova]').click();await page.locator('[data-escolher-data]').fill('2026-12-07');await page.locator('[data-escolher-data]').dispatchEvent('change');
  await page.locator('[data-escolher="20261207"]').waitFor();expect(await page.locator('[data-escolher-dia="2026-12-07"]').isDisabled()).toBe(false);expect(errors).toEqual([]);await page.close();
 });
 it('resposta do grupo antigo não preenche uma janela nova',async()=>{
  await page.route('**/api/office/grupos/87',async route=>{await new Promise(r=>setTimeout(r,350));await json(route,g);});
  await page.locator('#calendario [data-sel="394"]').first().click();await page.locator('[data-grupo-abrir]').first().click();
  await page.keyboard.press('Escape');await page.locator('[data-nova]').click();await page.waitForTimeout(500);
  expect(await page.locator('#camada').innerText()).toContain('que dia e que horário');expect(await page.locator('[data-cancelar-grupo]').count()).toBe(0);expect(errors).toEqual([]);await page.close();
 });
 it('salva o atributo menor do responsável escolhido na interface',async()=>{
  await page.route('**/api/office/baterias?**',route=>json(route,[{...bat,reservaFechada:false,autoAtendimento:true}]));
  let enviado: {pilotos:{menor:boolean}[]} | undefined;
  await page.route('**/api/office/grupos',async route=>{enviado=route.request().postDataJSON();await json(route,g);});
  await page.locator('[data-nova]').click();await page.locator('[data-escolher="394"]').click();await page.locator('[data-menor="0"]').waitFor();
  await page.locator('[data-campo="nome"][data-i="0"]').fill('TESTE CODEX');await page.locator('[data-campo="telefone"][data-i="0"]').fill('31999999999');
  await page.locator('[data-menor="0"]').click();await page.locator('[data-salvar-grupo]').click();await page.locator('[data-cancelar-grupo]').waitFor();
  expect(enviado?.pilotos[0].menor).toBe(true);expect(errors).toEqual([]);await page.close();
 });
 it('atualiza o grupo aberto sem trocar o contexto da janela',async()=>{
  await page.locator('#calendario [data-sel="394"]').first().click();await page.locator('[data-grupo-abrir]').first().click();await page.locator('[data-grupo-atualizar]').waitFor();
  await page.route(/\/api\/office\/grupos\/87(\?.*)?$/,route=>json(route,{...g,pago:14500,falta:203000}));
  await page.locator('[data-grupo-atualizar]').click();await page.waitForTimeout(100);expect(await page.locator('#camada').innerText()).toContain('2.030');expect(errors).toEqual([]);await page.close();
 });
 it('repetição após falha de resposta mantém chave de recebimento',async()=>{
  const keys:string[]=[];let n=0;await page.route('**/api/office/grupos/87/pagamentos',async route=>{keys.push(route.request().postDataJSON().idempotencyKey);if(++n===1)return route.abort();return json(route,g);});
  const run=()=>page.evaluate(async()=>{try{return await (window as unknown as {api:(p:string,o:unknown)=>Promise<unknown>}).api('/office/grupos/87/pagamentos',{method:'POST',body:{pilotoId:1,valorCentavos:14500,forma:'Pix'}});}catch{return 'falhou';}});
  await run();await run();await run();expect(keys).toHaveLength(3);expect(keys[0]).toBe(keys[1]);expect(keys[2]).not.toBe(keys[1]);await page.close();
 });
});
