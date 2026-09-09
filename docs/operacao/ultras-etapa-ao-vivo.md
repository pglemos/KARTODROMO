# Etapa Ultras com duas corridas

O resultado da etapa é formado pelas duas corridas configuradas em `scripts/ultras-stage.json`:

- Corrida 1 — traçado normal: LapTime `657330`, grupo `270368`, sessão UDK `ecd8f003-8417-4c6c-95f8-b47b26a9d830`.
- Corrida 2 — traçado invertido: LapTime `657332`, grupo `270369`, sessão UDK `fcab6da9-54b0-456b-87fa-c3de1ce8a02f`.

O bridge `services/ultras-stage-server.ts` lê as duas corridas diretamente do SQL do LapTime a cada cinco segundos, resolve o piloto pelo cadastro do UDK e grava um snapshot em `live_stage_snapshots`. A classificação soma `racePoints[0] + racePoints[1]` pelo `driverId`; o número do kart não participa da identidade. Penalidades e status são somente copiados do LapTime.

A regra regular do UDK precisa manter o vencedor com 50 pontos base. Os bônus de pole e melhor volta continuam visíveis no valor da corrida porque já fazem parte da regra cadastrada no UDK. O teto base das duas corridas é 100 pontos, antes dos bônus.

## Operação

Para validar os vínculos sem gravar snapshot:

```powershell
npm run ultras:stage:check
```

Para iniciar a publicação contínua:

```powershell
npm run ultras:stage
```

O diagnóstico fica em `http://127.0.0.1:4014/healthz`. O endpoint público do site é `/api/ultras-stage` e o placar combinado é `/podio-ultras`. O placar consulta o endpoint a cada três segundos e exibe o estado de cada corrida, os pontos individuais e o total.

Para recuperar o serviço depois de reinicialização do computador, registrar a tarefa uma vez em PowerShell elevado:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-ultras-stage-autostart.ps1 -RunNow
```

O bridge não publica uma classificação completa enquanto houver um nome sem identidade/categoria UDK. `Rafael Teodoro` está associado à categoria `Ultras Rápidos`, assim como `Lucas Gabriel Voieta Parreira`.
