// Menu « Import / Export » : tout ce qui s'importe ou s'exporte au même endroit.
// Import : articles et stock (modèle par page), autres fichiers habituels. Export : un classeur Excel par sujet, ou tout en un.
import { useState } from 'react';
import { useCan } from '../lib/auth';
import { all, get } from '../lib/db';
import { productVariants, stockOf, variantLabel, type Category, type Product, type Variant } from '../lib/catalog';
import { ACCOUNTS, today, type AccountId, type CashMove, type FinanceCategory } from '../lib/money';
import { CHANNELS, ORDER_STATUS, fmtPhone, isWalkIn, orderTotal, paidTotal, type Customer, type Order, type Zone } from '../lib/orders';
import type { Payout } from '../lib/closed';
import { PRIORITY, WAIT, estimate, itemsText, type Prospect } from '../lib/prospects';
import { Button, PageHead, navigate, toast, useRoute } from '../ui/kit';
import { Icon } from '../ui/icons';
import { exportTables, type Col } from '../ui/table';
import { ImportPage } from './Import';

const d = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const cat = (id?: string) => all<FinanceCategory>('financeCategories').find((c) => c.id === id)?.name ?? '';

type Sheet = { name: string; cols: Col<any>[]; rows: any[] };
const SHEETS: { key: string; label: string; text: string; perm: string; build: () => Sheet[] }[] = [
  {
    key: 'ventes', label: 'Ventes et commandes', text: 'Toutes les ventes sur place et commandes : client, lieu, statut, montants, vendeur ; et le détail des articles vendus.', perm: 'orders.create',
    build: () => {
      const orders = all<Order>('orders').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const lines = orders.flatMap((o) => o.lines.map((l) => ({ o, l })));
      return [
        { name: 'Ventes et commandes', rows: orders, cols: [
          { key: 'n', label: 'N°', value: (o: Order) => o.number, width: 12 }, { key: 'd', label: 'Date', value: (o: Order) => d(o.createdAt), width: 17 },
          { key: 't', label: 'Type', value: (o: Order) => (isWalkIn(o) ? 'Vente sur place' : o.kind === 'exchange' ? 'Échange' : 'Commande'), width: 15 },
          { key: 'c', label: 'Canal', value: (o: Order) => CHANNELS[o.channel] ?? '', width: 12 },
          { key: 'cl', label: 'Client', value: (o: Order) => o.name ?? '', width: 20 }, { key: 'fb', label: 'Facebook', value: (o: Order) => o.facebook ?? '', width: 18 },
          { key: 'p', label: 'Téléphone', value: (o: Order) => (o.phone ? fmtPhone(o.phone) : ''), width: 15 },
          { key: 'z', label: 'Zone', value: (o: Order) => get<Zone>('zones', o.zoneId || '')?.name ?? '', width: 18 }, { key: 'l', label: 'Lieu', value: (o: Order) => o.place ?? '', width: 20 },
          { key: 's', label: 'Statut', value: (o: Order) => ORDER_STATUS[o.status]?.label ?? o.status, width: 16 },
          { key: 'm', label: 'Total', value: (o: Order) => orderTotal(o), money: true, total: true, width: 14 }, { key: 'pa', label: 'Payé', value: (o: Order) => paidTotal(o), money: true, total: true, width: 14 },
          { key: 'v', label: 'Saisie par', value: (o: Order) => o.createdByName ?? '', width: 16 },
        ] },
        { name: 'Articles vendus', rows: lines, cols: [
          { key: 'n', label: 'N°', value: (r: { o: Order }) => r.o.number, width: 12 }, { key: 'd', label: 'Date', value: (r: { o: Order }) => d(r.o.createdAt), width: 17 },
          { key: 'c', label: 'Code', value: (r: any) => { const v = get<Variant>('variants', r.l.variantId); return get<Product>('products', v?.productId || '')?.code ?? ''; }, width: 14 },
          { key: 'a', label: 'Article', value: (r: any) => { const v = get<Variant>('variants', r.l.variantId); const p = get<Product>('products', v?.productId || ''); return `${p?.name ?? ''} ${v ? variantLabel(v) : ''}`.trim(); }, width: 32 },
          { key: 'q', label: 'Qté', value: (r: any) => r.l.qty, num: true, total: true, width: 8 }, { key: 'pu', label: 'Prix', value: (r: any) => r.l.unitPrice, money: true, width: 12 },
          { key: 'm', label: 'Montant', value: (r: any) => (r.l.isChoice ? 0 : r.l.qty * r.l.unitPrice), money: true, total: true, width: 14 },
          { key: 's', label: 'Statut', value: (r: { o: Order }) => ORDER_STATUS[r.o.status]?.label ?? '', width: 16 },
        ] },
      ];
    },
  },
  {
    key: 'clients', label: 'Clients', text: 'Fiches clients : nom, Facebook, téléphones, lieu habituel, notes.', perm: 'orders.create',
    build: () => [{ name: 'Clients', rows: all<Customer>('customers'), cols: [
      { key: 'n', label: 'Nom', value: (c: Customer) => c.name ?? '', width: 22 }, { key: 'f', label: 'Facebook', value: (c: Customer) => c.facebook ?? '', width: 22 },
      { key: 'p', label: 'Téléphone', value: (c: Customer) => (c.phone ? fmtPhone(c.phone) : ''), width: 15 }, { key: 'p2', label: 'Autre téléphone', value: (c: Customer) => (c.phone2 ? fmtPhone(c.phone2) : ''), width: 15 },
      { key: 'z', label: 'Zone', value: (c: Customer) => get<Zone>('zones', c.zoneId || '')?.name ?? '', width: 18 }, { key: 'l', label: 'Lieu', value: (c: Customer) => c.place ?? '', width: 22 },
      { key: 'o', label: 'Notes', value: (c: Customer) => c.notes ?? '', width: 30 },
    ] }],
  },
  {
    key: 'suivis', label: 'Clients à suivre', text: 'Suivis en cours, transformés et abandonnés, avec le motif d’attente et la prochaine relance.', perm: 'orders.create',
    build: () => [{ name: 'Clients à suivre', rows: all<Prospect>('prospects'), cols: [
      { key: 'n', label: 'Nom Facebook', value: (p: Prospect) => p.fbName, width: 22 }, { key: 'p', label: 'Téléphone', value: (p: Prospect) => (p.phone ? fmtPhone(p.phone) : ''), width: 15 },
      { key: 'i', label: 'Intéressé par', value: (p: Prospect) => itemsText(p), width: 34 }, { key: 'w', label: 'Attend', value: (p: Prospect) => WAIT[p.waitFor], width: 18 },
      { key: 'pr', label: 'Priorité', value: (p: Prospect) => PRIORITY[p.priority], width: 10 }, { key: 'r', label: 'Relance', value: (p: Prospect) => d(p.followAt), width: 17 },
      { key: 's', label: 'Statut', value: (p: Prospect) => ({ open: 'En cours', converted: 'Transformé', abandoned: `Abandonné (${p.abandonReason ?? ''})` })[p.status], width: 20 },
      { key: 'e', label: 'Montant estimé', value: (p: Prospect) => estimate(p), money: true, width: 14 }, { key: 'v', label: 'Suivi par', value: (p: Prospect) => p.ownerName ?? '', width: 16 },
    ] }],
  },
  {
    key: 'depenses', label: 'Dépenses', text: 'Toutes les dépenses : date, catégorie, type, compte, montant, saisi par.', perm: 'treasury.view',
    build: () => [{ name: 'Dépenses', rows: all<CashMove>('cashMoves').filter((m) => m.type === 'expense').sort((a, b) => a.at.localeCompare(b.at)), cols: [
      { key: 'd', label: 'Date', value: (m: CashMove) => d(m.at), width: 17 }, { key: 'l', label: 'Description', value: (m: CashMove) => m.label ?? '', width: 30 },
      { key: 'c', label: 'Catégorie', value: (m: CashMove) => cat(m.categoryId), width: 22 }, { key: 't', label: 'Type', value: (m: CashMove) => cat(m.typeId), width: 18 },
      { key: 'a', label: 'Compte', value: (m: CashMove) => ACCOUNTS[m.account as AccountId] ?? m.account, width: 16 }, { key: 'm', label: 'Montant', value: (m: CashMove) => -m.amount, money: true, total: true, width: 14 },
      { key: 'u', label: 'Saisi par', value: (m: CashMove) => m.userName ?? '', width: 16 },
    ] }],
  },
  {
    key: 'stock', label: 'Stock', text: 'Chaque article avec sa page, son stock, son prix de vente (et son coût si vous avez le droit de le voir).', perm: 'catalog.view',
    build: () => {
      const rows = all<Product>('products').filter((p) => p.active !== false).flatMap((p) => productVariants(p.id).map((v) => ({ p, v })));
      const page = (p: Product) => { let c = get<Category>('categories', p.categoryId || ''); while (c?.parentId) c = get<Category>('categories', c.parentId); return c?.name ?? ''; };
      return [{ name: 'Stock', rows, cols: [
        { key: 'pg', label: 'Page', value: (r: any) => page(r.p), width: 18 }, { key: 'c', label: 'Code', value: (r: any) => r.p.code, width: 14 },
        { key: 'a', label: 'Article', value: (r: any) => `${r.p.name} ${variantLabel(r.v) === 'Unique' ? '' : variantLabel(r.v)}`.trim(), width: 34 },
        { key: 'q', label: 'Stock', value: (r: any) => stockOf(r.v.id), num: true, total: true, width: 9 },
        { key: 'pv', label: 'Prix détail', value: (r: any) => r.p.priceRetail ?? 0, money: true, width: 13 }, { key: 'pg2', label: 'Prix gros', value: (r: any) => r.p.priceWholesale ?? 0, money: true, width: 13 },
        { key: 'ct', label: 'Coût moyen', value: (r: any) => r.v.costAvg ?? 0, money: true, width: 13, hide: true },
      ] }];
    },
  },
  {
    key: 'versements', label: 'Versements au patron', text: 'Chaque semaine versée : ventes, dépenses, attendu, remis, écart.', perm: 'treasury.view',
    build: () => [{ name: 'Versements', rows: all<Payout>('payouts').sort((a, b) => a.weekStart.localeCompare(b.weekStart)), cols: [
      { key: 'w', label: 'Semaine', value: (p: Payout) => `${p.weekStart} → ${p.weekEnd}`, width: 24 }, { key: 's', label: 'Ventes', value: (p: Payout) => p.sales, money: true, total: true, width: 14 },
      { key: 'e', label: 'Dépenses', value: (p: Payout) => p.expenses, money: true, total: true, width: 14 }, { key: 'x', label: 'Attendu', value: (p: Payout) => p.expected, money: true, total: true, width: 14 },
      { key: 'a', label: 'Remis', value: (p: Payout) => p.amount, money: true, total: true, width: 14 }, { key: 'g', label: 'Écart', value: (p: Payout) => p.gap, money: true, total: true, width: 12 },
      { key: 'st', label: 'Statut', value: (p: Payout) => (p.status === 'paid' ? 'Versé' : 'Annulé'), width: 10 }, { key: 'b', label: 'Par', value: (p: Payout) => p.byName ?? '', width: 16 },
    ] }],
  },
];

