#!/usr/bin/env node
// Acha, pelo CONTEÚDO (não pelo nome), a corrida e a tomada de tempo da bateria 2 do UDK de hoje.
// Corrida = sessão encerrada, verde depois de --depois (fim da corrida 1), com >= 10 voltas do líder.
// Tomada  = sessão encerrada entre --depois e o verde da corrida, com mais pilotos marcando volta.
// Saída: JSON {c2, pole2, ok}. ok=true só quando a corrida 2 já foi encerrada.
import { execFileSync } from 'node:child_process';

const depois = Number(process.argv[2] || 0); // epoch ms
const script = `[Console]::OutputEncoding=[Text.Encoding]::UTF8
$out = @(); (Invoke-RestMethod http://localhost:4050/api/sessions) | ? { $_.id -like '${new Date().toISOString().slice(0, 10)}*' } | % {
 $v = Invoke-RestMethod "http://localhost:4050/api/sessions/$($_.id)"
 if($v.greenAt -and [int64]$v.greenAt -gt ${depois}){
  $out += [pscustomobject]@{ id=$v.id; name=$v.name; state=$v.state; green=[int64]$v.greenAt; pass=$v.passingsCount; maxLaps=(@($v.standings | % { [int]$_.laps }) | measure -Maximum).Maximum; comVolta=@($v.standings | ? { $_.bestLapMs }).Count; n=@($v.standings).Count }
 } }
ConvertTo-Json -Compress -InputObject $out`;
const raw = execFileSync('ssh', ['-o', 'BatchMode=yes', 'orbits', 'powershell -NoProfile -Command -'], { input: script, encoding: 'utf8' });
const lista = [].concat(JSON.parse(raw.trim().split('\n').filter((l) => l.startsWith('[') || l.startsWith('{')).pop() || '[]'));
const corridas = lista.filter((s) => s.maxLaps >= 10 && s.n >= 10).sort((a, b) => a.green - b.green);
const c2 = corridas[0];
const tomadas = lista
  .filter((s) => s.state === 'encerrada' && s.comVolta > 0 && s.maxLaps < 10 && (!c2 || s.green < c2.green))
  .sort((a, b) => b.comVolta - a.comVolta || b.green - a.green);
console.log(JSON.stringify({ ok: !!c2 && c2.state === 'encerrada', c2: c2?.id || null, c2nome: c2?.name, c2estado: c2?.state, pole2: tomadas[0]?.id || null, pole2nome: tomadas[0]?.name, sessoes: lista.map((s) => `${s.name}|${s.state}|v${s.maxLaps}|cv${s.comVolta}`) }));
