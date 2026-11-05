const fs = require('fs');
const cp = require('child_process');

const tmpDir = '/tmp/test-kart-patch';
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(tmpDir, { recursive: true });

// Copy source files to tmp
fs.cpSync('/Users/pedroguilherme/PROJETOS/kartodromo-operacional/src', tmpDir + '/src', { recursive: true });
fs.cpSync('/Users/pedroguilherme/PROJETOS/kartodromo-operacional/tests', tmpDir + '/tests', { recursive: true });

// Init git repo in tmp
cp.execSync('git init && git config user.name test && git config user.email test@test.com && git add . && git commit -m initial', { cwd: tmpDir });

// Apply proposed changes in tmp to generate 100% authentic git diff
const proposedFormato = fs.readFileSync('/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/proposed_formato.ts', 'utf8');
fs.writeFileSync(tmpDir + '/src/features/operacao/formato.ts', proposedFormato);

let usuarios = fs.readFileSync(tmpDir + '/src/app/usuarios.tsx', 'utf8');
usuarios = usuarios.replace(
  'const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());',
  'const ehEu = Boolean(eu?.usuario && u.usuario.trim().toLowerCase() === eu.usuario.trim().toLowerCase());'
);
usuarios = usuarios.replace(
  "void acao(() => cliente.postar('/users', { usuario, nome, senha, perfil }), 'Usuário criado.')",
  "void acao(() => cliente.postar('/users', { usuario: usuario.trim(), nome: nome.trim(), senha, perfil }), 'Usuário criado.')"
);
fs.writeFileSync(tmpDir + '/src/app/usuarios.tsx', usuarios);

let stressTest = fs.readFileSync(tmpDir + '/tests/m1-challenger-stress.test.ts', 'utf8');
// Replace self-block test
stressTest = stressTest.replace(
  `    // Current implementation in src/app/usuarios.tsx line 88:
    // const ehEu = Boolean(eu?.usuario && u.usuario.toLowerCase() === eu.usuario.toLowerCase());
    const verificarEhEuAtual = (euUsuario: string | undefined, uUsuario: string): boolean => {
      return Boolean(euUsuario && uUsuario.toLowerCase() === euUsuario.toLowerCase());
    };

    // Robust implementation with trimming:
    const verificarEhEuRobusto = (euUsuario: string | undefined, uUsuario: string): boolean => {
      return Boolean(euUsuario && uUsuario.trim().toLowerCase() === euUsuario.trim().toLowerCase());
    };

    it('protege auto-bloqueio quando username é exatamente igual', () => {
      expect(verificarEhEuAtual('admin', 'admin')).toBe(true);
    });

    it('protege auto-bloqueio com diferença de maiúsculas/minúsculas', () => {
      expect(verificarEhEuAtual('Gerencia', 'GERENCIA')).toBe(true);
      expect(verificarEhEuAtual('PEDRO', 'pedro')).toBe(true);
    });

    it('VULNERABILIDADE / FALHA DE BORDA: falha ao detectar auto-bloqueio se houver espaços em branco (sem trim)', () => {
      // Se o usuário logado tem 'gerencia' mas no banco ou lista está 'gerencia ' ou ' gerencia'
      const atualComEspaco = verificarEhEuAtual('gerencia', 'gerencia ');
      const atualComEspacoInicio = verificarEhEuAtual('gerencia', ' gerencia');
      const atualAmbosEspacos = verificarEhEuAtual('gerencia ', 'gerencia');

      // Pela implementação atual (sem trim), estes retornam FALSE, permitindo bloquear a própria conta!
      expect(atualComEspaco).toBe(false); // Falha de proteção encontrada!
      expect(atualComEspacoInicio).toBe(false); // Falha de proteção encontrada!
      expect(atualAmbosEspacos).toBe(false); // Falha de proteção encontrada!

      // Uma verificação robusta com trim evitaria isso:
      expect(verificarEhEuRobusto('gerencia', 'gerencia ')).toBe(true);
      expect(verificarEhEuRobusto('gerencia', ' gerencia')).toBe(true);
      expect(verificarEhEuRobusto('gerencia ', 'gerencia')).toBe(true);
    });

    it('trata usernames com caracteres especiais e nulos com segurança', () => {
      expect(verificarEhEuAtual(undefined, 'gerencia')).toBe(false);
      expect(verificarEhEuAtual('', 'gerencia')).toBe(false);
    });`,
  `    // Implementation from src/app/usuarios.tsx line 88 (with trimming):
    const verificarEhEu = (euUsuario: string | undefined, uUsuario: string): boolean => {
      return Boolean(euUsuario && uUsuario.trim().toLowerCase() === euUsuario.trim().toLowerCase());
    };

    it('protege auto-bloqueio quando username é exatamente igual', () => {
      expect(verificarEhEu('admin', 'admin')).toBe(true);
    });

    it('protege auto-bloqueio com diferença de maiúsculas/minúsculas', () => {
      expect(verificarEhEu('Gerencia', 'GERENCIA')).toBe(true);
      expect(verificarEhEu('PEDRO', 'pedro')).toBe(true);
    });

    it('protege auto-bloqueio mesmo se houver espaços em branco (com trim)', () => {
      expect(verificarEhEu('gerencia', 'gerencia ')).toBe(true);
      expect(verificarEhEu('gerencia', ' gerencia')).toBe(true);
      expect(verificarEhEu('gerencia ', 'gerencia')).toBe(true);
      expect(verificarEhEu(' gerencia ', 'gerencia')).toBe(true);
      expect(verificarEhEu('gerencia', '  gerencia  ')).toBe(true);
    });

    it('trata usernames com caracteres especiais e nulos com segurança', () => {
      expect(verificarEhEu(undefined, 'gerencia')).toBe(false);
      expect(verificarEhEu('', 'gerencia')).toBe(false);
    });`
);

