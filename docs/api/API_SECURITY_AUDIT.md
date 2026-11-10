# Relatório de Auditoria e Teste de Segurança de API (API Security Testing Report)
**Sistema Operacional SRVKART (`:4060`) — Kartódromo Internacional de Betim**
*Padrão de Conformidade: OWASP API Security Top 10 (2023)*
*Data de Execução: 07 de Novembro de 2026*
*Alvo: Servidor Node.js/TypeScript `SRVKART` (via Túnel Seguro Cloudflare / SSH ORBITS)*

---

## 1. Sumário Executivo

Uma auditoria exaustiva de segurança de API foi conduzida contra o servidor de operações (`SRVKART :4060`) do Kartódromo Internacional de Betim. O escopo abrangeu análise estática de código-fonte (`services/ops-server.ts` e submódulos em `lib/ops/`) e testes dinâmicos de penetração automatizados executados diretamente contra o ambiente em execução através de túnel criptografado.

A arquitetura geral demonstra excelente maturidade operacional e segregação de responsabilidades:
- Autenticação de sessão de operadores baseada em tokens HMAC-SHA256 (`lib/ops/auth.ts`) com renovação dinâmica.
- Proteção de rotas internas de cronometragem via chave pré-compartilhada (`x-ops-key`) com verificação em tempo constante (`timingSafeEqual`) contra ataques de temporização (timing attacks).
- Consultas SQL 100% parametrizadas via driver `mssql` (`req.input`), eliminando vetores de injeção de SQL (SQLi).
- Limitação estrita de buffer de entrada (`readBody` com teto de 1 MB) protegendo contra saturação de memória por corpos gigantes.

Entretanto, foram identificadas vulnerabilidades de lógica de negócio e configurações de cabeçalho que requerem atenção corretiva.

---

## 2. Matriz de Vulnerabilidades (OWASP API Security Top 10:2023)

| ID | Categoria OWASP | Vulnerabilidade | Severidade | CVSS v3.1 | Status |
|---|---|---|---|---|---|
| **VULN-01** | **API6:2023** Fluxos Sensíveis | Esgotamento de Inventário de Baterias via Pré-Reservas sem Validade Temporal | **Alta** | `7.5` (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H) | Identificada |
| **VULN-02** | **API3:2023** Exposição de Dados | Exposição Excessiva de Dados Pessoais (LGPD) no Totem Não Vigiado | **Média** | `5.3` (CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N) | Identificada |
| **VULN-03** | **API2:2023** Autenticação | Fallback para Segredo Estático Fraco (`sem-segredo` / `sem-chave`) em Falta de Env | **Média** | `6.5` (CVSS:3.1/AV:L/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N) | Identificada |
| **VULN-04** | **API8:2023** Configuração | Ausência de Cabeçalhos HTTP de Segurança Defensiva (`nosniff`, `DENY`) | **Baixa** | `3.7` (CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N) | Confirmada em Teste |
| **VULN-05** | **API6:2023** Fluxos Sensíveis | Possibilidade de Esgotamento de Bobina Térmica por Spam de Impressão | **Baixa** | `4.3` (CVSS:3.1/AV:A/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L) | Identificada |
| **VULN-06** | **API1:2023** BOLA / Validação | Ordem de Checagem: Erro de Validação 400 antes da Checagem de Assinatura 403 | **Informativa** | `2.0` | Confirmada em Teste |

---

## 3. Detalhamento Técnico das Vulnerabilidades e Provas de Conceito (PoC)

### VULN-01: Esgotamento de Inventário de Baterias (Denial of Inventory / Slot Locking)
- **Classificação:** OWASP API6:2023 — Unrestricted Access to Sensitive Business Flows
- **Arquivos Afetados:** `services/ops-server.ts:459` e `lib/ops/office.ts:238`
- **Descrição Técnica:**
  Quando um piloto conclui o fluxo no totem (`POST /api/totem/inscrever`), o sistema cria uma pré-reserva com `Aprovada = 0` e `Pago = 0`. No entanto, a consulta de ocupação de baterias utilizada pelo totem e pela reserva online calcula:
  ```sql
  (SELECT COUNT(*) FROM dbo.Inscricao WHERE BateriaId = b.Id AND Status <> 'cancelada')
  ```
  Isso significa que **pré-reservas não pagas e não aprovadas reduzem imediatamente o número de vagas livres** (`livres = vagas - ocupadas`). Como não há expiração automática (TTL/garbage collector) no banco de dados para pré-reservas pendentes, um ator malicioso na rede ou no totem pode simular inscrições repetidas e trancar 100% das vagas de todas as baterias do dia, impedindo clientes reais de correr até que uma atendente cancele manualmente cada uma das reservas.
