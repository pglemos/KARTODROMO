# Peso e e-mail obrigatórios — 11/10/2026

Cadastros presenciais novos e alterações de clientes exigem e-mail válido e peso positivo. A validação ocorre nas telas nativas e no servidor, impedindo que aplicativos anteriores gravem campos vazios. A edição do peso pela reserva também rejeita valores vazios ou inválidos.

No totem, os campos são obrigatórios inclusive para clientes já cadastrados. O cadastro de menor permite usar o e-mail do responsável. Para compatibilidade com totens anteriores, o servidor recupera o e-mail do responsável autenticado quando a versão antiga não envia esse campo. Pré-cadastros importados do site continuam podendo chegar incompletos para conferência presencial.

Versão desktop: **1.0.60**, aplicativos Autoatendimento e Recepção. A cronometragem e o telão não foram atualizados nesta correção. Configurações locais e impressoras foram preservadas.

Instalação confirmada por versão e hash: Totem 1 `.161` e Totem 2 `.69` com Autoatendimento aberto em 1.0.60; Recepção 1 `.53` com Recepção 1.0.60 instalada e sessão anterior preservada; Recepção 2 `.239` com Autoatendimento 1.0.60 aberto e Recepção 1.0.60 instalada (estava fechada antes da implantação). Os manifestos e ZIPs dos dois aplicativos foram publicados no SRVKART para atualização nas próximas aberturas.

Validação: 60 testes do servidor passaram; suíte de componentes C# passou, incluindo os novos casos de peso/e-mail; verificação TypeScript passou; os dois aplicativos compilaram. Autoteste visual do totem passou em 1366×768, 1920×1080 e emulação de escala 125%/150%. Em produção, requisições incompletas retornaram HTTP 400; cadastros TESTE CODEX válidos persistiram corretamente; tentativas de apagar campos foram bloqueadas; todos os cadastros de teste foram excluídos. Também foi verificado o cadastro de menor por uma requisição compatível com versões antigas.

As cópias anteriores dos arquivos do servidor e das instalações foram preservadas. Evidências e roteiro de implantação ficam fora do repositório em `C:\KARTODROMO\peso-email-20261011`.

Durante o reinício, o carregamento pela execução TypeScript não abriu a porta em tempo hábil, inclusive com os fontes anteriores. O servidor foi iniciado com uma compilação CJS dos mesmos fontes corrigidos, sem dependências externas embutidas. `/healthz`, SQL e cadastros foram verificados. A ação original da tarefa `Kartodromo Servidor` foi restaurada sem interromper o processo validado; a próxima inicialização usa novamente `services/ops-server.ts`. A compilação temporária fica em `services/ops-server-peso-email.cjs`. O reinício demorado deve ser considerado em manutenção futura.

Na recepção 1, o executável novo foi colocado no caminho instalado, mantendo o processo anterior aberto para preservar o atendimento. A validação no servidor já protege essa sessão; os asteriscos e avisos locais novos aparecem na próxima abertura. A cópia em uso está em `Kartodromo.Recepcao.exe.em-uso-1.0.59-peso-email`.
