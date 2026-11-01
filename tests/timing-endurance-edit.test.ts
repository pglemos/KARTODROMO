import {expect,it} from 'vitest';
import {createSession,setCompetitors} from '../lib/timing/race-engine';
it('mantem voltas e penalidades ao editar nome e kart da equipe',()=>{
 const s=createSession({id:'teste',name:'TESTE CODEX',type:'corrida',durationMin:150,now:1,competitors:[{kart:'',name:'Equipe A'}]});
 Object.assign(s.competitors[0],{enduranceEquipeId:7,flag:'blue',crossings:[{id:'volta',wallMs:1000,decoderTimeMs:1000,lapMs:61000}],penalidades:[{id:'punicao',tipo:'tempo',segundos:15}]});
 setCompetitors(s,[{kart:'42',name:'Equipe A corrigida',enduranceEquipeId:7}]);
 expect(s.competitors[0].crossings).toHaveLength(1);
 expect(s.competitors[0].flag).toBe('blue');
 expect(s.competitors[0].penalidades?.[0].id).toBe('punicao');
 expect(s.competitors[0].enduranceEquipeId).toBe(7);
});
it('nao troca a identidade de duas equipes sem kart ao reordenar e renomear',()=>{
 const s=createSession({id:'teste',name:'TESTE CODEX',type:'corrida',durationMin:150,now:1,competitors:[{kart:'',name:'A'},{kart:'',name:'B'}]});
 Object.assign(s.competitors[0],{enduranceEquipeId:7,flag:'blue'});Object.assign(s.competitors[1],{enduranceEquipeId:8,flag:'black'});
 setCompetitors(s,[{kart:'',name:'B editada',enduranceEquipeId:8},{kart:'',name:'A editada',enduranceEquipeId:7}]);
 expect(s.competitors.map(c=>c.flag)).toEqual(['black','blue']);
});
