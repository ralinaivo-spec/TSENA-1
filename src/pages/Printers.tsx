// Paramètres → Imprimantes : imprimantes de cet appareil, poste d'impression partagé, options.
import { useEffect, useState } from 'react';
import { useCan } from '../lib/auth';
import { newId, remove, setMeta, useMeta, useTable } from '../lib/db';
import { getCloud } from '../lib/sync';
import { useCompany } from '../lib/settings';
import {
  BT_SPEEDS, CHARSETS, btRemembers, linkState, onLinkChange, useWakeState, type LinkState, KINDS, PAPERS, SYSTEM_PRINTER, cancelJobs, retryJob, reprintJob, deletePrinter, disconnectPrinter, reconnectPrinter, makeStation, pairBluetooth, printCharsetProbe, pairSerial, pairUsb, printOn, savePrinter, stopStation, support, testDoc, usePrinters,
  type BtSpeed, type Charset, type Paper, type PrintJob, type PrintStation, type Printer, type PrinterKind,
} from '../lib/print';
import { Help, Badge, Button, Confirm, Empty, IconButton, Modal, SelectField, TextField, Toggle, fmtDateTime, timeAgo, toast } from '../ui/kit';
import { Icon } from '../ui/icons';

const ua = navigator.userAgent;
const isMac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua);
const isAndroid = /Android/.test(ua);
const where = isMac ? 'du Mac (Réglages Système → Bluetooth)' : isAndroid ? 'du téléphone (Paramètres → Bluetooth)' : 'de l’ordinateur';
const directOk = support.bluetooth || support.usb || support.serial;
const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|CriOS|FxiOS|Firefox/.test(ua);

/** Navigateur sans impression directe (Safari, Firefox) : il faut ouvrir le logiciel dans Chrome ou Edge. */
function BrowserNotice() {
  if (directOk) return null;
  return (
    <div className="notice notice-warn"><Icon name="alert" /><div><strong>Ce navigateur ne peut pas parler directement à une imprimante à tickets.</strong>
      <div className="small">{isSafari ? 'Safari' : 'Ce navigateur'} ne permet ni le Bluetooth ni l’USB direct. Ouvrez Trésor en ligne dans <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong>{isMac ? ' sur ce Mac' : ''} (même adresse, même compte), puis ajoutez l’imprimante ici. Vous pouvez aussi l’installer comme application depuis Chrome (icône ⊕ dans la barre d’adresse).</div></div></div>
  );
}

/** Pas à pas pour une imprimante à tickets 58 mm (Bluetooth + USB), surtout sur Mac. */
/** État réel de la liaison avec l'imprimante (vert : connectée / prête ; rouge : à reconnecter), mis à jour en direct. */
function PrinterLink({ p }: { p: Printer }) {
  const [st, setSt] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (p.kind === 'system' || !p.ref) return;
    let alive = true;
    const read = () => { void linkState(p.kind as 'bluetooth', p.ref!).then((x) => { if (alive) setSt(x); }); };
    read();
    const off = onLinkChange(read);
    const t = setInterval(read, 3000);
    return () => { alive = false; off(); clearInterval(t); };
  }, [p.kind, p.ref]);
  if (!st) return null;
  const ok = st !== 'disconnected';
  return (
    <p className="small row" style={{ margin: 0, gap: 6, alignItems: 'center' }}>
      <span className={`dot ${ok ? 'dot-ok' : 'dot-danger'}`} />
      <strong style={{ color: ok ? 'var(--ok)' : 'var(--danger)' }}>{st === 'connected' ? 'Connectée' : st === 'ready' ? 'Prête (se connecte toute seule)' : 'Non connectée'}</strong>
      {!ok && <Button variant="primary" className="btn-sm" icon="refresh" busy={busy} onClick={async () => { setBusy(true); try { await reconnectPrinter(p); toast(`« ${p.name} » connectée`); } catch (e: any) { if (e?.name !== 'NotFoundError') toast(`Connexion impossible : ${e?.message ?? e}. Vérifiez que l’imprimante est allumée et qu’aucun autre appareil n’y est connecté.`, 'error', { sticky: true }); } finally { setBusy(false); } }}>Se reconnecter maintenant</Button>}
    </p>
  );
}

