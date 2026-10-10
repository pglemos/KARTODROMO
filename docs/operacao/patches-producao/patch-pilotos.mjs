// app de reserva: cadastro obrigatório de cada piloto extra (cada vaga = uma pessoa). uso: node patch-pilotos.mjs <entrada.js> <saida.js>
import fs from 'node:fs';
const [ent, sai] = process.argv.slice(2);
let s = fs.readFileSync(ent, 'utf8');
const trocar = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`esperava 1 ocorrência, achei ${n}: ${a.slice(0, 70)}`); s = s.replace(a, b); };

// 1) validador dos outros pilotos (ao lado do validador do comprador)
trocar('function yy(h,x=new Date){',
  'function kibValAc(lista,n,comprador,x=new Date){const e={},docs=new Set([_u(comprador.documento)]);for(let i=0;i<n;i++){const p=lista[i]||{},k="ac"+i,nome=(p.nome||"").trim(),d=_u(p.documento||"");nome.split(/\\s+/).length<2&&(e[k+"-nome"]="Informe nome e sobrenome.");vy(p.documento||"")?docs.has(d)?e[k+"-documento"]="Cada piloto precisa de um CPF diferente (cada vaga é de uma pessoa).":docs.add(d):e[k+"-documento"]="Confira os 11 números do CPF.";const nas=K0(p.nascimento||"");if(!nas)e[k+"-nascimento"]="Use uma data válida: DD/MM/AAAA.";else{const a=R0(nas,x);(a<14||a>=110)&&(e[k+"-nascimento"]="Cada piloto precisa ter 14 anos ou mais.")}}return e}function kibMasc(campo,v){const d=String(v).replace(/\\D/g,"");if(campo==="documento"){const t=d.slice(0,11);return t.length>9?`${t.slice(0,3)}.${t.slice(3,6)}.${t.slice(6,9)}-${t.slice(9)}`:t.length>6?`${t.slice(0,3)}.${t.slice(3,6)}.${t.slice(6)}`:t.length>3?`${t.slice(0,3)}.${t.slice(3)}`:t}if(campo==="nascimento"){const t=d.slice(0,8);return t.length>4?`${t.slice(0,2)}/${t.slice(2,4)}/${t.slice(4)}`:t.length>2?`${t.slice(0,2)}/${t.slice(2)}`:t}return v}function yy(h,x=new Date){');

// 2) estado dos outros pilotos e dos erros deles
trocar('[F,rl]=J.useState([]),', '[F,rl]=J.useState([]),[kibAc,kibSetAc]=J.useState([]),[kibErr,kibSetErr]=J.useState({}),[kibEu,kibSetEu]=J.useState(!0),');

// 3) "Continuar" da etapa Cadastro e o envio também conferem os outros pilotos
trocar('function sa(){const A=yy(hl);return Jl(A),Object.keys(A).length?(requestAnimationFrame(()=>document.getElementById(Object.keys(A)[0])?.focus()),!1):!0}',
  'function sa(){const A=yy(hl),B=kibValAc(kibAc,ml-(kibEu?1:0),hl);return Jl(A),kibSetErr(B),Object.keys(A).length||Object.keys(B).length?(requestAnimationFrame(()=>document.getElementById(Object.keys(A)[0]||Object.keys(B)[0])?.focus()),!1):!0}');

// 4) etapa 2: sai o campo opcional de nomes, entra o aviso
const ini = s.indexOf('c.jsxs("details",{className:"pilot-names"');
const fim = s.indexOf(',c.jsxs("div",{className:"group-help"', ini);
if (ini < 0 || fim < 0) throw new Error('bloco pilot-names');
s = s.slice(0, ini) + 'c.jsx("p",{className:"field-hint",style:{margin:"14px 0 0"},children:"Cada vaga é de uma pessoa diferente. Na etapa Cadastro você informa nome, CPF e data de nascimento de cada piloto."})' + s.slice(fim);

// 5) etapa 3: cadastro de cada piloto extra (antes da nota "Seu cadastro fica preservado")
const campo = (i, nome, rotulo, extra) =>
  'c.jsx(zn,{name:"ac"+i+"-' + nome + '",label:"' + rotulo + '",value:kibAc[i]?.' + nome + '||"",error:kibErr["ac"+i+"-' + nome + '"],'
  + 'onChange:(n,v)=>kibSetAc(L=>{const u=[...L];u[i]={...(u[i]||{}),' + nome + ':kibMasc("' + nome + '",v)};return u}),' + extra + '})';
const bloco = 'c.jsxs("div",{className:"kib-pilotos",children:[c.jsx("h3",{style:{margin:"24px 0 4px"},children:"Quem vai pilotar"}),c.jsx("p",{style:{margin:"0 0 10px",color:"var(--muted)"},children:`${ml} ${ml===1?"vaga":"vagas"} nesta reserva. Cada vaga é de uma pessoa diferente, com 14 anos ou mais (menores de 18 vêm com o responsável).`}),c.jsxs("label",{style:{display:"flex",gap:10,alignItems:"center",margin:"0 0 14px",fontWeight:600,cursor:"pointer"},children:[c.jsx("input",{type:"checkbox",checked:kibEu,onChange:A=>kibSetEu(A.target.checked),style:{width:18,height:18,accentColor:"var(--green)"}}),"Eu também vou pilotar nesta reserva"]}),...Array.from({length:Math.max(0,ml-(kibEu?1:0))},(A,i)=>c.jsxs("fieldset",{style:{border:"1px solid var(--border)",borderRadius:8,padding:"10px 14px 6px",margin:"0 0 12px"},children:[c.jsx("legend",{style:{padding:"0 6px",fontWeight:600},children:`Piloto ${i+(kibEu?2:1)}`}),c.jsxs("div",{className:"fields",children:['
  + campo('i', 'nome', 'Nome completo', 'autoComplete:"off",autoCapitalize:"words",maxLength:"120"') + ','
  + campo('i', 'documento', 'CPF', 'inputMode:"numeric",autoComplete:"off",placeholder:"000.000.000-00",maxLength:"14"') + ','
  + campo('i', 'nascimento', 'Data de nascimento', 'inputMode:"numeric",autoComplete:"off",placeholder:"DD/MM/AAAA",maxLength:"10"')
  + ']})]},i))]}),';
trocar('c.jsxs("p",{className:"data-note",children:[c.jsx(D0,', bloco + 'c.jsxs("p",{className:"data-note",children:[c.jsx(D0,');

// 6) o pedido leva o cadastro de cada piloto
trocar('pilotos:F.slice(0,ml),', 'compradorPilota:kibEu,pilotos:[...(kibEu?[hl.nome.trim()]:[]),...kibAc.slice(0,ml-(kibEu?1:0)).map(p=>(p?.nome||"").trim())],acompanhantes:Array.from({length:Math.max(0,ml-(kibEu?1:0))},(A,i)=>({nome:(kibAc[i]?.nome||"").trim(),documento:kibAc[i]?.documento||"",nascimento:K0(kibAc[i]?.nascimento||"")})),');

// 7) títulos das etapas
trocar('"Dados de quem reserva."', '"Dados de quem reserva e dos pilotos."');
fs.writeFileSync(sai, s);
console.log('ok', s.length);
