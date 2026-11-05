> **Substituído por `2026-10-31-app-operacional-prd.md` (PRD 2.0, aprovado pelo dono em 31/10/2026).** Mantido só como histórico.

# App Operacional do Kartódromo — Design

Substitui por completo o SorteioKarts 1.6 (`br.com.kartodromobetim.sorteio`). Data: 31/10/2026.

Legenda: **[dono]** decidido pelo dono do projeto. **[análise]** fato verificado no APK ou no código. **[escolha técnica]** decisão de quem escreveu este documento, ainda sujeita à revisão do dono.

## 1. Intenção

O sorteio hoje é uma ferramenta isolada, só para Android, que só funciona na rede local e não permite corrigir nada depois de gravar. O dono quer um **sistema operacional do kartódromo**, usado em tablet e celular por toda a operação: sorteio, lastro, troca de kart, equalização, punições e controle de prova. Tudo reflete na hora na cronometragem e na recepção, sem ninguém precisar avisar ninguém, e funciona dentro ou fora do kartódromo. [dono]

Sucesso é o pessoal do galpão trocar um kart no tablet e a cronometragem já estar certa, o diretor punir pelo app, o atrasado entrar sem refazer o sorteio dos outros, e o dono acompanhar tudo de longe. [dono]

Fracasso, mesmo que tecnicamente funcione:
- piloto não aprovado aparecendo para sortear;
- alterar o comportamento que já funciona na cronometragem;
- app dizer que aplicou uma punição ou troca que não chegou ao servidor;
- o caminho pela internet abrir alteração sem login.

## 2. Situação atual [análise]

- SorteioKarts 1.6: Kotlin/Compose, só Android, endereço local fixo por padrão `http://192.168.20.249:4050`. Usa `/healthz`, `/api/agenda`, `/api/agenda/:id/preparar`, `/api/sessions`, `/api/sessions/:id/sorteio`.
- **Causa do bug dos não aprovados:** `services/ops-server.ts:1005` devolve `aprovada` no grid, e `/api/agenda/:id/preparar` (`services/timing-server.ts:3302`) inclui todos os inscritos sem filtrar.
- **Causa do bug do atrasado:** `validarSorteio` trata mudança de lista como erro (`ListaMudouError`, HTTP 409), e o app manda refazer. Não há sorteio parcial nem colocação manual depois de gravado.
- Pela internet (`crono.kartodromodebetim.com.br`) o servidor só aceita leitura de uma lista fechada (`LEITURA_PELA_INTERNET`). Rotas destrutivas exigem rede local ou chave.
- O servidor já publica estado por SSE (`/api/events`) e já tem as operações de troca, penalidade, bandeira, passagens e equalização usadas pelo programa de cronometragem.

## 3. Regra central: paridade sem mudar a cronometragem [dono]

"Você não vai mudar nada do que já funciona." O app executa cada operação **pelos mesmos comandos, com as mesmas regras e os mesmos textos** do programa de cronometragem (`desktop/src/Kartodromo.Cronometragem`).

No servidor só se permite **acrescentar**: rotas novas, login, e a correção do filtro de aprovados, que o dono pediu. Nenhuma rota existente muda de contrato; o programa Windows, a recepção, o telão e o placar seguem funcionando sem atualização.

Antes de implementar, conferir por SSH (`ssh orbits`, somente leitura) se a versão em produção é a mesma do repositório. A produção é a referência.

## 4. Perfis [dono]

| Perfil | Pode |
|---|---|
| **Operação** | Sorteio, pista, galpão, diretor de prova e cronometragem, juntos |
| **Recepção** | Login separado. Aprovar pilotos e acompanhar o sorteio [escolha técnica] |
| **Dono/Gerência** | Vê tudo e faz tudo, de qualquer lugar |

- Cada pessoa tem usuário próprio, para o histórico mostrar quem fez cada ação. [escolha técnica]
- Dono/Gerência cria, bloqueia e redefine usuários dentro do app. [escolha técnica]
- Reaproveitar usuários e permissões da recepção/cronometragem se a análise mostrar que servem; caso contrário, cadastro novo só do app. Fica para quem construir.

## 5. Conexão [dono + escolha técnica]

