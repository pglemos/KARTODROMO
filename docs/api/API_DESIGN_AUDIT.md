# Auditoria de Design de Interface e API (API & Interface Design Audit)
**Sistema Operacional SRVKART (`:4060`) — Kartódromo Internacional de Betim**
*Data da Auditoria: Novembro de 2026*
*Autor: Antigravity Agentic Architecture Core*
*Escopo: `services/ops-server.ts`, `lib/ops/*.ts`, `desktop/` apps WinForms, integrações web/mobile*

---

## 1. Visão Geral e Arquitetura do Sistema

O servidor da operação (`SRVKART :4060`) é o núcleo transacional e operacional do Kartódromo Internacional de Betim, tendo substituído integralmente o legado proprietário (LapTime / CalXPro) em setembro de 2026. Ele atende simultaneamente três categorias distintas de clientes:

1. **Aplicações Nativas Windows (.NET 8 WinForms em `desktop/`):**
   - **Recepção:** Réplica moderna do LapTime Office, operando com token de sessão Bearer emitido no login.
   - **Autoatendimento (Totens):** Aplicação de tela cheia sem teclado físico, operando em modo quiosque em rede isolada, com identificação rápida por CPF/RG e assinatura HMAC efêmera.
   - **Cronometragem:** Operação de pista e telão, integrando com o servidor de decodificação TranX MYLAPS `:4050`.
2. **Painel Web de Gestão:**
   - Interface web de gestão administrativa, telemetria de endurance, ranking de pilotos, monitoramento de conectividade de rede e controle de frotas/oficina.
3. **Serviços Externos e Integrações Web:**
   - Site institucional (`www.kartodromodebetim.com.br`) para inscrições de campeonatos e pré-cadastros online via QR code.
   - Motor de reservas online (`reservas.kartodromodebetim.com.br`) sincronizando pedidos e agenda em tempo real com conciliação bancária via gateway Asaas.

---

## 2. Princípios de Design e Análise da Lei de Hyrum (Hyrum's Law)

> *"Com um número suficiente de usuários de uma API, todos os comportamentos observáveis do seu sistema serão dependidos por alguém, independentemente do que você prometer no contrato."*

### 2.1 Acoplamento de Mensagens de Erro Textuais no Cliente
**Diagnóstico:**
No servidor (`services/ops-server.ts` e `lib/ops/office.ts`), os erros são emitidos primordialmente como strings literais de mensagens humanas:
```json
{ "error": "Bateria inválida." }
{ "error": "Sessão expirada, identifique-se de novo." }
```
As aplicações clientes WinForms (`desktop/Recepcao/` e `desktop/Autoatendimento/`) realizam comparações diretas de strings em caixas de diálogo e fluxos condicionais. Por exemplo, mensagens como `"Sessão expirada"` ou `"Já existe cadastro com esse documento"` disparam lógicas de redirecionamento de tela no totem.

**Risco:**
Qualquer refatoração textual ou internacionalização de mensagens quebra silenciosamente a lógica de controle de fluxo dos aplicativos de tela instalados nos PCs da pista.

**Recomendação Arquitetural:**
Padronizar a resposta de erro para conter obrigatoriamente um código de máquina imutável (`code`), preservando a mensagem legível (`message`) para exibição:
```json
{
  "error": {
    "code": "SESSION_EXPIRED",
    "message": "Sessão expirada, identifique-se de novo.",
    "details": null
  }
}
```

### 2.2 Dependência de Formatação Temporal de Brasília e DATETIME2 do SQL Server
**Diagnóstico:**
O servidor intencionalmente não trafega datas em padrão UTC padrão ISO-8601 (`Z`), mas sim representações locais sem fuso (`YYYY-MM-DDTHH:mm:ss`), convertidas diretamente do SQL Server via `CONVERT(varchar, x, 126)` ou geradas por `new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })`.

**Impacto:**
- **Lado Positivo:** Garante que a Recepção e os Totens, rodando em máquinas Windows locais sem NTP rigoroso, não sofram com ambiguidades de fuso horário (-03:00 vs UTC).
- **Lado Crítico:** Clientes web ou integrações futuras que usem parsers nativos como `new Date(str)` em navegadores de usuários fora do fuso de Brasília interpretarão o horário como local do usuário, gerando erros em relatórios e agendas.

---

## 3. Semântica REST e Contratos de Protocolo HTTP

### 3.1 Divergências de Métodos HTTP e Códigos de Status