// Replace hora and formatarInicioAgenda tests in stress test
stressTest = stressTest.replace(
  `    it('COMPORTAMENTO DE ROBUSTEZ: hora() retorna "Invalid Date" com entradas inválidas por falta de validação interna', () => {
      // Testando diretamente a função hora() com entradas inválidas
      // Ao invés de fallback seguro como '--:--', hora() retorna 'Invalid Date'
      expect(hora('string-invalida')).toBe('Invalid Date');
      expect(hora(NaN)).toBe('Invalid Date');
    });

    it('formatarInicioAgenda: comportamento com fallbacks e artefato de slice em strings não-data', () => {
      expect(formatarInicioAgenda(undefined, 'BATERIA_1')).toBe('BATERIA_1');
      expect(formatarInicioAgenda('', 99)).toBe('99');
      expect(formatarInicioAgenda('2026-11-02T19:00:00.000Z', 10)).toBe('16:00');

      // String curta inválida (<11 chars) cai no fallback
      expect(formatarInicioAgenda('curta', 'FALLBACK')).toBe('FALLBACK');

      // String longa arbitrária não-ISO (>11 chars): sofre artefato de slice(11, 16)
      // "Bateria 10 - Treino".slice(11, 16) resulta em "- Tre" em vez de 'FALLBACK'
      const comArtefato = formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK');
      expect(comArtefato).toBe('- Tre'); // Artefato empírico comprovado!
    });`,
  `    it('resiliência de hora() contra entradas inválidas retornando fallback seguro', () => {
      // Testando diretamente a função hora() com entradas inválidas
      // Retorna fallback seguro '--:--' sem lançar exceções nem retornar 'Invalid Date'
      expect(hora('string-invalida')).toBe('--:--');
      expect(hora(NaN)).toBe('--:--');
      expect(hora(undefined)).toBe('--:--');
      expect(hora(null)).toBe('--:--');
      expect(hora('')).toBe('--:--');
    });

    it('formatarInicioAgenda: elimina artefato de slice em strings não-ISO e retorna fallback seguro', () => {
      expect(formatarInicioAgenda(undefined, 'BATERIA_1')).toBe('BATERIA_1');
      expect(formatarInicioAgenda('', 99)).toBe('99');
      expect(formatarInicioAgenda('2026-11-02T19:00:00.000Z', 10)).toBe('16:00');

      // String curta inválida (<11 chars) cai no fallback
      expect(formatarInicioAgenda('curta', 'FALLBACK')).toBe('FALLBACK');

      // String longa arbitrária não-ISO (>11 chars): não sofre mais artefato de slice(11, 16)
      expect(formatarInicioAgenda('Bateria 10 - Treino', 'FALLBACK')).toBe('FALLBACK');
      expect(formatarInicioAgenda('nao-e-data-valida', 'FALLBACK')).toBe('FALLBACK');

      // Horário simples pré-formatado (HH:mm) é preservado
      expect(formatarInicioAgenda('14:30', 'FALLBACK')).toBe('14:30');
    });`
);
fs.writeFileSync(tmpDir + '/tests/m1-challenger-stress.test.ts', stressTest);

// Generate genuine git diff
const diff = cp.execSync('git diff', { cwd: tmpDir, encoding: 'utf8' });
fs.writeFileSync('/Users/pedroguilherme/PROJETOS/KARTODROMO/.agents/teamwork/explorer_m1_remediation_2/remediation_m1_explorer_2.patch', diff);
console.log('Successfully generated git diff patch. Length:', diff.length);

// Clean up tmpDir
fs.rmSync(tmpDir, { recursive: true, force: true });
