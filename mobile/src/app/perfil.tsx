/**
 * Perfil do piloto em 3 passos (Dados, Endereço, Confirmar), com os dados do cadastro do kartódromo. Nome, CPF e
 * e-mail aparecem mas não se mudam aqui (identidade da conta). O resto vai para o cadastro em até 1 minuto. O CEP
 * preenche rua, bairro, cidade e estado.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Aviso, Bloco, TelaCarreira, voltar } from '../components/carreira-kit';
import { tap } from '../components/motion';
import { useUi } from '../components/theme';
import { MobileApiError, mobileRequest } from '../api/client';
import { useSession } from '../session/provider';

type Perfil = {
  nome: string | null; email: string | null; documento: string | null; telefone: string | null; nascimento: string | null; sexo: string | null;
  peso: number | null; tipoSanguineo: string | null; cep: string | null; endereco: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; estado: string | null; clienteDesde: string | null;
};
type Resposta = { perfil: Perfil | null; pendente: Partial<Perfil> | null; erro: string | null };
const PASSOS = ['Dados', 'Endereço', 'Confirmar'];
const SANGUE = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const dataBr = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
const dataIso = (br: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : br.trim() ? 'invalida' : ''; };

export default function PerfilTela() {
  const { palette } = useUi();
  const { session } = useSession();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState('');
  const [passo, setPasso] = useState(0);
  const [f, setF] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    if (!session) { setErro('Entre na sua conta para ver o seu perfil.'); return; }
    try {
      const r = await mobileRequest<Resposta>('/api/mobile/v1/conta/perfil', { accessToken: session.accessToken });
      const p = { ...(r.perfil ?? {}), ...(r.pendente ?? {}) } as Partial<Perfil>;
      setDados(r); setErro('');
      setF({
        telefone: p.telefone ?? '', nascimento: dataBr(p.nascimento ?? null), sexo: p.sexo ?? '', peso: p.peso ? String(p.peso).replace('.', ',') : '', tipoSanguineo: p.tipoSanguineo ?? '',
        cep: p.cep ?? '', endereco: p.endereco ?? '', numero: p.numero ?? '', complemento: p.complemento ?? '', bairro: p.bairro ?? '', cidade: p.cidade ?? '', estado: p.estado ?? '',
      });
    } catch (e) { setErro(e instanceof MobileApiError ? e.message : 'Não foi possível carregar o perfil.'); }
  }, [session]);
  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const muda = (k: string) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const buscarCep = async (cep: string) => {
    const d = cep.replace(/\D/g, '');
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json() as { logradouro?: string; bairro?: string; localidade?: string; uf?: string; erro?: boolean };
      if (!j.erro) setF((x) => ({ ...x, endereco: j.logradouro || x.endereco, bairro: j.bairro || x.bairro, cidade: j.localidade || x.cidade, estado: j.uf || x.estado }));
    } catch { /* sem internet: preenche à mão */ }
  };

  const enviar = async () => {
    if (!session) return;
    const nasc = dataIso(f.nascimento ?? '');
    if (nasc === 'invalida') { setAviso('Data de nascimento no formato dd/mm/aaaa.'); setPasso(0); return; }
    setEnviando(true); setAviso('');
    try {
      const r = await mobileRequest<{ mensagem: string }>('/api/mobile/v1/conta/perfil', {
        method: 'PUT', accessToken: session.accessToken,
        body: { ...f, nascimento: nasc, peso: f.peso ? f.peso.replace(',', '.') : null },
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setAviso(r.mensagem);
      void carregar();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      setAviso(e instanceof MobileApiError ? e.message : 'Não foi possível salvar agora.');
    } finally { setEnviando(false); }
  };

  if (!dados) return <TelaCarreira titulo="Perfil" carregando={!erro}>{erro ? <Aviso texto={erro} /> : null}</TelaCarreira>;
  const p = dados.perfil;

  const campo = ({ k, rotulo, teclado, metade, placeholder, onBlur }: { k: string; rotulo: string; teclado?: 'number-pad' | 'phone-pad' | 'decimal-pad'; metade?: boolean; placeholder?: string; onBlur?: () => void }) => (
    <View style={{ width: metade ? '48%' : '100%', flexGrow: 1, gap: 4 }}>
      <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '800' }}>{rotulo.toUpperCase()}</Text>
      <TextInput value={f[k] ?? ''} onChangeText={muda(k)} keyboardType={teclado} placeholder={placeholder} placeholderTextColor={palette.textMuted} onBlur={onBlur} accessibilityLabel={rotulo}
        style={{ backgroundColor: palette.surfaceElevated, color: palette.text, borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1, borderColor: palette.borderSubtle }} />
    </View>
  );
  const fixo = ({ rotulo, valor }: { rotulo: string; valor: string | null }) => (
    <View style={{ width: '100%', gap: 4 }}>
      <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '800' }}>{rotulo.toUpperCase()}</Text>
      <Text style={{ color: palette.textSecondary, fontSize: 16, padding: 12, borderRadius: 12, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.borderSubtle }}>{valor || '—'}</Text>
    </View>
  );
  const opcoes = ({ k, rotulo, opcoes: lista }: { k: string; rotulo: string; opcoes: [string, string][] }) => (
    <View style={{ width: '100%', gap: 6 }}>
      <Text style={{ color: palette.textMuted, fontSize: 11, fontWeight: '800' }}>{rotulo.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {lista.map(([v, t]) => (
          <Pressable key={v} onPress={() => { tap(); muda(k)(f[k] === v ? '' : v); }} accessibilityRole="radio" accessibilityState={{ selected: f[k] === v }}
            style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: f[k] === v ? palette.accent : palette.surfaceElevated }}>
            <Text style={{ color: f[k] === v ? '#000000' : palette.text, fontWeight: '800' }}>{t}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <TelaCarreira titulo="Perfil" onRefresh={carregar}>
      <Bloco index={0}>
        <Text style={{ color: palette.textMuted, fontSize: 12, fontWeight: '800', textAlign: 'center' }}>PASSO {passo + 1} DE 3</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {PASSOS.map((t, i) => (
            <View key={t} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <Pressable onPress={() => { tap(); setPasso(i); }} accessibilityRole="button" accessibilityLabel={`Passo ${i + 1}: ${t}`}
                style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: i <= passo ? palette.accent : palette.surfaceElevated }}>
                <Text style={{ color: i <= passo ? '#000000' : palette.textMuted, fontWeight: '900' }}>{i + 1}</Text>
              </Pressable>
              <Text style={{ color: i === passo ? palette.text : palette.textMuted, fontSize: 12, fontWeight: '800' }}>{t}</Text>
            </View>
          ))}
        </View>
        {!p ? <Text style={{ color: palette.textMuted, fontSize: 13 }}>Seu cadastro está sendo trazido do kartódromo. Pode preencher: o que você salvar entra no cadastro.</Text> : null}
        {dados.pendente ? <Text style={{ color: palette.accent, fontSize: 13 }}>Alteração enviada, gravando no cadastro do kartódromo…</Text> : null}
        {dados.erro ? <Text style={{ color: palette.danger, fontSize: 13 }}>{dados.erro}</Text> : null}
      </Bloco>

      {passo === 0 ? (
        <Bloco titulo="Dados" index={1}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {fixo({ rotulo: "Nome", valor: p?.nome ?? null })}
            {fixo({ rotulo: "CPF", valor: p?.documento ?? null })}
            {fixo({ rotulo: "E-mail", valor: p?.email ?? null })}
            {campo({ k: 'telefone', rotulo: 'WhatsApp com DDD', teclado: 'phone-pad', placeholder: '31 99999-9999' })}
            {campo({ k: 'nascimento', rotulo: 'Nascimento', teclado: 'number-pad', metade: true, placeholder: 'dd/mm/aaaa' })}
            {campo({ k: 'peso', rotulo: 'Peso em kg', teclado: 'decimal-pad', metade: true, placeholder: '75' })}
            {opcoes({ k: 'sexo', rotulo: 'Gênero', opcoes: [['M', 'Masculino'], ['F', 'Feminino']] })}
            {opcoes({ k: 'tipoSanguineo', rotulo: 'Tipo sanguíneo', opcoes: SANGUE.map((s) => [s, s] as [string, string]) })}
          </View>
          <Text style={{ color: palette.textMuted, fontSize: 12 }}>Nome, CPF e e-mail são a identidade da sua conta: para mudar, fale com a recepção.</Text>
        </Bloco>
      ) : null}

      {passo === 1 ? (
        <Bloco titulo="Endereço" index={1}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {campo({ k: 'cep', rotulo: 'CEP', teclado: 'number-pad', metade: true, placeholder: '32600-000', onBlur: () => void buscarCep(f.cep ?? '') })}
            {campo({ k: 'numero', rotulo: 'Número', metade: true })}
            {campo({ k: 'endereco', rotulo: 'Rua' })}
            {campo({ k: 'complemento', rotulo: 'Complemento' })}
            {campo({ k: 'bairro', rotulo: 'Bairro' })}
            {campo({ k: 'cidade', rotulo: 'Cidade', metade: true })}
            {campo({ k: 'estado', rotulo: 'Estado', metade: true, placeholder: 'MG' })}
          </View>
        </Bloco>
      ) : null}

      {passo === 2 ? (
        <Bloco titulo="Confirmar" index={1}>
          {[['WhatsApp', f.telefone], ['Nascimento', f.nascimento], ['Peso', f.peso ? `${f.peso} kg` : ''], ['Gênero', f.sexo === 'M' ? 'Masculino' : f.sexo === 'F' ? 'Feminino' : ''], ['Tipo sanguíneo', f.tipoSanguineo],
            ['Endereço', [f.endereco, f.numero, f.complemento].filter(Boolean).join(', ')], ['Bairro', f.bairro], ['Cidade', [f.cidade, f.estado].filter(Boolean).join(' / ')], ['CEP', f.cep]].map(([r, v]) => (
            <View key={r} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: palette.borderSubtle }}>
              <Text style={{ color: palette.textMuted }}>{r}</Text>
              <Text style={{ color: palette.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{v || '—'}</Text>
            </View>
          ))}
          {aviso ? <Text style={{ color: aviso.startsWith('Recebido') ? palette.neonGreen : palette.danger, fontWeight: '700' }}>{aviso}</Text> : null}
        </Bloco>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => { tap(); if (passo) setPasso(passo - 1); else voltar(); }} accessibilityRole="button"
          style={{ flex: 1, padding: 15, borderRadius: 999, borderWidth: 1, borderColor: palette.border, alignItems: 'center' }}>
          <Text style={{ color: palette.text, fontWeight: '800' }}>{passo ? 'Voltar' : 'Cancelar'}</Text>
        </Pressable>
        <Pressable disabled={enviando} onPress={() => { tap(); if (passo < 2) setPasso(passo + 1); else void enviar(); }} accessibilityRole="button"
          style={{ flex: 1, padding: 15, borderRadius: 999, backgroundColor: palette.accent, alignItems: 'center', opacity: enviando ? 0.6 : 1 }}>
          <Text style={{ color: '#000000', fontWeight: '900' }}>{passo < 2 ? 'Próximo' : enviando ? 'Salvando…' : 'Salvar'}</Text>
        </Pressable>
      </View>
    </TelaCarreira>
  );
}
