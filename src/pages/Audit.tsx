// Journal d'activité : qui a fait quoi, quand, sur quel appareil. Filtrable par période.
import { useMemo, useState } from 'react';
import type { User } from '../lib/auth';
import { useTable } from '../lib/db';
import { Empty, PageHead, fmtDateTime } from '../ui/kit';
import { PeriodPicker, inPeriod, type Period, defaultPeriod } from '../ui/period';

export function AuditPage() {
  const rows = useTable('audit');
  const users = useTable<User>('users');
  const [period, setPeriod] = useState<Period>(defaultPeriod('today'));
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(100);
  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => inPeriod(r.at, period))
      .filter((r) => !userId || r.userId === userId)
      .filter((r) => !action || r.action === action)
      .filter((r) => !n || `${r.details} ${r.userName} ${r.action}`.toLowerCase().includes(n))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [rows, period, userId, action, q]);

  return (
    <>
      <PageHead title="Journal d'activité" subtitle={`${list.length} action${list.length > 1 ? 's' : ''} sur la période`} />
      <div className="card stack">
        <PeriodPicker value={period} onChange={setPeriod} />
        <div className="row">
          <div className="field" style={{ flex: '1 1 200px' }}>
            <input aria-label="Rechercher" placeholder="Rechercher dans le journal" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 1 200px' }}>
            <select aria-label="Utilisateur" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Tous les utilisateurs</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
            </select>
          </div>
          <div className="field" style={{ flex: '0 1 200px' }}>
            <select aria-label="Type d'action" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Toutes les actions</option>
              {actions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="card card-flush">
        {list.length === 0 ? <Empty icon="list" title="Aucune action sur cette période" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détails</th><th>Appareil</th></tr></thead>
              <tbody>
                {list.slice(0, limit).map((r) => (
                  <tr key={r.id}>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.at)}</td>
                    <td>{r.userName}</td>
                    <td><strong>{r.action}</strong></td>
                    <td>{r.details}</td>
                    <td className="muted">{r.device || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {list.length > limit && <button className="btn btn-ghost" onClick={() => setLimit(limit + 200)}>Afficher plus ({list.length - limit} restantes)</button>}
    </>
  );
}
