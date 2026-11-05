# Checklist de Implantação e Homologação — Cronometragem

> **Status:** Código implementado e verificado isoladamente via suites de teste (Vitest 58/58 arquivos, 474 testes GREEN; C# 20/20 testes GREEN; .NET Release build limpo sem erros ou avisos).
> **Atenção:** Nenhuma alteração foi promovida para a pasta de produção `C:\repos\KARTODROMO` nem para os serviços em execução (`:4050`, `:4060`, SQL Server de produção).
> A implantação depende de aprovação formal e janela operacional.

---

## 1. Gates de Homologação (Obrigatórios antes do Go-Live)

| Gate | Descrição | Status Atual | Ação Necessária na Janela |
|---|---|---|---|
| **GATE-SQL** | Aplicação da migration `0010_crono_uso_karts.sql` no banco `KartodromoOps` (`SRVKART\SQLEXPRESS`) | Validado em ambiente de teste com mock transacional | Rodar `sqlcmd -S localhost\SQLEXPRESS -d KartodromoOps -E -i migrations/ops/0010_crono_uso_karts.sql` no SRVKART |
| **GATE-AUTH** | Configuração da chave `TIMING_API_KEY` no ambiente do serviço `:4050` e nos clientes | Implementado com fallback para desenvolvimento local | Definir `TIMING_API_KEY` no `.env` do serviço no ORBITS e distribuir nos clientes nativos |
| **GATE-SRV** | Atualização do serviço de cronometragem `:4050` no host ORBITS | Compilação testada em `C:\temp\teste-crono` | Parar serviço `:4050`, sincronizar arquivos TypeScript/Node compilados, reiniciar serviço |
| **GATE-DESKTOP** | Atualização do executável `Kartodromo.Cronometragem.exe` | Build Release gerado sem avisos (`net8.0-windows`) | Copiar binários para a pasta de aplicativos do operador |
| **GATE-HW** | Teste de comunicação com hardware real (Decoder MYLAPS P3 :5403, Painel LED COM3) | Testado em simulador `:4150` | Abrir sessão de teste durante janela sem prova em andamento e validar leituras do loop real |
| **GATE-SMTP** | Envio de e-mail de resultados com servidor SMTP de produção | Testado com mock efêmero e transporte isolado | Efetuar teste de envio para e-mail do operador antes de baterias comerciais |
| **GATE-IMPRESSAO** | Geração e visualização de PDFs/relatórios na impressora física | Validados previews de todas as modalidades e layout nativo | Imprimir página de teste na impressora padrão |

---

## 2. Roteiro Passo a Passo de Implantação

### Fase 1: Preparação e Janela (Sem Baterias Ativas)
1. Confirmar que não há baterias em andamento na pista nem clientes no circuito.
2. Confirmar que a fila de impressão da Recepção está limpa (`/api/office/impressao/fila`).
3. Obter autorização explícita do proprietário para atualização da cronometragem.
4. Fazer backup da pasta de dados `data/timing/` existente no ORBITS:
   ```powershell
   Copy-Item -Path "C:\repos\KARTODROMO\data\timing" -Destination "C:\temp\timing_backup_pre_deploy" -Recurse
   ```

### Fase 2: Banco de Dados (SRVKART)
1. Conectar ao SRVKART via WinRM ou sessão autorizada.
2. Executar a migration idempotente:
   ```cmd
   sqlcmd -S localhost\SQLEXPRESS -d KartodromoOps -E -i C:\kartodromo-servidor\migrations\ops\0010_crono_uso_karts.sql
   ```
3. Verificar a criação da tabela `dbo.CronoUsoKarts`:
   ```cmd
   sqlcmd -S localhost\SQLEXPRESS -d KartodromoOps -E -Q "SELECT COUNT(*) FROM dbo.CronoUsoKarts"
   ```

### Fase 3: Serviço de Cronometragem (ORBITS)
1. Parar o serviço atual da cronometragem:
   ```powershell
   Stop-Process -Name node -ErrorAction SilentlyContinue # ou service stop se registrado via nssm/pm2
   ```
2. Aplicar o novo código e dependências em `C:\repos\KARTODROMO`.
3. Configurar a chave `TIMING_API_KEY` no arquivo de ambiente protegido.
4. Iniciar o serviço e validar endpoints de saúde:
   ```powershell
   curl http://localhost:4050/healthz
   curl http://localhost:4050/api/state
   ```

### Fase 4: Aplicativo Nativo WinForms
1. Atualizar o executável `Kartodromo.Cronometragem.exe` no computador CRONOMETRAGEM (ORBITS) e na reserva CRONO1 (.254).
2. Abrir o aplicativo e conferir:
   - Conexão com o catálogo e exibição de eventos sem recursão.
   - Navegação completa por teclado (Setas, Enter, Espaço).
   - Layout em resolução 1366×768 (botões "Distribuir", "Imprimir", legenda completa de 2 linhas, rodapés visíveis).
   - Acesso à tela de Relatórios (`FormRelatoriosCrono`) com filtros em cascata corretos.

### Fase 5: Validação com Prova de Teste ("TESTE CODEX")
1. Criar uma prova avulsa identificada como `TESTE CODEX`.
2. Rodar 2 voltas simuladas ou passagens reais pelo loop.
3. Finalizar com bandeira quadriculada, verificar cálculo de melhores voltas, classificação e penalidades.
4. Gerar relatório e post do Instagram (conferir presença das 4 faixas de peso e rótulo de período).
5. Descartar/excluir a sessão de teste para não poluir os registros do dia.

---

## 3. Plano de Rollback

Em caso de imprevisto operacional durante a janela:
1. **Serviço Node:** Restaurar a pasta `C:\repos\KARTODROMO` anterior ou retornar o commit via git:
   ```powershell
   git checkout HEAD~1
   ```
2. **Dados da Cronometragem:** Restaurar a pasta `C:\temp\timing_backup_pre_deploy` para `data/timing/`.
3. **Banco SQL:** A tabela `dbo.CronoUsoKarts` é retrocompatível e não interfere na estrutura legado de `Manutencao`. Se for estritamente necessário remover:
   ```cmd
   sqlcmd -S localhost\SQLEXPRESS -d KartodromoOps -E -Q "DROP TABLE dbo.CronoUsoKarts"
   ```
4. **Desktop:** Restaurar o executável anterior a partir da pasta de backup.
5. Reiniciar o serviço `:4050` e abrir o aplicativo WinForms anterior.
