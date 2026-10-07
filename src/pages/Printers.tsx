// Paramètres → Imprimantes : imprimantes de cet appareil, poste d'impression partagé, options.
import { useState } from 'react';
import { useCan } from '../lib/auth';
import { newId, remove, setMeta, useMeta, useTable } from '../lib/db';
import { getCloud } from '../lib/sync';
import { useCompany } from '../lib/settings';
import {
  CHARSETS, KINDS, PAPERS, SYSTEM_PRINTER, deletePrinter, makeStation, pairBluetooth, pairSerial, pairUsb, printOn, savePrinter, stopStation, support, testDoc, usePrinters,
  type Charset, type Paper, type PrintJob, type PrintStation, type Printer, type PrinterKind,
} from '../lib/print';
import { Badge, Button, Confirm, Empty, IconButton, Modal, SelectField, TextField, Toggle, fmtDateTime, timeAgo, toast } from '../ui/kit';
import { Icon } from '../ui/icons';

const isOnline = (s: PrintStation) => !!s.lastSeen && Date.now() - new Date(s.lastSeen).getTime() < 3 * 60_000;

export function PrintersTab() {
  const can = useCan();
  const company = useCompany();
  const printers = usePrinters();
  const stations = useTable<PrintStation>('printStations');
  const jobs = useTable<PrintJob>('printJobs');
  const mine = useMeta<{ stationId: string; printerId: string } | null>('myStation', null);
  const def = useMeta<string>('printDefault', '');
  const auto = useMeta<boolean>('printAutoTicket', false);
  const [edit, setEdit] = useState<Printer | 'new' | null>(null);
  const [del, setDel] = useState<Printer | null>(null);
  const [station, setStation] = useState(false);
  const [delStation, setDelStation] = useState<PrintStation | null>(null);
  const myStation = stations.find((s) => s.id === mine?.stationId);
  const recent = [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  async function test(p: Printer) {
    try { await printOn(p, testDoc(company, p.name)); toast(p.kind === 'system' ? 'Fenêtre d’impression ouverte' : 'Page de test envoyée'); }
    catch (e: any) { if (e?.name !== 'NotFoundError') toast(e?.message ?? String(e), 'error'); }
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row-between">
          <div><h2>Imprimantes de cet appareil</h2><p className="small muted">Chaque téléphone ou ordinateur a ses propres imprimantes. Donnez-leur un nom clair (ex. « Ticket caisse »).</p></div>
          <Button icon="plus" onClick={() => setEdit('new')}>Ajouter une imprimante</Button>
        </div>
        {printers.length === 0 ? (
          <Empty icon="printer" title="Aucune imprimante ajoutée">
            <p className="small muted">Sans réglage, vous pouvez déjà imprimer avec la fenêtre d’impression de l’appareil ou partager le ticket en image.</p>
          </Empty>
        ) : (
          <ul className="list">
            {printers.map((p) => (
              <li key={p.id} className="list-item">
                <Icon name="printer" />
                <div className="list-item-main">
                  <span className="list-item-title">{p.name} {def === p.id && <Badge tone="brand">Par défaut</Badge>}</span>
                  <p className="small muted">{KINDS[p.kind]} · {PAPERS[p.paper]}{p.deviceName ? ` · ${p.deviceName}` : ''}{p.kind !== 'system' && !p.ref ? ' · pas encore appairée' : ''}</p>
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                  <Button variant="ghost" onClick={() => test(p)}>Test</Button>
                  {def !== p.id && <Button variant="quiet" className="hide-sm" onClick={() => setMeta('printDefault', p.id)}>Par défaut</Button>}
                  <IconButton icon="edit" label="Modifier" onClick={() => setEdit(p)} />
                  <IconButton icon="trash" label="Supprimer" onClick={() => setDel(p)} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="list-item" style={{ padding: 0 }}>
          <Icon name="monitor" />
          <div className="list-item-main"><span className="list-item-title">{SYSTEM_PRINTER.name} {def === SYSTEM_PRINTER.id && <Badge tone="brand">Par défaut</Badge>}</span><p className="small muted">Toujours disponible : AirPrint (iPhone, Mac), imprimantes installées sur Windows, enregistrer en PDF.</p></div>
          <Button variant="ghost" onClick={() => test(SYSTEM_PRINTER)}>Test</Button>
        </div>
        <Toggle checked={auto} onChange={(v) => setMeta('printAutoTicket', v)} label="Imprimer le ticket automatiquement après chaque vente sur place (sur l’imprimante par défaut de cet appareil)" />
      </div>

      <div className="card stack">
        <div><h2>Poste d’impression partagé</h2>
          <p className="small muted">Pour imprimer depuis un iPhone ou un téléphone sans Bluetooth : l’appareil relié à l’imprimante (ex. le téléphone Android ou l’ordinateur de la caisse) devient « poste d’impression ». Les autres appareils lui envoient les tickets par le cloud. Le poste doit rester allumé avec TSENA ouvert.</p></div>
        {!getCloud() && <div className="notice"><Icon name="cloudOff" /><span>Reliez d’abord le cloud (onglet « Cloud et synchronisation ») pour utiliser un poste partagé.</span></div>}
        {myStation ? (
          <div className="notice notice-ok"><Icon name="check" /><span><strong>Cet appareil est le poste « {myStation.name} ».</strong> Il imprime sur « {myStation.printerName} » les tickets envoyés par les autres. <button className="link-btn" onClick={() => setStation(true)}>Modifier</button> · <button className="link-btn" onClick={async () => { await stopStation(); toast('Cet appareil n’est plus un poste d’impression'); }}>Arrêter</button></span></div>
        ) : (
          <Button variant="ghost" icon="cloud" disabled={!getCloud()} onClick={() => setStation(true)}>Faire de cet appareil un poste d’impression</Button>
        )}
        {stations.length > 0 && (
          <ul className="list">
            {stations.map((s) => (
              <li key={s.id} className="list-item">
                <span className={`dot ${isOnline(s) ? 'dot-ok' : 'dot-off'}`} />
                <div className="list-item-main">
                  <span className="list-item-title">{s.name}{s.id === mine?.stationId ? ' (cet appareil)' : ''}</span>
                  <p className="small muted">{s.printerName || '—'} · {isOnline(s) ? 'en ligne' : `vu ${timeAgo(s.lastSeen)}`}</p>
                </div>
                {can('settings.company') && s.id !== mine?.stationId && <IconButton icon="trash" label="Retirer" onClick={() => setDelStation(s)} />}
              </li>
            ))}
          </ul>
        )}
        {recent.length > 0 && (
          <details>
            <summary className="small">Dernières impressions envoyées aux postes</summary>
            <ul className="list">
              {recent.map((j) => (
                <li key={j.id} className="list-item">
                  <div className="list-item-main"><span className="list-item-title">{j.doc?.title}</span><p className="small muted">{fmtDateTime(j.createdAt)} · {j.byName || ''} → {stations.find((s) => s.id === j.stationId)?.name || 'poste retiré'}{j.error ? ` · ${j.error}` : ''}</p></div>
                  <Badge tone={j.status === 'done' ? 'ok' : j.status === 'error' ? 'danger' : 'warn'}>{j.status === 'done' ? 'Imprimé' : j.status === 'error' ? 'Erreur' : 'En attente'}</Badge>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="card stack-s">
        <h2>Quelle imprimante acheter ?</h2>
        <p className="small">Une imprimante à tickets <strong>58 mm « ESC/POS »</strong> avec <strong>Bluetooth et USB</strong>. Sur Android (Chrome) et sur ordinateur (Chrome ou Edge), TSENA imprime directement dessus. Sur iPhone, Apple bloque le Bluetooth direct : utilisez un poste d’impression partagé, une imprimante compatible AirPrint, ou le partage en image.</p>
        <p className="small muted">Ce navigateur : Bluetooth {support.bluetooth ? '✓' : '✗'} · USB {support.usb ? '✓' : '✗'} · Port série {support.serial ? '✓' : '✗'}</p>
      </div>

      {edit && <PrinterForm printer={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {del && <Confirm title="Supprimer cette imprimante ?" message={`« ${del.name} » sera retirée de cet appareil.`} confirmLabel="Supprimer" danger onConfirm={async () => { await deletePrinter(del.id); if (mine?.printerId === del.id) await stopStation(); toast('Imprimante supprimée'); }} onClose={() => setDel(null)} />}
      {station && <StationForm current={myStation} printers={printers} onClose={() => setStation(false)} />}
      {delStation && <Confirm title="Retirer ce poste ?" message={`Les autres appareils ne pourront plus envoyer de tickets à « ${delStation.name} ».`} confirmLabel="Retirer" danger onConfirm={async () => { await remove('printStations', delStation.id); toast('Poste retiré'); }} onClose={() => setDelStation(null)} />}
    </div>
  );
}

function PrinterForm({ printer, onClose }: { printer?: Printer; onClose: () => void }) {
  const company = useCompany();
  const firstKind: PrinterKind = support.bluetooth ? 'bluetooth' : support.usb ? 'usb' : 'system';
  const [p, setP] = useState<Printer>(printer ?? { id: newId(), name: '', kind: firstKind, paper: '58', charset: 'cp858', logo: true, cut: false });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Printer>) => setP({ ...p, ...patch });
  const available = (k: PrinterKind) => k === 'system' || support[k];
  const direct = p.kind !== 'system';

  async function pair() {
    setBusy(true);
    try {
      const r = p.kind === 'bluetooth' ? await pairBluetooth() : p.kind === 'usb' ? await pairUsb() : await pairSerial();
      setP({ ...p, ref: r.ref, deviceName: r.name, name: p.name || r.name });
      toast(`Imprimante trouvée : ${r.name}`);
    } catch (e: any) {
      if (e?.name !== 'NotFoundError') toast(e?.message ?? String(e), 'error');
    } finally { setBusy(false); }
  }
  async function submit() {
    if (!p.name.trim()) return toast('Donnez un nom à l’imprimante.', 'error');
    await savePrinter({ ...p, name: p.name.trim() });
    toast('Imprimante enregistrée'); onClose();
  }

  return (
    <Modal title={printer ? 'Modifier l’imprimante' : 'Ajouter une imprimante'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button>
        {(!direct || p.ref) && <Button variant="ghost" onClick={async () => { try { await printOn(p, testDoc(company, p.name || 'Imprimante')); } catch (e: any) { toast(e?.message ?? String(e), 'error'); } }}>Page de test</Button>}
        <Button onClick={submit}>Enregistrer</Button></>}>
      <div className="stack">
        <TextField label="Nom de l’imprimante" hint="Le nom que vous choisirez au moment d’imprimer, ex. « Ticket caisse »." value={p.name} onChange={(v) => set({ name: v })} />
        <div className="stack-s">
          <strong>Branchement</strong>
          <div className="choice-list">
            {(['bluetooth', 'usb', 'serial', 'system'] as PrinterKind[]).map((k) => (
              <label key={k} className={`choice ${p.kind === k ? 'is-on' : ''} ${available(k) ? '' : 'is-disabled'}`}>
                <input type="radio" name="kind" disabled={!available(k)} checked={p.kind === k} onChange={() => set({ kind: k, ref: undefined, deviceName: undefined })} />
                <span className="choice-text"><strong>{KINDS[k]}</strong><span className="small muted">{{
                  bluetooth: available(k) ? 'Android (Chrome), ordinateur (Chrome/Edge). Allumez l’imprimante avant de chercher.' : 'Pas disponible sur ce navigateur (iPhone/Safari, Firefox).',
                  usb: available(k) ? 'Ordinateur avec Chrome ou Edge, imprimante branchée par câble.' : 'Pas disponible sur ce navigateur.',
                  serial: available(k) ? 'Ordinateur : imprimante Bluetooth appairée dans Windows/macOS, ou câble USB-série.' : 'Pas disponible sur ce navigateur.',
                  system: 'Tous les appareils : la fenêtre d’impression s’ouvre, vous y choisissez l’imprimante.',
                }[k]}</span></span>
              </label>
            ))}
          </div>
        </div>
        {direct && (
          <div className="row" style={{ alignItems: 'center' }}>
            <Button icon="search" busy={busy} onClick={pair}>{p.ref ? 'Chercher une autre imprimante' : 'Chercher l’imprimante'}</Button>
            {p.ref ? <Badge tone="ok">Appairée : {p.deviceName}</Badge> : <span className="small muted">Une liste des appareils proches va s’ouvrir.</span>}
          </div>
        )}
        <div className="grid-2">
          <SelectField label="Papier" value={p.paper} onChange={(v) => set({ paper: v as Paper })} options={(Object.keys(PAPERS) as Paper[]).filter((k) => direct ? k !== 'a4' : true).map((k) => ({ value: k, label: PAPERS[k] }))} />
          {direct && <SelectField label="Jeu de caractères (accents)" value={p.charset} onChange={(v) => set({ charset: v as Charset })} options={(Object.keys(CHARSETS) as Charset[]).map((k) => ({ value: k, label: CHARSETS[k] }))} />}
          {p.kind === 'serial' && <SelectField label="Vitesse du port" value={String(p.baud ?? 9600)} onChange={(v) => set({ baud: Number(v) })} options={[9600, 19200, 38400, 115200].map((b) => ({ value: String(b), label: `${b} bauds` }))} />}
        </div>
        <Toggle checked={p.logo} onChange={(v) => set({ logo: v })} label="Imprimer le logo en haut du ticket" />
        {direct && <Toggle checked={p.cut} onChange={(v) => set({ cut: v })} label="Couper le papier à la fin (si l’imprimante a un massicot)" />}
      </div>
    </Modal>
  );
}

function StationForm({ current, printers, onClose }: { current?: PrintStation; printers: Printer[]; onClose: () => void }) {
  const mine = useMeta<{ printerId: string } | null>('myStation', null);
  const choices = [...printers, SYSTEM_PRINTER];
  const [name, setName] = useState(current?.name ?? 'Caisse boutique');
  const [pid, setPid] = useState(mine?.printerId ?? printers[0]?.id ?? SYSTEM_PRINTER.id);
  const chosen = choices.find((c) => c.id === pid);
  return (
    <Modal title="Poste d’impression" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Annuler</Button><Button disabled={!name.trim()} onClick={async () => { await makeStation(name.trim(), pid); toast('Cet appareil est maintenant un poste d’impression'); onClose(); }}>Enregistrer</Button></>}>
      <div className="stack">
        <TextField label="Nom du poste (vu par les autres appareils)" value={name} onChange={setName} />
        <SelectField label="Imprimante utilisée par ce poste" value={pid} onChange={setPid} options={choices.map((c) => ({ value: c.id, label: c.name }))} />
        {chosen?.kind === 'system' && <div className="notice"><Icon name="alert" /><span>Avec la fenêtre d’impression, quelqu’un devra cliquer « Imprimer » sur ce poste à chaque ticket. Préférez une imprimante en Bluetooth ou USB direct.</span></div>}
        {printers.length === 0 && <p className="small muted">Ajoutez d’abord l’imprimante à tickets de cet appareil (Bluetooth ou USB) pour qu’il imprime tout seul.</p>}
      </div>
    </Modal>
  );
}