- Funciona no Wi-Fi do kartódromo, em outro Wi-Fi e em 3G/4G. O app identifica o caminho sozinho e troca sem ação do usuário. [dono]
- O kartódromo tem dois links de internet, então a queda de internet no servidor não entra no escopo. [dono]
- **Local:** com o servidor alcançável na rede (`/healthz`), fala direto com `:4050`.
- **Fora:** API pública nova, em Cloudflare Worker, com login e permissão, seguindo pelo túnel já existente até o servidor. Só essa porta recebe alterações pela internet, com token do usuário e chave de serviço. O bloqueio atual de `LEITURA_PELA_INTERNET` continua igual para o resto.
- **Mesmo login** nos dois caminhos: na rede local o app também se identifica.
- **Tempo real:** conexão contínua (SSE/WebSocket), sem atualização periódica de tela; ao reconectar, busca o estado completo. Barra discreta mostra "Local", "Internet" ou "Sem conexão".
- **Atraso:** os tempos de volta seguem exatos em milésimos porque vêm da cronometragem. A chegada à tela depende da rede: dezenas de ms no Wi-Fi, cerca de 100 a 500 ms em 3G/4G. Metas a medir no aparelho real: até 200 ms local e 1 s em 4G, do comando à tela de outro aparelho. O dono pediu "sem lag"; a limitação física foi explicada a ele.

### Sem conexão nenhuma
- Pesos, conferências e rascunho de sorteio ficam salvos no aparelho e enviam ao voltar, sem duplicar (chave de idempotência).
- **Troca de kart, punição, bandeira e demais ações de prova não entram em fila:** o app mostra "não aplicado" e deixa repetir. Uma ação atrasada em prova pode ser pior que nenhuma.
- Duas pessoas agindo ao mesmo tempo: vale a verificação do servidor (como `kartAntes`/`nomeAntes`), e quem ficou desatualizado recebe aviso com o estado novo.

## 6. Funcionalidades

### 6.1 Sorteio
Mantém tudo o que o 1.6 faz [análise]:
- baterias da agenda e da cronometragem; preparar bateria;
- frota Light (karts 1–99, meta 90 kg) e Super (100+, meta 100 kg);
- karts em manutenção fora do sorteio; aviso de kart já usado pelo piloto, considerando programa e evento (`pilotosDoSorteio`);
- modos: todos de uma vez, um a um com aceitar/recusar e chamada do piloto, modo fiscal; agrupamento por kart e por nome;
- peso de 20 a 250 kg, lastro em peças de 5 kg e 2,5 kg, peso final;
- conferir, editar e descartar escala; gravar na cronometragem; compartilhar; ajuda de uso.

Novo [dono]:
- **Só aprovados:** só entra quem está com `aprovada = 1` na recepção. O bloqueio é no servidor, e não apenas na tela.
- **Atrasados:** quando a recepção aprova alguém depois do sorteio, aparece aviso "3 aprovados aguardando kart", sem mexer na tela de quem está operando. O operador escolhe:
  - **sortear só esses** entre os karts livres da frota; ou
  - **colocar manualmente** em um kart livre.
  Em ambos, o lastro é calculado e **os pilotos já sorteados não mudam**.
- **Editar depois de gravado:** trocar piloto de kart, retirar, recalcular lastro, sempre com histórico.
- **Aprovação retirada ou inscrição cancelada depois do sorteio:** avisa, e o operador decide retirar. Nunca sai sozinho. [escolha técnica]
- Kart que entra em manutenção depois do sorteio: avisa e sugere kart livre. [escolha técnica]

### 6.2 Troca de kart
Igual a `TrocarKart` (`FormCrono.Cadastros.cs:327`), usando `POST /api/sessions/:id/swap-kart` [dono + análise]:
- escolher piloto; ver kart atual, voltas e melhor volta; digitar ou tocar no kart novo;
- "Guardar as voltas" (padrão) ou "Ignorar" (padrão no Tabajara);
- kart novo que já passou como "Kart 12" tem as passagens levadas ao piloto;
- registro `kart-swap` com autor; confirmação com voltas e melhor volta;
- propagação nas baterias do mesmo programa, como o servidor já faz.
- Acréscimo no app: mostrar o lastro necessário no kart novo. [escolha técnica]

### 6.3 Diretor de prova
Pelas mesmas rotas do programa (`FormCrono.Penalidades.cs`):
- advertência (preta e branca), com kart atingido, curva e volta;
- penalidade de tempo; várias por piloto; retirar;
- bandeira preta/desclassificação; bandeiras por piloto (verde, amarela, vermelha, branca) e da bateria;
- reiniciar bateria e relargada;
- observações da prova.

### 6.4 Controle de prova e cronometragem
Paridade com os menus do programa:
- largar, bandeira quadriculada, encerrar, cancelar, editar bateria;
- ao vivo com voltas por kart;
- passagens: incluir manual, excluir, invalidar, validar, restaurar, atribuir a competidor, ajustes "posteriores deste kart", contar leitura ignorada;
- incluir e retirar volta, ajustar posição, registro do competidor;
- remontar pelo diário, transponder × competidor;
- resultado e envio por e-mail.

