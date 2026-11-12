import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('mantém a interface da Recepção na thread STA após consultar atualizações', () => {
  const source = readFileSync('desktop/src/Kartodromo.Recepcao/Program.cs', 'utf8');
  expect(source).toMatch(/\[STAThread\]\s+static void Main\(\)/);
  // a consulta de atualização roda fora da thread STA (Task.Run) e só o resultado volta para ela
  expect(source).toMatch(/Task\.Run\(\(\) => Atualizacao\.TratarInicioAsync\("Recepcao", args, instanciaUnica: true\)\)\.GetAwaiter\(\)\.GetResult\(\)/);
});
