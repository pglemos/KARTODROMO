# Pré-cadastro online e identificação nos totens

## Objetivo

Permitir que o cliente abra um link ou leia um QR code, preencha os dados pessoais usados pelo autoatendimento e, ao chegar ao kartódromo, recupere esses dados no Totem 1 ou 2 digitando CPF, RG, passaporte ou e-mail. O cliente ainda escolhe a bateria presencialmente, pelo fluxo atual.

O link permanente será `https://kartodromodebetim.com.br/pre-cadastro`. O QR code codifica somente esse endereço, sem dados pessoais ou identificadores do cliente.

## Estado atual e restrições

- O site público Next.js roda no Cloudflare Workers e usa D1 (`KARTODROMO_ADMIN_DB`).
- O serviço operacional roda na LAN em `SRVKART:4060` e grava clientes no SQL Server `KartodromoOps`.
- Os dois totens usam o mesmo serviço operacional. Há clientes WinForms e uma interface web de autoatendimento atendidos por esse serviço.
- O serviço operacional não pode ser exposto diretamente à internet. A integração pública deve terminar no Worker/D1.
- O autoatendimento coleta tipo de registro, tipo de documento, documento, nome, e-mail, telefone, nascimento, peso, CEP e endereço. O responsável também pode cadastrar menores com nome, nascimento e documento opcional.
- A interface do totem mostra Pessoa Física/Pessoa Jurídica, mas atualmente o serviço não persiste essa escolha. O sistema da recepção também descarta `tipoPessoa`. Este trabalho persistirá o tipo de pessoa de ponta a ponta.
- A bateria é selecionada somente depois do cadastro e não fará parte do formulário online.

## Abordagens consideradas

1. **Fila privada no D1 com sincronização iniciada pelo servidor local — escolhida.** O serviço da operação busca a fila por HTTPS de saída e cria registros pendentes locais. Mantém SQL fora da internet e permite que os totens continuem usando o banco operacional.
2. **Cloudflare Tunnel até um endpoint operacional restrito.** Reduz a latência da gravação, mas cria um caminho de entrada da internet até o servidor da operação e adiciona dependência operacional do túnel.
3. **Totem consultando D1 pela internet em cada identificação.** Evita a fila local, mas torna a identificação dependente da conexão externa e cria D1 como uma segunda fonte de dados em tempo real.

## Experiência do cliente

### Pré-cadastro no site

1. O cliente abre `/pre-cadastro` pelo link ou QR code, em uma página responsiva para celular.
2. O formulário oferece os dados compatíveis com o autoatendimento: tipo de pessoa (física ou jurídica), tipo de documento (CPF, RG ou passaporte), documento, nome completo, e-mail, celular/WhatsApp, data de nascimento, peso, CEP, endereço, bairro, cidade e UF. Endereço, número e complemento podem ser preenchidos separadamente e são mapeados para as colunas operacionais existentes.
3. O responsável pode incluir um ou mais menores com nome, nascimento e documento opcional. A relação com o responsável é mantida.
4. O formulário não pergunta bateria, horário, produto, pagamento, reserva nem participantes de uma corrida.
5. CPF/documento, nome, celular, nascimento e aceite do termo seguem as regras obrigatórias do totem. E-mail, peso e endereço permanecem opcionais conforme o fluxo atual. CEP pode preencher endereço via ViaCEP, com edição manual disponível.
6. O envio mostra uma confirmação genérica, sem dizer se um documento já existe. O cliente usa no totem o mesmo documento informado; a sincronização periódica e a busca autenticada sob demanda cobrem a chegada logo após o envio.

O site usa o mesmo texto de consentimento LGPD apresentado no totem e registra versão e data/hora do aceite. Não haverá edição pública de um cadastro já enviado por meio de conhecimento de CPF ou e-mail.

### Chegada ao kartódromo

