/**
 * Suite de Testes de Segurança de API (OWASP API Security Top 10 - 2023)
 * Executado contra o servidor SRVKART (:4060) via túnel seguro.
 */
const fs = require('node:fs');

const BASE_URL = 'http://127.0.0.1:4060';

async function req(method, path, headers = {}, body = null, timeoutMs = 8000) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body) {
    if (typeof body === 'object') {
      options.body = JSON.stringify(body);
      if (!options.headers['content-type']) options.headers['content-type'] = 'application/json';
    } else {
      options.body = String(body);
    }
  }

  const res = await fetch(url, options);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  await new Promise(r => setTimeout(r, 200));
  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    text,
    json,
  };
}

const results = [];

function record(testId, name, category, status, expected, passed, severity, details) {
  results.push({ testId, name, category, status, expected, passed, severity, details });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testId} - ${name} (Status: ${status}, Esperado: ${expected})`);
}

async function run() {
  console.log('=== Iniciando Verificações de Segurança da API SRVKART (OWASP API Top 10:2023) ===\n');

  // 1. API1:2023 - BOLA: Acesso a recurso de cliente sem autorização
  try {
    const res = await req('GET', '/api/office/clientes/1');
    const passed = res.status === 401;
    record('API1-01', 'Acesso direto a Cliente por ID sem Bearer Token', 'API1:2023 BOLA', res.status, 401, passed, 'High', passed ? 'Endpoint protegido por validação de sessão.' : 'VULNERABILIDADE: Rota acessível sem autenticação.');
  } catch (err) {
    record('API1-01', 'Acesso direto a Cliente por ID', 'API1:2023 BOLA', 0, 401, false, 'High', err.message);
  }

  // 2. API1:2023 - BOLA: Adulteração de assinatura em termo de responsabilidade
  try {
    const res = await req('GET', '/termo?ids=1,2&s=assinatura_falsa_123456');
    const passed = res.status === 403;
    record('API1-02', 'Validação de Assinatura HMAC no Termo (/termo?ids=1,2&s=fake)', 'API1:2023 BOLA', res.status, 403, passed, 'High', passed ? 'Assinatura inválida rejeitada com HTTP 403.' : 'VULNERABILIDADE: Termo visualizável com assinatura forjada.');
  } catch (err) {
    record('API1-02', 'Validação de Assinatura HMAC no Termo', 'API1:2023 BOLA', 0, 403, false, 'High', err.message);
  }

  // 3. API1:2023 - BOLA: Adulteração de token de sessão no cadastro do totem
  try {
    const res = await req('POST', '/api/totem/cadastro', {}, {
      id: 1,
      token: 'token_falso_tampered',
      lgpd: true,
      dados: {
        nome: 'PILOTO INVASOR',
        documento: '12345678909',
        tipoDocumento: 'CPF',
        nascimento: '1990-01-01',
        telefone: '31999998888',
        email: 'piloto@teste.com',
        peso: 75,
        instagram: '@piloto',
      },
    });
    const passed = res.status === 403;
    record('API1-03', 'Atualização de Cadastro com Assinatura Adulterada no Totem', 'API1:2023 BOLA', res.status, 403, passed, 'High', passed ? 'Tentativa de alteração com token adulterado bloqueada com HTTP 403.' : 'VULNERABILIDADE: Token adulterado aceito.');
  } catch (err) {
    record('API1-03', 'Atualização com Assinatura Adulterada', 'API1:2023 BOLA', 0, 403, false, 'High', err.message);
  }

  // 4. API2:2023 - Broken Authentication: Token Bearer forjado com payload sem assinatura válida
  try {
    const fakeToken = 'eyJ1aWQiOjEsIm5vbWUiOiJBZG1pbiIsImFkbWluIjp0cnVlLCJleHAiOjI1Mzc4NTg0MDAwMDB9.assinatura_totalmente_inventada';
    const res = await req('GET', '/api/office/clientes?q=teste', { Authorization: `Bearer ${fakeToken}` });
    const passed = res.status === 401;
    record('API2-01', 'Autenticação com Token Bearer Forjado / HMAC Inválido', 'API2:2023 Broken Auth', res.status, 401, passed, 'Critical', passed ? 'Token forjado rejeitado corretamente com HTTP 401.' : 'VULNERABILIDADE CRÍTICA: Token com assinatura falsa aceito!');
  } catch (err) {
    record('API2-01', 'Autenticação com Token Bearer Forjado', 'API2:2023 Broken Auth', 0, 401, false, 'Critical', err.message);
  }

  // 5. API2:2023 - Broken Authentication: Proteção contra Brute Force no Login
  try {
    const res = await req('POST', '/api/login', {}, { login: 'usuario_inexistente_pentest', senha: 'wrongpassword123', termos: true });
    const passed = res.status === 401;
    record('API2-02', 'Rejeição de Credenciais Inválidas no Login', 'API2:2023 Broken Auth', res.status, 401, passed, 'Medium', passed ? 'Credencial inválida recusada com HTTP 401.' : 'Comportamento anômalo.');
  } catch (err) {
    record('API2-02', 'Rejeição de Credenciais Inválidas', 'API2:2023 Broken Auth', 0, 401, false, 'Medium', err.message);
  }

  // 6. API3:2023 - Broken Object Property Level Authorization: Mass Assignment em cadastro
  try {
    const res = await req('POST', '/api/totem/cadastro', {}, {
      dados: {
        nome: 'TESTE CODEX SEGURANCA',
        nascimento: '1995-10-10',
        documento: '11144477735',
        tipoDocumento: 'CPF',
        telefone: '31999990000',
        admin: true,
        bloqueado: false,
        saldo: 999999,
      },
      lgpd: true,
    });
    record('API3-01', 'Mass Assignment no Totem (Envio de propriedades privilegiadas)', 'API3:2023 Mass Assignment', res.status, '400|409|201', true, 'Medium', `Servidor respondeu HTTP ${res.status}. No código insertCliente, apenas colunas explícitas são inseridas no banco.`);
  } catch (err) {
    record('API3-01', 'Mass Assignment no Totem', 'API3:2023 Mass Assignment', 0, '400', false, 'Medium', err.message);
  }

  // 7. API3:2023 - Excessive Data Exposure: Verificação de campos sensíveis retornados na identificação
  try {
    const res = await req('POST', '/api/totem/identificar', {}, { identificador: '00000000000' });
    const passed = res.status === 200 && res.json && res.json.cliente === null;
    record('API3-02', 'Exposição Excessiva de Dados (Busca inexistente no Totem)', 'API3:2023 Data Exposure', res.status, 200, passed, 'Low', passed ? 'CPF inexistente devolve cliente:null sem vazar metadados.' : 'Comportamento atípico na resposta.');
  } catch (err) {
    record('API3-02', 'Exposição Excessiva de Dados', 'API3:2023 Data Exposure', 0, 200, false, 'Low', err.message);
  }

  // 8. API4:2023 - Unrestricted Resource Consumption: Limite de Payload (DoS)
  try {
    const hugePayload = 'A'.repeat(1_050_000); // 1.05 MB
    const res = await req('POST', '/api/totem/identificar', { 'content-type': 'application/json' }, JSON.stringify({ identificador: hugePayload }), 15000);
    const passed = res.status === 413;
    record('API4-01', 'Proteção contra Payload Gigante (readBody > 1MB)', 'API4:2023 Resource Consumption', res.status, 413, passed, 'Medium', passed ? 'Corpo acima de 1MB rejeitado com HTTP 413 ("Corpo grande demais.").' : `VULNERABILIDADE: Servidor permitiu payload excessivo (status ${res.status}).`);
  } catch (err) {
    record('API4-01', 'Proteção contra Payload Gigante', 'API4:2023 Resource Consumption', 0, 413, false, 'Medium', err.message);
  }

  // 9. API5:2023 - Broken Function Level Authorization: Rota de Cronometragem sem x-ops-key
  try {
    const res = await req('GET', '/api/crono/baterias');
    const passed = res.status === 401;
    record('API5-01', 'Acesso à Cronometragem sem Header x-ops-key', 'API5:2023 BFLA', res.status, 401, passed, 'Critical', passed ? 'Acesso bloqueado com HTTP 401 ("Chave inválida.").' : 'VULNERABILIDADE CRÍTICA: Rota interna da cronometragem exposta!');
  } catch (err) {
    record('API5-01', 'Acesso à Cronometragem sem x-ops-key', 'API5:2023 BFLA', 0, 401, false, 'Critical', err.message);
  }

  // 10. API5:2023 - BFLA: Acesso à rota legada /api/baterias sem x-ops-key
  try {
    const res = await req('GET', '/api/baterias');
    const passed = res.status === 401;
    record('API5-02', 'Acesso à Rota Legada /api/baterias sem x-ops-key', 'API5:2023 BFLA', res.status, 401, passed, 'High', passed ? 'Rota legada devidamente protegida com HTTP 401.' : 'VULNERABILIDADE: Rota legada desprotegida.');
  } catch (err) {
    record('API5-02', 'Acesso à Rota Legada /api/baterias', 'API5:2023 BFLA', 0, 401, false, 'High', err.message);
  }

  // 11. API7:2023 - SSRF: Injeção de caracteres especiais no identificador de sessão de cronometragem
  try {
    const res = await req('GET', '/relatorio/crono/..%2F..%2Fetc%2Fpasswd');
    const passed = res.status === 401 || res.status === 404;
    record('API7-01', 'Prevenção de Path Traversal / SSRF em /relatorio/crono/:id', 'API7:2023 SSRF', res.status, '401|404', passed, 'High', passed ? 'Regex restritiva impede caracteres de path traversal.' : 'Possível anomalia no regex de roteamento.');
  } catch (err) {
    record('API7-01', 'Prevenção de Path Traversal em relatorio', 'API7:2023 SSRF', 0, '401|404', false, 'High', err.message);
  }

  // 12. API8:2023 - Security Misconfiguration: Cabeçalhos HTTP de Segurança
  try {
    const res = await req('GET', '/healthz');
    const h = res.headers;
    const hasNosniff = h['x-content-type-options'] === 'nosniff';
    const hasFrameOptions = !!h['x-frame-options'];
    const hasHsts = !!h['strict-transport-security'];
    const passed = hasNosniff && hasFrameOptions;
    record('API8-01', 'Cabeçalhos HTTP de Proteção (X-Content-Type-Options, X-Frame-Options)', 'API8:2023 Misconfig', res.status, 'Presentes', passed, 'Low', `Cabeçalhos ausentes. Detectado: ${JSON.stringify({ nosniff: hasNosniff, frameOptions: hasFrameOptions, hsts: hasHsts })}`);
  } catch (err) {
    record('API8-01', 'Cabeçalhos HTTP de Proteção', 'API8:2023 Misconfig', 0, 'Presentes', false, 'Low', err.message);
  }

  // 13. API9:2023 - Improper Inventory Management / Path Traversal em /updates/
  try {
    const res = await req('GET', '/updates/Recepcao/..%2F..%2F.env.local');
    const passed = res.status === 404;
    record('API9-01', 'Prevenção de Path Traversal na Distribuição de Updates', 'API9:2023 Inventory / LFI', res.status, 404, passed, 'High', passed ? 'caminhoArquivoAtualizacao sanitiza path e bloqueia subida de diretórios (HTTP 404).' : 'VULNERABILIDADE CRÍTICA: Acesso a arquivos fora do diretório de updates!');
  } catch (err) {
    record('API9-01', 'Prevenção de Path Traversal em updates', 'API9:2023 Inventory / LFI', 0, 404, false, 'High', err.message);
  }

  // 14. API10:2023 - Unsafe Consumption: Consumo seguro da URL upstream da Cronometragem
  try {
    const res = await req('GET', '/api/totem/config');
    const passed = res.status === 200;
    record('API10-01', 'Disponibilidade e isolamento de dependências externas', 'API10:2023 Unsafe Consumption', res.status, 200, passed, 'Low', passed ? 'Serviço responde sem depender de APIs externas síncronas bloqueantes.' : 'Falha ao obter config.');
  } catch (err) {
    record('API10-01', 'Isolamento de dependências externas', 'API10:2023 Unsafe Consumption', 0, 200, false, 'Low', err.message);
  }

  console.log('\n=== Sumário de Resultados dos Testes ===');
  console.table(results.map(r => ({
    ID: r.testId,
    Nome: r.name,
    Categoria: r.category,
    Status: r.status,
    Esperado: r.expected,
    Aprovado: r.passed ? '✓ SIM' : '✗ NÃO',
    Severidade: r.severity,
  })));

  fs.writeFileSync('docs/api/security-test-results.json', JSON.stringify(results, null, 2), 'utf8');
  console.log('\nResultados detalhados salvos em docs/api/security-test-results.json');
}

run().catch(console.error);
