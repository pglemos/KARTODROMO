# Reservas — Kartódromo de Betim

Aplicação React/Vite para `https://reservas.kartodromodebetim.com.br`. A interface reúne data e horário, pilotos, cadastro do adulto responsável e revisão/pagamento em quatro etapas. No celular, a primeira data disponível aparece antes dos horários; o calendário completo pode ser expandido. O resumo permite revisar a corrida e o total.

Os dados, horários, preços, vagas, cobranças e confirmações vêm do serviço de produção existente. Não há agenda ou pagamento simulados no aplicativo. Pix usa exclusivamente o QR code e o código retornados pelo servidor; cartão abre a fatura HTTPS da Asaas. A confirmação só aparece no estado `confirmado`, recebido da API. `pago` continua aguardando a confirmação da recepção.

## Desenvolvimento e verificação

A partir de `website/`:

```sh
npm ci
npm run dev:reservations
npm run lint
npm run test:reservations
npm run build:reservations
npm run preview:reservations
```

`dev:reservations` encaminha `/api` ao serviço real. Não envie pedidos de teste ao serviço real sem seguir as regras de operação do repositório.

Para verificar a interface sem criar pedidos, deixe o preview local na porta 5174 e execute:

```sh
npm run qa:reservations
```

Os testes de navegador usam Chromium em `/usr/bin/chromium` e interceptam todos os endpoints `/api`. As respostas e pedidos são locais, identificados como TESTE CODEX. A fixture padrão é sintética e relativa à data atual. Opcionalmente, `RESERVATIONS_AGENDA_FIXTURE=/caminho/agenda.json` permite validar a apresentação de uma cópia da agenda pública. Os testes nunca enviam o formulário ao domínio real.

As verificações incluem 12 testes de validação/roteamento, 52 combinações de layout em 1440, 768, 390 e 320 px, 20 auditorias WCAG, dois fluxos completos e oito cenários de falha/capacidade. Os relatórios e screenshots ficam em `/tmp/kart-audit/reservations-new/`.

## Publicação

```sh
CLOUDFLARE_ACCOUNT_ID=<conta> CLOUDFLARE_API_TOKEN=<token> npm run deploy:reservations
```

O Worker `kartodromo-reservas-2026` serve somente os documentos `/`, `/reservar`, `/reservar/`, `/reservar.html`, `/index.html` e os assets `/booking-assets/*` e `/booking-media/*`. A ligação `LEGACY` chama diretamente o serviço de produção `kartodromo-cadastro` para todos os outros caminhos, incluindo agenda, criação e consulta de reservas, webhooks da Asaas, sincronização e assets antigos. Método, corpo, query string e cabeçalhos são preservados. O backend não é republicado a partir da cópia local.

Ative a rota Workers `reservas.kartodromodebetim.com.br/*` para `kartodromo-reservas-2026`. Essa rota tem precedência sobre o domínio personalizado existente, que continua associado a `kartodromo-cadastro`. O domínio `cadastro.kartodromodebetim.com.br` permanece no serviço original. Para reverter a interface, exclua somente a nova rota; o domínio personalizado volta a atender a aplicação original. Preserve o serviço e todas as credenciais/R2/webhooks existentes.

## Estados e proteção do fluxo

- A agenda é consultada novamente antes de criar um pedido. Alteração de preço exige nova revisão; falta de vagas retorna à seleção.
- O formulário impede envios simultâneos. Uma resposta de rede ambígua após POST interrompe novos envios e orienta atendimento, sem repetir o POST automaticamente.
- CPF, data real de nascimento, maioridade em Brasília, nome, celular, e-mail e peso opcional são validados. Os requisitos dos pilotos são separados dos dados do adulto comprador.
- O UUID do pedido é mantido no fragmento do link e no armazenamento local, sem guardar dados pessoais do formulário. Pedidos em andamento podem ser retomados. Os estados finais removem o UUID do armazenamento, preservando o link atual.
- A consulta usa backoff em falhas, evita sobreposição e atualiza ao retornar à aba ou recuperar conexão. Há mensagem visível quando a situação não pode ser verificada.
- O relógio usa a validade retornada pelo servidor. Vencimento do relógio não representa confirmação, ausência de cobrança ou reembolso; a tela aguarda a situação oficial.
- `pago_sem_vaga` encaminha à recepção, sem oferecer outro pagamento. Links de cartão aceitam somente HTTPS em `asaas.com` e subdomínios.
- A confirmação inclui código copiável, dados oficiais, chegada uma hora antes, mapa, impressão e arquivo de calendário. As mudanças de estado são anunciadas para leitores de tela.

Não há testes de cobrança real nesta entrega; os cenários financeiros são verificados por respostas locais da API. O serviço original permanece responsável por processamento e confirmação operacional.
