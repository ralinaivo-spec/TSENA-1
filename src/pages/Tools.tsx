// Paramètres → Outils (admin) : vérification de la cohérence, export complet, espace utilisé.
// Paramètres → Système (super-admin) : effacer les données de test.
import { useEffect, useMemo, useState } from 'react';
import { useCan } from '../lib/auth';
import { useTable } from '../lib/db';
import { DATA_GROUPS, KEPT_LABEL, checkData, clearData, exportAllExcel, tableCounts, type Issue } from '../lib/maintenance';
import { Badge, Button, Confirm, toast } from '../ui/kit';
import { Icon } from '../ui/icons';

const TABLE_LABELS: Record<string, string> = {
  users: 'Utilisateurs', roles: 'Rôles', settings: 'Paramètres', audit: 'Journal', categories: 'Catégories', products: 'Articles', variants: 'Variantes', stockMoves: 'Mouvements de stock',
  suppliers: 'Fournisseurs', purchases: 'Achats', receptions: 'Réceptions', zones: 'Zones', couriers: 'Livreurs', customers: 'Clients', orders: 'Commandes et ventes',
  printStations: "Postes d'impression", printJobs: 'Impressions', cashMoves: 'Mouvements de trésorerie', financeCategories: 'Catégories de dépenses', recurring: 'Opérations récurrentes',
  courierSettlements: 'Versements livreurs', closings: 'Anciennes clôtures',
};

