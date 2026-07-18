import { useMemo, useState } from 'react';
import { Gift, Gauge, Medal, Star } from 'lucide-react';

export type ClubPageKey =
  | 'vantagens' | 'cadastro' | 'consulta' | 'painel' | 'corridas' | 'pontuacao'
  | 'catalogo' | 'resgates' | 'perfil' | 'regulamento' | 'campanhas';

const customer = {
  nome: 'Rafael Nogueira', cpf: '123.456.789-00', email: 'rafael.nog@email.com',
  telefone: '(31) 99456-7788', cidade: 'Betim', membroDesde: '10/03/2024', pontos: 260,
};
const rewards = [
  ['Boné Oficial', 100, 'Vestuário'], ['Troféu Pequeno', 100, 'Colecionável'],
  ['Camiseta Oficial', 200, 'Vestuário'], ['Troféu Grande', 200, 'Colecionável'],
  ['Voucher para uma corrida', 300, 'Experiência'],
] as const;
const races = [
  ['14/07/2026', 'Bateria de aniversário', 20], ['08/07/2026', 'Corrida avulsa', 20],
  ['28/06/2026', 'Corrida — sábado', 10], ['14/06/2026', 'Corrida avulsa', 20],
  ['31/05/2026', 'Corrida — domingo', 10], ['19/05/2026', 'Corrida avulsa', 20],
] as const;
const campaigns = [
  ['Bônus de aniversário', 'Ganhe 50 pontos extras no mês do seu aniversário.', true],
  ['Indique um amigo', 'Ganhe 30 pontos quando o amigo indicado correr pela primeira vez.', true],
  ['Dose dupla de fim de ano', 'Pontuação em dobro em corridas de dezembro.', false],
] as const;
const tabs: Array<[string, ClubPageKey]> = [
  ['Painel', 'painel'], ['Corridas', 'corridas'], ['Pontuação', 'pontuacao'], ['Catálogo', 'catalogo'],
  ['Resgates', 'resgates'], ['Perfil', 'perfil'], ['Regulamento', 'regulamento'], ['Campanhas', 'campanhas'],
];
const href = (key: ClubPageKey) => `/clube-${key}`;

function ClubLogo() {
  return <a href="/"><img className="w-36" src="/brand/kib-logo.png" alt="Kartódromo Internacional de Betim" /></a>;
}

function ClubPortalShell({ page, children }: { page: ClubPageKey; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-ink-950 font-body text-white">
      <header className="border-b border-white/10 bg-ink-950 px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><ClubLogo /><a className="text-xs font-bold text-white/60 hover:text-primary-400" href="/clube-vantagens">Sair</a></div>
      </header>
      <nav className="border-b border-white/10 bg-ink-900 px-4" aria-label="Área do clube">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto py-2">
          {tabs.map(([label, key]) => <a className={`shrink-0 px-3 py-2 text-xs font-bold uppercase tracking-wider ${page === key ? 'bg-primary-500 text-ink-950' : 'text-white/60 hover:text-white'}`} href={href(key)} key={key}>{label}</a>)}
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </main>
  );
}

const Title = ({ eyebrow, children }: { eyebrow?: string; children: React.ReactNode }) => <header className="mb-8"><p className="font-race text-xs font-bold uppercase tracking-[.18em] text-primary-400">{eyebrow ?? 'Clube de Vantagens'}</p><h1 className="mt-2 font-display text-4xl uppercase leading-none md:text-6xl">{children}</h1></header>;
const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => <section className={`border border-white/10 bg-ink-800 p-5 ${className}`}>{children}</section>;

