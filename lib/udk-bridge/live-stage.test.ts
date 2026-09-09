import { describe, expect, it } from 'vitest';
import { buildStageSnapshot, resolveStageDriver, type StageBinding, type StageCompetitor, type StageRace } from './live-stage';
const binding: StageBinding = {stageId:'stage',seasonId:'season',title:'Etapa',races:[{racingId:1,groupId:10,sessionId:'s1',label:'Normal'},{racingId:2,groupId:11,sessionId:'s2',label:'Invertido'}]};
const drivers = [{id:'a',full_name:'Ana Silva',sport_name:null,category_id:'insanos'},{id:'b',full_name:'Bia Lima',sport_name:null,category_id:'insanos'},{id:'c',full_name:'Caio Reis',sport_name:null,category_id:'rapidos'}];
const categories = [{id:'insanos',name:'Insanos',slug:'insanos'},{id:'rapidos',name:'Rápidos',slug:'rapidos'}];
const rule = {position_points:{'1':50,'2':45},pole_points:1,fastest_lap_points:1};
const competitor = (name:string,pos:number,kart='1'):StageCompetitor => ({Id_RacingCompetitor:pos,Competitor:name,Number:kart,Pos:pos,Lap:10,BestLapTime:null,TotalTime:null,PenaltyTotalTime:null,StartPos:0,RacingStatus:0,IsHidden:false});
const races = ():StageRace[] => [{racingId:1,groupId:10,state:5,competitors:[competitor('Ana Silva',1),competitor('Bia Lima',2),competitor('Caio Reis',3)]},{racingId:2,groupId:11,state:5,competitors:[competitor('Bia Lima',1,'7'),competitor('Ana Silva',2,'9'),competitor('Caio Reis',3)]}];
describe('duas corridas Ultras',()=>{
 it('soma por piloto e categoria, mesmo com troca de kart, e preserva empates',()=>{
  const snapshot=buildStageSnapshot(binding,races(),drivers,categories,rule);
  expect(snapshot.categories[0].rows.map(r=>[r.total,r.position])).toEqual([[95,1],[95,1]]);
  expect(snapshot.categories[1].rows[0].total).toBe(100);
  expect(snapshot.complete).toBe(true);
 });
 it('não inventa pontos para corrida agendada',()=>{
  const source=races();source[1].state=0;
  expect(buildStageSnapshot(binding,source,drivers,categories,rule).categories[0].rows[0].racePoints).toEqual([50,null]);
  source[1].endTime='00:17:00.000';
  expect(buildStageSnapshot(binding,source,drivers,categories,rule).heats[1].state).toBe('scheduled');
 });
 it('trata EndTime como duração programada durante uma corrida sem resultado',()=>{
  const source=races();source[0].state=1;source[0].startedAt='2026-09-08T21:00:00.000Z';source[0].endTime='00:17:00.000';
  source[0].competitors.forEach(entry=>{entry.Pos=0;entry.Lap=0;});
  source[1].state=0;
  const snapshot=buildStageSnapshot(binding,source,drivers,categories,rule);
  expect(snapshot.heats[0].state).toBe('live');
  expect(snapshot.heats[0].entries.every(entry=>entry.points===null)).toBe(true);
  expect(snapshot.categories[0].rows.every(row=>row.total===null&&row.position===null)).toBe(true);
 });
 it('sinaliza piloto sem vínculo e impede conclusão',()=>{
  const source=races();source[0].competitors.push(competitor('Outro Piloto',4));
  const snapshot=buildStageSnapshot(binding,source,drivers,categories,rule);
  expect(snapshot.unresolved).toEqual(['Outro Piloto']);expect(snapshot.complete).toBe(false);
 });
 it('não usa nome genérico ou número do kart como identidade',()=>{
  expect(resolveStageDriver('Ana',drivers)).toBeNull();
  expect(resolveStageDriver('Ana Maria Silva',drivers)?.id).toBe('a');
  expect(resolveStageDriver('Nome importado',drivers,{ 'Nome importado':'Bia Lima' })?.id).toBe('b');
 });
 it('recusa baterias ou sessões duplicadas e grupos incorretos',()=>{
  expect(()=>buildStageSnapshot({...binding,races:[binding.races[0],binding.races[0]]},races(),drivers,categories,rule)).toThrow();
  const source=races();source[0].groupId=99;
  expect(()=>buildStageSnapshot(binding,source,drivers,categories,rule)).toThrow();
 });
 it('não pontua desclassificados e aplica bônus por categoria',()=>{
  const source=races();source[0].competitors[0].RacingStatus=2;
  source[0].competitors[1].StartPos=2;source[0].competitors[1].BestLapTime='1970-01-01T00:01:00Z';
  const heat=buildStageSnapshot(binding,source,drivers,categories,rule).heats[0];
  expect(heat.entries.find(e=>e.driverId==='a')?.points).toBe(0);
  expect(heat.entries.find(e=>e.driverId==='b')?.points).toBe(52);
 });
 it('aceita os marcadores de encerramento do LapTime e preserva penalidades da fonte',()=>{
  const source=races();
  source[0].state=4;
  source[0].startedAt='2026-09-08T21:00:00.000Z';
  source[0].lastPassingFlag=5;
  source[0].competitors[0].PenaltyLap=2;
  source[0].competitors[0].PenaltyTotalTime='00:00:03.500';
  const snapshot=buildStageSnapshot(binding,source,drivers,categories,rule);
  expect(snapshot.heats[0].state).toBe('finished');
  expect(snapshot.heats[0].entries.find(e=>e.driverId==='a')).toMatchObject({ penaltyLaps:2, penaltyMs:3500 });
 });
 it('restringe uma etapa configurada às duas categorias Ultras',()=>{
  expect(()=>buildStageSnapshot({...binding,categorySlugs:['insanos','outra']},races(),drivers,categories,rule)).toThrow(/categorias insanos e rapidos/);
  expect(buildStageSnapshot({...binding,categorySlugs:['insanos','rapidos']},races(),drivers,categories,rule).categories.map(c=>c.slug)).toEqual(['insanos','rapidos']);
 });
 it('recusa uma regra cujo vencedor não vale 50 pontos base',()=>{
  expect(()=>buildStageSnapshot(binding,races(),drivers,categories,{...rule,position_points:{'1':49}})).toThrow(/50 pontos base/);
 });
});