export function ToolsTab() {
  const can = useCan();
  const o = useTable('orders'); const v = useTable('variants'); const m = useTable('stockMoves'); const p = useTable('products');
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [busy, setBusy] = useState('');
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);
  const counts = useMemo(() => tableCounts(), [o, v, m, p]);
  useEffect(() => { (navigator.storage?.estimate?.() as Promise<any> | undefined)?.then((e) => e && setUsage({ used: e.usage || 0, quota: e.quota || 0 })).catch(() => {}); }, []);
  const run = () => setIssues(checkData());
  useEffect(() => { if (issues) run(); }, [o, v, m, p]);
  const problems = issues?.filter((i) => i.level !== 'ok').length ?? 0;
  const mb = (n: number) => (n / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' Mo';
  return (
    <div className="stack">
      <div className="card stack">
        <div className="row-between">
          <div><h3>Vérifier les données</h3><p className="small muted">Recalcule le stock à partir de tous les mouvements et cherche les incohérences (stock négatif, commandes sans livreur, trop-perçus…). Rien n’est modifié sans votre accord.</p></div>
          <Button icon="search" onClick={run}>{issues ? 'Vérifier à nouveau' : 'Lancer la vérification'}</Button>
        </div>
        {issues && <p><Badge tone={problems ? 'warn' : 'ok'}>{problems ? `${problems} point(s) à regarder` : 'Tout est en ordre'}</Badge> <span className="small muted">Stock recalculé à partir de {m.length.toLocaleString('fr-FR')} mouvement(s).</span></p>}
        {issues && (
          <ul className="list">
            {issues.map((i) => (
              <li key={i.key} className="list-item" style={{ alignItems: 'flex-start' }}>
                <span style={{ color: i.level === 'ok' ? 'var(--ok)' : i.level === 'warn' ? 'var(--danger)' : 'var(--gold)', marginTop: 2 }}><Icon name={i.level === 'ok' ? 'check' : 'alert'} /></span>
                <div className="list-item-main">
                  <span className="list-item-title">{i.title}{i.items.length ? ` (${i.items.length})` : ''}</span>
                  <p className="small muted">{i.detail}</p>
                  {i.items.length > 0 && <details><summary className="small">Voir la liste</summary><p className="small" style={{ whiteSpace: 'pre-line' }}>{i.items.slice(0, 100).join('\n')}{i.items.length > 100 ? `\n… et ${i.items.length - 100} autre(s)` : ''}</p></details>}
                </div>
                {i.fix && can('stock.adjust') && <Button variant="ghost" busy={busy === i.key} onClick={async () => { setBusy(i.key); try { await i.fix!(); toast('Correction faite'); run(); } finally { setBusy(''); } }}>{i.fixLabel}</Button>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {can('backup.manage') && (
        <div className="card stack">
          <div><h3>Exporter toutes les données en Excel</h3><p className="small muted">Un classeur avec une feuille par type de données (articles, commandes, trésorerie…), pour vos archives ou votre comptable. Les mots de passe et les photos ne sont pas exportés.</p></div>
          <div><Button variant="ghost" icon="download" busy={busy === 'xls'} onClick={async () => { setBusy('xls'); try { await exportAllExcel(); } finally { setBusy(''); } }}>Exporter en Excel</Button></div>
        </div>
      )}

      <div className="card stack-s">
        <h3>Données sur cet appareil</h3>
        {usage && <p className="small">Espace utilisé : <strong>{mb(usage.used)}</strong>{usage.quota ? ` sur ${mb(usage.quota)} disponibles` : ''}.</p>}
        <div className="table-wrap"><table className="kv-table"><tbody>
          {counts.filter((c) => c.n).map((c) => <tr key={c.t}><td>{TABLE_LABELS[c.t] ?? c.t}</td><td>{c.n.toLocaleString('fr-FR')}</td></tr>)}
        </tbody></table></div>
      </div>
    </div>
  );
}

/** Super-admin : effacer les données de test en gardant les réglages. */
export function ClearDataCard() {
  const [sel, setSel] = useState<string[]>(DATA_GROUPS.filter((g) => g.default).map((g) => g.key));
  const [open, setOpen] = useState(false);
  const toggle = (k: string) => {
    const g = DATA_GROUPS.find((x) => x.key === k)!;
    if (sel.includes(k)) setSel(sel.filter((x) => x !== k && !DATA_GROUPS.find((d) => d.key === x)?.needs?.includes(k)));
    else setSel([...new Set([...sel, k, ...(g.needs ?? [])])]);
  };
  return (
    <div className="card stack" style={{ borderColor: 'var(--gold)' }}>
      <div><h3>Effacer les données de test</h3><p className="small muted">Pour repartir de zéro après les essais, sans refaire les réglages. Une sauvegarde est faite juste avant (fichier + cloud). L’effacement est envoyé à tous les appareils reliés.</p></div>
      <div className="stack-s">
        {DATA_GROUPS.map((g) => (
          <label key={g.key} className="row" style={{ gap: 10, alignItems: 'center' }}>
            <input type="checkbox" className="perm-check" checked={sel.includes(g.key)} onChange={() => toggle(g.key)} />
            <span>{g.label}{g.needs ? <span className="small muted"> (efface aussi : {g.needs.map((n) => DATA_GROUPS.find((d) => d.key === n)!.label.split(/[ ,:]/)[0].toLowerCase()).join(', ')})</span> : null}</span>
          </label>
        ))}
      </div>
      <p className="small">{KEPT_LABEL}</p>
      <div><Button variant="danger" icon="trash" disabled={!sel.length} onClick={() => setOpen(true)}>Effacer la sélection</Button></div>
      {open && <Confirm title="Effacer les données sélectionnées ?" danger confirmLabel="Effacer" typeToConfirm="EFFACER" onClose={() => setOpen(false)}
        message={<div className="stack-s"><p>Seront effacés : <strong>{DATA_GROUPS.filter((g) => sel.includes(g.key)).map((g) => g.label).join(' ; ')}</strong>.</p><p className="small muted">Un fichier de sauvegarde va être téléchargé avant l’effacement.</p></div>}
        onConfirm={async () => { const n = await clearData(sel); toast(`${n.toLocaleString('fr-FR')} enregistrement(s) effacé(s)`); }} />}
    </div>
  );
}
