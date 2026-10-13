import {it,expect} from 'vitest';
import {createSession,setCompetitors,restoreCompetitor} from '../lib/timing/race-engine';
function fixture(){return createSession({id:'TESTE_CODEX',name:'TESTE CODEX',type:'corrida',durationMin:20,minLapSec:5,now:0,competitors:[{kart:'1',name:'TESTE CODEX A',customerId:'7'},{kart:'2',name:'TESTE CODEX B',customerId:'8'}]});}
it('guarda vários excluídos e recupera um só com seu histórico após recarregar JSON',()=>{
 const s=fixture();s.competitors[0].crossings=[{id:'x',wallMs:1000,decoderTimeMs:1000,lapMs:null}];s.competitors[0].flag='black';
 setCompetitors(s,[]);const restored=JSON.parse(JSON.stringify(s));
 expect(restored.excludedCompetitors).toHaveLength(2);
 restoreCompetitor(restored,restored.excludedCompetitors[0].id);
 expect(restored.competitors[0].name).toBe('TESTE CODEX A');expect(restored.competitors[0].crossings[0].id).toBe('x');expect(restored.competitors[0].flag).toBe('black');expect(restored.excludedCompetitors).toHaveLength(1);
});
it('recusa conflito de kart sem perder o excluído',()=>{
 const s=fixture();setCompetitors(s,[{kart:'2',name:'TESTE CODEX B',customerId:'8'}]);setCompetitors(s,[{kart:'1',name:'TESTE CODEX C'},{kart:'2',name:'TESTE CODEX B',customerId:'8'}]);
 expect(()=>restoreCompetitor(s,s.excludedCompetitors![0].id)).toThrow('outro piloto');expect(s.excludedCompetitors).toHaveLength(1);
});
it('salvar e trocar kart não cria exclusão falsa',()=>{const s=fixture();setCompetitors(s,[{kart:'3',name:'TESTE CODEX A',customerId:'7'},{kart:'2',name:'TESTE CODEX B',customerId:'8'}]);expect(s.excludedCompetitors??[]).toHaveLength(0);});
it('recupera penalidades e junta passagens que o kart fez enquanto estava sem piloto',()=>{
 const s=fixture();const c=s.competitors[0];c.crossings=[{id:'antes',wallMs:1000,decoderTimeMs:1000,lapMs:null}];
 c.penalidades=[{id:'p',tipo:'tempo',segundos:5,wallMs:900}];c.detalhes={peso:80,email:'teste@example.com'};
 setCompetitors(s,[{kart:'2',name:'TESTE CODEX B',customerId:'8'}]);
 s.competitors.push({kart:'1',name:'Kart 1',autoAdded:true,finished:false,crossings:[{id:'depois',wallMs:61000,decoderTimeMs:61000,lapMs:null}]});
 const id=s.excludedCompetitors![0].id;const r=restoreCompetitor(s,id);
 expect(r.crossings.map(x=>x.id)).toEqual(['antes','depois']);expect(r.crossings[1].lapMs).toBe(60000);expect(r.penalidades![0].segundos).toBe(5);expect(r.detalhes!.peso).toBe(80);
 expect(s.competitors.filter(x=>x.kart==='1')).toHaveLength(1);expect(()=>restoreCompetitor(s,id)).toThrow('não encontrado');
});
