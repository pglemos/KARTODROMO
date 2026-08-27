import { LockKeyhole } from 'lucide-react';
import type { Role } from '@/src/admin/lib/rbac';

const roleLabels: Readonly<Record<Role, string>> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  financeiro: 'Financeiro',
  recepcao: 'Recepção',
  lanchonete: 'Lanchonete',
  operador_telao: 'Operador do telão',
  viewer: 'Visualizador',
};

export function AdminAccessDenied({ role }: { role: Role }) {
  return (
    <section className="admin-access-denied" aria-labelledby="admin-access-denied-title">
      <div className="admin-access-denied__icon" aria-hidden="true">
        <LockKeyhole size={22} />
      </div>
      <div>
        <h2 id="admin-access-denied-title">Acesso não disponível para este perfil</h2>
        <p>
          O perfil <strong>{roleLabels[role]}</strong> não possui permissão para consultar esta área.
          Se precisar desse acesso, solicite a alteração à administração.
        </p>
      </div>
      <a className="admin-button admin-button-secondary" href="/admin">
        Voltar ao início
      </a>
    </section>
  );
}
