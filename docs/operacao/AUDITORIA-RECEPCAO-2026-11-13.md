# Auditoria da Recepção — 13/11/2026

Somente leitura: nada foi alterado, reiniciado ou publicado.

## O que foi conferido

- Aplicativo da Recepção (`desktop/src/Kartodromo.Recepcao`, 9 mil linhas, WinForms .NET 8) e a biblioteca comum (`Kartodromo.Comum`, 5,9 mil linhas).
- Servidor da operação (`services/ops-server.ts` + `lib/ops/*`, 9,9 mil linhas) e as 27 migrações do banco `KartodromoOps`.
- Estado no SRVKART: nomes das variáveis do `.env.local` (sem ler valores), `/healthz`, versões publicadas.

Não conferido: dados dentro do banco (usuários, caixas abertos, tamanho) — a conta Windows usada não tem acesso ao SQL e não usei a senha do aplicativo; uso real nas telas; impressoras; os PCs da Recepção em si.

## Retrato

| Item | Situação |
|---|---|
| Versão no fonte | 1.0.110 |
| Versão publicada para a Recepção | 1.0.108 (Cronometragem já está em 1.0.110) |
| Servidor | no ar, `/healthz` ok |
| Comunicação | `http://192.168.20.13:4060`, sem criptografia |
| Senhas | scrypt com sal, comparação em tempo constante |
| Login | bloqueio de 15 min após 10 erros por IP |
| Testes | 4 níveis de teste ponta a ponta + 29 arquivos em `tests/ops`; o projeto da Recepção não tem testes unitários próprios |

## Prioridade 1 — segurança e dinheiro

| # | Achado | Evidência | Correção |
|---|---|---|---|
| 1 | Segredo da sessão não está configurado | `OPS_SESSION_SECRET` não existe no `.env.local` do SRVKART. `lib/ops/auth.ts` cai para `OPS_RECEPCAO_KEY` (a mesma chave usada pelos workers e pela cronometragem) e, se ela faltar, para o texto fixo `'sem-segredo'`. | Criar `OPS_SESSION_SECRET` próprio; remover o texto fixo e fazer o servidor recusar subir sem segredo. Quem tiver a chave da operação hoje consegue fabricar sessão de administrador. |
| 2 | Senha e sessão trafegam sem criptografia | `appsettings.json` aponta para `http://`; o servidor escuta em `0.0.0.0:4060` sem TLS. | HTTPS na rede interna (certificado próprio instalado nos PCs) ou túnel já existente. |
| 3 | Sessão vai na URL | Relatórios e termo usam `?t=<token>`; o token fica na fila de impressão (`.runtime\impressao-fila.json`) e em logs. | Token curto de uso único só para impressão, com validade de minutos. |
| 4 | Sessão não pode ser cancelada | Token assinado, vale 16 h e se renova sozinho; desativar o usuário ou trocar a senha não derruba quem já entrou. `validaToken` não consulta o banco. | Conferir `Ativo` e uma "versão da senha" a cada chamada, ou guardar sessões no banco. |
| 5 | Permissões por perfil cobrem só agenda e reservas | `exigePermissaoOffice` trata apenas `/baterias`, `/grupos` e `/reservas`. Caixa, vendas, estorno, clientes, vouchers e relatórios só distinguem "admin" de "não admin". Usuário sem perfil, ou perfil sem linhas, passa em tudo. | Aplicar a matriz de permissões a todas as rotas; sem perfil = sem acesso. |
| 6 | Fechamento de caixa sem conferência | `/caixa/fechar` grava só a hora e o valor deixado para o próximo turno. Não pede o valor contado, não registra diferença, não separa por forma de pagamento. | Fechamento cego: operador digita o que contou por forma de pagamento, sistema grava a diferença e exige justificativa. |
| 7 | Não há trilha de auditoria | Nenhuma tabela de log de ações. Só 12 colunas `UsuarioId` espalhadas. Alteração de preço, exclusão de bateria, edição de cliente e mudança de permissão não deixam registro de quem fez. A tela de login promete "tudo fica registrado no seu nome". | Tabela `Auditoria` (quem, quando, o quê, antes, depois) gravada no servidor em toda escrita. |
| 8 | Banco sem criptografia na conexão | `OPS_SQL_ENCRYPT` não definido; SQL escutando na porta 1433 para a rede. | Ligar `encrypt`, e restringir a 1433 à própria máquina. |
| 9 | .NET 8 saiu de suporte em 10/11/2026 | `Directory.Build.props`: `net8.0-windows`. | Migrar para .NET 10 (LTS). |

## Prioridade 2 — robustez

