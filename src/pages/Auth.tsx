// Écrans d'accès : connexion, première connexion, mot de passe oublié, verrouillage.
import { useState, type ReactNode } from 'react';
import { checkPasswordStrength, checkSecretAnswer, findUser, managesOwnPassword, login, logout, roleOf, SECRET_QUESTIONS, setPassword, setSecretQuestion, audit, type User } from '../lib/auth';
import { all, save, setMeta, useMeta, useTable } from '../lib/db';
import { checkPin, hasPin, maskEmail, resetByEmail, sendResetLink } from '../lib/maintenance';
import { getCloud } from '../lib/sync';
import { useCompany } from '../lib/settings';
import { connectCloud } from '../lib/sync';
import { Button, PasswordField, SelectField, TextField, toast } from '../ui/kit';
import { Icon } from '../ui/icons';

export function BrandLogo({ size }: { size?: number }) {
  const c = useCompany();
  return (
    <span className="brand-logo" style={size ? { width: size, height: size } : undefined}>
      {c.logo ? <img src={c.logo} alt="" /> : (c.name || 'T').trim().charAt(0).toUpperCase()}
    </span>
  );
}

function AuthShell({ children }: { children: ReactNode }) {
  const c = useCompany();
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="auth-awning" aria-hidden />
        <div className="auth-company">
          <BrandLogo />
          <span className="small" style={{ opacity: .85 }}>{c.slogan || 'Gestion commerciale'}</span>
        </div>
        <h1 className="auth-title">{c.name}</h1>
        <p className="auth-tagline">Achats, stock, ventes, livraisons et caisse — même sans connexion.</p>
      </aside>
      <main className="auth-main"><div className="auth-card">{children}</div></main>
    </div>
  );
}

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'forgot' | 'cloud'>('login');
  if (mode === 'forgot') return <ForgotScreen onBack={() => setMode('login')} />;
  if (mode === 'cloud') return <CloudScreen onBack={() => setMode('login')} />;
  return <LoginForm onForgot={() => setMode('forgot')} onCloud={() => setMode('cloud')} />;
}

function LoginForm({ onForgot, onCloud }: { onForgot: () => void; onCloud: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell>
      <div>
        <h2>Connexion</h2>
        <p className="muted">Entrez le nom d'utilisateur et le mot de passe donnés par votre admin.</p>
      </div>
      <ResetErrorNotice />
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try { await login(username, password); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
      }}>
        <TextField label="Nom d'utilisateur" value={username} onChange={setUsername} autoComplete="username" autoCapitalize="none" autoCorrect="off" autoFocus />
        <PasswordField label="Mot de passe" value={password} onChange={setPwd} />
        {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
        <Button type="submit" busy={busy} block disabled={!username || !password}>Se connecter</Button>
      </form>
      <div className="row-between">
        <Button variant="quiet" type="button" onClick={onForgot}>Mot de passe oublié ?</Button>
        <Button variant="quiet" type="button" icon="cloud" onClick={onCloud}>Relier au cloud</Button>
      </div>
      <p className="small muted">Nouvel appareil ? Reliez-le d'abord au cloud de la société pour retrouver vos comptes et vos données.</p>
    </AuthShell>
  );
}

