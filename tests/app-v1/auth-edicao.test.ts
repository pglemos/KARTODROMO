import { beforeEach, describe, expect, it } from 'vitest';
import { abrirStore, type AppStore } from '../../lib/app-v1/store';
import { atualizarUsuario, criarUsuario, excluirUsuario, login, type Relogio } from '../../lib/app-v1/auth';

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';

describe('edição, exclusão e senha mínima de 6 caracteres', () => {
  let store: AppStore;
  let agora: number;
  const ctx = (): { store: AppStore; segredo: string; relogio: Relogio } => ({ store, segredo: SEGREDO, relogio: () => agora });

  beforeEach(async () => {
    store = abrirStore(':memory:');
    agora = 1_000_000;
  });

  it('permite criar usuário com senha de 6 caracteres e recusa menor que 6', async () => {
    await expect(criarUsuario(ctx(), { usuario: 'pedro', nome: 'Pedro', perfil: 'OPERACAO', senha: '12345' }))
      .rejects.toThrow(/pelo menos 6 caracteres/);

    const id = await criarUsuario(ctx(), { usuario: 'pedro', nome: 'Pedro', perfil: 'OPERACAO', senha: '123456' });
    expect(id).toBeTruthy();

    const loginRes = await login(ctx(), 'pedro', '123456', 'tab-1');
    expect(loginRes.accessToken).toBeTruthy();
  });

  it('permite atualizar nome, perfil e senha de um usuário', async () => {
    await criarUsuario(ctx(), { usuario: 'carlos', nome: 'Carlos Antigo', perfil: 'OPERACAO', senha: 'senha1' });

    await atualizarUsuario(ctx(), 'carlos', { nome: 'Carlos Novo', perfil: 'GERENCIA', novaSenha: 'novasenha' });

    const u = store.db.prepare('SELECT nome, perfil FROM usuarios WHERE usuario = ?').get('carlos') as { nome: string; perfil: string };
    expect(u.nome).toBe('Carlos Novo');
    expect(u.perfil).toBe('GERENCIA');

    // Autentica com a nova senha
    const loginRes = await login(ctx(), 'carlos', 'novasenha', 'tab-1');
    expect(loginRes.accessToken).toBeTruthy();
  });

  it('recusa nova senha menor que 6 caracteres na edição', async () => {
    await criarUsuario(ctx(), { usuario: 'marcos', nome: 'Marcos', perfil: 'RECEPCAO', senha: 'senha1' });

    await expect(atualizarUsuario(ctx(), 'marcos', { novaSenha: '123' }))
      .rejects.toThrow(/pelo menos 6 caracteres/);
  });

  it('permite excluir usuário e remove sessões associadas', async () => {
    const id = await criarUsuario(ctx(), { usuario: 'temp', nome: 'Temporário', perfil: 'OPERACAO', senha: 'senha1' });
    await login(ctx(), 'temp', 'senha1', 'tab-1');

    excluirUsuario(ctx(), 'temp', 'outro-usuario-id');

    const u = store.db.prepare('SELECT id FROM usuarios WHERE id = ?').get(id);
    expect(u).toBeUndefined();

    const sessoes = store.db.prepare('SELECT id FROM sessoes WHERE usuarioId = ?').all(id);
    expect(sessoes).toHaveLength(0);
  });

  it('impede que o próprio usuário logado se exclua', async () => {
    const id = await criarUsuario(ctx(), { usuario: 'admin', nome: 'Admin', perfil: 'GERENCIA', senha: 'senha1' });

    expect(() => excluirUsuario(ctx(), 'admin', id))
      .toThrow(/Não é permitido excluir o próprio usuário logado/);
  });
});