1. A sincronização periódica busca novos envios; em uma identificação sem resultado local, o servidor pode fazer uma consulta autenticada sob demanda para cobrir envios recentes.
2. O serviço procura primeiro um cliente operacional pelo documento normalizado. Se não houver, procura um pré-cadastro pendente. A normalização remove pontuação, converte letras em maiúsculas e preserva letras e números; um passaporte como `AB123` nunca vira apenas `123`. CPF/RG/passaporte com resultados múltiplos não escolhem arbitrariamente um cliente: o totem pede o tipo de documento. A identificação por e-mail só é usada quando encontra um único perfil; se o e-mail for compartilhado/ambíguo, o totem pede documento.
3. O totem apresenta os campos preenchidos para conferência, sem bateria selecionada. O cliente pode corrigir os campos editáveis e segue para as etapas atuais de participantes e escolha da bateria.
4. Ao confirmar, o servidor promove o cadastro pendente a `dbo.Cliente`, cria os menores vinculados e encerra a pendência numa transação idempotente.
5. A mesma API atende os totens 1 e 2. A interface WinForms e a interface web de autoatendimento devem continuar compatíveis com o fluxo.

Se já houver um cliente no SQL com o mesmo documento, esse registro tem prioridade. O envio público nunca atualiza nem substitui automaticamente um cadastro operacional; o cliente usa o cadastro já existente e pode corrigi-lo pelo fluxo normal do totem.

## Arquitetura e componentes

### Site e Cloudflare D1

- Página pública Next.js em `/pre-cadastro` e endpoint de envio `POST /api/pre-cadastro`.
- Endpoint de sincronização protegido por segredo de servidor, nunca acessível pelo JavaScript do navegador: leitura em lote dos pendentes e confirmação/acknowledgement após gravação local.
- Tabela D1 de fila com UUID interno, índices HMAC de documento/e-mail, payload, versão/data do consentimento, estado e expiração. D1 não oferece busca pública por identificador.
- Endpoint separado de busca sob demanda, também autenticado, recebe identificador somente do servidor operacional, normaliza e consulta a fila sem expor resultado à página pública.
- A página mostra o QR code e permite imprimi-lo/baixá-lo em SVG; `GET /pre-cadastro/qr.svg` sempre codifica o link permanente.

### Servidor operacional e SQL local

- O serviço operacional inicia uma rotina de sincronização de saída a cada 15 segundos, configurável, e usa leitura sob demanda quando uma identificação local não encontra cliente ou pré-cadastro.
- Novas tabelas de staging guardam o perfil do responsável e dependentes, UUID interno, índices de documento/e-mail, data de expiração e estado. Uma chave única pelo UUID do pedido torna repetição segura.
- O servidor grava o staging antes de confirmar o pedido ao Worker. Se a gravação falhar, não confirma o item e o Worker o entrega novamente.
- Antes de criar staging, o serviço compara o documento normalizado com clientes operacionais. Se já existir cliente, preserva o cadastro operacional e confirma a remoção do payload da fila sem importar a cópia pública.
- Enquanto houver uma pendência para o mesmo documento, o primeiro envio válido permanece; envios posteriores recebem a mesma resposta genérica, não substituem a pendência e não criam outra.
- Segredo de sincronização configurado fora do repositório no Worker e no `.env.local` do servidor operacional. A sincronização usa HTTPS, comparação de segredo em tempo constante e não registra payload ou identificadores em logs. A chave HMAC usada para indexar identificadores fica somente no Worker.
- Rotas públicas de cadastro não podem usar as rotas privadas de sincronização. O SQL Server não recebe conexão da internet.

### API e aplicações dos totens

- `POST /api/totem/identificar` preserva a busca operacional existente e passa a reconhecer staging local e a alternativa remota autenticada.
- A busca ativa em `dbo.Cliente` ganha coluna indexada de documento normalizado, preenchida para dados existentes. O resultado deixa de usar `TOP 1` para colisões de documento/e-mail: solicita tipo de documento/documento quando houver mais de um perfil possível.
- A resposta distingue cadastro operacional de pré-cadastro e inclui um token assinado com escopo e expiração para impedir que o cliente confirme outro pedido.
- Um endpoint de confirmação promove a pendência e seus dependentes de forma transacional; tentativas repetidas retornam o mesmo cliente criado, sem duplicar registros.
- As interfaces WinForms e web exibem a origem “Pré-cadastro online”, preenchem os campos e mantêm as validações, revisão e seleção de bateria atuais.
- `tipoPessoa` será persistido no SQL, incluído nos contratos operacionais e preservado pela recepção e pelos totens. A migração dá `Pessoa Física` como padrão aos cadastros antigos sem esse campo; os tipos de documento continuam CPF, RG e passaporte. Este escopo não adiciona CNPJ nem muda as regras de identificação solicitadas.

