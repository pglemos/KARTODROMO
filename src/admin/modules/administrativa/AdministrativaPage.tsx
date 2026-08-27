import { ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { humanizeAdminError } from '@/lib/admin-error-messages';
import { useAuth } from '../../auth/AuthContext';
import { roles, type Role } from '../../lib/rbac';
import { Button } from '../../ui/Button';
import { DataTable, type DataTableColumn } from '../../ui/DataTable';
import { FormField } from '../../ui/FormField';
import { Modal } from '../../ui/Modal';
import { PageHeader } from '../../ui/PageHeader';
import { useToast } from '../../ui/useToast';
import { listAudit, listProfiles, updateProfile } from './administrativa.api';
import type { AuditEntry, Profile, ProfileUpdate } from './administrativa.types';

type Tab = 'usuarios' | 'auditoria';

type ProfileFormState = {
  full_name: string;
  role: Role;
  phone: string;
  active: boolean;
};

type ProfileFormErrors = Partial<Record<keyof ProfileFormState, string>>;

const inputClassName =
  'w-full rounded-lg border border-zinc-700 bg-zinc-950 min-h-[44px] px-3 py-2 sm:min-h-0 sm:py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

const roleLabels: Readonly<Record<Role, string>> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  financeiro: 'Financeiro',
  recepcao: 'Recepção',
  lanchonete: 'Lanchonete',
  operador_telao: 'Operador do telão',
  viewer: 'Visualizador',
};