function ForgotScreen({ onBack }: { onBack: () => void }) {
  const [username, setUsername] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [method, setMethod] = useState<'' | 'question' | 'email'>('');
  const [sent, setSent] = useState(false);
  const cloud = getCloud();
  const [answer, setAnswer] = useState('');
  const [verified, setVerified] = useState(false);
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = pwd ? checkPasswordStrength(pwd) : null;

  return (
    <AuthShell>
      <div>
        <h2>Mot de passe oublié</h2>
        <p className="muted">{!user ? 'Indiquez votre nom d’utilisateur.' : method === 'email' ? 'Un lien va être envoyé à l’adresse e-mail de la société.' : method === 'question' ? 'Répondez à votre question secrète pour choisir un nouveau mot de passe.' : 'Comment voulez-vous retrouver l’accès ?'}</p>
      </div>
      {!user && (
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          const u = findUser(username);
          if (!u) return setError("Ce nom d'utilisateur n'existe pas sur cet appareil.");
          if (!managesOwnPassword(u)) return setError("Votre mot de passe est donné par le gérant : demandez-lui de vous le redonner.");
          if (!u.secretAnswerHash && !getCloud()) return setError("Ce compte n'a pas de question secrète et l'appareil n'est pas relié au cloud. Demandez au super-admin de réinitialiser votre mot de passe.");
          setError(null); setUser(u);
          setMethod(!getCloud() ? 'question' : !u.secretAnswerHash ? 'email' : '');
        }}>
          <TextField label="Nom d'utilisateur" value={username} onChange={setUsername} autoCapitalize="none" autoFocus />
          {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
          <Button type="submit" block disabled={!username}>Continuer</Button>
        </form>
      )}
      {user && !method && (
        <div className="stack">
          <Button block variant="ghost" icon="key" onClick={() => setMethod('question')}>Répondre à ma question secrète</Button>
          <Button block variant="ghost" icon="cloud" onClick={() => setMethod('email')}>Recevoir un lien par e-mail</Button>
        </div>
      )}
      {user && method === 'email' && (
        sent ? (
          <div className="notice notice-ok"><Icon name="check" /><span>E-mail envoyé à <strong>{maskEmail(cloud?.email || '')}</strong>. Ouvrez-le <strong>sur cet appareil</strong> (ou un autre appareil où TSENA est relié au cloud) et touchez le lien : vous pourrez choisir un nouveau mot de passe. Le lien est valable 1 heure. Pensez à regarder dans les spams.</span></div>
        ) : (
          <form className="stack" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setError(null);
            try { await sendResetLink(user); setSent(true); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
          }}>
            <div className="card"><p className="small muted">Le lien sera envoyé à l’adresse du compte cloud de la société</p><p><strong>{maskEmail(cloud?.email || '')}</strong></p></div>
            {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
            <Button type="submit" block busy={busy}>Envoyer le lien</Button>
          </form>
        )
      )}
      {user && method === 'question' && !user.secretAnswerHash && <div className="notice notice-danger"><Icon name="alert" /><span>Ce compte n’a pas de question secrète.</span></div>}
      {user && method === 'question' && user.secretAnswerHash && !verified && (
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await checkSecretAnswer(user, answer)) { setVerified(true); setError(null); }
          else setError('Réponse incorrecte. Les majuscules et les accents ne comptent pas.');
          setBusy(false);
        }}>
          <div className="card"><p className="small muted">Votre question</p><p><strong>{user.secretQuestion}</strong></p></div>
          <TextField label="Votre réponse" value={answer} onChange={setAnswer} autoFocus autoComplete="off" />
          {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
          <Button type="submit" block busy={busy} disabled={!answer}>Vérifier</Button>
        </form>
      )}
      {user && verified && (
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          if (strength) return;
          if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques.');
          setBusy(true);
          await setPassword(user.id, pwd, { reason: 'Réinitialisé par question secrète' });
          setBusy(false);
          toast('Mot de passe changé. Connectez-vous.');
          onBack();
        }}>
          <PasswordField label="Nouveau mot de passe" value={pwd} onChange={setPwd} autoComplete="new-password" error={strength} hint="Au moins 6 caractères, lettres et chiffres." autoFocus />
          <PasswordField label="Retapez le mot de passe" value={pwd2} onChange={setPwd2} autoComplete="new-password" error={error} />
          <Button type="submit" block busy={busy} disabled={!pwd || !pwd2}>Enregistrer le mot de passe</Button>
        </form>
      )}
      <Button variant="quiet" onClick={onBack}>Retour à la connexion</Button>
    </AuthShell>
  );
}

function CloudScreen({ onBack }: { onBack: () => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthShell>
      <div>
        <h2>Relier cet appareil au cloud</h2>
        <p className="muted">Les comptes et les données de la société seront téléchargés sur cet appareil.</p>
      </div>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try { await connectCloud(url, key, email, pwd); toast('Appareil relié. Les données arrivent…'); onBack(); }
        catch (err: any) { setError(err.message); }
        finally { setBusy(false); }
      }}>
        <CloudFields url={url} setUrl={setUrl} k={key} setK={setKey} email={email} setEmail={setEmail} pwd={pwd} setPwd={setPwd} />
        {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
        <Button type="submit" busy={busy} block disabled={!url || !key || !email || !pwd}>Relier l'appareil</Button>
      </form>
      <Button variant="quiet" onClick={onBack}>Retour à la connexion</Button>
    </AuthShell>
  );
}