## Privacidade, segurança e retenção

- HTTPS para página, APIs e sincronização. Segredos de sincronização fora do Git e sem reutilizar credenciais publicadas em chat.
- Cloudflare Turnstile e limite de frequência contra envio automatizado, validação de todos os campos no servidor, limite de payload e resposta idêntica para novo envio e envio duplicado; a resposta nunca confirma se CPF/e-mail já existe.
- D1 armazena dados apenas enquanto aguardam importação; após o staging local ser confirmado, o payload é apagado. Pendências não importadas expiram em até 30 dias.
- SQL local remove dados de staging não confirmados após 30 dias. Ao promover cadastro, os dados passam às tabelas operacionais conforme o ciclo existente.
- Logs registram UUID interno, resultado e falha técnica, sem CPF, e-mail, telefone, endereço, payload ou segredo.
- Consentimento LGPD é explícito no site. Menores só são incluídos sob cadastro e consentimento do responsável.

## Erros e recuperação

- Se D1 ou a internet estiver indisponível, o site informa que não conseguiu enviar e mantém os dados no formulário para nova tentativa.
- Se a sincronização de saída falhar, o item permanece na fila e é repetido de forma idempotente; a consulta sob demanda cobre o caso em que o cliente chega antes do próximo ciclo.
- Se a conexão externa falhar no totem e não houver staging local, o totem informa indisponibilidade do pré-cadastro e permite tentar novamente ou seguir o cadastro manual atual.
- Documento inválido, formulário incompleto, token expirado ou indisponibilidade resultam em mensagem de ação. Envio duplicado recebe a mesma confirmação genérica e não substitui a primeira pendência; não há consulta pública de status por CPF/e-mail.
- Uma falha ao promover o pedido mantém o staging para nova tentativa; não cria apenas parte do responsável/dependentes.

## Verificação e critérios de aceite

1. O link canônico abre o formulário em celular e desktop; o QR SVG decodifica exatamente para `https://kartodromodebetim.com.br/pre-cadastro`.
2. As validações web e server-side cobrem campos obrigatórios, CPF, datas, e-mail, telefone, consentimento, menores e payload malformado.
3. API pública não consegue ler pendentes; endpoint de sincronização rejeita chamada sem segredo; erros e logs não incluem dados pessoais.
4. Repetir sincronização, leitura sob demanda ou confirmação não duplica cliente ou dependente. Cadastro operacional existente vence sem ser sobrescrito.
5. CPF, RG, passaporte alfanumérico e e-mail único encontram o pré-cadastro tanto no Totem 1 quanto no Totem 2. Documentos com prefixo alfanumérico não colidem com seu sufixo numérico; documento/e-mail ambíguo pede desambiguação e nunca retorna um perfil arbitrário.
6. O totem apresenta o perfil e dependentes, permite conferência/edição suportada, e só apresenta bateria nas etapas presenciais atuais.
7. Formulário público, aplicações WinForms/web do totem e recepção preservam `tipoPessoa` após fechar e reabrir cadastro.
8. Teste ponta a ponta usa registros claramente identificados como `TESTE CODEX`, valida fila, SQL, ambos os clientes de totem, reserva/bateria não selecionada no site e promoção no totem; ao final, remove os registros de teste de D1 e SQL.
9. Migrações D1 e SQL são repetíveis; falha no deploy/Worker ou servidor local não perde pendências nem corrompe clientes existentes.

## Fora de escopo

- Escolha de bateria, horário, produto, reserva, pagamento ou assinatura do termo de corrida no site.
- Alteração automática de clientes operacionais já existentes a partir de formulário público.
- CNPJ como documento de identificação, autenticação por SMS/e-mail ou gestão pública de cadastros existentes.
- Exposição direta do SQL Server ou do servidor operacional à internet.