/** Poste d'impression : ce qui garde la liaison active, et les réglages du téléphone qui la coupent. */
function StationHealth() {
  const wake = useWakeState();
  const wakeOn = useMeta<boolean>('stationWakeLock', true);
  const android = /Android/.test(navigator.userAgent);
  return (
    <div className="card stack-s station-health" style={{ background: 'var(--surface-2)' }}>
      <strong>Pour que le poste ne coupe jamais</strong>
      <Toggle checked={wakeOn !== false} onChange={(v) => setMeta('stationWakeLock', v)} label="Garder l’écran allumé tant que Trésor en ligne est ouvert (conseillé : écran éteint = téléphone endormi = Bluetooth coupé)" />
      <p className="small muted" style={{ margin: 0 }}>Écran : {wake === 'on' ? '✅ maintenu allumé' : wake === 'unsupported' ? '⚠️ ce navigateur ne peut pas le garder allumé : réglez la mise en veille de l’écran sur « Jamais » / 30 min' : '⏸ pas encore actif (revenez sur l’application)'} · Liaison avec l’imprimante : ✅ maintenue toutes les 25 s, reconnexion automatique si elle tombe · Réception des tickets : toutes les 2 s</p>
      <details className="small"><summary><strong>Réglages {android ? 'du téléphone Android' : 'de l’appareil'} à faire une fois</strong></summary>
        <ol className="guide-steps" style={{ marginTop: 8 }}>
          <li><strong>Laissez le téléphone branché au chargeur</strong> et Trésor en ligne <strong>ouvert à l’écran</strong> (pas en arrière-plan, pas une autre application par-dessus).</li>
          {android && <li><strong>Batterie de Chrome sans restriction</strong> : Paramètres → Applications → Chrome → Batterie → <strong>« Non restreinte »</strong> (ou « Pas d’optimisation »). Si Trésor en ligne est installé comme application, faites pareil pour lui. Retirez Chrome des « applications en veille / mises en veille profonde » (Samsung : Paramètres → Batterie → Limites d’utilisation en arrière-plan).</li>}
          {android && <li><strong>Économiseur de batterie désactivé</strong> sur le poste (il coupe le Bluetooth et endort les pages).</li>}
          <li><strong>Mise en veille de l’écran</strong> : 30 min ou « Jamais » si l’option ci-dessus ne suffit pas.</li>
          {!btRemembers() && android && <li><strong>Reconnexion automatique après réouverture</strong> (facultatif) : dans Chrome, ouvrez <em>chrome://flags</em>, cherchez <em>« Web Bluetooth new permissions backend »</em>, mettez <strong>Enabled</strong>, redémarrez Chrome. Chrome se souviendra alors de l’imprimante : plus besoin de cliquer « Reconnecter » quand le logiciel est rouvert.</li>}
          <li><strong>Imprimante</strong> : sur secteur, à moins de 3 mètres, et <strong>un seul appareil connecté à elle</strong> (déconnectez-la des autres téléphones / ordinateurs). Si elle s’éteint seule après quelques minutes, désactivez son arrêt automatique (notice ou application du fabricant).</li>
          <li><strong>Le plus fiable</strong> : relier l’imprimante au téléphone par un <strong>câble USB OTG</strong> (USB-C ou micro-USB vers USB, ~5 000 Ar) et choisir « USB (direct) » : pas de coupure Bluetooth, et reconnexion automatique même après réouverture.</li>
        </ol>
      </details>
    </div>
  );
}

function TicketPrinterGuide({ open }: { open: boolean }) {
  return (
    <details className="card printer-guide" open={open}>
      <summary><strong>Imprimante à tickets 58 mm (ex. JK-5803H, « POS-58 », « KPrinter ») : comment la brancher</strong></summary>
      <div className="stack-s small" style={{ marginTop: 10 }}>
        <p className="muted" style={{ margin: 0 }}>Aucun logiciel ni pilote à installer : Trésor en ligne envoie le ticket directement à l’imprimante. {isMac ? 'Inutile de l’ajouter dans « Imprimantes et scanners » du Mac.' : ''}</p>
        <ol className="guide-steps">
          <li><strong>Allumez l’imprimante</strong> (papier en place) et ouvrez le logiciel dans <strong>Chrome</strong> ou <strong>Edge</strong>.</li>
          <li><strong>Ajouter une imprimante</strong> → Branchement <strong>« Bluetooth (direct) »</strong> → <strong>Chercher l’imprimante</strong> → choisissez son nom (ex. <em>KPrinter_6193</em>) → Associer.</li>
          <li>Si son nom n’apparaît pas dans la liste (imprimantes Bluetooth « classiques », ex. <em>JK-301PL</em>) : appairez-la d’abord dans les réglages Bluetooth {where} (code souvent <strong>0000</strong> ou <strong>1234</strong>), puis choisissez le branchement <strong>« Port série / Bluetooth appairé »</strong> et sélectionnez <em>KPrinter_…</em>.</li>
          <li>Avec le câble USB : branchement <strong>« USB (direct) »</strong> → choisissez <em>POS-58</em> / <em>Printer POS-58</em>.</li>
          <li>Papier <strong>58 mm</strong>, puis <strong>Test des accents</strong> : un petit ticket sort avec des lignes A, C, D. Choisissez dans « Jeu de caractères » la lettre dont la ligne <em>é è à ç</em> est bien écrite.</li>
          <li>Enregistrez, mettez-la <strong>« Par défaut »</strong>. Ensuite, le bouton <strong>Imprimer</strong> (ticket de caisse, ticket client, bon de livraison, étiquette) l’utilise directement. Après chaque réouverture du logiciel, la première impression peut demander de recliquer sur l’imprimante dans la liste (sécurité du navigateur).</li>
        </ol>
      </div>
    </details>
  );
}

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
  const [disc, setDisc] = useState<Printer | null>(null);
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
      <BrowserNotice />
      <TicketPrinterGuide open={!printers.some((p) => p.kind !== 'system')} />
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
                  {p.kind !== 'system' && p.ref && (p.paused
                    ? <p className="small" style={{ margin: 0 }}><Badge tone="neutral">Déconnectée</Badge> <span className="muted">Libérée : un autre appareil peut s’y associer (ex. pour devenir le poste d’impression).</span></p>
                    : <PrinterLink p={p} />)}
                </div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {p.kind !== 'system' && p.ref && (p.paused
                    ? <Button variant="ghost" icon="refresh" onClick={async () => { try { await reconnectPrinter(p); toast(`« ${p.name} » reconnectée à cet appareil`); } catch (e: any) { if (e?.name !== 'NotFoundError') toast(`Reconnexion impossible : ${e?.message ?? e}. Vérifiez qu’elle est allumée et libérée sur l’autre appareil.`, 'error'); } }}>Reconnecter</Button>
                    : <Button variant="ghost" onClick={() => setDisc(p)}>Déconnecter</Button>)}
                  {!p.paused && <Button variant="ghost" onClick={() => test(p)}>Test</Button>}
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
          <Help>Comme une imprimante en réseau : <strong>n’importe quel appareil</strong> relié à l’imprimante (l’ordinateur de la caisse, ou un <strong>téléphone Android</strong> avec Chrome ; pas un iPhone, qui ne permet pas le Bluetooth direct) devient « poste d’impression », et <strong>tous les autres appareils</strong> (téléphones, iPhone, tablettes, autres ordinateurs) y impriment en choisissant son nom dans « Imprimer ». Les tickets passent par le cloud : le poste doit rester allumé, connecté à Internet, avec Trésor en ligne ouvert (dans Chrome). Celui qui envoie est prévenu quand le ticket est sorti. Conseil : sur le poste, reliez l’imprimante en <strong>USB</strong> ou en <strong>Bluetooth appairé (port série)</strong> : elle se reconnecte toute seule à la réouverture ; en Bluetooth direct, un bandeau demande un clic sur « Reconnecter » après chaque réouverture. Pour changer d’appareil poste : « Déconnecter » l’imprimante ici, puis l’associer sur l’autre appareil.</Help></div>
        {!getCloud() && <div className="notice"><Icon name="cloudOff" /><span>Reliez d’abord le cloud (onglet « Cloud et synchronisation ») pour utiliser un poste partagé.</span></div>}
        {myStation ? (
<>          <div className="notice notice-ok"><Icon name="check" /><span><strong>Cet appareil est le poste « {myStation.name} ».</strong> Il imprime sur « {myStation.printerName} » les tickets envoyés par les autres. <button className="link-btn" onClick={() => setStation(true)}>Modifier</button> · <button className="link-btn" onClick={async () => { await stopStation(); toast('Cet appareil n’est plus un poste d’impression'); }}>Arrêter</button></span></div>
          <StationHealth />
          </>
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
                  {s.alert && <p className="small" style={{ margin: 0 }}><Badge tone="warn">Imprimante à reconnecter</Badge> Sur l’appareil « {s.name} », cliquez « Reconnecter l’imprimante » (bandeau en haut de l’écran) : les tickets en attente sortiront.</p>}
                </div>
                {can('settings.company') && s.id !== mine?.stationId && <IconButton icon="trash" label="Retirer" onClick={() => setDelStation(s)} />}
              </li>
            ))}
          </ul>
        )}
        {recent.length > 0 && (
          <details id="print-history">
            <summary className="small">Dernières impressions envoyées aux postes</summary>
            <ul className="list">
              {recent.map((j) => (
                <li key={j.id} className="list-item">
                  <div className="list-item-main"><span className="list-item-title">{j.doc?.title}</span><p className="small muted">{fmtDateTime(j.createdAt)} · {j.byName || ''} → {stations.find((s) => s.id === j.stationId)?.name || 'poste retiré'}{j.error ? ` · ${j.error}` : ''}</p></div>
                  <Badge tone={j.status === 'done' ? 'ok' : j.status === 'error' ? 'danger' : 'warn'}>{j.status === 'done' ? 'Imprimé' : j.status === 'error' ? 'Erreur' : 'En attente'}</Badge>
                  {j.status !== 'done'
                    ? <Button variant="ghost" className="btn-sm" icon="refresh" onClick={async () => { await retryJob(j); toast('Ticket relancé sur le poste'); }}>Réessayer</Button>
                    : <Button variant="ghost" className="btn-sm" icon="printer" onClick={async () => { try { toast(await reprintJob(j)); } catch (e: any) { toast(e?.message ?? String(e), 'error'); } }}>Réimprimer</Button>}
                  {j.status !== 'done' && <IconButton icon="trash" label={j.status === 'pending' ? 'Annuler ce ticket (il ne sortira pas)' : 'Effacer'} onClick={async () => { await cancelJobs([j.id]); toast(j.status === 'pending' ? 'Ticket annulé : il ne sortira pas' : 'Effacé'); }} />}
                </li>
              ))}
            </ul>
            {(() => { const stuck = jobs.filter((j) => j.status !== 'done'); return stuck.length > 0 && (
              <Button variant="ghost" icon="trash" onClick={async () => { await cancelJobs(stuck.map((j) => j.id)); toast(`${stuck.length} ticket(s) en attente ou en erreur effacé(s)`); }}>Effacer les tickets en attente et en erreur ({stuck.length})</Button>
            ); })()}
          </details>
        )}
      </div>

      <div className="card stack-s">
        <h2>Quelle imprimante acheter ?</h2>
        <p className="small">Une imprimante à tickets <strong>58 mm « ESC/POS »</strong> avec <strong>Bluetooth et USB</strong>. Sur Android (Chrome) et sur ordinateur (Chrome ou Edge), Trésor en ligne imprime directement dessus. Sur iPhone, Apple bloque le Bluetooth direct : utilisez un poste d’impression partagé, une imprimante compatible AirPrint, ou le partage en image.</p>
        <p className="small muted">Ce navigateur : Bluetooth {support.bluetooth ? '✓' : '✗'} · USB {support.usb ? '✓' : '✗'} · Port série {support.serial ? '✓' : '✗'}</p>
      </div>

      {edit && <PrinterForm printer={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {disc && <Confirm title="Déconnecter cette imprimante ?" confirmLabel="Déconnecter" message={<div className="stack-s"><p style={{ margin: 0 }}>« {disc.name} » sera libérée de cet appareil <strong>sans être supprimée</strong> : ses réglages restent, et « Reconnecter » la reprend en un clic.</p><p className="small muted" style={{ margin: 0 }}>Une imprimante Bluetooth ne se connecte qu’à un seul appareil à la fois : une fois libérée, associez-la sur le téléphone ou l’ordinateur qui doit devenir le poste d’impression.</p>{mine?.printerId === disc.id && <p className="small" style={{ margin: 0 }}><strong>Cet appareil est le poste d’impression : il arrêtera de l’être.</strong></p>}</div>} onConfirm={async () => { await disconnectPrinter(disc); toast(`« ${disc.name} » déconnectée : vous pouvez l’associer à un autre appareil`); }} onClose={() => setDisc(null)} />}
      {del && <Confirm title="Supprimer cette imprimante ?" message={`« ${del.name} » sera retirée de cet appareil.`} confirmLabel="Supprimer" danger onConfirm={async () => { await deletePrinter(del.id); if (mine?.printerId === del.id) await stopStation(); toast('Imprimante supprimée'); }} onClose={() => setDel(null)} />}
      {station && <StationForm current={myStation} printers={printers} onClose={() => setStation(false)} />}
      {delStation && <Confirm title="Retirer ce poste ?" message={`Les autres appareils ne pourront plus envoyer de tickets à « ${delStation.name} ».`} confirmLabel="Retirer" danger onConfirm={async () => { await remove('printStations', delStation.id); toast('Poste retiré'); }} onClose={() => setDelStation(null)} />}
    </div>
  );
}