| Rota | Método Atual | Comportamento Observado | Padrão REST Recomendado | Motivo / Gravidade |
|---|---|---|---|---|
| `POST /api/office/baterias/{id}/status` | `POST` | Atualiza status da bateria | `PATCH /api/office/baterias/{id}/status` | Operação de mutação parcial de recurso; POST é historicamente aceito para comandos RPC. |
| `POST /api/office/reservas/{id}/aprovar` | `POST` | Aprova reserva | `POST /api/office/reservas/{id}/aprovar` | RPC pragmático aceitável. |
| `POST /api/office/reservas/{id}/mover` | `POST` | Move piloto de bateria | `POST /api/office/reservas/{id}/mover` | RPC pragmático aceitável. |
| `POST /api/office/vendas/{id}/estorno` | `POST` | Estorna venda e títulos | `POST /api/office/vendas/{id}/estorno` | Transação financeira irreversível; POST idempotente via chave é o ideal. |
| `GET /termo` | `GET` | Retorna HTML e atualiza `TermoImpressoEm = SYSDATETIME()` | `GET` com efeito colateral em BD | Viola idempotência do método `GET`. Um robô ou pré-visualizador de link altera estado no banco. |
| `GET /api/office/impressao/proxima` | `GET` | Retorna job e altera `pegoEm` e incrementa `tentativas` | `POST /api/office/impressao/reservar` | Polling com efeito colateral em `GET`. |

> [!WARNING]
> O endpoint `GET /api/office/impressao/proxima` altera estado no servidor a cada requisição (atualiza timestamp `pegoEm` e incrementa contador de tentativas). Se um proxy reverso, antivírus ou extensão de navegador pré-carregar essa URL, o trabalho de impressão pode ser marcado como tentativa gasta sem que a impressora física tenha recebido os dados.

### 3.2 Consistência de Respostas de Erro (HTTP Status Codes)
A API utiliza com rigor a classe customizada `HttpError(status, message)`.
A distribuição dos códigos no código-fonte é coerente com boas práticas:
- `400 Bad Request`: Dados obrigatórios ausentes ou de tipo inválido (`int()`, `cents()`, `isoDate()`).
- `401 Unauthorized`: Token de sessão ausente, inválido ou expirado; chave `x-ops-key` inválida; credenciais de login incorretas.
- `403 Forbidden`: Token válido porém sem permissão (ex.: usuário comum tentando fechar dia sem a chave no parâmetro `office.usuariosSemFecharBateria`).
- `404 Not Found`: Recurso não localizado (cliente, bateria, venda, arquivo de atualização).
- `409 Conflict`: Conflito de unicidade de negócio (CPF duplicado, piloto já inscrito na equipe, bateria incompatível).
- `413 Payload Too Large`: Limite de corpo excedido (1 MB em `readBody`, limite de bytes em upload de fotos de pilotos).
- `429 Too Many Requests`: Proteção contra ataques de força bruta no login (10 tentativas com falha por IP = 15 minutos de bloqueio).
- `502 Bad Gateway`: Falha de comunicação upstream com o servidor da cronometragem (`TIMING_URL` `:4050`).

---

## 4. Validação nas Fronteiras do Sistema (Boundary Validation)

### 4.1 Estado Atual: Parsers Manuais Ad-hoc
No código atual, a validação de parâmetros e payload é feita por funções utilitárias pontuais:
- `int(v, nome, min = 1)`: Garante inteiro e dispara `HttpError(400)`.
- `cents(v, nome)`: Garante valor monetário inteiro positivo em centavos (máximo R\$ 1.000.000,00).
- `isoDate(v)`: Valida regex `^\d{4}-\d{2}-\d{2}$` e consistência do calendário.
- `localDateTime(v)`: Valida formato de hora local e adiciona segundos para DATETIME2.
- `str(v, max)`: Trunca ou normaliza string.
- `isValidCpf(v)`: Validação de dígito verificador módulo 11 de CPF brasileiro.

**Análise Crítica:**
- **Pontos Fortes:** Rápido, zero overhead de biblioteca, código enxuto e sem dependências pesadas de runtime, alinhado com a filosofia minimalista ("ponytail").
- **Vulnerabilidades:**
  1. **Mass Assignment em `POST /clientes` e `PUT /clientes/{id}`:** O objeto `dados` recebido no corpo é espalhado em `insertCliente({ ...dados })`. Se um cliente malicioso injetar propriedades como `Bloqueado = 0` ou manipular chaves internas, o comportamento depende exclusivamente da filtragem manual feita na query SQL.
  2. **Validação Parcial de JSON Arrays:** Arrays como `participantes` em `/api/totem/inscrever` são validados iterativamente em loops `for`, podendo falhar no meio do processamento após algumas operações já terem sido avaliadas.

### 4.2 Proposta de Validação por Contrato Formal (Zod / Typebox)
Para rotas críticas de escrita e checkout, recomenda-se formalizar schemas declarativos nas bordas:
```typescript
import { z } from 'zod';

export const ClienteCadastroSchema = z.object({
  nome: z.string().trim().min(3).max(120),
  tipoDocumento: z.enum(['CPF', 'RG', 'PASSAPORTE', 'OUTRO']).default('CPF'),
  documento: z.string().trim().min(5).max(30),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().email().optional().or(z.literal('')),
  telefone: z.string().min(10).max(20),
  instagram: z.string().max(50).optional(),
  peso: z.coerce.number().min(20).max(250).optional(),
  cep: z.string().max(10).optional(),
  endereco: z.string().max(200).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  estado: z.string().length(2).optional(),
});
```