export function ImportExportPage() {
  const route = useRoute();
  const can = useCan();
  const tab = route.split('/')[2] === 'export' || !can('catalog.edit') ? 'export' : 'import';
  return (
    <>
      <div className="tabs" role="tablist" style={{ marginBottom: 4 }}>
        {can('catalog.edit') && <button role="tab" aria-selected={tab === 'import'} onClick={() => navigate('/import-export')}>Importer</button>}
        <button role="tab" aria-selected={tab === 'export'} onClick={() => navigate('/import-export/export')}>Exporter</button>
      </div>
      {tab === 'import' ? <ImportPage /> : <ExportTab />}
    </>
  );
}

function ExportTab() {
  const can = useCan();
  const [busy, setBusy] = useState<string | null>(null);
  const list = SHEETS.filter((s) => can(s.perm));
  const withCost = (sh: Sheet[]) => sh.map((s) => ({ ...s, cols: s.cols.map((c) => (c.key === 'ct' ? { ...c, hide: !can('costs.view') } : c)) }));
  const run = async (key: string, name: string, sheets: Sheet[]) => {
    setBusy(key);
    try { await exportTables(`tresor-en-ligne_${name}_${today()}.xlsx`, withCost(sheets)); toast('Fichier Excel prêt'); }
    catch (e: any) { toast(e?.message ?? 'Export impossible', 'error'); } finally { setBusy(null); }
  };
  return (
    <>
      <PageHead title="Exporter en Excel" subtitle="Un classeur par sujet, ou tout dans un seul classeur. Chaque écran garde aussi son bouton « Excel » pour exporter ce qui est affiché." />
      <div className="card row-between">
        <div><h3>Tout en un seul classeur</h3><p className="small muted">{list.map((s) => s.label).join(', ')} : un onglet par sujet.</p></div>
        <Button icon="download" busy={busy === 'all'} onClick={() => run('all', 'tout', list.flatMap((s) => s.build()))}>Tout exporter</Button>
      </div>
      <div className="export-grid">
        {list.map((s) => (
          <div key={s.key} className="card stack-s">
            <h3><Icon name="fileSheet" size={18} /> {s.label}</h3>
            <p className="small muted" style={{ flex: 1 }}>{s.text}</p>
            <div><Button variant="ghost" icon="download" busy={busy === s.key} onClick={() => run(s.key, s.key, s.build())}>Excel</Button></div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Onglets communs « Commandes Chine » / « Réceptions » (un seul menu Achats et réceptions). */
export function PurchasingTabs({ current }: { current: 'achats' | 'receptions' }) {
  const can = useCan();
  if (!can('purchases.manage') || !can('purchases.receive')) return null;
  return (
    <div className="tabs" role="tablist">
      <button role="tab" aria-selected={current === 'achats'} onClick={() => navigate('/achats')}>Commandes Chine</button>
      <button role="tab" aria-selected={current === 'receptions'} onClick={() => navigate('/receptions')}>Réceptions</button>
    </div>
  );
}
