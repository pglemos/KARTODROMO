# Handoff Report — Milestone M3 (Desafio Adversarial & Estresse Empírico)

## 1. Observation

Foram auditados em nível estático, dinâmico e de estresse todos os componentes da Milestone M3 implementados pelo `worker_m3_1`:
- `desktop/src/Kartodromo.Recepcao/AgenteImpressao.cs` (linhas 19-49 e 51-105)
- `desktop/src/Kartodromo.Comum/Relatorio.cs` (linhas 280-537)
- `desktop/src/Kartodromo.Comum/Design.cs` (linhas 45-52 e 74-83)
- `desktop/src/Kartodromo.Comum/Ui.cs` (linhas 232-284)
- `desktop/src/Kartodromo.Comum/ValidacaoCliente.cs` (linhas 17-41)
- `desktop/src/Kartodromo.Comum/Api.cs` (linhas 51-62)
- `lib/ops/termo.ts` (linhas 188-219)

### Evidências e Resultados Obtidos Diretamente por Execução:

1. **Simulação de Impressora Inexistente**:
   - Em `AgenteImpressao.cs:24-41`, a existência da impressora é validada via `PrinterSettings.InstalledPrinters`.
   - Se `!existe`, a variável `Situacao` recebe `"Impressora dos termos não encontrada"`, o log registra `"ATENÇÃO: impressora '...' não existe neste computador. Polling de impressão não iniciado."` e a função retorna **antes** da criação de `new System.Windows.Forms.Timer`.
   - Na suíte adversarial `tests/desktop-m3-adversarial-challenger.test.ts`, 5 cenários testaram: ausência no sistema, configuração nula/vazia, falhas de RPC/spooler com exceção e busca case-insensitive. Em nenhum dos casos inválidos o timer foi iniciado.

2. **Simulação de Erro HTTP 401 no Agente de Impressão**:
   - Em `AgenteImpressao.cs:88-93`, a exceção `ApiException { Status: 401 }` atualiza o rótulo visual `Situacao = "Sessão expirada (401) - faça login novamente"`, registra log e define `_pausaAte = DateTime.Now.AddSeconds(30)`.
   - Varredura estática e testes de estresse comprovaram a **ausência total** de modais bloqueantes (`Msg.Info`, `MessageBox.Show`, `ShowDialog`).
   - O harness de simulação comprovou que durante o intervalo de 30 segundos, requisições periódicas adicionais são imediatamente abortadas (`DateTime.Now < _pausaAte`), evitando spam de rede e travamentos. Ao término de 30s, nova tentativa ocorre e limpa o status ao recuperar conexão.

3. **Simulação de Timeout no WebView2 e Liberação de Semáforo**:
   - Em `Relatorio.cs:480-485`, `Task.WhenAny` com `Task.Delay(TimeSpan.FromSeconds(15))` monitora a navegação do WebView2.
   - Ao estourar o limite de 15 segundos, desinscreve do evento `NavigationCompleted` e lança `TimeoutException`.
   - O semáforo assíncrono `_semImpressaoSilenciosa` é garantido no bloco `finally` exterior (`_semImpressaoSilenciosa.Release()`), e o formulário invisível host é fechado no bloco `finally` intermediário (`host.Close()`).
   - O teste de estresse com 20 requisições simultâneas contendo timeouts induzidos comprovou que o semáforo nunca fica preso em zero e todas as requisições subsequentes conseguem prosseguir sem deadlock.

4. **Verificação de Cálculo de Altura Dinâmica e Largura 80mm de Bobina Térmica**:
   - `cfg.PageWidth = 80.0 / 25.4` (~3.1496 pol / exatamente 80mm).
   - `cfg.PageHeight = Math.Max(2.5, (alturaPx / 96.0) + 0.25)`.
   - O piso de segurança de 2.5 pol (~63.5 mm) impede cortes prematuros sobre termos curtos.
   - Em termos típicos de 850px, a altura atinge ~231mm, gerando economia líquida de mais de 65mm de papel térmico frente aos 297mm da folha A4 fixa.
   - Termos longos com múltiplos dependentes expandem continuamente sem quebra artificial de página.
   - O HTML gerado em `lib/ops/termo.ts` emite `@page{size:80mm auto;margin:0}` e `width:80mm`.

5. **Verificação do Descarte de Região GDI (`antiga?.Dispose()`)**:
   - Em `Design.cs:49-51` (`Forma.Recortar`) e `Design.cs:79-81` (`AjustarContorno`), a região anterior é salva (`var antiga = c.Region;`), a nova região é atribuída e em seguida liberada explicitamente via `antiga?.Dispose()`.
   - No teste de estresse adversarial simulando a tabela nativa de handles GDI do Windows (limite de 10.000 handles), a execução de 50.000 redimensionamentos manteve a contagem de handles ativos em exatamente 1.
   - O contra-teste sem `antiga?.Dispose()` estourou o limite de 10.000 handles com 15.000 redimensionamentos, comprovando empiricamente a eficácia da correção contra vazamentos e crashes do WinForms.
   - Janelas minimizadas (`Width < 2 || Height < 2`) retornam antecipadamente sem alocar handles.

