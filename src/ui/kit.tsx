// Composants d'interface réutilisables : boutons, champs, fenêtres, notifications, navigation.
import { useEffect, useId, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

// ---- Navigation (adresse après le #, compatible GitHub Pages et hors ligne) ----
const routeSubs = new Set<() => void>();
window.addEventListener('hashchange', () => routeSubs.forEach((f) => f()));
export function useRoute(): string {
  return useSyncExternalStore((cb) => { routeSubs.add(cb); return () => routeSubs.delete(cb); }, () => location.hash.slice(1) || '/');
}
export function navigate(path: string) { location.hash = path; }

// ---- Notifications ----
interface Toast { id: number; text: string; kind: 'ok' | 'error' | 'info' }
let toasts: Toast[] = [];
const toastSubs = new Set<() => void>();
export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const t = { id: Date.now() + Math.random(), text, kind };
  toasts = [...toasts.slice(-2), t];
  toastSubs.forEach((f) => f());
  setTimeout(() => { toasts = toasts.filter((x) => x !== t); toastSubs.forEach((f) => f()); }, kind === 'error' ? 6000 : 3500);
}
export function Toasts() {
  const list = useSyncExternalStore((cb) => { toastSubs.add(cb); return () => toastSubs.delete(cb); }, () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <Icon name={t.kind === 'error' ? 'alert' : 'check'} size={18} />
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Boutons ----
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'quiet'; icon?: IconName; busy?: boolean; block?: boolean };
export function Button({ variant = 'primary', icon, busy, block, children, className = '', disabled, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${className}`} disabled={disabled || busy} {...rest}>
      {busy ? <span className="spinner" aria-hidden /> : icon ? <Icon name={icon} size={18} /> : null}
      {children && <span>{children}</span>}
    </button>
  );
}
export function IconButton({ icon, label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string }) {
  return (
    <button className="icon-btn" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

// ---- Champs ----
export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
export function TextField({ label, hint, error, value, onChange, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; hint?: ReactNode; error?: string | null; value: string; onChange: (v: string) => void }) {
  return <Field label={label} hint={hint} error={error}>{(id) => <input id={id} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />}</Field>;
}
export function PasswordField({ label, hint, error, value, onChange, autoComplete = 'current-password', autoFocus }: { label: string; hint?: ReactNode; error?: string | null; value: string; onChange: (v: string) => void; autoComplete?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {(id) => (
        <div className="input-with-btn">
          <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} />
          <button type="button" className="input-btn" onClick={() => setShow(!show)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
            <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
      )}
    </Field>
  );
}
export function SelectField({ label, hint, value, onChange, options }: { label: string; hint?: ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden><span className="toggle-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

// ---- Fenêtre (modale) ----
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.classList.add('no-scroll');
    return () => { window.removeEventListener('keydown', k); document.body.classList.remove('no-scroll'); };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Fermer" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** Confirmation d'une action risquée ; pour les plus graves, il faut taper un mot. */
export function Confirm({ title, message, confirmLabel, danger, typeToConfirm, onConfirm, onClose }: { title: string; message: ReactNode; confirmLabel: string; danger?: boolean; typeToConfirm?: string; onConfirm: () => Promise<void> | void; onClose: () => void }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm;
  return (
    <Modal title={title} onClose={onClose} footer={
      <>
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button variant={danger ? 'danger' : 'primary'} busy={busy} disabled={!ok} onClick={async () => {
          setBusy(true);
          try { await onConfirm(); onClose(); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
        }}>{confirmLabel}</Button>
      </>
    }>
      <div className="stack">
        {danger && <div className="notice notice-danger"><Icon name="alert" /><span><strong>Action risquée.</strong> Vérifiez bien avant de confirmer : elle peut être difficile ou impossible à défaire. Elle est notée dans le journal d’activité avec votre nom.</span></div>}
        <div>{message}</div>
        {typeToConfirm && <TextField label={`Pour confirmer, tapez ${typeToConfirm}`} value={typed} onChange={setTyped} autoFocus />}
      </div>
    </Modal>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'brand' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <p className="empty-title">{title}</p>
      {children}
    </div>
  );
}

export const fmtDateTime = (iso?: string) => iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
export function timeAgo(iso?: string) {
  if (!iso) return 'jamais';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `le ${fmtDate(iso)}`;
}