export function CloudFields({ url, setUrl, k, setK, email, setEmail, pwd, setPwd }: { url: string; setUrl: (v: string) => void; k: string; setK: (v: string) => void; email: string; setEmail: (v: string) => void; pwd: string; setPwd: (v: string) => void }) {
  return (
    <>
      <TextField label="Adresse du projet (Project URL)" value={url} onChange={setUrl} placeholder="https://xxxx.supabase.co" autoCapitalize="none" inputMode="url" />
      <TextField label="Clé publique (anon / publishable key)" value={k} onChange={setK} autoCapitalize="none" autoComplete="off" />
      <TextField label="E-mail du compte cloud de la société" value={email} onChange={setEmail} type="email" autoCapitalize="none" />
      <PasswordField label="Mot de passe du compte cloud" value={pwd} onChange={setPwd} autoComplete="off" />
    </>
  );
}

/** Première connexion : nouveau mot de passe obligatoire, puis question secrète. */
export function FirstSetupScreen({ user }: { user: User }) {
  const needPwd = !!user.mustChangePassword;
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [question, setQuestion] = useState(user.secretQuestion || SECRET_QUESTIONS[0]);
  const [custom, setCustom] = useState('');
  const [answer, setAnswer] = useState('');
  const [email, setEmail] = useState(user.email || '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = pwd ? checkPasswordStrength(pwd) : null;
  const finalQuestion = question === '__custom' ? custom.trim() : question;

  return (
    <AuthShell>
      <div>
        <h2>Bienvenue, {user.fullName}</h2>
        <p className="muted">
          {needPwd ? 'Choisissez votre propre mot de passe, puis une question secrète pour le retrouver si vous l’oubliez.' : 'Choisissez une question secrète pour pouvoir retrouver votre mot de passe.'}
        </p>
      </div>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (needPwd) {
          if (strength) return;
          if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques.');
        }
        if (!finalQuestion) return setError('Écrivez votre question.');
        if (answer.trim().length < 2) return setError('Écrivez une réponse.');
        setBusy(true);
        try {
          if (needPwd) await setPassword(user.id, pwd, { reason: 'Changé à la première connexion' });
          await setSecretQuestion(user.id, finalQuestion, answer);
          if (email !== (user.email || '')) await save('users', { id: user.id, email: email.trim() });
          await audit('Compte', 'Première connexion terminée', 'users', user.id);
          toast('Votre compte est prêt.');
        } catch (err: any) { setError(err.message); }
        finally { setBusy(false); }
      }}>
        {needPwd && (
          <>
            <PasswordField label="Nouveau mot de passe" value={pwd} onChange={setPwd} autoComplete="new-password" error={strength} hint="Au moins 6 caractères, lettres et chiffres." autoFocus />
            <PasswordField label="Retapez le mot de passe" value={pwd2} onChange={setPwd2} autoComplete="new-password" />
          </>
        )}
        <SelectField label="Question secrète" value={question} onChange={setQuestion} hint="Choisissez une question dont vous seul connaissez la réponse."
          options={[...SECRET_QUESTIONS.map((q) => ({ value: q, label: q })), { value: '__custom', label: 'Écrire ma propre question…' }]} />
        {question === '__custom' && <TextField label="Votre question" value={custom} onChange={setCustom} />}
        <TextField label="Réponse" value={answer} onChange={setAnswer} autoComplete="off" hint="Les majuscules et les accents ne comptent pas." />
        <TextField label="E-mail (facultatif)" type="email" value={email} onChange={setEmail} autoCapitalize="none" />
        {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
        <Button type="submit" busy={busy} block>Terminer</Button>
      </form>
      <div className="row-between">
        <Button variant="ghost" onClick={async () => { await audit('Compte', 'Première configuration reportée', 'users', user.id); await setMeta('setupSkipped', true); }}>Plus tard</Button>
        <Button variant="quiet" onClick={() => logout()}>Se déconnecter</Button>
      </div>
      <p className="small muted">« Plus tard » : cet écran reviendra à la prochaine connexion.</p>
    </AuthShell>
  );
}

