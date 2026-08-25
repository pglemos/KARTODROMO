# Operação — Sincronização da cópia TB50

> Como atualizar `C:\KARTODROMO-TB50` (deploy do telão/pódio) com o código do repositório principal.
> Procedimento validado em 2026-08-24 (deploy quente sem perda de frame).

## ⚠️ Contexto crítico

`C:\KARTODROMO-TB50` **não é staging dormente**. É o pipeline em operação:

| Serviço | Comando | Porta |
|---|---|---|
| Placar/pódio (telão) | `next start -p 3100 -H 0.0.0.0` | 3100 (aberto na rede) |
| Scraper LapTime local | `tsx services/livetime-scraper-server.ts` | 4010 (⚠️ conflito com o scraper do repo principal nesta máquina — o da TB50 é **redundante aqui**) |
| Streamers de vídeo HLS | powershells escrevendo `public/videos/` | — (não tocar durante o sync) |

## Particularidades da cópia TB50

- `node_modules` é um **symlink** → Turbopack rejeita; build obrigatoriamente com
  **`next build --webpack`** (já ajustado no `package.json` dela).
- `package.json`, `package-lock.json` e `.env.local` são **preservados** (não espelhar):
  a cópia tem env próprio (ViPlex, UDK, Supabase, portas 3100/4010).
- `.runtime/`, `.next/` e `public/videos/` não entram no espelho.

## Procedimento

```powershell
# 1) Backup integral do código atual
robocopy "C:\KARTODROMO-TB50" "C:\KARTODROMO\.tmp\backup-tb50" /E `
  /XD node_modules .next .git .runtime videos /XF package.json package-lock.json .env.local

# 2) Parar os serviços node da cópia (streamers de vídeo continuam)
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'KARTODROMO-TB50' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

# 3) Espelhar código (repo -> TB50)
foreach ($d in @('app','components','lib','migrations','public','services','src','styles','supabase','api')) {
  robocopy "C:\KARTODROMO\$d" "C:\KARTODROMO-TB50\$d" /MIR /XD node_modules .next videos /NFL /NDL /NJH /NJS /NP
}
foreach ($f in @('next.config.ts','tsconfig.json','tailwind.config.js','postcss.config.js',
                 'eslint.config.js','open-next.config.ts','next-env.d.ts')) {
  Copy-Item "C:\KARTODROMO\$f" "C:\KARTODROMO-TB50\$f" -Force
}

# 4) Build (webpack — symlink!)
Set-Location C:\KARTODROMO-TB50
npx next build --webpack

# 5) Subir o placar
Start-Process node -ArgumentList 'node_modules\next\dist\bin\next','start','-p','3100','-H','0.0.0.0' -WorkingDirectory C:\KARTODROMO-TB50 -WindowStyle Hidden

# 6) Saúde
Invoke-WebRequest http://127.0.0.1:3100/design/home.dc.html          # 200
Invoke-WebRequest http://127.0.0.1:3100/placar-telao-tb50?layout=designer  # 200
```

## Notas

- O scraper da pasta TB50 entra em conflito de porta com o scraper do repo principal
  (`:4010`) e fica zumbi se relançado aqui — **não relancar**; quem alimenta os dados é o
  scraper do repo principal.
- As tarefas agendadas ("Kartodromo TB50 Podium", watchdog) reassumem a supervisão no próximo boot.
- Janela ideal: fora de provas (madrugada). Interrupção típica do placar: 3–5 minutos.
