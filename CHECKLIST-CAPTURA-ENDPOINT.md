# Checklist de Captura LiveTime

Conclusão atual: LiveTime usa Blazor Server com `/_blazor/negotiate` e WebSocket SignalR. Não tratar isso como API JSON pública.

Durante corrida ativa:

- Abrir `https://livetime.azurewebsites.net/?uid=<uid>`.
- Confirmar se a tabela exibe `P`, `#`, `Name`, `Lap`, `Time`, `Gap`, `Interval`, `B.Lap`, `B.Time`.
- Rodar scraper:

```bash
LIVETIME_UID=<uid> npm run scraper
```

- Verificar snapshot:

```txt
http://localhost:4010/api/livetime-snapshot
```

- Conferir campos:
  - `position`
  - `kart`
  - `name`
  - `time`
- Ignorar erros visuais não críticos como favicon 404.
- Se a tabela não aparecer, verificar se a página está em estado de espera.