---

## 5. Gerenciamento de Estado, Concorrência e Idempotência

### 5.1 Concorrência na Alocação de Vagas em Baterias (`/api/totem/inscrever`)
**Cenário Real:**
Em dias de grande movimento (sábados e domingos), pilotos simultâneos nos Totens 1 e 2 podem selecionar a última vaga disponível na mesma bateria ao mesmo tempo.

**Implementação Atual:**
O método `inscreverN` em `lib/ops/office.ts` calcula a quantidade de inscritos atuais via consulta agregada antes de inserir.
```sql
SELECT COUNT(*) FROM dbo.Inscricao WHERE BateriaId = @b AND Status <> 'cancelada'
```
**Risco de Condição de Corrida (TOCTOU - Time of Check to Time of Use):**
Se duas requisições lerem `ocupadas = 29` para uma bateria de 30 vagas simultaneamente, ambas passarão pela validação e realizarão o `INSERT`, resultando em 31 inscritos (overbooking não intencional de karts na pista).

**Remediação de Design:**
Executar a verificação e a inserção dentro de uma transação serializada ou com lock atômico condicional no SQL Server:
```sql
INSERT INTO dbo.Inscricao (BateriaId, ClienteId, Status, Origem, CriadoEm)
SELECT @bateriaId, @clienteId, 'ativa', @origem, SYSDATETIME()
WHERE (SELECT COUNT(*) FROM dbo.Inscricao WHERE BateriaId = @bateriaId AND Status <> 'cancelada') < @limiteVagas;
```
Se `@@ROWCOUNT == 0`, disparar `HttpError(409, 'A bateria acabou de lotar. Escolha outro horário.')`.

### 5.2 Fila de Impressão em Memória (`filaImpressao`)
**Diagnóstico:**
A fila de impressão térmica (`services/ops-server.ts:236`) é armazenada em memória no processo Node.js:
```typescript
type Impressao = { id: number; url: string; titulo: string; origem: string; criadoEm: number; pegoEm?: number; feitaEm?: number; tentativas: number };
const filaImpressao: Impressao[] = [];
```
**Vantagens do Design:**
- Velocidade extrema: latência sub-milissegundo para os totens e o app da Recepção.
- Simplicidade operacional: sem necessidade de Redis ou serviço externo de mensageria.

**Fragilidades Observadas:**
- Em caso de reinício do serviço no SRVKART (por exemplo, após deploy ou atualização automática), os termos que foram enfileirados nos últimos minutos e ainda não impressos são perdidos da memória.
- **Mitigação Existente:** A recepção possui telas para reimprimir termos sob demanda (`/termo?ids=...`).
- **Evolução Recomendada:** Persistir o estado da fila em tabela SQL (`dbo.FilaImpressao`) com retenção de 24 horas, mantendo cache em memória para polling de alta velocidade.

---

## 6. Governança e Evolução dos Contratos de Interface

### 6.1 Regra de Versão Única (The One-Version Rule)
A operação do kartódromo não possui suporte a múltiplas versões legadas simultâneas de API com rotas bifurcadas como `/v1/`, `/v2/`.
Os clientes Windows nativos atualizam-se automaticamente via canal `/updates/{app}/manifest.json` assim que uma nova versão é publicada.
**Diretriz:**
- Estender interfaces de forma aditiva: novos campos opcionais nos responses e payloads.
- Jamais renomear ou remover campos existentes em rotas consumidas pelos aplicativos instalados (`desktop/`).

---

## 7. Sumário de Recomendações Priorizadas

| Prioridade | Área | Ação Recomendada | Impacto |
|---|---|---|---|
| **P1 (Alta)** | Concorrência | Lock atômico na alocação de vagas da bateria para evitar overbooking em totens simultâneos | Evita conflitos de karts na pista em dias de pico |
| **P1 (Alta)** | Idempotência | Mover efeito colateral de gravação de data de impressão para fora de `GET /termo` | Conformidade com RFC 9110 e proteção contra pré-buscas |
| **P2 (Média)** | Semântica | Estruturar payload de erros com `code` imutável em conjunto com `message` | Desacopla regras de tela das strings de texto |
| **P2 (Média)** | Validação | Adicionar schema de higienização de payload em `POST /clientes` contra mass assignment | Proteção dos dados cadastrais de pilotos |
| **P3 (Baixa)** | Impressão | Persistência transitória da fila térmica em tabela SQL para tolerância a reinício | Zero perda de trabalhos de impressão em reboots |