**Fora do app (ficam só no programa Windows):** decoder, painel LED, parâmetros do sistema, backups, configurações de e-mail, suporte remoto. Lidam com máquina local. [escolha técnica]

### 6.5 Equalização e karts
- Sessões de equalização: criar, editar, blocos por kart, redutor, ação da oficina, importar, finalizar, reabrir, metas e regras, pelas rotas `/api/equalizacao/*`. [dono]
- Ranking dos karts, ranking por peso.
- Situação da frota: disponível, em uso, manutenção; marcar kart quebrado com motivo. [escolha técnica]

### 6.6 Recepção
Lista de aprovação em tempo real e situação do sorteio de cada bateria. Não mexe em caixa nem cadastro, que seguem no programa da recepção. [escolha técnica]

### 6.7 Dono/Gerência
Painel ao vivo: baterias em andamento, sorteios, punições, trocas, frota. Histórico filtrável por pessoa, bateria e tipo. Gestão de usuários. Todas as ações dos outros perfis. [dono]

### 6.8 Transversal
- Histórico de cada ação: quem, quando, aparelho, caminho (local/internet), antes e depois. [escolha técnica]
- Avisos internos em tempo real: atrasado aprovado, kart quebrado, punição aplicada. Notificação push fica para depois da primeira versão. [escolha técnica]
- Ações que alteram prova pedem confirmação; ações destrutivas repetem o nome do piloto/kart.

## 7. Aparência [dono]

- React Native, Android e iOS, mesma base do app Kartódromo de Betim (Expo 57, Expo Router, em `PROJETOS/kartodromo-app-ios`): identidade, fontes, componentes e `motion.tsx`.
- Muitas animações e micro-reações: revelação do kart no sorteio, kart "caindo" no grid, contagem do lastro, confirmação ao trocar kart, retorno tátil.
- Layout pensado primeiro para **tablet no galpão**: botões grandes, luz forte, uso com luva e pressa; celular também suportado. Animação nunca atrasa operação; respeita "reduzir movimento". [escolha técnica]

## 8. Distribuição [escolha técnica]

App separado do app de clientes, em repositório próprio, com novo identificador. Não aparece para o público: TestFlight/distribuição privada na Apple e teste interno ou distribuição privada no Google. O caminho final de loja é decidido quando chegar a hora, considerando as regras de 12 testadores do Google.

O 1.6 continua em uso até a nova versão passar em bateria real; a troca é um aparelho por vez.

## 9. Segurança

- Senhas nunca guardadas em texto; token de curta duração, armazenamento seguro do aparelho, bloqueio de usuário imediato.
- Limite de tentativas no login e no uso da API.
- Credenciais enviadas por chat anteriormente não são usadas; os segredos ficam só nos cofres do Worker e do servidor.

## 10. Verificação

- Testes automáticos das regras novas: filtro de aprovados, atrasados sem alterar os já sorteados, permissão por perfil e idempotência.
- Testes de regressão provando que as rotas existentes respondem igual.
- Teste integrado com servidor em modo simulado (`SIMULATE`).
- Bateria real assistida no kartódromo antes de aposentar o 1.6, incluindo derrubar o Wi-Fi em plena prova e medir o atraso.

## 11. Decisões de construção [escolha técnica]

- **Camada nova no servidor:** o app usa rotas novas e autenticadas (`/api/app/v1/*`), nos dois caminhos, que chamam as mesmas funções das rotas atuais. As rotas atuais continuam iguais para o programa Windows; quem estiver no Wi-Fi e chamá-las diretamente não passa pelos perfis, como já ocorre hoje. Isolar essa rede é recomendação à parte. Na rede local, usar conexão criptografada se possível; se não for viável, usar a API pública mesmo dentro do kartódromo.
- **Filtro de aprovados:** vale na rota nova e em bateria vinda da recepção. Bateria criada direto na cronometragem não tem aprovação e não é filtrada. O 1.6 não muda e mantém o erro até ser aposentado.
- **Convivência:** durante a transição, uma bateria usa um app só (regra de operação); a verificação de lista do servidor recusa gravações desatualizadas.
- **Histórico:** ações do app têm usuário; ações do programa Windows aparecem com o autor que ele já grava, sem mudar o programa.
- **Produção diferente do repositório:** a primeira fase é conferir e alinhar o repositório à produção, sem publicar nada. Cada publicação no servidor pede autorização do dono e ocorre fora do horário de bateria.

## 12. Fica para quem construir

Bibliotecas, estrutura interna, forma de transporte em tempo real (SSE ou WebSocket), desenho exato da API pública, ordem das fases, e se a API pública entra no Worker existente ou em um novo.
