# Auditoria logada — Reserva Online Granja Viana (KGV)

Data: 10/11/2026. Conta do Pedro (ID 255356), logada no Chrome. Auditoria **somente leitura**: nada foi reservado, pago, cancelado, convidado ou editado. Complementa [granja-viana-reservas-2026-11-10.md](granja-viana-reservas-2026-11-10.md).

Stack: SPA React (Vite) em `/reservaonline/`, backend PHP/Scriptcase em `/kgv/reserva_online/*` + serviços REST (`checkout`, `participant`, `checkin`). Alertas com SweetAlert2. Rastreamento: GTM, GA4, Google Ads, pixel OpenAI. `noindex`.

---

## 1. Estrutura geral (tela única + modais)

Tudo acontece numa página; cada menu abre um modal.

**Cabeçalho:** logo · seletor de idioma (bandeira BR/EN) · tema claro/escuro · Início · Consultar Pontos · Meu Perfil · Alterar Senha · Minhas Reservas · Minhas Corridas · Sair.

**Faixa de aviso vermelha** (texto vindo do backend, `getTextoAvisoReservaOnline`), editável pela operação sem deploy. Conteúdo atual:
- programa de pontos descontinuado em 01/01/2026;
- reserva **sempre no nome do piloto** (menor = dados do menor, não do responsável) para não travar no check-in;
- documento do menor obrigatório no check-in;
- preço exibido **sem** taxa de processamento;
- "desconto na taxa: 40% a partir de 10 participantes".

**Corpo:** calendário à esquerda (mês, setas, botão atualizar, dias sem horário em cinza, legenda) + lista de horários à direita.
- Saudação "Bem-vindo, NOME" + saldo de pontos.
- Botão **Compartilhar** (link da data) e chave **Ocultar indisponíveis**.
- Cada horário: produto (KART RENTAL 20/25 MIN), hora, **nº de vagas**, selo "Bateria aberta" / "(Bateria fechada)", preço, botão Reservar (cinza se indisponível).

## 2. Telas e fluxos

### 2.1 Consultar Pontos
Modal com botão "Consultar Pontos" → "Nenhum ponto disponível". Programa desativado, mas a tela continua (legado).

### 2.2 Meu Perfil
- **Identificação:** ID, Tipo de Cliente (Consumidor Final), Origem (como conheceu).
- **Dados pessoais:** Nome, País, Nacionalidade, CPF, E-mail, Nascimento, RG, Sexo.
- **Contato:** celular, residencial, comercial.
- **Endereço:** CEP, rua, número, complemento, bairro, UF, cidade (com código IBGE oculto).
- Tudo só leitura até clicar **Editar Perfil**. Nome, País, CPF/Passaporte e e-mail ficam travados permanentemente, com aviso amarelo "por razões de segurança".

### 2.3 Alterar Senha
Senha atual · nova · confirmar, com checklist ao vivo: 8+ caracteres, maiúscula, minúscula, número. Mostrar/ocultar senha.

### 2.4 Minhas Reservas
- **Abas:** Baterias Abertas · Baterias Fechadas · Canceladas · Participando. Filtros: Todos / Pagos / Pendentes. Botão atualizar.
- **Card da reserva:** nº, data de criação, data/hora reservada (início–fim), situação da reserva, status do pagamento, pessoas, tipo (Aberta – Individual), produto, horário, valor unitário, total, valor pago, método.
- **Ações:** Pagar Agora · Gerenciar Participantes · Cancelar Reserva.
- Reserva real encontrada: **#119253**, 24/11 às 22:30, 10 pessoas, R$ 1.850, pendente.

### 2.5 Gerenciar Participantes ⭐ (principal diferencial)
- **KPIs:** total de participantes, pagos, pendentes, arrecadado (R$).
- **Botões:** "Irei participar" (o organizador ocupa uma vaga) · "Gerar Novos Convites".
- **Cada vaga:** nome ou "Aguardando cadastro", e-mail, valor (R$ 185), status, método de pagamento, **expiração do convite** (= horário da bateria).
- **Ações por vaga:** Copiar Link · WhatsApp · Enviar por e-mail · Remover.
- **Link do convite:** `/reservaonline/?invite=inv_<hash32>`, token opaco e único por vaga.
- **Pagamento individual:** cada participante tem valor e método próprios, ou seja, cada um pode pagar a sua parte.

### 2.6 Pagar Agora — bloqueio por termo ⭐
Antes de pagar, o sistema valida: "Você selecionou 10 pessoas, mas apenas 0 participantes aceitaram o termo. Para baterias abertas com múltiplos participantes, é obrigatório que todos aceitem o termo antes do pagamento."

Ou seja, o termo de todos vem **antes** do dinheiro. Pelo código JS, a tela de pagamento depois disso tem:
- PIX: QR com validade e reaproveitamento de cobrança já gerada;
- cartão crédito/débito com parcelas e juros;
- taxa de processamento (bruta/líquida/desconto);
- voucher;
- Garantia de Reagendamento;
- motivo de recusa do cartão.