function PrinterForm({ printer, onClose }: { printer?: Printer; onClose: () => void }) {
  const company = useCompany();
  const firstKind: PrinterKind = support.bluetooth ? 'bluetooth' : support.usb ? 'usb' : 'system';
  const [p, setP] = useState<Printer>(printer ?? { id: newId(), name: '', kind: firstKind, paper: '58', charset: 'cp850', logo: true, cut: false });
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
        {direct && p.ref && <Button variant="ghost" onClick={async () => { try { await printCharsetProbe(p); toast('Ticket « Test des accents » envoyé : choisissez la lettre bien imprimée'); } catch (e: any) { if (e?.name !== 'NotFoundError') toast(e?.message ?? String(e), 'error'); } }}>Test des accents</Button>}
        {(!direct || p.ref) && <Button variant="ghost" onClick={async () => { try { await printOn(p, testDoc(company, p.name || 'Imprimante')); } catch (e: any) { if (e?.name !== 'NotFoundError') toast(e?.message ?? String(e), 'error'); } }}>Page de test</Button>}
        <Button onClick={submit}>Enregistrer</Button></>}>
      <div className="stack">
        <TextField label="Nom de l’imprimante" required hint="Le nom que vous choisirez au moment d’imprimer, ex. « Ticket caisse »." value={p.name} onChange={(v) => set({ name: v })} />
        <div className="stack-s">
          <strong>Branchement</strong>
          <div className="choice-list">
            {(['bluetooth', 'usb', 'serial', 'system'] as PrinterKind[]).map((k) => (
              <label key={k} className={`choice ${p.kind === k ? 'is-on' : ''} ${available(k) ? '' : 'is-disabled'}`}>
                <input type="radio" name="kind" disabled={!available(k)} checked={p.kind === k} onChange={() => set({ kind: k, ref: undefined, deviceName: undefined })} />
                <span className="choice-text"><strong>{KINDS[k]}</strong><span className="small muted">{{
                  bluetooth: available(k) ? 'Android (Chrome), ordinateur (Chrome/Edge). Allumez l’imprimante avant de chercher.' : 'Pas disponible sur ce navigateur (iPhone/Safari, Firefox).',
                  usb: available(k) ? 'Ordinateur avec Chrome ou Edge, imprimante branchée par câble.' : 'Pas disponible sur ce navigateur.',
                  serial: available(k) ? 'Imprimante Bluetooth « classique » (ex. JK-301PL) déjà appairée dans les réglages Bluetooth du téléphone Android ou de l’ordinateur, ou câble USB-série.' : (isAndroid ? 'Pas disponible : mettez à jour Google Chrome sur ce téléphone (Play Store), puis rouvrez le logiciel.' : 'Pas disponible sur ce navigateur.'),
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
        {p.kind === 'bluetooth' && !p.ref && <p className="small muted" style={{ margin: 0 }}>Le nom de l’imprimante n’apparaît pas dans la liste ? Elle utilise le Bluetooth « classique » (ex. JK-301PL) : appairez-la dans les réglages Bluetooth {where}, puis choisissez ci-dessus « Port série / Bluetooth appairé ».</p>}
        {p.kind === 'serial' && !p.ref && <p className="small muted" style={{ margin: 0 }}>Appairez d’abord l’imprimante dans les réglages Bluetooth {where}, puis cliquez sur « Chercher l’imprimante » : elle apparaît sous son nom (ex. « KPrinter_… »).</p>}
        <div className="grid-2">
          <SelectField label="Papier" value={p.paper} onChange={(v) => set({ paper: v as Paper })} options={(Object.keys(PAPERS) as Paper[]).filter((k) => direct ? k !== 'a4' : true).map((k) => ({ value: k, label: PAPERS[k] }))} />
          {direct && <SelectField label="Jeu de caractères (accents)" value={p.charset} onChange={(v) => set({ charset: v as Charset })} options={(Object.keys(CHARSETS) as Charset[]).filter((k) => k !== 'cp858' || p.charset === 'cp858').map((k) => ({ value: k, label: CHARSETS[k] }))} />}
          {direct && <SelectField label="Espace blanc en bas du ticket" hint="Pour déchirer sans couper le texte." value={String(p.feedMm ?? 20)} onChange={(v) => set({ feedMm: Number(v) })} options={[10, 15, 20, 25, 30].map((n) => ({ value: String(n), label: `${n / 10} cm${n === 20 ? ' (conseillé)' : ''}` }))} />}
          {p.kind === 'bluetooth' && <SelectField label="Envoi Bluetooth" hint="Si le ticket s’arrête au milieu : choisissez « Normal »." value={p.btSpeed ?? 'safe'} onChange={(v) => set({ btSpeed: v as BtSpeed })} options={(Object.keys(BT_SPEEDS) as BtSpeed[]).map((k) => ({ value: k, label: BT_SPEEDS[k] }))} />}
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
        <TextField label="Nom du poste (vu par les autres appareils)" required value={name} onChange={setName} />
        <SelectField label="Imprimante utilisée par ce poste" value={pid} onChange={setPid} options={choices.map((c) => ({ value: c.id, label: c.name }))} />
        {chosen?.kind === 'bluetooth' && <div className="notice"><Icon name="alert" /><span>En Bluetooth direct, le navigateur demande un clic pour se reconnecter après chaque réouverture du logiciel (un bandeau « Reconnecter l’imprimante » s’affichera). En USB ou en « Port série / Bluetooth appairé », le poste se reconnecte tout seul.</span></div>}
        {chosen?.kind === 'system' && <div className="notice"><Icon name="alert" /><span>Avec la fenêtre d’impression, quelqu’un devra cliquer « Imprimer » sur ce poste à chaque ticket. Préférez une imprimante en Bluetooth ou USB direct.</span></div>}
        {printers.length === 0 && <p className="small muted">Ajoutez d’abord l’imprimante à tickets de cet appareil (Bluetooth ou USB) pour qu’il imprime tout seul.</p>}
      </div>
    </Modal>
  );
}
