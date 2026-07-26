import { ExternalLink, Monitor } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { canAccess } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { FormField } from '../../ui/FormField';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/useToast';
import { getState, updateState } from './telao.api';
import type {
  JsonValue,
  TelaoDisplayMode,
  TelaoState,
  TelaoStateUpdate,
} from './telao.types';

type SavingKey = TelaoDisplayMode | 'pagination' | 'layout' | null;

const displayModes: readonly { label: string; value: TelaoDisplayMode }[] = [
  { label: 'Ao vivo', value: 'live' },
  { label: 'Pódio final real', value: 'final-real' },
  { label: 'Final', value: 'final' },
];

const cardClassName =
  'rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-lg shadow-black/10 md:p-6';

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60';

const updatedAtFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';

const formatLayout = (layout: JsonValue): string => JSON.stringify(layout, null, 2);

const formatUpdatedAt = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : updatedAtFormatter.format(date);
};

export const TelaoPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<TelaoState | null>(null);
  const [pageOffset, setPageOffset] = useState('0');
  const [layoutText, setLayoutText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<SavingKey>(null);

  const canWrite =
    canAccess(role, 'telao') && ['owner', 'admin', 'operador_telao'].includes(role);

  const loadState = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const loadedState = await getState();
      setState(loadedState);
      setPageOffset(String(loadedState.page_offset));
      setLayoutText(formatLayout(loadedState.layout));
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const savePatch = async (
    key: Exclude<SavingKey, null>,
    patch: TelaoStateUpdate,
    successMessage: string,
  ): Promise<TelaoState | null> => {
    setSavingKey(key);

    try {
      const updatedState = await updateState(patch);
      setState(updatedState);
      toast.success(successMessage);
      return updatedState;
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      setSavingKey(null);
    }
  };

  const handleModeChange = async (displayMode: TelaoDisplayMode) => {
    await savePatch(displayMode, { display_mode: displayMode }, 'Modo atualizado.');
  };

  const changePageOffset = (delta: number) => {
    setPageOffset((current) => {
      const parsed = Number(current);
      const base = Number.isInteger(parsed) ? parsed : (state?.page_offset ?? 0);
      return String(base + delta);
    });
  };

  const handlePaginationSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedOffset = Number(pageOffset);

    if (!Number.isInteger(parsedOffset)) {
      toast.error('Informe um deslocamento de página inteiro.');
      return;
    }

    const updatedState = await savePatch(
      'pagination',
      { page_offset: parsedOffset },
      'Paginação atualizada.',
    );

    if (updatedState) {
      setPageOffset(String(updatedState.page_offset));
    }
  };

  const handleLayoutSave = async () => {
    let parsedLayout: JsonValue;

    try {
      parsedLayout = JSON.parse(layoutText) as JsonValue;
    } catch {
      toast.error('O layout informado não contém um JSON válido.');
      return;
    }

    const updatedState = await savePatch(
      'layout',
      { layout: parsedLayout },
      'Layout atualizado.',
    );

    if (updatedState) {
      setLayoutText(formatLayout(updatedState.layout));
    }
  };

  return (
    <section>
      <PageHeader
        subtitle="Controle o modo, a paginação e o layout exibidos no telão TB50."
        title="Telão"
      />

      {loading ? (
        <div className={`${cardClassName} mt-8 text-sm text-zinc-300`} role="status">
          Carregando estado do telão...
        </div>
      ) : loadError || !state ? (
        <div className={`${cardClassName} mt-8`} role="alert">
          <p className="font-bold text-red-200">Não foi possível carregar o telão.</p>
          <p className="mt-2 text-sm text-zinc-300">{loadError}</p>
          <Button className="mt-4" onClick={() => void loadState()} variant="ghost">
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <article className={cardClassName}>
              <h2 className="text-lg font-black text-white">Modo de exibição</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Define qual etapa da classificação aparece no placar.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {displayModes.map((mode) => (
                  <Button
                    aria-pressed={state.display_mode === mode.value}
                    disabled={!canWrite || savingKey !== null}
                    key={mode.value}
                    loading={savingKey === mode.value}
                    onClick={() => void handleModeChange(mode.value)}
                    variant={state.display_mode === mode.value ? 'primary' : 'ghost'}
                  >
                    {mode.label}
                  </Button>
                ))}
              </div>
            </article>

            <article className={cardClassName}>
              <h2 className="text-lg font-black text-white">Paginação</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Ajuste o deslocamento da página exibida no telão.
              </p>
              <form className="mt-5" onSubmit={(event) => void handlePaginationSave(event)}>
                <FormField htmlFor="telao-page-offset" label="Deslocamento da página">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      aria-label="Diminuir deslocamento em um"
                      disabled={!canWrite || savingKey !== null}
                      onClick={() => changePageOffset(-1)}
                      variant="ghost"
                    >
                      -1
                    </Button>
                    <input
                      className={`${inputClassName} sm:max-w-40`}
                      disabled={!canWrite || savingKey !== null}
                      id="telao-page-offset"
                      onChange={(event) => setPageOffset(event.target.value)}
                      step="1"
                      type="number"
                      value={pageOffset}
                    />
                    <Button
                      aria-label="Aumentar deslocamento em um"
                      disabled={!canWrite || savingKey !== null}
                      onClick={() => changePageOffset(1)}
                      variant="ghost"
                    >
                      +1
                    </Button>
                    <Button
                      disabled={!canWrite || savingKey !== null}
                      loading={savingKey === 'pagination'}
                      type="submit"
                    >
                      Salvar
                    </Button>
                  </div>
                </FormField>
              </form>
            </article>
          </div>

          <article className={`${cardClassName} mt-5`}>
            <h2 className="text-lg font-black text-white">Layout (JSON)</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Edite a configuração consumida pelo aplicativo do telão.
            </p>
            <div className="mt-5">
              <FormField htmlFor="telao-layout" label="Configuração do layout">
                <textarea
                  className={`${inputClassName} min-h-80 resize-y font-mono leading-6`}
                  disabled={!canWrite || savingKey !== null}
                  id="telao-layout"
                  onChange={(event) => setLayoutText(event.target.value)}
                  spellCheck={false}
                  value={layoutText}
                />
              </FormField>
              <Button
                className="mt-4"
                disabled={!canWrite || savingKey !== null}
                loading={savingKey === 'layout'}
                onClick={() => void handleLayoutSave()}
              >
                Salvar layout
              </Button>
            </div>
          </article>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto]">
            <article className={cardClassName}>
              <div className="flex items-center gap-3">
                <Monitor aria-hidden="true" className="text-brand-300" size={24} />
                <div>
                  <h2 className="font-black text-white">Estado do telão</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Última atualização: {formatUpdatedAt(state.updated_at)}
                  </p>
                </div>
              </div>
            </article>

            <article className={cardClassName}>
              <h2 className="font-black text-white">Links úteis</h2>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <a
                  className="inline-flex items-center gap-2 text-sm font-bold text-brand-300 hover:text-brand-200"
                  href="/placar-telao-tb50?layout=designer"
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir placar TB50
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
                <a
                  className="inline-flex items-center gap-2 text-sm font-bold text-brand-300 hover:text-brand-200"
                  href="/designer-telao"
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir designer do telão
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              </div>
            </article>
          </div>
        </>
      )}
    </section>
  );
};