### 2.7 Página do convite (visitante sem login)
- **Wizard em 3 etapas:** 1 Entrar → 2 Termo de Responsabilidade → 3 Concluir.
- **Card do convite:** produto, data, horário início–fim, nº de pessoas, "Grupo", **expira em**.
- Login ou "Não tem conta? Cadastre-se" na mesma tela.
- **Banner de cookies LGPD:** Aceitar tudo / Recusar não essenciais.
- Tema escuro por padrão nesse fluxo.

### 2.8 Minhas Corridas
Filtro por mês e ano (2024–2026) + "Mostrar canceladas". Vazio para esta conta. O código prevê resumo, corridas por ano/mês e distribuição por categoria.

### 2.9 Nova Reserva (clique em Reservar)
- **Resumo:** produto, data, início–fim, preço, vagas. "Logado como: e-mail".
- **Tipo de bateria:**
  - **Aberta:** "Reserva para 1 pessoa…", quantidade com − / + (máx. 10, limite por CPF), aviso "A reserva será criada agora. O pagamento será feito em Minhas Reservas".
  - **Fechada:** convites + termo, sem cobrança agora. Aparece **INDISPONÍVEL** quando o horário já tem gente.
- **Continuar** cria a reserva **pendente** (não testado).
- **Modelo:** primeiro cria a reserva, paga depois. Isso segura a vaga sem pagamento.

### 2.10 Check-in mobile
Endpoint `checkin_rest_service/config`. Pelo JS: janela de horário, GPS com precisão mínima, QR code no local, exige pagamento + termo, rate limit.

### 2.11 Termo (PDF)
Gerado com dados do cadastro. Inclui:
- regras de segurança e briefing;
- limite de 120 kg / 1,95 m;
- condições de saúde proibidas;
- opt-out de uso de imagem;
- LGPD;
- política de reembolso escalonada;
- assinaturas da locadora e do responsável.

O aceite tem validade em dias (`obterDiasValidade`) e é checado por `verificarTermo`.

## 3. Endpoints observados
`getCliente`, `getAnoExercicio`, `getTextoAvisoReservaOnline`, `onAgendamentos_sem_vaga`, `onConsultaPontosCliente`, `onMinhasReservas`, `onHistoricoVendas`, `verificarTermo`, `obterDiasValidade`, `getPaises/getEstados/getCidades/getOrigens`, `participant_rest_service/{participant_list,reservations_by_participant}`, `checkin_rest_service/config`, `checkout_rest_service/ping`.

## 4. Problemas de UX do KGV (não copiar)

| Problema | Por quê |
|---|---|
| Login obrigatório para ver/reservar | Atrito alto; nosso fluxo sem conta converte melhor. |
| Reserva pendente sem pagar | Grupo pode segurar 10 vagas sem pagar (#119253 está assim). Gera no-show e vaga presa. Nós seguramos com prazo + pagamento. |
| Preço sem taxa | Total só aparece no fim. Mostrar total final desde o início. |
| Tudo em modal, ESC não fecha | Sem URL por tela, ruim no celular e no botão voltar. |
| Menu com 8 botões coloridos | Poluição visual; pontos descontinuados ainda no menu. |
| Bloqueio de pagamento só aparece ao clicar | Melhor mostrar "0/10 aceitaram o termo" no card. |
| Aviso em CAIXA ALTA vermelho | Difícil de ler. |
| Pixel OpenAI + Ads no fluxo logado | Rever LGPD antes de copiar rastreamento. |

## 5. O que implementar em Betim (priorizado)

### P1
1. **Painel do organizador por reserva** (`/r/<código>`, sem senha, link mágico por WhatsApp/e-mail):
   - KPIs: total / cadastrados / pagos / arrecadado;
   - lista de vagas com status;
   - Copiar / WhatsApp / remover / trocar pessoa;
   - "Eu vou correr" para o organizador ocupar uma vaga.
   - Base: `0011_reserva_grupo.sql` + link `cadastro?r=`.
2. **Status por vaga no cadastro:** aguardando → cadastrado + termo aceito → check-in. Convite expira na largada.
3. **Aceite digital do termo no pré-cadastro**, com versão + validade em dias. Se a versão mudar, pede de novo. PDF com dados (o modelo do KGV serve de referência). Mostrar "X/Y aceitaram" no painel.
4. **Aviso operacional editável** (faixa no topo vinda do banco), sem deploy.
5. **Agenda:**
   - nº de vagas restantes;
   - selo aberta/fechada;
   - "Ocultar indisponíveis";
   - "Compartilhar data" (`?data=`).

### P2
6. **Pagamento dividido opcional:** cada piloto paga a sua vaga pelo link, com prazo. Hoje um paga tudo; manter como padrão.
7. **Minhas reservas por CPF + código:** ver, reenviar convites, cancelar conforme política.
8. **Política de reembolso escalonada** calculada automaticamente, igual ao termo KGV (7/2 dias aberta; 15/7 fechada).
9. **Voucher** no checkout (migração 0010 já existe), **desconto por quantidade**, **Garantia de Reagendamento** como add-on.
10. **Bateria fechada / evento empresa** com convites sem cobrança e faturamento.

### P3
11. Check-in no celular (GPS + QR na recepção) integrado ao totem.
12. "Minhas corridas" por CPF com tempos (já temos resultados).
13. Inglês; tema escuro.
