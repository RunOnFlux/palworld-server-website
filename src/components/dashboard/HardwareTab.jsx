import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Cpu, MemoryStick, HardDrive, AlertTriangle, RefreshCw, CheckCircle, CreditCard, X, RotateCcw, Database, ArrowRight, Wallet, Gauge, ListChecks } from 'lucide-react';
import apiService from '../../services/apiService';
import stripeService from '../../services/stripeService';
import { payWithSSP, payWithZelcore, isSSPAvailable } from '../../services/walletService';
// (stripeService also provides getSubscriptionStatus / chargeSubscriptionUpdate / updateSubscriptionPrice)
import { fetchDecryptedEnterpriseSpec } from '../../utils/enterpriseCrypto';
import { encryptAppSpec, computeRemainingExpire, fetchLatestAppSpec } from '../../utils/appSpecHelpers';

// Snapped slider ranges (within sane Flux limits). Step = increment.
// Maxima are the real Flux protocol limits per component (stratus tier minus locked
// system resources): CPU 15 cores, RAM 59000 MB, HDD 820 GB. (The old 60 GB cap was
// actually lockedSystemResources.hdd, i.e. reserved space — not a real max.)
const LIMITS = {
  cpu: { min: 1, max: 15, step: 0.5, label: 'CPU', unit: 'vCores', icon: Cpu },
  ram: { min: 1000, max: 59000, step: 1000, label: 'RAM', unit: 'MB', icon: MemoryStick },
  hdd: { min: 15, max: 820, step: 5, label: 'Storage', unit: 'GB', icon: HardDrive },
};

// Open the Stripe checkout in a popup and resolve once /success posts PAYMENT_SUCCESS for
// our payment hash (mirrors the renewal fiat flow). If the popup is blocked, calls
// onBlocked(url, cancel) so the caller can show a dialog with a manual "open" link — the
// message listener stays active, so opening via the link still resolves the payment.
function openStripeCheckout(checkoutUrl, paymentHash, { onBlocked, onStart } = {}) {
  return new Promise((resolve, reject) => {
    const url = checkoutUrl; // createCheckoutSession returns the FULL checkout URL from the bridge
    let poll = null;
    const cleanup = () => { window.removeEventListener('message', onMsg); if (poll) clearInterval(poll); };
    const cancel = () => { cleanup(); reject(new Error('Payment cancelled.')); };
    const onMsg = (event) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === 'PAYMENT_SUCCESS' && event.data.paymentHash === paymentHash) {
        cleanup(); resolve(event.data.stripeSessionId || null);
      } else if (event.data.type === 'PAYMENT_CANCELLED') {
        cancel();
      }
    };
    window.addEventListener('message', onMsg);
    onStart?.(cancel); // let the caller cancel this payment (Cancel button)

    const win = window.open(url, '_blank', 'width=600,height=800,resizable=yes,scrollbars=yes');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Popup blocked — hand the URL to the caller; keep listening for success.
      onBlocked?.(url);
    } else {
      poll = setInterval(() => {
        if (win.closed) { cleanup(); reject(new Error('Payment window closed before completing.')); }
      }, 800);
    }
  });
}

const snap = (v, { min, max, step }) => {
  const snapped = Math.round(v / step) * step;
  return Math.min(max, Math.max(min, snapped));
};

// Blocks in ~one month (post-fork) — used to price the new recurring subscription amount.
const ONE_MONTH_BLOCKS = 88000;

/**
 * Hardware tab — change CPU / RAM / HDD of an existing instance via snapped
 * sliders. Decrypt current spec → edit → recompute expire (no sub extension) →
 * price the delta → pay (crypto/Stripe) → re-encrypt → appupdate.
 * CPU/RAM apply with a SOFT redeploy (data kept); HDD needs a HARD redeploy
 * (volume reallocated → data wiped) and is warned explicitly.
 */