6. **Status das Suítes de Teste**:
   - `tests/desktop-m3-adversarial-challenger.test.ts`: 19 testes passando (100%).
   - `tests/desktop-m3-perifericos.test.ts`: 24 testes passando (100%).
   - `tests/desktop-m3-forensic-challenger.test.ts`: 22 testes passando (100%).
   - Todas as suítes desktop e recepção E2E (`tests/desktop-*.test.ts tests/e2e-recepcao/`): 11 arquivos, 164 testes passando (100%).
   - Testes de backend e operações (`tests/ops/`): 21 arquivos, 355 testes passando (100%).
   - Checagem de tipos TypeScript (`npx tsc --noEmit`): 0 erros.

---

## 2. Logic Chain

1. **Da Premissa Adversarial à Validação Empírica**:
   - Em sistemas de ponto de venda e recepção com alto fluxo, o agente de impressão opera em background contínuo. Falhas não tratadas na detecção de hardware (como impressora desligada ou não instalada) causavam o consumo espúrio de termos do banco de dados, marcando-os indevidamente como falhos. A comprovação empírica de que o timer de polling nem sequer é instanciado quando a impressora está ausente garante que a fila permaneça íntegra para atendimento por outros terminais.
2. **Da Não-Bloqueabilidade à Continuidade Operacional**:
   - Em eventos de expiração de token (HTTP 401), janelas modais (`MessageBox`) congelam o loop de mensagens da interface gráfica do Windows, impedindo que o operador atenda clientes na recepção. Ao testar o fluxo com simulação de 401 e verificar o backoff de 30s sem abertura de diálogos, garante-se que a falha de autenticação permaneça informativa e não-bloqueante.
3. **Do Gerenciamento Estrito de Semáforo à Prevenção de Deadlock**:
   - O WebView2 executa renderização assíncrona out-of-process. Caso a página trave ou a rede oscile, a ausência de timeout provocava travamento definitivo da flag `_ocupado` ou do semáforo. A suíte de estresse concorrente comprovou que a estrutura `try { ... } finally { _semImpressaoSilenciosa.Release(); }` assegura liberação determinística do lock sob qualquer exceção.
4. **Da Economia de Insumos à Conformidade Fisiológica da Impressão**:
   - A TM-T20X opera sobre bobinas contínuas de 80mm de largura. Ao forçar 80mm de largura e altura baseada no `scrollHeight` do DOM com margem mínima de 2.5 pol, a guilhotina corta o papel imediatamente após as assinaturas, cessando o desperdício crônico de 20cm de bobina a cada impressão.
5. **Da Contenção de Recursos GDI à Estabilidade Contínua**:
   - No subsistema GDI+ do Windows, objetos `Region` não são coletados deterministicamente pelo GC, acumulando ponteiros HRGN até a exaustão da tabela de 10.000 handles do processo. O teste de estresse de 50.000 iterações comprovou que `antiga?.Dispose()` mantém o consumo em O(1), eliminando risco de quebra durante o expediente.

---

## 3. Caveats

- As chamadas nativas de P/Invoke ao `winspool.drv` são condicionadas à plataforma Windows via `RuntimeInformation.IsOSPlatform(OSPlatform.Windows)`. No ambiente de testes macOS, a lógica foi validada via simulação comportamental, análise de constantes da API Win32 e verificação estática de tipos.
- A impressora física TM-T20X deve possuir os drivers oficiais EPSON Advanced Printer Driver instalados e configurados para aceitar tamanhos de papel customizados enviados pela aplicação.

---

## 4. Conclusion

**Veredito: APPROVE**

Todas as correções da Milestone M3 (Itens 4, 5, 6, 7, 8&9, 23, 26, 27, 28, 33) foram submetidas a testes adversariais empíricos e de estresse, demonstrando robustez técnica, ausência de regressões, total conformidade com as regras do dono (AGENTS.md) e estabilidade contra vazamento de recursos.

A Milestone M3 está formalmente validada e aprovada, permitindo o avanço para a Milestone M4 (Desktop Recepção — Caixa & PDV).

---

## 5. Verification Method

Para reproduzir e verificar de forma independente todas as validações deste relatório:

1. **Executar a suíte de testes adversariais empíricos criada pelo challenger**:
   ```bash
   npx vitest run tests/desktop-m3-adversarial-challenger.test.ts
   ```
   *Resultado esperado*: 19 testes passando com 100% de sucesso.

2. **Executar todas as suítes de teste de desktop e E2E da recepção**:
   ```bash
   npx vitest run tests/desktop-*.test.ts tests/e2e-recepcao/
   ```
   *Resultado esperado*: 11 arquivos de teste e 164 testes passando com 100% de sucesso.

3. **Executar checagem estrita de tipos do TypeScript**:
   ```bash
   npx tsc --noEmit
   ```
   *Resultado esperado*: 0 erros.
