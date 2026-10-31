# DISPATCH LOG

## 2026-10-26T19:06:31Z
Você é o Project Orchestrator (teamwork_preview_orchestrator) encarregado de liderar e coordenar a auditoria, correção e validação ponta a ponta de todos os 39 itens de falhas, erros, vulnerabilidades e gargalos operacionais do sistema de autoatendimento do Kartódromo de Betim.

Seu diretório de trabalho é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/orchestrator_2
O arquivo fidedigno da solicitação original do usuário é: /Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/ORIGINAL_REQUEST.md (veja a seção sob o timestamp 2026-10-26T19:04:37Z).

Escopo e Requisitos:
R1. Impressão e Gestão de Termos de Responsabilidade (Itens 1 a 6):
- Desacoplar a fila de impressão da memória volátil do Node.js (filaImpressao: Impressao[]), persistindo os trabalhos no banco de dados (dbo.FilaImpressao ou tabela equivalente) para que reinícios do SRVKART :4060 não percam termos.
- Manter contingência de impressão caso o app da Recepção (.53) esteja fechado ou deslogado, registrando status claro no banco sem descarte automático e silencioso em 3 horas.
- Tratar a ausência de impressora local no totem: nunca tentar impressão local cega (ImprimirSilencioso) sem impressora válida configurada; exibir orientação na tela caso a impressão na recepção falhe.
- Eliminar o desperdício de bobina térmica na impressora TM-T20 da recepção ajustando o layout do termo para altura dinâmica/automática em vez de 297 mm fixos.
- Fornecer script/rotina de limpeza para as filas fantasmas legadas de spooler nos totens (EPSON TM-T20 Receipt).

R2. Segurança, Privacidade e LGPD (Itens 7 a 11):
- Proteger dados pessoais (PII) na tela pública de identificação (POST /api/totem/identificar): mascarar e-mail, telefone, documento e endereço, e não expor dados sensíveis ou dependentes menores na tela sem validação prévia.
- Substituir a associação frágil de reservas de grupo por IP de socket (identificadoNoTotem) e IPs hardcoded (192.168.20.161/.69) por identificação segura com token de sessão assinado ou identificador do totem configurável.
- Proteger o app Kiosk contra escape para a área de trabalho do Windows no teclado físico USB (bloquear combinações do sistema como Win, Alt+Tab, Ctrl+Esc via hook de teclado seguro).
- Incluir consentimento explícito e termos adequados de tratamento de dados de menores no fluxo de cadastro de dependentes.

R3. Validação de Dados e Cadastro no Totem (Itens 12 a 19):
- Tornar o Instagram opcional ou oferecer opção explícita "Não possuo Instagram" para não impedir clientes (crianças, idosos, turistas) de participarem da bateria.
- Flexibilizar campo de celular e máscara de telefone para aceitar números internacionais e turistas com passaporte.
- Harmonizar faixas de validação de peso entre o desktop (FormTotem.cs) e o servidor (cadastro-obrigatorio.ts).
- Preservar as colunas Numero e Complemento na tabela dbo.Cliente ao atualizar endereço pelo totem, evitando que sejam sobrescritas como NULL.
- Permitir edição assistida de nome e documento de cliente pré-existente e tratamento elegante para documentos duplicados (HTTP 409) sem perder dados já digitados.
- Corrigir a função Mascarar para manter a posição correta do cursor durante a edição, sem saltar sempre para o fim do texto.
- Parametrizar com segurança consultas SQL na rota de baterias do totem.

R4. Usabilidade, Hardware e Fluxo de Atendimento (Itens 20 a 27):
- Preservar a seleção dos participantes ao transitar entre as telas de seleção de menores e cadastro de novos menores.
- Validar a regra de responsável por menor: impedir que um menor corra sozinho sem responsável cadastrado e impedir avanço falso de responsável sem dependentes.
- Melhorar o temporizador de inatividade de 90 segundos: pausar/confirmar antes de fechar diálogos modais de alerta e termos LGPD; interceptar eventos de rolagem (mouse wheel) e toque.
- Tratar o foco adequadamente ao fechar o diálogo modal de termos LGPD.
- Manter conformidade com a regra do dono: totem sem teclado virtual padrão, mantendo foco constante nos campos para digitação no teclado USB e emitindo aviso caso o teclado não seja detectado.

R5. Regras de Baterias, Agendamento e Concorrência (Itens 28 a 33):
- Bloquear a pré-reserva de baterias cujo horário de início já passou (eliminar a tolerância indevida de -30 minutos em novas reservas no totem).
- Exibir mensagem clara e informativa quando uma bateria tiver vagas restantes, mas insuficientes para a quantidade de participantes do grupo.
- Exibir os horários e categorias de todas as baterias contratadas na tela de sucesso.
- Exibir com clareza o valor/preço de cada bateria e categoria (Light vs Super).
- Preparar suporte a pagamento autônomo (ex.: QR Code Pix dinâmico) para desafogar a fila da recepção.
- Tratar condição de corrida na reserva da última vaga com reatualização automática e amigável da grade.

R6. Infraestrutura, Deploy, Rede e Ciclo de Vida (Itens 34 a 39):
- Corrigir os erros de sintaxe no script scripts/apps/habilitar-admin-remoto-totem1.ps1 e assegurar a sincronização NTP no Totem 1.
- Reduzir o timeout do cliente HTTP do totem para faixas resilientes (ex.: 8–10 segundos) evitando congelamento da interface.
- Tornar assíncrona a verificação de atualizações desktop na inicialização (TratarInicioAsync) para evitar tela preta de abertura.
- Eliminar vazamentos de memória GDI (ContextMenuStrip.Dispose(), reaproveitamento de bitmaps do logo).
- Implementar pool de conexões e cancelamento de requisições sobrepostas no ViaCep.
- Garantir a persistência do atalho de inicialização automática no script de implantação remota (implantar-remoto.ps1).

Critérios de Aceite:
- Todos os testes TypeScript existentes e novos passam: npx vitest run.
- Checagem estrita de tipos do TypeScript sem erros: npx tsc --noEmit.
- Solução desktop compila com sucesso em Release: dotnet build desktop/Kartodromo.Desktop.sln -c Release.
- Autoteste visual do totem valida telas em 1366x768 e 1920x1080.
- Cumprimento absoluto das regras do dono (AGENTS.md): responder em pt-BR, não mexer no telão FormTV/--tv, app nativo Windows, totem sem teclado na tela por padrão, testes em produção apenas com "TESTE CODEX" e desfeitos, cronometragem no :4150.
