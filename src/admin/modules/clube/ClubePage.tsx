import { FormEvent, useState } from 'react';
import { Gift, Megaphone, Users } from 'lucide-react';
import { Card } from '../../ui/Card';
import { PageHeader } from '../../ui/PageHeader';

type Reward = { id: number; name: string; category: string; points: number; stock: number };
const initialRewards: Reward[] = [
  { id: 1, name: 'Boné Oficial', category: 'Vestuário', points: 100, stock: 18 },
  { id: 2, name: 'Troféu Pequeno', category: 'Colecionável', points: 100, stock: 12 },
  { id: 3, name: 'Camiseta Oficial', category: 'Vestuário', points: 200, stock: 9 },
  { id: 4, name: 'Voucher para uma corrida', category: 'Experiência', points: 300, stock: 30 },
];

export function ClubePage() {
  const [rewards, setRewards] = useState(initialRewards);
  const [pending, setPending] = useState([
    { id: 1, participant: 'Mariana Souza', reward: 'Boné Oficial', points: 100 },
    { id: 2, participant: 'Carlos Ferreira', reward: 'Troféu Pequeno', points: 100 },
  ]);
  const [campaigns, setCampaigns] = useState([
    { id: 1, name: 'Bônus de aniversário', active: true },
    { id: 2, name: 'Indique um amigo', active: true },
    { id: 3, name: 'Dose dupla de fim de ano', active: false },
  ]);
  const [modal, setModal] = useState(false);

  function updateStock(id: number, delta: number) {
    setRewards((items) => items.map((item) => item.id === id ? { ...item, stock: Math.max(0, item.stock + delta) } : item));
  }
  function addReward(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setRewards((items) => [...items, {
      id: Date.now(), name: String(data.get('name')), category: String(data.get('category')),
      points: Number(data.get('points')), stock: Number(data.get('stock')),
    }]);
    setModal(false);
  }

  return <section className="space-y-6">
    <PageHeader eyebrow="Gestão" title="Clube de Vantagens" subtitle="Participantes, recompensas, campanhas e resgates do programa de fidelidade." />
    <div className="grid gap-4 md:grid-cols-3">
      {[['Participantes','128',Users],['Recompensas',String(rewards.length),Gift],['Campanhas ativas',String(campaigns.filter((item)=>item.active).length),Megaphone]].map(([label,value,Icon]) => <Card className="p-5" key={String(label)}><Icon className="text-brand-400" size={22}/><span className="mt-4 block text-xs font-bold uppercase text-zinc-500">{String(label)}</span><strong className="mt-1 block text-3xl text-zinc-100">{String(value)}</strong></Card>)}
    </div>
    <Card className="p-5"><h2 className="mb-4 text-lg font-bold text-zinc-100">Resgates aguardando aprovação</h2>{pending.length ? <div className="space-y-2">{pending.map((item)=><div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3" key={item.id}><div><strong className="text-zinc-200">{item.participant}</strong><p className="text-xs text-zinc-500">{item.reward} · {item.points} pontos</p></div><div className="flex gap-2"><button className="rounded bg-brand-500 px-3 py-2 text-xs font-bold text-zinc-950" onClick={()=>setPending((all)=>all.filter((row)=>row.id!==item.id))}>Aprovar</button><button className="rounded border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400" onClick={()=>setPending((all)=>all.filter((row)=>row.id!==item.id))}>Recusar</button></div></div>)}</div> : <p className="text-sm text-zinc-500">Nenhum resgate pendente.</p>}</Card>
    <Card className="p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold text-zinc-100">Recompensas e estoque</h2><button className="rounded bg-brand-500 px-3 py-2 text-xs font-bold text-zinc-950" onClick={()=>setModal(true)}>+ Nova recompensa</button></div><div className="space-y-2">{rewards.map((item)=><div className="grid items-center gap-3 rounded-lg border border-zinc-800 p-3 md:grid-cols-[1fr_auto_auto]" key={item.id}><div><strong className="text-zinc-200">{item.name}</strong><p className="text-xs text-zinc-500">{item.category} · {item.points} pontos</p></div><span className="text-sm text-zinc-400">Estoque: {item.stock}</span><div className="flex gap-1"><button className="h-8 w-8 rounded border border-zinc-700" onClick={()=>updateStock(item.id,-1)}>−</button><button className="h-8 w-8 rounded border border-zinc-700" onClick={()=>updateStock(item.id,1)}>+</button></div></div>)}</div></Card>
    <Card className="p-5"><h2 className="mb-4 text-lg font-bold text-zinc-100">Campanhas</h2><div className="grid gap-2 md:grid-cols-3">{campaigns.map((item)=><button className={`rounded-lg border p-4 text-left ${item.active?'border-brand-500/40 bg-brand-500/10':'border-zinc-800'}`} key={item.id} onClick={()=>setCampaigns((all)=>all.map((row)=>row.id===item.id?{...row,active:!row.active}:row))}><strong className="block text-zinc-200">{item.name}</strong><span className="mt-2 block text-xs uppercase text-brand-400">{item.active?'Ativa':'Inativa'}</span></button>)}</div></Card>
    {modal && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"><form className="grid w-full max-w-lg gap-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6" onSubmit={addReward}><div className="flex justify-between"><h2 className="text-xl font-bold">Nova recompensa</h2><button type="button" onClick={()=>setModal(false)}>✕</button></div>{[['name','Nome'],['category','Categoria'],['points','Pontos'],['stock','Estoque inicial']].map(([name,label])=><label className="grid gap-1 text-sm" key={name}>{label}<input className="h-11 rounded border border-zinc-700 bg-zinc-950 px-3" min={name==='stock'?0:1} name={name} required type={name==='points'||name==='stock'?'number':'text'}/></label>)}<button className="h-11 rounded bg-brand-500 font-bold text-zinc-950">Salvar recompensa</button></form></div>}
  </section>;
}