- **Atualização automática confere SHA-256, mas não assinatura.** O manifesto e o pacote vêm do mesmo servidor por HTTP: quem alterar um altera o outro. Assinar o manifesto (chave pública embutida no aplicativo) e assinar o executável.
- **Sem modo offline.** Se o SRVKART ou a rede caem, a Recepção para: não vende, não faz check-in. Falta ao menos consulta da agenda do dia em cache e fila local de vendas.
- **18 blocos `catch` vazios** nos dois projetos: erros somem sem registro.
- **Vários `HttpClient` criados a cada uso** (`Cadastros.cs:244`, `TelasAuxiliares.cs:105`, `Acoes.cs:407`): reaproveitar um só.
- **`Nullable` desligado** no projeto inteiro: erros de referência nula só aparecem em uso.
- **Arquivos grandes demais:** `FormPrincipal.cs` 1.518 linhas, `office.ts` 2.043, `grupos.ts` 1.591. Roteamento por `if (path === ...)` em sequência.
- **Servidor guarda estado só em memória:** bloqueio de login e contadores somem a cada reinício; fila de impressão em arquivo JSON apesar de existir a tabela `FilaImpressao`.
- **27 consultas montam SQL com texto interpolado.** As conferidas usam nomes de coluna de listas fixas e valores por parâmetro, então não achei injeção; mas `grupos.ts:1066` monta `IN (...)` com números direto no texto. Padronizar tudo por parâmetro.
- **Log em arquivo de texto local** em cada PC, sem rotação e sem envio central.
- **Números de migração repetidos** (`0010`, `0011`, `0012`, `0016` aparecem duas vezes).
- **Acessibilidade:** 90 nomes acessíveis definidos (bom), mas nenhum `TabIndex` — a ordem do Tab depende da ordem de criação dos controles.
- **Projeto da Recepção sem testes unitários** (`desktop/tests` cobre Comum, Cronometragem e Atualização). Regras de tela e de caixa só são cobertas pelo autoteste embutido.

## Funcionalidades que faltam

| Área | Falta | Observação |
|---|---|---|
| Fiscal | Emissão de NFC-e / NFS-e | Nenhuma referência no código. |
| Pagamento | Integração com a maquininha (TEF) | Hoje o operador digita o valor na máquina e de novo no sistema; erro de digitação não é detectado. |
| Pagamento | Pix com QR no balcão e baixa automática | Asaas já é usado na reserva online; falta no caixa. |
| Agenda | Lista de espera | Nenhuma referência. |
| Agenda | Registro de não comparecimento | Nenhuma referência; sem isso não há política nem estatística. |
| Vendas | Estoque e lanchonete/loja | Só produtos de corrida. |
| Caixa | Conferência cega, diferença e relatório de fechamento assinado | Ver item 6. |
| Gestão | Painel do dia: faturamento, ocupação por bateria, ticket médio, comparação com a semana anterior | Há relatórios, não há painel. |
| Gestão | Trilha de auditoria consultável | Ver item 7. |
| Cliente | Aviso automático por WhatsApp (confirmação, lembrete, resultado) | Hoje há link de WhatsApp, não envio automático. |
| Cliente | Exportar e apagar dados a pedido (LGPD) dentro da Recepção | Existe no aplicativo do cliente; conferir se a Recepção consegue atender o pedido no balcão. |
| Acesso | Segundo fator ou cartão/PIN para estorno, sangria e exclusão | Hoje basta estar logado. |
| Acesso | Bloqueio de tela por inatividade | Sessão vale 16 h e se renova. |
| Operação | Aviso na tela quando o servidor ou a impressora caem, com tentativa automática | Há indicador de conexão; impressão desiste após 10 tentativas sem alerta ao operador. |

## O que está bom

- Aplicativo fala só com a API; nenhum acesso direto ao banco a partir dos PCs.
- Dinheiro sempre em centavos inteiros no servidor (`cents()`), sem ponto flutuante.
- Vendas, estornos e reservas dentro de transação; estorno bloqueado com movimento fechado; sangria não passa do dinheiro em caixa; justificativa obrigatória.
- Um terminal por usuário e um usuário por terminal.
- Usuário SQL próprio da aplicação (`KartOpsSql`); a conta Windows de administração não entra no banco.
- Tratamento global de exceção com registro em arquivo; instância única; atualização com rollback.
- 386 `await` e só um `.GetResult()` (na inicialização): interface não trava em chamadas de rede.
- Design tokens compartilhados com o site; DPI tratado para o PC em 125 %.
- Autoteste embutido (telas, cliques, relatórios, roteiro de agenda) e 4 níveis de teste ponta a ponta.

## Ordem sugerida

1. Criar `OPS_SESSION_SECRET` e remover o texto fixo (item 1). Exige reinício do servidor (cerca de 10 s) e novo login de todos.
2. Publicar a 1.0.110 para a Recepção, ou confirmar por que ficou na 1.0.108.
3. Trilha de auditoria (item 7) e fechamento cego (item 6).
4. Permissões em todas as rotas (item 5) e sessão cancelável (item 4).
5. HTTPS interno e token de impressão de uso único (itens 2 e 3).
6. Migração para .NET 10 com `Nullable` ligado.
7. Pix no balcão e TEF; depois lista de espera, não comparecimento e painel do dia.