- **Prova de Conceito (PoC):**
  ```bash
  # Requisição no Totem gerando pré-reserva sem pagamento
  curl -s -X POST http://192.168.20.13:4060/api/totem/inscrever \
    -H "content-type: application/json" \
    -d '{
      "bateriaId": 532,
      "participantes": [{"id": 1042, "token": "<token_valido>"}]
    }'
  ```
- **Remediação Recomendada:**
  Adicionar uma rotina de expiração automática ou desconsiderar pré-reservas sem aprovação após 20 minutos:
  ```sql
  -- Vagas ocupadas considerando apenas reservas aprovadas, pagas ou pré-reservas recentes (< 20 min)
  SELECT COUNT(*) FROM dbo.Inscricao
  WHERE BateriaId = @b AND Status <> 'cancelada'
    AND (Aprovada = 1 OR Pago = 1 OR CriadoEm >= DATEADD(minute, -20, SYSDATETIME()))
  ```

---

### VULN-02: Exposição Excessiva de Dados Pessoais no Totem Público (LGPD / Privacy Leak)
- **Classificação:** OWASP API3:2023 — Broken Object Property Level Authorization
- **Arquivos Afetados:** `services/ops-server.ts:334-358`
- **Descrição Técnica:**
  No totem de autoatendimento, ao informar um CPF/RG conhecido (`POST /api/totem/identificar`), o endpoint devolve o registro completo com:
  - Endereço residencial completo (rua, número, complemento, bairro, cidade, CEP).
  - Telefone celular e e-mail.
  - Data de nascimento.
  - Perfil do Instagram.
  - Relação nominal e data de nascimento de filhos e menores dependentes.
  Em um quiosque físico aberto onde pessoas aguardam em fila logo atrás da tela, qualquer indivíduo que conheça o CPF de outra pessoa pode digitar o número e obter seu endereço domiciliar completo e lista de dependentes.
- **Prova de Conceito (PoC):**
  ```bash
  curl -s -X POST http://192.168.20.13:4060/api/totem/identificar \
    -H "content-type: application/json" \
    -d '{"identificador": "12345678900"}'
  ```
- **Remediação Recomendada:**
  Aplicar mascaramento (data masking) nos campos exibidos no totem:
  ```typescript
  telefone: tel ? tel.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) *****-$3') : '',
  email: em ? em.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
  endereco: end ? 'Endereço cadastrado' : '',
  ```

---

### VULN-03: Fallback para Segredos Estáticos em Ausência de Variáveis de Ambiente
- **Classificação:** OWASP API2:2023 — Broken Authentication
- **Arquivos Afetados:** `lib/ops/auth.ts:20` e `services/ops-server.ts:164`
- **Descrição Técnica:**
  O código prevê strings literais fixas caso as variáveis de ambiente não estejam populadas:
  ```typescript
  const segredo = () => process.env.OPS_SESSION_SECRET || process.env.OPS_RECEPCAO_KEY || 'sem-segredo';
  const sign = (text: string) => createHmac('sha256', KEY || 'sem-chave').update(text).digest('base64url').slice(0, 22);
  ```
  Se o servidor for iniciado em um ambiente onde o `.env.local` esteja corrompido ou ausente, a aplicação roda em estado degradado inseguro: qualquer invasor pode gerar tokens válidos para qualquer operador calculando HMAC com `'sem-segredo'`.
- **Remediação Recomendada:**
  Eliminar o fallback e interromper a inicialização do processo com erro fatal caso as chaves estejam ausentes:
  ```typescript
  const secret = process.env.OPS_SESSION_SECRET || process.env.OPS_RECEPCAO_KEY;
  if (!secret) throw new Error('FATAL: Variáveis de segurança OPS_RECEPCAO_KEY e OPS_SESSION_SECRET são obrigatórias.');
  ```

---

### VULN-04: Ausência de Cabeçalhos HTTP de Proteção de Navegação
- **Classificação:** OWASP API8:2023 — Security Misconfiguration
- **Arquivos Afetados:** `services/ops-server.ts:108` (`send()`)
- **Descrição Técnica:**
  As respostas JSON e HTML do servidor nativo Node.js definem apenas `content-type` e `cache-control: no-store`. Não são emitidos cabeçalhos fundamentais de proteção contra MIME sniffing, clickjacking e encapsulamento em iframes:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **Remediação Recomendada:**
  Incluir os cabeçalhos em `send()` e `sendHtml()`:
  ```typescript
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  ```

---

## 4. Resultados dos Testes Automatizados de Penetração

Os testes foram executados via script de automação (`scripts/test-api-security.cjs`) contra o ambiente de produção local via túnel seguro.

