// Tableaux plus larges que l'écran : on le signale (première colonne fixe + « Faites défiler → » avec flèches),
// pour que rien ne paraisse coupé. Surveille tous les .table-wrap de la page.
export function watchWideTables() {
  const mark = (w: HTMLElement) => {
    const tb = w.querySelector(':scope > table') as HTMLElement | null;
    const more = !!tb && tb.offsetWidth - w.clientWidth > 4;
    // Le rappel est placé DANS le conteneur (fixé à gauche), pour disparaître avec le tableau.
    let hint = w.querySelector(':scope > .scroll-hint') as HTMLElement | null;
    if (more) {
      w.setAttribute('data-more', '');
      if (!hint) {
        hint = document.createElement('div'); hint.className = 'scroll-hint';
        hint.innerHTML = '<span>Tableau plus large que l’écran : faites défiler</span><button type="button" aria-label="Colonnes à gauche">←</button><button type="button" aria-label="Colonnes à droite">→</button>';
        const [l, r] = hint.querySelectorAll('button');
        l.addEventListener('click', () => w.scrollBy({ left: -w.clientWidth * 0.7, behavior: 'smooth' }));
        r.addEventListener('click', () => w.scrollBy({ left: w.clientWidth * 0.7, behavior: 'smooth' }));
        w.appendChild(hint);
      }
      hint.style.width = w.clientWidth + 'px';
    } else { w.removeAttribute('data-more'); hint?.remove(); }
  };
  const ro = new ResizeObserver((es) => es.forEach((e) => { const w = (e.target as HTMLElement).closest('.table-wrap') as HTMLElement | null; if (w) mark(w); }));
  const seen = new WeakSet<Element>();
  let t = 0;
  const scan = () => {
    t = 0;
    document.querySelectorAll<HTMLElement>('.table-wrap').forEach((w) => { if (!seen.has(w)) { seen.add(w); ro.observe(w); const tb = w.querySelector(':scope > table'); if (tb) ro.observe(tb); } mark(w); });
  };
  new MutationObserver(() => { if (!t) t = window.setTimeout(scan, 150); }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', () => { if (!t) t = window.setTimeout(scan, 150); });
  scan();
}