/** Écran de verrouillage après inactivité. */
export function LockScreen({ user, onUnlock }: { user: User; onUnlock: () => void }) {
  const pins = useMeta<Record<string, string>>('pins', {});
  const withPin = !!pins[user.id];
  const [usePwd, setUsePwd] = useState(!withPin);
  const [pwd, setPwd] = useState('');
  const [pin, setPin] = useState('');
  const [tries, setTries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const unlock = async () => { await setMeta('lastActivity', Date.now()); onUnlock(); };
  return (
    <AuthShell>
      <div className="row">
        <span className="avatar">{user.fullName.charAt(0).toUpperCase()}</span>
        <div>
          <h2>{user.fullName}</h2>
          <p className="muted small">{roleOf(user)?.name} · session verrouillée</p>
        </div>
      </div>
      {!usePwd ? (
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError(null);
          if (await checkPin(user.id, pin)) { await unlock(); }
          else { const t = tries + 1; setTries(t); setPin(''); if (t >= 5) { setUsePwd(true); setError('Trop d’essais : entrez votre mot de passe.'); } else setError(`Code incorrect (${5 - t} essai(s) restant(s)).`); }
          setBusy(false);
        }}>
          <div className="field"><label htmlFor="pin">Code PIN</label>
            <input id="pin" className="pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} autoFocus onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
          {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
          <Button type="submit" busy={busy} block icon="lock" disabled={pin.length < 4}>Déverrouiller</Button>
          <Button variant="quiet" type="button" onClick={() => { setUsePwd(true); setError(null); }}>Utiliser mon mot de passe</Button>
        </form>
      ) : (
        <form className="stack" onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true); setError(null);
          try { await login(user.username, pwd); await unlock(); }
          catch (err: any) { setError(err.message); }
          finally { setBusy(false); }
        }}>
          <PasswordField label="Mot de passe" value={pwd} onChange={setPwd} autoFocus />
          {error && <div className="notice notice-danger"><Icon name="alert" /><span>{error}</span></div>}
          <Button type="submit" busy={busy} block icon="lock" disabled={!pwd}>Déverrouiller</Button>
        </form>
      )}
      <Button variant="quiet" onClick={() => logout()}>Changer d'utilisateur</Button>
    </AuthShell>
  );
}

function ResetErrorNotice() {
  const err = useMeta<string | null>('resetError', null);
  if (!err) return null;
  return <div className="notice notice-danger"><Icon name="alert" /><span>Mot de passe oublié : {err} <button className="link-btn" onClick={() => setMeta('resetError', null)}>OK</button></span></div>;
}

/** Après le lien reçu par e-mail : choisir le compte et son nouveau mot de passe. */
export function EmailResetScreen() {
  useTable('users');
  const pending = useMeta<{ userId: string } | null>('pendingReset', null);
  const accounts = all<User>('users').filter((u) => managesOwnPassword(u) && u.active !== false);
  const [userId, setUserId] = useState(pending?.userId && accounts.some((a) => a.id === pending.userId) ? pending.userId : accounts[0]?.id ?? '');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = pwd ? checkPasswordStrength(pwd) : null;
  return (
    <AuthShell>
      <div><h2>Nouveau mot de passe</h2><p className="muted">Le lien reçu par e-mail est valide. Choisissez le compte et son nouveau mot de passe.</p></div>
      <form className="stack" onSubmit={async (e) => {
        e.preventDefault();
        if (strength) return;
        if (pwd !== pwd2) return setError('Les deux mots de passe ne sont pas identiques.');
        setBusy(true);
        try { await resetByEmail(userId, pwd); toast('Mot de passe changé. Connectez-vous.'); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
      }}>
        <SelectField label="Compte" value={userId} onChange={setUserId} options={accounts.map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))} />
        <PasswordField label="Nouveau mot de passe" value={pwd} onChange={setPwd} autoComplete="new-password" error={strength} hint="Au moins 6 caractères, lettres et chiffres." autoFocus />
        <PasswordField label="Retapez le mot de passe" value={pwd2} onChange={setPwd2} autoComplete="new-password" error={error} />
        <Button type="submit" block busy={busy} disabled={!pwd || !pwd2 || !userId}>Enregistrer le mot de passe</Button>
      </form>
      <Button variant="quiet" onClick={() => setMeta('resetGranted', null)}>Annuler</Button>
    </AuthShell>
  );
}