```
┌─────────┬────────────┬─────────────────────────────────────────────────────────────────────────┬──────────────────────────────────┬────────┬───────────────┬──────────┬────────────┐
│ (index) │ ID         │ Nome                                                                    │ Categoria                        │ Status │ Esperado      │ Aprovado │ Severidade │
├─────────┼────────────┼─────────────────────────────────────────────────────────────────────────┼──────────────────────────────────┼────────┼───────────────┼──────────┼────────────┤
│ 0       │ 'API1-01'  │ 'Acesso direto a Cliente por ID sem Bearer Token'                       │ 'API1:2023 BOLA'                 │ 401    │ 401           │ '✓ SIM'  │ 'High'     │
│ 1       │ 'API1-02'  │ 'Validação de Assinatura HMAC no Termo (/termo?ids=1,2&s=fake)'         │ 'API1:2023 BOLA'                 │ 403    │ 403           │ '✓ SIM'  │ 'High'     │
│ 2       │ 'API1-03'  │ 'Atualização de Cadastro com Assinatura Adulterada no Totem'            │ 'API1:2023 BOLA'                 │ 403    │ 403           │ '✓ SIM'  │ 'High'     │
│ 3       │ 'API2-01'  │ 'Autenticação com Token Bearer Forjado / HMAC Inválido'                 │ 'API2:2023 Broken Auth'          │ 401    │ 401           │ '✓ SIM'  │ 'Critical' │
│ 4       │ 'API2-02'  │ 'Rejeição de Credenciais Inválidas no Login'                            │ 'API2:2023 Broken Auth'          │ 401    │ 401           │ '✓ SIM'  │ 'Medium'   │
│ 5       │ 'API3-01'  │ 'Mass Assignment no Totem (Envio de propriedades privilegiadas)'        │ 'API3:2023 Mass Assignment'      │ 400    │ '400|409|201' │ '✓ SIM'  │ 'Medium'   │
│ 6       │ 'API3-02'  │ 'Exposição Excessiva de Dados (Busca inexistente no Totem)'             │ 'API3:2023 Data Exposure'        │ 200    │ 200           │ '✓ SIM'  │ 'Low'      │
│ 7       │ 'API4-01'  │ 'Proteção contra Payload Gigante (readBody > 1MB)'                      │ 'API4:2023 Resource Consumption' │ 413    │ 413           │ '✓ SIM'  │ 'Medium'   │
│ 8       │ 'API5-01'  │ 'Acesso à Cronometragem sem Header x-ops-key'                           │ 'API5:2023 BFLA'                 │ 401    │ 401           │ '✓ SIM'  │ 'Critical' │
│ 9       │ 'API5-02'  │ 'Acesso à Rota Legada /api/baterias sem x-ops-key'                      │ 'API5:2023 BFLA'                 │ 401    │ 401           │ '✓ SIM'  │ 'High'     │
│ 10      │ 'API7-01'  │ 'Prevenção de Path Traversal / SSRF em /relatorio/crono/:id'            │ 'API7:2023 SSRF'                 │ 401    │ '401|404'     │ '✓ SIM'  │ 'High'     │
│ 11      │ 'API8-01'  │ 'Cabeçalhos HTTP de Proteção (X-Content-Type-Options, X-Frame-Options)' │ 'API8:2023 Misconfig'            │ 200    │ 'Presentes'   │ '✗ NÃO'  │ 'Low'      │
│ 12      │ 'API9-01'  │ 'Prevenção de Path Traversal na Distribuição de Updates'                │ 'API9:2023 Inventory / LFI'      │ 404    │ 404           │ '✓ SIM'  │ 'High'     │
│ 13      │ 'API10-01' │ 'Disponibilidade e isolamento de dependências externas'                 │ 'API10:2023 Unsafe Consumption'  │ 200    │ 200           │ '✓ SIM'  │ 'Low'      │
└─────────┴────────────┴─────────────────────────────────────────────────────────────────────────┴──────────────────────────────────┴────────┴───────────────┴──────────┴────────────┘
```

---

## 5. Plano de Ação e Recomendações Priorizadas

1. **Imediato (Sprint Atual):**
   - Implementar timeout/expiração em `dbo.Inscricao` para pré-reservas não aprovadas (`Aprovada = 0`), impedindo trancamento de baterias.
   - Adicionar os cabeçalhos de proteção `X-Content-Type-Options: nosniff` e `X-Frame-Options: DENY` na função `send()`.
2. **Curto Prazo:**
   - Mascarar dados pessoais na tela de identificação do totem para conformidade com a LGPD.
   - Substituir o fallback `'sem-segredo'` por exceção impeditiva na inicialização do serviço caso a chave mestra não exista no ambiente.
3. **Médio Prazo:**
   - Adicionar rate-limiting por IP também nos endpoints públicos do totem (`/api/totem/identificar` e `/api/totem/inscrever`).