function ClubLanding() {
  return <main className="min-h-screen bg-ink-950 text-white">
    <header className="border-b border-white/10 px-4 py-5"><div className="mx-auto flex max-w-6xl items-center justify-between"><ClubLogo /><a className="border border-white/20 px-4 py-3 text-xs font-bold uppercase" href="/clube-consulta">Consultar pontos</a></div></header>
    <section className="relative overflow-hidden px-4 py-24 md:py-36"><div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(0,230,118,.18),transparent_38%)]" /><div className="relative mx-auto max-w-6xl"><p className="font-race text-sm font-bold uppercase tracking-[.2em] text-primary-400">Piloto frequente merece vantagem</p><h1 className="mt-5 max-w-4xl font-display text-6xl uppercase leading-[.82] md:text-8xl">Clube de <span className="text-primary-400">Vantagens</span></h1><p className="mt-7 max-w-2xl text-lg leading-8 text-white/65">Cada corrida vale pontos. Seus pontos viram produtos, troféus e novas experiências na pista.</p><div className="mt-9 flex flex-wrap gap-3"><a className="bg-primary-400 px-7 py-4 font-display uppercase text-ink-950" href="/clube-cadastro">Fazer meu cadastro</a><a className="border border-white/20 px-7 py-4 font-display uppercase" href="/clube-consulta">Consultar meus pontos</a></div></div></section>
    <section className="border-y border-white/10 bg-ink-900 px-4 py-20"><div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-2"><Title>Adesão gratuita.<br/><span className="text-primary-400">Pontos automáticos.</span></Title><div className="grid gap-3">{['Cadastre-se gratuitamente', 'Corra e acumule pontos', 'Troque por recompensas'].map((step, i) => <Card key={step}><span className="text-primary-400">0{i + 1}</span><h2 className="mt-2 font-display text-2xl uppercase">{step}</h2></Card>)}</div></div></section>
    <section className="px-4 py-20"><div className="mx-auto max-w-6xl"><Title>Troque seus pontos</Title><div className="grid gap-3 md:grid-cols-3">{rewards.slice(0, 3).map(([name, points]) => <Card key={name}><Gift className="text-primary-400"/><h2 className="mt-5 font-display text-2xl uppercase">{name}</h2><p className="mt-2 text-white/55">{points} pontos</p></Card>)}</div></div></section>
    <footer className="border-t border-white/10 px-4 py-10"><div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-5 text-sm text-white/55"><span>Clube de Vantagens · Kartódromo de Betim</span><a href="https://wa.me/5531998842898">WhatsApp: (31) 99884-2898</a></div></footer>
  </main>;
}

function Cadastro() {
  const [done, setDone] = useState(false);
  if (done) return <ClubPortalShell page="cadastro"><Title>Cadastro realizado!</Title><p className="text-white/65">Seja bem-vindo ao Clube de Vantagens.</p><a className="mt-6 inline-flex bg-primary-400 px-6 py-4 font-bold uppercase text-ink-950" href="/clube-painel">Ir para meu painel</a></ClubPortalShell>;
  return <ClubPortalShell page="cadastro"><div className="mx-auto max-w-2xl"><Title>Fazer meu cadastro</Title><form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>{[['Nome completo','text'],['CPF','text'],['Data de nascimento','date'],['Telefone','tel'],['E-mail','email'],['Cidade','text']].map(([label,type]) => <label className="grid gap-2 text-sm font-bold" key={label}>{label}<input className="h-12 border border-white/15 bg-ink-800 px-4 text-white" required type={type}/></label>)}<label className="flex gap-3 text-sm text-white/65 sm:col-span-2"><input required type="checkbox"/> Li e aceito o regulamento do Clube de Vantagens.</label><button className="h-14 bg-primary-400 font-display uppercase text-ink-950 sm:col-span-2">Confirmar cadastro</button></form></div></ClubPortalShell>;
}

function Consulta() {
  const [cpf, setCpf] = useState(''); const [result, setResult] = useState(false); const valid = cpf.replace(/\D/g, '').length === 11;
  return <ClubPortalShell page="consulta"><div className="mx-auto max-w-2xl"><Title>Consultar meus pontos</Title><form className="flex flex-wrap gap-3" onSubmit={(e) => {e.preventDefault(); setResult(valid);}}><input aria-label="CPF" className="h-14 min-w-64 flex-1 border border-white/15 bg-ink-800 px-4" onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" value={cpf}/><button className="bg-primary-400 px-7 font-bold uppercase text-ink-950">Consultar</button></form>{result && <Card className="mt-6"><h2 className="font-display text-3xl uppercase">{customer.nome}</h2><strong className="mt-5 block text-5xl text-primary-400">{customer.pontos} pontos</strong><a className="mt-6 inline-flex border border-white/20 px-5 py-3 font-bold uppercase" href="/clube-catalogo">Ver catálogo de recompensas</a></Card>}</div></ClubPortalShell>;
}