const HardwareTab = ({ server, onUpdate, onRedeploy, onReinstall, onSwitchTab }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [current, setCurrent] = useState({ cpu: 0, ram: 0, hdd: 0 });
  const [next, setNext] = useState({ cpu: 0, ram: 0, hdd: 0 });
  const [price, setPrice] = useState(null); // { usd, flux } for the delta
  const [priceLoading, setPriceLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [wallet, setWallet] = useState('ssp');
  const [subscription, setSubscription] = useState(null); // active Stripe sub → charge card + reprice
  const [payState, setPayState] = useState('idle'); // 'idle' | 'submitting' | 'paying' | 'confirmed' | 'cancelled'
  const [txid, setTxid] = useState(null);
  const [blockedPaymentUrl, setBlockedPaymentUrl] = useState(null); // Stripe popup blocked → manual open
  const [showPopupBlockedDialog, setShowPopupBlockedDialog] = useState(false);
  const [propagation, setPropagation] = useState('idle'); // 'idle' | 'detecting' | 'live' | 'timeout'
  const [redeploying, setRedeploying] = useState(false);

  const payAbortRef = useRef(null); // AbortController for the in-flight crypto payment
  const cancelPayRef = useRef(null); // cancel fn for the in-flight Stripe checkout
  const pollRef = useRef(null); // propagation poll interval
  const outerRef = useRef(null);
  const composeRef = useRef(null);
  const contactsRef = useRef([]);
  const isEnterpriseRef = useRef(false);
  const heightRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const outer = await apiService.getAppSpecs(server.name);
      if (!outer || !outer.name) throw new Error('Could not load current server spec.');

      // An app is enterprise iff it carries an encrypted `enterprise` blob — that only exists
      // on v8+, so its mere presence is definitive. (Gating on a parsed version field is
      // fragile: a missing/non-numeric version would misflag it as non-enterprise and send the
      // spec — passwords included — UNENCRYPTED, also downgrading it off enterprise.)
      const isEnterprise = !!outer.enterprise;
      isEnterpriseRef.current = isEnterprise;

      let compose = outer.compose;
      let contacts = outer.contacts || [];
      if (isEnterprise && (!compose || compose.length === 0)) {
        const zelidauth = await apiService.getStoredAuth();
        const fluxApiBase = sessionStorage.getItem('stickyBackendDNS') || 'https://api.runonflux.io';
        const decrypted = await fetchDecryptedEnterpriseSpec(server.name, fluxApiBase, zelidauth);
        if (!decrypted?.compose?.length) throw new Error('Could not decrypt the current spec. Try again in a moment.');
        compose = decrypted.compose;
        contacts = decrypted.contacts || contacts;
      }

      outerRef.current = outer;
      composeRef.current = compose;
      contactsRef.current = contacts;
      heightRef.current = await apiService.getBlockHeight();

      // Active Stripe subscription? → pay the delta on the card + reprice the recurring amount.
      try {
        const sub = await stripeService.getSubscriptionStatus(server.name);
        setSubscription(sub || false);
      } catch { setSubscription(false); }

      const c0 = compose[0] || {};
      const cur = {
        cpu: Number(c0.cpu) || LIMITS.cpu.min,
        ram: Number(c0.ram) || LIMITS.ram.min,
        hdd: Number(c0.hdd) || LIMITS.hdd.min,
      };
      setCurrent(cur);
      setNext(cur);
    } catch (e) {
      setError(e.message || 'Failed to load hardware.');
    } finally {
      setLoading(false);
    }
  }, [server.name]);

  useEffect(() => { load(); }, [load]);

  const changed = next.cpu !== current.cpu || next.ram !== current.ram || next.hdd !== current.hdd;
  const hddChanged = next.hdd !== current.hdd;

  // Build the plaintext updated spec (expire recomputed to remaining blocks).
  const buildSpec = useCallback(() => {
    const outer = outerRef.current;
    const compose = composeRef.current;
    const newCompose = compose.map((c, i) =>
      i === 0 ? { ...c, cpu: next.cpu, ram: next.ram, hdd: next.hdd } : c
    );
    return {
      ...outer,
      expire: computeRemainingExpire(outer, heightRef.current),
      compose: newCompose,
      contacts: contactsRef.current,
      enterprise: '',
    };
  }, [next]);

  // Debounced price calc when the target changes.
  useEffect(() => {
    if (!changed || loading) { setPrice(null); return; }
    let cancelled = false;
    setPriceLoading(true);
    const t = setTimeout(async () => {
      try {
        // Price the ENCRYPTED spec so the enterprise scope surcharge is reflected. The
        // `enterprise` blob is what makes the app enterprise on-chain (it's internal, not a
        // plain flag), so pricing a plaintext spec would undercharge. encryptAppSpec is a no-op
        // for non-enterprise apps.
        const encrypted = await encryptAppSpec(buildSpec(), isEnterpriseRef.current);
        const p = await apiService.calculateAppPrice(encrypted);
        if (!cancelled) setPrice(p);
      } catch {
        if (!cancelled) setPrice(null);
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [next, changed, loading, buildSpec]);

  const isPaid = !!price && price.flux > 0;
  const hasSub = subscription && subscription.status === 'active';

  const doApply = async () => {
    setSaving(true);
    setError(null);
    setShowConfirm(false);
    setTxid(null);
    setPayState('submitting');
    try {
      // Re-read the spec AND the block height before building. buildSpec recomputes expire
      // from outerRef, so the copy loaded when this tab mounted would put its own (possibly
      // pre-renewal) expiry back on chain; a stale height would separately overestimate the
      // remaining blocks and slightly extend the subscription. This also refuses outright
      // while an update is still confirming.
      const fresh = await fetchLatestAppSpec(server.name);
      outerRef.current = fresh.outer;
      composeRef.current = fresh.compose;
      contactsRef.current = fresh.contacts;
      isEnterpriseRef.current = fresh.isEnterprise;
      try { const h = await apiService.getBlockHeight(); if (h) heightRef.current = h; } catch { /* keep load-time height */ }

      // Re-encrypt + submit the signed appupdate → payment hash.
      const finalSpec = await encryptAppSpec(buildSpec(), isEnterpriseRef.current);
      const paymentHash = await apiService.updateAppSpecification(finalSpec);

      if (hasSub) {
        // Subscription user: charge the delta to their card, then reprice the recurring amount.
        if (isPaid) {
          setPayState('paying');
          await stripeService.chargeSubscriptionUpdate({
            appName: server.name, hash: paymentHash, price: price.usd, description: 'Hardware change',
          });
        }
        // Reprice recurring subscription to the new monthly cost of the changed spec.
        // Encrypt first so the enterprise surcharge is included (same reason as the quote above).
        try {
          const monthlyEncrypted = await encryptAppSpec({ ...buildSpec(), expire: ONE_MONTH_BLOCKS }, isEnterpriseRef.current);
          const monthly = await apiService.calculateAppPrice(monthlyEncrypted);
          if (monthly?.usd) await stripeService.updateSubscriptionPrice(server.name, monthly.usd);
        } catch (repriceErr) {
          console.warn('Subscription reprice failed:', repriceErr.message);
        }
      } else if (isPaid) {
        setPayState('paying');
        if (wallet === 'card') {
          // Fiat: one-time Stripe checkout (same flow as renewal). Opens a popup and waits
          // for /success to post PAYMENT_SUCCESS for this payment hash.
          const origin = window.location.origin;
          const successUrl = `${origin}/success?hardware=true&server=${encodeURIComponent(server.name)}&hash=${paymentHash}`;
          const cancelUrl = `${origin}/cancel?hardware=true`;
          const sessionId = await stripeService.createCheckoutSession(
            server.name, successUrl, cancelUrl, paymentHash, price.usd,
            `${server.name} - Hardware change`, 'Palworld Server on Flux Decentralized Cloud',
          );
          const sid = await openStripeCheckout(sessionId, paymentHash, {
            onStart: (cancel) => { cancelPayRef.current = cancel; },
            onBlocked: (url) => { setBlockedPaymentUrl(url); setShowPopupBlockedDialog(true); },
          });
          setShowPopupBlockedDialog(false);
          setBlockedPaymentUrl(null);
          setTxid(sid);
        } else {
          // Crypto: pay the FLUX delta with the wallet. Capture the txid as confirmation.
          // AbortController lets the Cancel button stop the wallet wait (ZelCore WS / SSP).
          const controller = new AbortController();
          payAbortRef.current = controller;
          const deploymentInfo = await apiService.getDeploymentInfo();
          const paymentAddress = deploymentInfo?.address;
          if (!paymentAddress) throw new Error('Failed to get payment address');
          const amount = String(price.flux);
          const abortPromise = new Promise((_, rej) => {
            controller.signal.addEventListener('abort', () => rej(new Error('Payment cancelled.')), { once: true });
          });
          const res = wallet === 'zelcore'
            ? await payWithZelcore({ address: paymentAddress, amount, message: paymentHash, signal: controller.signal })
            : await Promise.race([payWithSSP({ message: paymentHash, amount, address: paymentAddress, chain: 'flux' }), abortPromise]);
          setTxid(res?.txid || null);
        }
      }

      // Payment done. This is a SPEC UPDATE (not a renewal) — the confirmation is the
      // dashboard reflecting the new hash/specs on its next refresh, which onUpdate triggers.
      setPayState('confirmed');
      watchPropagation();
      toast.success(isPaid ? 'Payment confirmed — applying update.' : 'Update submitted — applying.');
      setCurrent({ ...next });
      // NOTE: onUpdate() is deferred to closeMonitor(). Refetching here would re-render the
      // parent and yank the confirmation dialog away (perceived as a page refresh/regress) —
      // deploy stays on its finalizing step for the same reason.
    } catch (e) {
      setShowPopupBlockedDialog(false);
      setBlockedPaymentUrl(null);
      const cancelled = /cancel/i.test(e.message || '');
      if (cancelled) {
        setError(null);
        setPayState('cancelled'); // keep the dialog open (mirrors deploy's cancelled overlay) — no regress
        toast('Payment cancelled', { icon: '✋' });
      } else {
        setPayState('idle');
        setError(e.message || 'Failed to update hardware.');
        toast.error(e.message || 'Failed to update hardware');
      }
    } finally {
      setSaving(false);
      payAbortRef.current = null;
      cancelPayRef.current = null;
    }
  };

  const cancelPayment = () => {
    payAbortRef.current?.abort();   // crypto (ZelCore/SSP wait)
    cancelPayRef.current?.();       // Stripe checkout wait
    setShowPopupBlockedDialog(false);
    setBlockedPaymentUrl(null);
  };

  // After payment, watch the network converge on the new spec. Flux redeploys each instance
  // automatically once the update propagates — this just gives the user a live signal (and an
  // optional "redeploy now" shortcut) instead of a blind wait. Poll until the on-chain hash
  // changes from the one we loaded with.
  const watchPropagation = () => {
    const oldHash = outerRef.current?.hash || null;
    setPropagation('detecting');
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks += 1;
      try {
        const spec = await apiService.getAppSpecs(server.name);
        if (spec?.hash && spec.hash !== oldHash) {
          clearInterval(pollRef.current); pollRef.current = null;
          outerRef.current = spec; // adopt the new spec as the baseline for the next change
          setPropagation('live');
          return;
        }
      } catch { /* transient RPC error — keep polling */ }
      if (ticks >= 45) { // ~15 min at 20s
        clearInterval(pollRef.current); pollRef.current = null;
        setPropagation('timeout');
      }
    }, 20000);
  };

  const closeMonitor = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    const wasConfirmed = payState === 'confirmed';
    setPayState('idle');
    setPropagation('idle');
    setRedeploying(false);
    setTxid(null);
    // Deferred refetch — only when something actually changed (confirmed), so dismissing a
    // cancelled dialog doesn't needlessly reload the panel.
    if (wasConfirmed && onUpdate) onUpdate();
  };

  // Optional manual redeploy from the monitor. Storage/HDD reallocates the volume → HARD
  // redeploy (wipes data); CPU/RAM keep data → soft redeploy.
  const handleRedeployNow = () => {
    setRedeploying(true);
    if (hddChanged) onReinstall?.(); else onRedeploy?.();
    closeMonitor();
  };

  // Stop polling if the tab unmounts mid-watch.
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const handleApply = () => {
    if (!changed) return;
    if (hddChanged) { setShowConfirm(true); return; } // data-loss confirm
    doApply();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400">Loading hardware…</p>
      </div>
    );
  }

  // Sliders are pure input controls — the change review (old → new + delta) lives only
  // in the "Pending changes" card below, so nothing is duplicated. The track fill and a
  // small notch marking the CURRENT allocation give instant visual context while dragging.
  const Slider = ({ k }) => {
    const cfg = LIMITS[k];
    const Icon = cfg.icon;
    const pct = ((next[k] - cfg.min) / (cfg.max - cfg.min)) * 100;
    const dirty = next[k] !== current[k];
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-white whitespace-nowrap">{cfg.label}</span>
          </div>
          <span className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg border transition-colors ${dirty ? 'text-primary-light border-primary/40 bg-primary/10' : 'text-white border-slate-700/60 bg-slate-800/60'}`}>
            {next[k]} <span className="text-[10px] font-medium text-slate-400">{cfg.unit}</span>
          </span>
        </div>
        <input
          type="range"
          aria-label={cfg.label}
          min={cfg.min}
          max={cfg.max}
          step={cfg.step}
          value={next[k]}
          onChange={(e) => setNext((p) => ({ ...p, [k]: snap(parseFloat(e.target.value), cfg) }))}
          className="hw-range w-full cursor-pointer"
          style={{ background: `linear-gradient(to right, rgba(33,150,243,0.9) ${pct}%, rgba(51,65,85,0.55) ${pct}%)` }}
        />
      </div>
    );
  };

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Resources — one unified card, each row a slider with filled track */}
      <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/60 to-slate-900/70 overflow-hidden divide-y divide-slate-700/40">
        <div className="px-4 py-3 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
            <Gauge className="w-4 h-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-white">Resources</div>
            <div className="text-[11px] text-slate-400">CPU, memory and storage of your server</div>
          </div>
        </div>
        <Slider k="cpu" />
        <Slider k="ram" />
        <Slider k="hdd" />
      </div>

      {/* Pending changes summary — review old → new, with a subtle Reset in the header */}
      {changed && (
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/60 to-slate-900/70 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-700/40">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-white">Pending changes</span>
            </div>
            <button
              type="button"
              onClick={() => setNext({ ...current })}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          {/* Tiles auto-fit the available width — as many columns as fit, each ≥210px */}
          <div className="p-3 grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            {Object.keys(LIMITS).filter((k) => next[k] !== current[k]).map((k) => {
              const cfg = LIMITS[k];
              const Icon = cfg.icon;
              const delta = next[k] - current[k];
              const up = delta > 0;
              return (
                <div key={k} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 px-3.5 py-3 transition-colors hover:border-slate-600/70">
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 truncate">{cfg.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 font-mono flex-shrink-0">
                    <span className="text-base text-slate-500">{current[k]}</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                    <span className={`text-lg font-bold ${up ? 'text-emerald-400' : 'text-amber-400'}`}>{next[k]}</span>
                    <span className="text-xs text-slate-400">{cfg.unit}</span>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${up ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' : 'text-amber-400 bg-amber-500/15 border border-amber-500/30'}`}>
                      {up ? '+' : ''}{delta}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backup-first step — one compact, actionable card instead of walls of warning text */}
      {changed && (
        <div className={`rounded-2xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${hddChanged ? 'border-red-500/40 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/[0.08]'}`}>
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${hddChanged ? 'text-red-400' : 'text-amber-400'}`} />
            <div className={`text-xs leading-relaxed ${hddChanged ? 'text-red-200/90' : 'text-amber-200/90'}`}>
              <p className={`font-semibold ${hddChanged ? 'text-red-300' : 'text-amber-300'}`}>
                {hddChanged ? 'Storage change WIPES all server data' : 'Redeploy may move your server to another node'}
              </p>
              <p>
                Create a backup and <strong>download it to your device</strong> first. On-server backups are
                part of the app image, so they {hddChanged ? 'get wiped too' : 'may not carry over'} —
                only <strong>automatic backups</strong> are stored outside the image.
              </p>
            </div>
          </div>
          {onSwitchTab && (
            <button
              type="button"
              onClick={() => onSwitchTab('backup')}
              className={`shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${hddChanged
                ? 'text-red-300 border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
                : 'text-amber-300 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'}`}
            >
              <Database className="w-3.5 h-3.5" /> Open Backup
            </button>
          )}
        </div>
      )}

      {/* Price — crypto and fiat split into two clear columns; the selected method is highlighted */}
      {changed && (
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800/60 to-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-700/40">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-white">Cost to apply</div>
                <div className="text-[11px] text-slate-400">One-time — hardware change</div>
              </div>
            </div>
            {priceLoading && <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />}
            {!priceLoading && price && !isPaid && (
              <span className="text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">Free</span>
            )}
            {!priceLoading && !price && <span className="text-sm text-slate-500">—</span>}
          </div>

          {!priceLoading && isPaid && (
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-700/40">
              {/* Crypto price */}
              <div className={`px-4 py-3 ${wallet !== 'card' ? 'bg-primary/10' : ''}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Crypto</div>
                <div className="flex items-center gap-2 text-xl font-bold text-white leading-tight">
                  <img src="/flux-icon.svg" alt="FLUX" className="w-5 h-5"
  width={20}
  height={20}
  decoding="async" />
                  {price.flux} <span className="text-sm font-medium text-slate-400">FLUX</span>
                </div>
                {price.fluxDiscount > 0 && (
                  <div className="text-xs text-emerald-400 mt-1">{price.fluxDiscount}% discount included</div>
                )}
              </div>
              {/* Fiat price */}
              <div className={`px-4 py-3 ${wallet === 'card' ? 'bg-primary/10' : ''}`}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Fiat · Card</div>
                <div className="text-xl font-bold text-white leading-tight">
                  ${price.usd.toFixed(2)} <span className="text-sm font-medium text-slate-400">USD</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">+ VAT at checkout</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription note — charge card + reprice recurring */}
      {changed && hasSub && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
          <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
          <p className="text-xs text-primary/90">
            You have an active subscription.{isPaid ? ' The upgrade difference will be charged to your card,' : ' No charge now —'} and
            your <strong>recurring monthly price will be updated</strong> to match the new hardware.
          </p>
        </div>
      )}

      {/* Wallet choice for paid upgrades (crypto / no subscription) — one card, rich options */}
      {changed && isPaid && !hasSub && (
        <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/60 to-slate-900/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-white">Choose your payment method</div>
              <div className="text-[11px] text-slate-400">Crypto (FLUX) or fiat — the price follows your choice</div>
            </div>
          </div>
          <div className="p-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'card', name: 'Stripe', sub: 'Credit / debit card', img: '/wallets/stripe.png', kind: 'fiat' },
              { id: 'ssp', name: 'SSP', sub: isSSPAvailable?.() ? 'Browser extension' : 'Extension not detected', img: '/wallets/ssp-white.svg', disabled: !isSSPAvailable?.(), kind: 'crypto' },
              { id: 'zelcore', name: 'Zelcore', sub: 'Desktop & mobile app', img: '/wallets/zelcore.svg', kind: 'crypto' },
            ].map((w) => {
              const active = wallet === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWallet(w.id)}
                  disabled={w.disabled}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${active
                    ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/40 shadow-lg shadow-primary/10'
                    : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600 hover:bg-slate-800/70'} disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span className="w-10 h-10 rounded-lg bg-slate-900/70 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                    <img src={w.img} alt="" className="w-6 h-6 object-contain"
  width={24}
  height={24}
  decoding="async" />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {w.name}
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${w.kind === 'fiat'
                        ? 'text-sky-300 border-sky-500/40 bg-sky-500/10'
                        : 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'}`}>
                        {w.kind}
                      </span>
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">{w.sub}</span>
                  </span>
                  {active && <CheckCircle className="w-4 h-4 text-primary absolute top-2 right-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popup Blocked Dialog (modal) — mirrors the renewal flow */}
      {showPopupBlockedDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-gradient-to-b from-gray-800 to-gray-900 border border-orange-500/30">
            <div className="p-6 text-center">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4 bg-orange-500/10 border border-orange-500/25">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Popup Blocked</h4>
              <p className="text-sm text-gray-400 mb-5">
                Your browser blocked the payment window. Click below to open it manually — the payment will still complete here.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (blockedPaymentUrl) {
                    window.open(blockedPaymentUrl, '_blank');
                    setShowPopupBlockedDialog(false);
                    setBlockedPaymentUrl(null);
                  }
                }}
                className="w-full px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold transition-colors"
              >
                Open Payment Window
              </button>
              <button
                type="button"
                onClick={cancelPayment}
                className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 border border-gray-700/60 bg-gray-800/40 hover:bg-gray-700/50 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleApply}
        disabled={!changed || saving || priceLoading}
        className="group relative w-full overflow-hidden rounded-xl py-2 inline-flex items-center justify-center gap-2 text-sm font-bold text-white cursor-pointer
          bg-gradient-to-r from-emerald-600 to-emerald-500 hover:brightness-110 transition-[filter,box-shadow] duration-200
          shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
      >
        {saving ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /><span className="leading-none">{payState === 'paying' ? 'Waiting for payment…' : 'Submitting update…'}</span></>
        ) : isPaid ? (
          <>
            <span className="leading-none">Pay &amp; Apply</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
        ) : (
          <><CheckCircle className="w-4 h-4" /><span className="leading-none">Apply Changes</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>
        )}
      </button>

      {/* Payment / propagation monitor — separate dialog, mirrors the deploy flow (fiat + crypto).
          Shows the wallet/Stripe wait, then payment confirmation + live spec propagation, with an
          optional manual redeploy (soft for CPU/RAM, hard for Storage). */}
      {payState !== 'idle' && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-gradient-to-b from-gray-800 to-gray-900 border ${payState === 'confirmed' ? 'border-emerald-500/30' : payState === 'cancelled' ? 'border-amber-500/30' : 'border-gray-700/60'}`}>
            <div className="p-6">
              {payState === 'cancelled' ? (
                /* --- Cancelled — stable end-state, no charge, no regress (mirrors deploy) --- */
                <div className="flex flex-col items-center text-center">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/25 mb-4">
                    <X className="w-5 h-5 text-amber-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white mb-1">Payment Cancelled</h4>
                  <p className="text-sm text-gray-400 mb-5">
                    No charge was made and your hardware wasn&apos;t changed. You can try again whenever you&apos;re ready.
                  </p>
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={closeMonitor}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 border border-gray-700/60 bg-gray-800/40 hover:bg-gray-700/50 hover:text-white transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={doApply}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary/20 border border-primary/40 text-primary-light hover:bg-primary/30 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : payState !== 'confirmed' ? (
                /* --- Waiting for payment (fiat popup / crypto wallet) --- */
                <div className="flex flex-col items-center text-center">
                  <div className="animate-spin rounded-full h-11 w-11 border-4 border-primary border-t-transparent mb-4" />
                  <h4 className="text-lg font-semibold text-white mb-1">
                    {payState === 'paying' ? 'Waiting for Payment' : 'Submitting Update'}
                  </h4>
                  <p className="text-sm text-gray-400">
                    {payState === 'paying'
                      ? (wallet === 'card'
                          ? 'Complete the payment in the Stripe window. This dialog closes automatically once it confirms.'
                          : 'Approve the transaction in your wallet. This dialog closes automatically once it confirms.')
                      : 'Signing and broadcasting the new spec…'}
                  </p>
                  {payState === 'paying' && (
                    <button
                      type="button"
                      onClick={cancelPayment}
                      className="mt-5 px-6 py-2 inline-flex items-center gap-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 bg-red-600/15 hover:bg-red-600/25 border border-red-500/30 transition-colors"
                    >
                      <X className="w-4 h-4" /> Cancel Payment
                    </button>
                  )}
                </div>
              ) : (
                /* --- Confirmed → propagation + optional redeploy --- */
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/25 shrink-0">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-white">{isPaid ? 'Payment Confirmed' : 'Update Submitted'}</h4>
                      <p className="text-xs text-gray-400">The new hardware spec is on-chain.</p>
                    </div>
                  </div>

                  {/* Propagation status */}
                  <div className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 mb-3">
                    {propagation === 'live' ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                        <CheckCircle className="w-4 h-4" /> New spec is live on the network.
                      </div>
                    ) : propagation === 'timeout' ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                        <AlertTriangle className="w-4 h-4" /> Still propagating — this can take a few minutes. Safe to close.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Detecting new spec across the network…
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mb-3">
                    Flux <strong>applies this automatically</strong> — each instance redeploys on its own,
                    staggered so the server stays up.
                    {propagation === 'live'
                      ? ' The new spec is live, so a manual redeploy now is safe.'
                      : ' Manual redeploy unlocks once the new spec is live — redeploying earlier would relaunch the old spec.'}
                  </p>

                  {hddChanged && (
                    <p className="text-xs text-red-300/90 mb-3 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>Storage change triggers a <strong>hard redeploy that WIPES data</strong> on each instance — make sure you have a backup.</span>
                    </p>
                  )}

                  {txid && <p className="text-[11px] text-slate-400 font-mono break-all mb-3">txid: {txid}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={closeMonitor}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-300 border border-gray-700/60 bg-gray-800/40 hover:bg-gray-700/50 hover:text-white transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleRedeployNow}
                      disabled={redeploying || propagation !== 'live'}
                      title={propagation !== 'live' ? 'Available once the new spec is live on the network' : undefined}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        hddChanged
                          ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                          : 'bg-primary/20 border border-primary/40 text-primary-light hover:bg-primary/30'
                      }`}
                    >
                      {propagation !== 'live'
                        ? 'Waiting for spec…'
                        : hddChanged ? 'Redeploy now (wipes data)' : 'Redeploy now'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* HDD data-loss confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/60 bg-gradient-to-b from-gray-800 to-gray-900 border border-red-500/30 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-500/10 border border-red-500/25">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="font-bold text-base text-white">Disk change wipes data</p>
                <p className="text-xs text-red-400 mt-0.5">Hard redeploy — world/save lost</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              Resizing the disk reallocates the volume. Your server data will be
              permanently deleted and the server rebuilt from scratch. Continue?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={doApply} className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30">
                Wipe &amp; Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HardwareTab;