const roleClasses: Readonly<Record<Role, string>> = {
  owner: 'border-violet-800 bg-violet-950 text-violet-200',
  admin: 'border-brand-800 bg-brand-950 text-brand-100',
  financeiro: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  recepcao: 'border-sky-800 bg-sky-950 text-sky-200',
  lanchonete: 'border-amber-800 bg-amber-950 text-amber-200',
  operador_telao: 'border-indigo-800 bg-indigo-950 text-indigo-200',
  viewer: 'border-zinc-700 bg-zinc-800 text-zinc-200',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const getErrorMessage = (error: unknown): string =>
  humanizeAdminError(error, 'Ocorreu um erro inesperado.');

const profileToForm = (profile: Profile): ProfileFormState => ({
  full_name: profile.full_name,
  role: profile.role,
  phone: profile.phone ?? '',
  active: profile.active,
});

const validateForm = (form: ProfileFormState): ProfileFormErrors => {
  const errors: ProfileFormErrors = {};

  if (!form.full_name.trim()) {
    errors.full_name = 'Informe o nome do usuário.';
  }

  return errors;
};

const RoleBadge = ({ role }: { role: Role }) => (
  <span
    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${roleClasses[role]}`}
  >
    {roleLabels[role]}
  </span>
);

export const AdministrativaPage = () => {
  const { role } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [formErrors, setFormErrors] = useState<ProfileFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const canManage = role === 'owner' || role === 'admin';

  const loadProfiles = useCallback(async () => {
    if (!canManage) {
      return;
    }

    setProfilesLoading(true);
    setProfilesError(null);
    try {
      setProfiles(await listProfiles());
    } catch (error: unknown) {
      setProfilesError(getErrorMessage(error));
    } finally {
      setProfilesLoading(false);
    }
  }, [canManage]);

  const loadAudit = useCallback(async () => {
    if (!canManage) {
      return;
    }

    setAuditLoading(true);
    setAuditError(null);
    try {
      setAuditEntries(await listAudit(100));
    } catch (error: unknown) {
      setAuditError(getErrorMessage(error));
    } finally {
      setAuditLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    if (activeTab === 'usuarios') {
      void loadProfiles();
    } else {
      void loadAudit();
    }
  }, [activeTab, loadAudit, loadProfiles]);

  const profileColumns = useMemo<readonly DataTableColumn<Profile>[]>(
    () => [
      {
        key: 'email',
        label: 'E-mail',
        render: (profile) => profile.email ?? 'Sem e-mail',
      },
      {
        key: 'full_name',
        label: 'Nome',
        render: (profile) => profile.full_name || 'Não informado',
      },
      {
        key: 'role',
        label: 'Papel',
        render: (profile) => <RoleBadge role={profile.role} />,
      },
      {
        key: 'active',
        label: 'Ativo',
        render: (profile) => (
          <span
            className={
              profile.active
                ? 'font-semibold text-emerald-300'
                : 'font-semibold text-zinc-400'
            }
          >
            {profile.active ? 'Sim' : 'Não'}
          </span>
        ),
      },
      {
        key: 'created_at',
        label: 'Criado em',
        render: (profile) => dateFormatter.format(new Date(profile.created_at)),
      },
    ],
    [],
  );

  const auditColumns = useMemo<readonly DataTableColumn<AuditEntry>[]>(
    () => [
      {
        key: 'created_at',
        label: 'Data',
        render: (entry) => dateFormatter.format(new Date(entry.created_at)),
      },
      {
        key: 'actor',
        label: 'Ator',
        render: (entry) => entry.actor ?? 'Sistema',
      },
      { key: 'action', label: 'Ação' },
      { key: 'entity', label: 'Entidade' },
      { key: 'entity_id', label: 'ID da entidade' },
    ],
    [],
  );

  const openEditModal = (profile: Profile) => {
    setEditingProfile(profile);
    setForm(profileToForm(profile));
    setFormErrors({});
  };

  const closeEditModal = () => {
    if (!submitting) {
      setEditingProfile(null);
      setForm(null);
      setFormErrors({});
    }
  };

  const updateForm = <K extends keyof ProfileFormState>(
    field: K,
    value: ProfileFormState[K],
  ) => {
    setForm((current) => (current ? { ...current, [field]: value } : current));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProfile || !form) {
      return;
    }

    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload: ProfileUpdate = {
      full_name: form.full_name.trim(),
      role: form.role,
      phone: form.phone.trim() || null,
      active: form.active,
    };

    setSubmitting(true);
    try {
      const updatedProfile = await updateProfile(editingProfile.id, payload);
      setProfiles((current) =>
        current.map((profile) =>
          profile.id === updatedProfile.id ? updatedProfile : profile,
        ),
      );
      toast.success('Usuário atualizado com sucesso.');
      setEditingProfile(null);
      setForm(null);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (!canManage) {
    return (
      <section>
        <PageHeader
          subtitle="Esta área é exclusiva para proprietários e administradores."
          title="Administrativa"
        />
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-red-900/70 bg-red-950/30 p-8 text-center">
          <ShieldAlert aria-hidden="true" className="text-red-300" size={32} />
          <h2 className="mt-4 text-lg font-bold text-white">Acesso restrito</h2>
          <p className="mt-2 max-w-md text-sm text-red-100">
            Seu papel não possui permissão para gerenciar usuários ou consultar a auditoria.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        subtitle="Gerencie usuários, papéis de acesso e consulte o histórico de auditoria."
        title="Administrativa"
      />

      <div className="mt-8 border-b border-zinc-800" role="tablist">
        {([
          ['usuarios', 'Usuários'],
          ['auditoria', 'Auditoria'],
        ] as const).map(([tab, label]) => {
          const isActive = activeTab === tab;
          return (
            <button
              aria-selected={isActive}
              className={[
                'border-b-2 px-4 py-3 text-sm font-bold transition-colors',
                isActive
                  ? 'border-brand-400 text-brand-200'
                  : 'border-transparent text-zinc-400 hover:text-white',
              ].join(' ')}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === 'usuarios' ? (
          <DataTable
            columns={profileColumns}
            emptyLabel="Nenhum usuário encontrado."
            error={profilesError}
            loading={profilesLoading}
            onEdit={openEditModal}
            onRetry={() => void loadProfiles()}
            rows={profiles}
          />
        ) : (
          <DataTable
            columns={auditColumns}
            emptyLabel="Nenhum registro de auditoria encontrado."
            error={auditError}
            loading={auditLoading}
            onRetry={() => void loadAudit()}
            rows={auditEntries}
          />
        )}
      </div>

      <Modal
        footer={
          <>
            <Button disabled={submitting} onClick={closeEditModal} variant="ghost">
              Cancelar
            </Button>
            <Button form="profile-form" loading={submitting} type="submit">
              Salvar alterações
            </Button>
          </>
        }
        isOpen={Boolean(editingProfile && form)}
        onClose={closeEditModal}
        title="Editar usuário"
      >
        {form ? (
          <form className="grid gap-5 md:grid-cols-2" id="profile-form" onSubmit={handleSubmit}>
            <div className="md:col-span-2">
              <FormField
                error={formErrors.full_name}
                htmlFor="profile-full-name"
                label="Nome completo"
              >
                <input
                  className={inputClassName}
                  id="profile-full-name"
                  onChange={(event) => updateForm('full_name', event.target.value)}
                  required
                  value={form.full_name}
                />
              </FormField>
            </div>

            <FormField htmlFor="profile-role" label="Papel">
              <select
                className={inputClassName}
                id="profile-role"
                onChange={(event) => updateForm('role', event.target.value as Role)}
                value={form.role}
              >
                {roles.map((availableRole) => (
                  <option key={availableRole} value={availableRole}>
                    {roleLabels[availableRole]}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField htmlFor="profile-phone" label="Telefone">
              <input
                className={inputClassName}
                id="profile-phone"
                onChange={(event) => updateForm('phone', event.target.value)}
                placeholder="(31) 99999-9999"
                type="tel"
                value={form.phone}
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Status da conta">
                <label className="inline-flex cursor-pointer items-center gap-3 text-sm text-zinc-200">
                  <input
                    checked={form.active}
                    className="peer sr-only"
                    onChange={(event) => updateForm('active', event.target.checked)}
                    type="checkbox"
                  />
                  <span className="relative h-6 w-11 rounded-full bg-zinc-700 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-brand-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400" />
                  {form.active ? 'Usuário ativo' : 'Usuário inativo'}
                </label>
              </FormField>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
};