function Portal({ page }: { page: ClubPageKey }) {
  const [saved, setSaved] = useState(false); const [balance, setBalance] = useState(customer.pontos);
  const movements = useMemo(() => [...races, ['02/06/2026', 'Resgate de Boné Oficial', -100] as const], []);
  let content: React.ReactNode;
  if (page === 'painel') content = <><Title eyebrow="Meu clube">Olá, Rafael</Title><div className="grid gap-3 md:grid-cols-3"><Card><Gauge className="text-primary-400"/><strong className="mt-4 block text-5xl">{balance}</strong><span className="text-white/50">pontos disponíveis</span></Card><Card className="md:col-span-2"><h2 className="font-display text-2xl uppercase">Próxima recompensa</h2><p className="mt-3 text-white/60">Voucher para uma corrida · faltam {300-balance} pontos</p><div className="mt-5 h-2 bg-white/10"><div className="h-full bg-primary-400" style={{width:`${Math.min(100,balance/3)}%`}}/></div></Card></div><div className="mt-6 grid gap-3 md:grid-cols-3">{campaigns.map(([name,desc,active])=><Card key={name}><Star className="text-primary-400"/><h2 className="mt-4 font-display text-xl uppercase">{name}</h2><p className="mt-2 text-sm text-white/55">{desc}</p><span className="mt-4 block text-xs uppercase text-primary-400">{active?'Ativa':'Em breve'}</span></Card>)}</div></>;
  else if (page === 'corridas') content = <><Title>Corridas pontuadas</Title><Card>{races.map(([date,name,points])=><div className="flex justify-between gap-4 border-b border-white/10 py-4 last:border-0" key={date+name}><div><strong>{name}</strong><span className="block text-xs text-white/45">{date}</span></div><b className="text-primary-400">+{points} pts</b></div>)}</Card></>;
  else if (page === 'pontuacao') content = <><Title>Como você ganha pontos</Title><div className="grid gap-3 md:grid-cols-2"><Card><h2 className="font-display text-2xl uppercase">Terça a sexta</h2><strong className="mt-4 block text-4xl text-primary-400">20 pontos</strong></Card><Card><h2 className="font-display text-2xl uppercase">Finais de semana e feriados</h2><strong className="mt-4 block text-4xl text-primary-400">10 pontos</strong></Card></div><Card className="mt-4">{movements.map(([date,name,points])=><div className="flex justify-between border-b border-white/10 py-3" key={date+name}><span>{name} · {date}</span><b className={points>0?'text-primary-400':'text-red-400'}>{points>0?'+':''}{points}</b></div>)}</Card></>;
  else if (page === 'catalogo') content = <><Title>Recompensas disponíveis</Title><p className="mb-6 text-white/60">Saldo: <b className="text-primary-400">{balance} pontos</b></p><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{rewards.map(([name,points,category])=><Card key={name}><Gift className="text-primary-400"/><span className="mt-5 block text-xs uppercase text-white/45">{category}</span><h2 className="mt-1 font-display text-2xl uppercase">{name}</h2><strong className="mt-4 block text-primary-400">{points} pontos</strong><button className="mt-5 w-full border border-primary-400 px-4 py-3 text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-35" disabled={balance<points} onClick={()=>setBalance(balance-points)}>Resgatar</button></Card>)}</div></>;
  else if (page === 'resgates') content = <><Title>Resgates realizados</Title><Card>{[['02/06/2026','Boné Oficial',-100],['11/04/2026','Troféu Pequeno',-100]].map(([date,name,points])=><div className="flex justify-between border-b border-white/10 py-4" key={String(date)}><span>{name}<small className="block text-white/45">{date}</small></span><b className="text-red-400">{points} pts</b></div>)}</Card></>;
  else if (page === 'perfil') content = <><Title>Meu perfil</Title><form className="grid max-w-2xl gap-4 sm:grid-cols-2" onSubmit={(e)=>{e.preventDefault();setSaved(true);}}>{Object.entries(customer).slice(0,5).map(([key,value])=><label className="grid gap-2 text-sm font-bold" key={key}>{key}<input className="h-12 border border-white/15 bg-ink-800 px-4" defaultValue={value} disabled={key==='cpf'}/></label>)}<button className="h-12 bg-primary-400 font-bold uppercase text-ink-950 sm:col-span-2">Salvar alterações</button>{saved&&<p className="text-primary-400">Alterações salvas.</p>}</form></>;
  else if (page === 'regulamento') content = <><Title>Regulamento do clube</Title><div className="grid gap-3">{['Adesão e elegibilidade','Acúmulo de pontos','Validade dos pontos','Resgate de recompensas','Disposições gerais'].map((title,i)=><Card key={title}><h2 className="font-display text-2xl uppercase text-primary-400">{i+1}. {title}</h2><p className="mt-3 leading-7 text-white/60">A participação é gratuita e pessoal. Pontos são creditados após corridas elegíveis e não podem ser transferidos. Recompensas dependem de saldo e disponibilidade.</p></Card>)}</div></>;
  else content = <><Title>Bônus e promoções</Title><div className="grid gap-3 md:grid-cols-3">{campaigns.map(([name,desc,active])=><Card key={name}><Medal className="text-primary-400"/><h2 className="mt-4 font-display text-2xl uppercase">{name}</h2><p className="mt-3 text-white/60">{desc}</p><span className="mt-5 block text-xs font-bold uppercase text-primary-400">{active?'Campanha ativa':'Programada'}</span></Card>)}</div></>;
  return <ClubPortalShell page={page}>{content}</ClubPortalShell>;
}

export default function ClubPage({ page }: { page: ClubPageKey }) {
  if (page === 'vantagens') return <ClubLanding />;
  if (page === 'cadastro') return <Cadastro />;
  if (page === 'consulta') return <Consulta />;
  return <Portal page={page} />;
}
