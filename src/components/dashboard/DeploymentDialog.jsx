import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Rocket, XCircle } from 'lucide-react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import stripeService from '../../services/stripeService';
import apiService from '../../services/apiService';
import storageService from '../../services/storageService';
import { payWithSSP, payWithZelcore, isSSPAvailable } from '../../services/walletService';
import marketplaceService from '../../services/marketplaceService';
import { withModsMount } from '../../config/modsConfig';
import geolocationData from '../../utils/geolocation';
import toast from 'react-hot-toast';

// Step components
import StepProgressBar from './deployment-steps/StepProgressBar';
import StepPlanSelection from './deployment-steps/StepPlanSelection';
import StepConfigure from './deployment-steps/StepConfigure';
import StepEnvironment from './deployment-steps/StepEnvironment';
import StepLocation from './deployment-steps/StepLocation';
import StepReview from './deployment-steps/StepReview';
import StepFinalizing from './deployment-steps/StepFinalizing';

// Subscription duration options (FluxOS pattern) - moved outside to prevent recreation
const SUBSCRIPTION_OPTIONS = [
  { months: 1, label: '1 Month', discount: 0 },
  { months: 3, label: '3 Months (3% off)', discount: 3 },
  { months: 6, label: '6 Months (6% off)', discount: 6 },
  { months: 12, label: '12 Months (12% off)', discount: 12 },
];

// Pure helper functions - moved outside to prevent recreation on every render
const parseNumericValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  }
  return value;
};

const parseRamValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const number = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(number)) return undefined;
    if (value.toUpperCase().includes('GB')) {
      return number * 1000;
    }
    return number;
  }
  return value;
};

const parseHddValue = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const number = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(number)) return undefined;
    if (value.toUpperCase().includes('MB')) {
      return number / 1000;
    }
    return number;
  }
  return value;
};

// Instance count is a property of the marketplace plan, NOT a fixed 3.
// Deploying more instances than the plan is priced for silently loses money on Flux,
// so the plan is the single source of truth: the selected config first, then the
// parent app. Fallback to 3 only if the plan omits it entirely.
const getPlanInstances = (plan) => plan?._config?.instances || plan?._app?.instances || 3;

// Merge "KEY=value" env arrays with later arrays overriding earlier ones by KEY.
// This mirrors FluxCloud InstallDialog behavior: the parent app compose env is the
// base and the selected config's env overrides/extends it.
const mergeEnvParams = (...envArrays) => {
  const byKey = new Map();
  envArrays.forEach((envs) => {
    if (!Array.isArray(envs)) return;
    envs.forEach((entry) => {
      if (typeof entry !== 'string' || !entry) return;
      const eq = entry.indexOf('=');
      byKey.set(eq === -1 ? entry : entry.slice(0, eq), entry);
    });
  });
  return [...byKey.values()];
};



/**
 * DeploymentDialog Component
 * Multi-step wizard for deploying a new game server
 */
// Resources reserved for the node's OS/FluxOS — the app can only use what's left.
const OS_RESERVE = { cores: 1, ram: 2, ssd: 80 };
const CONTINENT_NAMES = {
  AF: 'Africa', AS: 'Asia', EU: 'Europe',
  NA: 'North America', OC: 'Oceania', SA: 'South America',
};

const DeploymentDialog = ({ isOpen, onClose, onSuccess, preSelectedPlan }) => {
  const { user, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(preSelectedPlan ? 2 : 1);
  const skippedStep1Ref = useRef(!!preSelectedPlan);
  const stepDirectionRef = useRef(1); // 1 = forward, -1 = back

  // Ref to store popup monitoring intervals for cleanup
  const popupIntervalsRef = useRef([]);
  const [selectedPlan, setSelectedPlan] = useState(preSelectedPlan || null);
  const [serverConfig, setServerConfig] = useState({
    name: '',
    appName: '',
    instances: 3, // Placeholder — replaced by the plan's instance count on selection
  });
  const [subscriptionMonths, setSubscriptionMonths] = useState(1);
  const [apiPricing, setApiPricing] = useState({ usd: 0, flux: 0, fluxDiscount: 0 });
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [environmentParams, setEnvironmentParams] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [geolocationForm, setGeolocationForm] = useState({
    continent: '',
    country: '',
    region: '',
  });
  const [allowedLocations, setAllowedLocations] = useState([]);
  const [availableLocations, setAvailableLocations] = useState({ nodes: [] });
  const [availableContinents, setAvailableContinents] = useState([]);
  const [availableCountries, setAvailableCountries] = useState([]);

  const [blockedPaymentUrl, setBlockedPaymentUrl] = useState(null);
  const [showPopupBlockedDialog, setShowPopupBlockedDialog] = useState(false);
  const [paymentHash, setPaymentHash] = useState(null);
  const [stripeSessionId, setStripeSessionId] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null); // 'success' or 'cancelled'
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [autoRenewal, setAutoRenewal] = useState(false);
  const [cryptoTxid, setCryptoTxid] = useState(null);
  const [waitingForCrypto, setWaitingForCrypto] = useState(false); // Show waiting dialog during crypto payment
  const cryptoAbortRef = useRef(null); // AbortController for ZelCore WS cancel
  const [isFreeFirstMonth, setIsFreeFirstMonth] = useState(false); // Free first month eligibility
  const [existingCustomer, setExistingCustomer] = useState(false); // Returning Flux customer — free month not applicable
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const saveServerToLocalStorageRef = useRef(null); // Ref to avoid stale closure in message listener

  // Memoize price calculations to avoid re-computing on every render
  const { currentDiscount, monthlyPrice, totalCost, fluxPrice } = useMemo(() => {
    const discount = SUBSCRIPTION_OPTIONS.find(opt => opt.months === subscriptionMonths)?.discount || 0;

    // Calculate monthly price - use HIGHER of plan price vs API price (FluxOS WordPress pattern)
    const planMonthlyPrice = (selectedPlan?.price?.monthly || 0) / 100;
    const apiMonthlyPrice = apiPricing.usd > 0 ? apiPricing.usd : 0;
    const monthly = apiMonthlyPrice > 0 ? Math.max(planMonthlyPrice, apiMonthlyPrice) : planMonthlyPrice;

    // Calculate total cost with discount
    const total = monthly * subscriptionMonths * (1 - discount / 100);

    // FLUX price (FluxOS InstallDialog formula)
    const fluxPerUsd = apiPricing.usd > 0 ? (apiPricing.flux / apiPricing.usd) : 0;
    const monthlyFlux = monthly * fluxPerUsd;
    const flux = fluxPerUsd > 0 ? parseFloat((monthlyFlux * subscriptionMonths * (1 - discount / 100)).toFixed(2)) : 0;

    return {
      currentDiscount: discount,
      monthlyPrice: monthly,
      totalCost: total,
      fluxPrice: flux,
    };
  }, [selectedPlan, apiPricing, subscriptionMonths]);

  // Fetch plans from marketplace
  const [availablePlans, setAvailablePlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  useEffect(() => {
    if (!isOpen) return;
    const hasCached = availablePlans.length > 0;
    setPlansLoading(!hasCached);
    const fetchPlans = marketplaceService.getServerPlans();
    if (hasCached) {
      fetchPlans.then(setAvailablePlans).finally(() => setPlansLoading(false));
    } else {
      const minDelay = new Promise(r => setTimeout(r, 2000));
      Promise.all([fetchPlans, minDelay])
        .then(([plans]) => setAvailablePlans(plans))
        .finally(() => setPlansLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-select plan and skip to step 2 if plan is pre-selected
  useEffect(() => {
    if (preSelectedPlan && isOpen) {
      skippedStep1Ref.current = true;
      setSelectedPlan(preSelectedPlan);
      setServerConfig(prev => ({ ...prev, instances: getPlanInstances(preSelectedPlan) })); // plan's instance count
      setCurrentStep(2);
    } else if (isOpen) {
      skippedStep1Ref.current = false;
      setCurrentStep(1);
      setSelectedPlan(null);
    }
  }, [preSelectedPlan, isOpen]);

  // Close dialog when user logs out
  useEffect(() => {
    if (isOpen && !isAuthenticated) {
      console.log('🚪 DeploymentDialog: User logged out, closing dialog');
      onClose();
    }
  }, [isOpen, isAuthenticated, onClose]);

  // Cleanup popup monitoring intervals and crypto on unmount
  useEffect(() => {
    return () => {
      popupIntervalsRef.current.forEach(clearInterval);
      popupIntervalsRef.current = [];
      cryptoAbortRef.current?.abort();
    };
  }, []);

  // Clear environment parameters when plan changes
  useEffect(() => {
    if (selectedPlan) {
      setEnvironmentParams({});
    }
  }, [selectedPlan]);

  // Regenerate server name with fresh timestamp when dialog opens
  useEffect(() => {
    if (isOpen && selectedPlan) {
      const name = `palworld${Date.now()}`;
      setServerConfig(prev => ({ ...prev, name, appName: name }));
    }
  }, [isOpen, selectedPlan]);

  // Scroll to top when step changes
  useEffect(() => {
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
      const scrollableContent = modalContainer.querySelector('.overflow-y-auto');
      if (scrollableContent) {
        scrollableContent.scrollTop = 0;
      }
    }
  }, [currentStep]);

  // Enterprise apps (encrypted compose) can ONLY run on nodes that report an
  // arcaneVersion. Non-enterprise apps run anywhere. This drives BOTH which stats
  // projection we request and whether we filter nodes by arcaneVersion below.
  const isEnterprise = !!selectedPlan?._app?.isAutoEnterprise;

  // Per-node hardware the plan needs = sum of ALL its compose components
  // (a node hosts every container of the app). ram is in MB → convert to GB.
  const planHardware = useMemo(() => {
    const comps = selectedPlan?._config?.components || [];
    let cpu = 0, ramMb = 0, hdd = 0;
    comps.forEach((c) => {
      cpu += c.cpu || c.cpubasic || 0;
      ramMb += c.ram || c.rambasic || 0;
      hdd += c.hdd || c.hddbasic || 0;
    });
    return { cpu, ramGB: ramMb / 1000, hddGB: hdd };
  }, [selectedPlan]);

  // Fetch available nodes from Flux stats API. Enterprise apps need the `flux`
  // object (for arcaneVersion); both need `benchmark` (hardware) + `geolocation`.
  useEffect(() => {
    const controller = new AbortController();
    const fetchLocations = async () => {
      try {
        // NOTE: `flux` MUST come last — the stats API returns an "Internal error"
        // when `flux` is the first projection field (e.g. `flux,geolocation,...`).
        const projection = isEnterprise
          ? 'geolocation,benchmark,flux'
          : 'geolocation,benchmark';
        const response = await fetch(`https://stats.runonflux.io/fluxinfo?projection=${projection}`, { signal: controller.signal });
        const result = await response.json();

        if (result.status === 'success' && result.data && result.data.length > 5000) {
          // Keep a flat per-node list; hardware/arcane/IP filtering happens in
          // computeAvailability once the plan + instance count are known.
          const nodes = [];
          result.data.forEach((n) => {
            const g = n.geolocation;
            if (!g?.continentCode || !g?.countryCode) return;
            const b = n.benchmark?.bench || {};
            if (!b.cores) return; // node has no valid benchmark → cannot place apps
            // Multiple nodes can share one public IP (up to 8, on different ports).
            // The IP lives in flux.ip as "ip:port" (enterprise projection) or in
            // geolocation.ip (both). Strip the port to group by real machine/network.
            const rawIp = n.flux?.ip || g.ip || '';
            const ip = rawIp.split(':')[0];
            nodes.push({
              cont: g.continentCode,
              country: g.countryCode,
              ip,
              cores: b.cores,
              ram: b.ram || 0,
              ssd: b.ssd || 0,
              arcane: !!n.flux?.arcaneVersion,
            });
          });

          setAvailableLocations({ nodes });
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('Failed to fetch locations:', error);
        // Fallback to global deployment
        setAllowedLocations([]);
      }
    };

    if (isOpen) {
      fetchLocations();
    }
    return () => controller.abort();
  }, [isOpen, isEnterprise]);

  // Fetch pricing when plan or instances change (debounced)
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const loadPricing = async () => {
        if (selectedPlan) {
          const auth = await apiService.getStoredAuth();
          if (auth && !controller.signal.aborted) {
            fetchPricingFromAPI(selectedPlan, serverConfig.instances, controller.signal);
          }
        }
      };
      loadPricing();
    }, 300); // 300ms debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedPlan, serverConfig.instances]);

  // Check free first month eligibility when plan selected and duration is 1 month
  useEffect(() => {
    if (!selectedPlan || subscriptionMonths !== 1) {
      setIsFreeFirstMonth(false);
      setExistingCustomer(false);
      return;
    }

    let cancelled = false;
    const checkEligibility = async () => {
      setCheckingEligibility(true);
      setExistingCustomer(false);
      try {
        const auth = await apiService.getStoredAuth();
        if (!auth || cancelled) return;

        // Get repotags from selected plan's marketplace app
        const repotags = selectedPlan._app?.compose?.map(c => c.repotag).filter(Boolean) || [];
        if (repotags.length === 0) {
          setIsFreeFirstMonth(false);
          return;
        }

        // Check if marketplace app has redirectUrl (required for free first month)
        if (!selectedPlan._app?.redirectUrl) {
          setIsFreeFirstMonth(false);
          return;
        }

        const eligible = await apiService.checkFreeFirstMonthEligibility(auth.zelid);
        if (!cancelled) {
          setIsFreeFirstMonth(eligible);
          setExistingCustomer(!eligible);
          if (eligible) console.log('🎉 User eligible for free first month!');
        }
      } catch (error) {
        console.error('[FreeMonth] Check failed:', error);
        if (!cancelled) setIsFreeFirstMonth(false);
      } finally {
        if (!cancelled) setCheckingEligibility(false);
      }
    };

    checkEligibility();
    return () => { cancelled = true; };
  }, [selectedPlan, subscriptionMonths]);

  // Get country name from geolocation data
  const getCountryName = useCallback((code) => {
    const country = geolocationData.countries.find(c => c.code === code);
    return country ? country.name : code;
  }, []);

  // Listen for payment completion messages from popup
  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security
      if (event.origin !== window.location.origin) return;

      if (event.data.type === 'PAYMENT_SUCCESS' && event.data.deployment) {
        // Payment completed successfully - save to localStorage
        const hash = event.data.paymentHash;
        const stripeSessionIdValue = event.data.stripeSessionId;
        if (hash && saveServerToLocalStorageRef.current) {
          saveServerToLocalStorageRef.current(hash, stripeSessionIdValue);
        }

        // Store both hashes for display
        setPaymentHash(hash);
        setStripeSessionId(stripeSessionIdValue);

        setWaitingForPayment(false);
        setPaymentResult('success');
        setCurrentStep(6); // Move to finalizing step
        setIsDeploying(false);
      } else if (event.data.type === 'PAYMENT_CANCELLED' && event.data.deployment) {
        // Payment was cancelled
        setWaitingForPayment(false);
        setPaymentResult('cancelled');
        setIsDeploying(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // Empty deps - mount/unmount only

  // Build the selectable continents/countries from the raw node list, filtered by:
  //   1. hardware — node's usable resources (after OS reserve) must fit the plan
  //   2. enterprise — node must report an arcaneVersion when the app is enterprise
  //   3. availability gate — a location only qualifies if it has enough UNIQUE public
  //      IPs (not nodes) to place every instance, since Flux spreads instances across
  //      distinct IPs. We surface both counts so the user sees real redundancy.
  const computeAvailability = useCallback((locationData, requiredInstances) => {
    const nodes = locationData?.nodes;
    if (!nodes) return;

    const { cpu, ramGB, hddGB } = planHardware;
    const fits = (n) =>
      (n.cores - OS_RESERVE.cores) >= cpu &&
      (n.ram - OS_RESERVE.ram) >= ramGB &&
      (n.ssd - OS_RESERVE.ssd) >= hddGB &&
      (!isEnterprise || n.arcane);

    const contAgg = new Map(); // code -> { nodeCount, ips:Set }
    const ctryAgg = new Map(); // `${cont}_${country}` -> { nodeCount, ips:Set }
    nodes.forEach((n) => {
      if (!fits(n)) return;
      if (!contAgg.has(n.cont)) contAgg.set(n.cont, { nodeCount: 0, ips: new Set() });
      const c = contAgg.get(n.cont);
      c.nodeCount++; if (n.ip) c.ips.add(n.ip);

      const key = `${n.cont}_${n.country}`;
      if (!ctryAgg.has(key)) ctryAgg.set(key, { nodeCount: 0, ips: new Set() });
      const cc = ctryAgg.get(key);
      cc.nodeCount++; if (n.ip) cc.ips.add(n.ip);
    });

    // Continents — gate on unique IPs >= instances
    const continents = [];
    contAgg.forEach((v, code) => {
      const ipCount = v.ips.size;
      if (ipCount >= requiredInstances && CONTINENT_NAMES[code]) {
        continents.push({ name: CONTINENT_NAMES[code], code, nodeCount: v.nodeCount, ipCount });
      }
    });
    continents.sort((a, b) => b.ipCount - a.ipCount);
    setAvailableContinents(continents);

    // Countries for the selected continent — same IP gate
    if (geolocationForm.continent) {
      const countries = [];
      ctryAgg.forEach((v, key) => {
        const [cont, code] = key.split('_');
        if (cont !== geolocationForm.continent) return;
        const ipCount = v.ips.size;
        if (ipCount >= requiredInstances) {
          countries.push({ code, name: getCountryName(code), nodeCount: v.nodeCount, ipCount });
        }
      });
      countries.sort((a, b) => b.ipCount - a.ipCount);
      setAvailableCountries(countries);
    } else {
      setAvailableCountries([]);
    }
  }, [planHardware, isEnterprise, geolocationForm.continent, getCountryName]);

  // Recompute whenever the node list, instance count, plan hardware, enterprise flag
  // or selected continent changes (all captured via computeAvailability's identity).
  useEffect(() => {
    computeAvailability(availableLocations, serverConfig.instances);
  }, [serverConfig.instances, availableLocations, computeAvailability]);

  // Build geolocation codes array for Flux app spec (FluxOS format)
  const getGeolocationCodes = () => {
    return allowedLocations; // Return the array of allowed location codes
  };

  // Fetch pricing from Flux API (FluxOS pattern)
  const fetchPricingFromAPI = async (plan, instances, externalSignal) => {
    if (!plan || !plan._app) return;

    setLoadingPricing(true);
    try {
      // Get auth from storage
      const zelidauth = await apiService.getStoredAuth();

      // Build temporary app spec with 1 month for price calculation
      // Field order must match FluxOS!
      const compose = plan._app.compose.map(service => ({
        name: service.name || 'component',
        description: service.description || 'Component',
        repotag: service.repotag || '',
        ports: Array.isArray(service.ports) ? service.ports : [],
        domains: Array.isArray(service.domains) ? service.domains : [],
        environmentParameters: Array.isArray(service.environmentParameters) ? service.environmentParameters : [],
        commands: Array.isArray(service.commands) ? service.commands : [],
        containerPorts: Array.isArray(service.containerPorts) ? service.containerPorts : [],
        containerData: withModsMount(service.containerData),
        tiered: typeof service.tiered === 'boolean' ? service.tiered : false,
        cpu: parseNumericValue(plan.specs?.cpu) || service.cpu || 1,
        ram: parseNumericValue(plan.specs?.ram) || service.ram || 2000,
        hdd: parseNumericValue(plan.specs?.storage) || service.hdd || 10,
        secrets: service.secrets || '',
        repoauth: service.repoauth || '',
        envFluxStorage: service.envFluxStorage || '',
      }));

      // Debug logging
      console.log('🔍 Original plan._app.compose:', plan._app.compose);
      console.log('🔍 Mapped compose:', compose);
      console.log('🔍 HDD values:', compose.map(s => s.hdd));

      const tempSpec = {
        version: 8,
        name: 'temp-pricing-check',
        description: 'Pricing calculation',
        owner: zelidauth?.zelid || 'unknown',
        compose: compose,
        instances,
        expire: 88000, // 1 month
        contacts: ['https://discord.com/invite/runonflux'],
        geolocation: [],
        nodes: [],
        staticip: false,
        enterprise: '',
      };

      console.log('📊 Fetching pricing for spec:', tempSpec);

      // Add timeout for pricing calculation (60 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      // Abort on external signal too (effect cleanup)
      if (externalSignal) {
        if (externalSignal.aborted) { controller.abort(); }
        else { externalSignal.addEventListener('abort', () => controller.abort(), { once: true }); }
      }

      try {
        const response = await fetch('https://api.runonflux.io/apps/calculatefiatandfluxprice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: JSON.stringify(tempSpec),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to fetch pricing');
        }

        const data = await response.json();
        console.log('📊 Pricing API response:', data);

        if (data.status === 'success' && data.data) {
          setApiPricing({
            usd: parseFloat(data.data.usd) || 0,
            flux: parseFloat(data.data.flux) || 0,
            fluxDiscount: parseFloat(data.data.fluxDiscount) || 0,
          });
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.error('⏱️ Pricing calculation timed out after 60s');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
      // Fallback to plan pricing
      setApiPricing({ usd: 0, flux: 0, fluxDiscount: 0 });
    } finally {
      setLoadingPricing(false);
    }
  };

  const handleClose = useCallback(() => {
    if (!isDeploying) {
      // If payment was successful, trigger dashboard refresh
      if (paymentResult === 'success' && onSuccess) {
        onSuccess();
      }

      // Abort any in-flight crypto payment or popup monitoring
      cryptoAbortRef.current?.abort();
      popupIntervalsRef.current.forEach(clearInterval);
      popupIntervalsRef.current = [];

      // Reset all form fields to default values
      setCurrentStep(1);
      setSelectedPlan(null);
      setServerConfig({ name: '', instances: 3 });
      setSubscriptionMonths(1);
      setEnvironmentParams({});
      setShowAdvanced(false);
      setGeolocationForm({ continent: '', country: '', region: '' });
      setAllowedLocations([]);
      setAvailableLocations([]);
      setAvailableContinents([]);
      setAvailableCountries([]);

      setApiPricing({ usd: 0, flux: 0, fluxDiscount: 0 });
      setLoadingPricing(false);
      setPaymentResult(null);
      onClose();
    }
  }, [isDeploying, paymentResult, onSuccess, onClose]);

  const handlePlanSelect = useCallback((plan) => {
    stepDirectionRef.current = 1;
    setSelectedPlan(plan);
    setServerConfig(prev => ({ ...prev, instances: getPlanInstances(plan) })); // price + deploy the plan's instance count
    setPaymentHash(null); // Spec changed — invalidate old hash
    setCurrentStep(2);
  }, []);

  const handleConfigure = useCallback((e) => {
    e.preventDefault();

    // Extract environment parameters from selected plan
    const userEnvParams = selectedPlan?._app?.compose?.[0]?.userEnvironmentParameters;
    if (userEnvParams && userEnvParams.length > 0) {
      const initialParams = {};

      // Set default values for required parameters
      userEnvParams.forEach(param => {
        if (param.required) {
          initialParams[param.name] = param.values?.[0] || '';
        }
      });

      setEnvironmentParams(initialParams);
    }

    // Skip environment step if no user-configurable parameters
    const userParams = selectedPlan?._app?.compose?.[0]?.userEnvironmentParameters;
    const hasUserParams = userParams && userParams.length > 0;

    stepDirectionRef.current = 1;
    setCurrentStep(hasUserParams ? 3 : 4);
  }, [selectedPlan]);

  // Check if environment step should be shown
  const hasEnvironmentStep = useMemo(() => {
    const userParams = selectedPlan?._app?.compose?.[0]?.userEnvironmentParameters;
    return userParams && userParams.length > 0;
  }, [selectedPlan]);

  // Memoized step navigation handlers to prevent child re-renders
  const handleBackToStep1 = useCallback(() => {
    stepDirectionRef.current = -1;
    skippedStep1Ref.current = false;
    setCurrentStep(1);
  }, []);
  const handleBackToStep2 = useCallback(() => { stepDirectionRef.current = -1; setCurrentStep(2); }, []);
  const handleBackToStep3OrSkip = useCallback(() => { stepDirectionRef.current = -1; setCurrentStep(hasEnvironmentStep ? 3 : 2); }, [hasEnvironmentStep]);
  const handleBackToStep4 = useCallback(() => { stepDirectionRef.current = -1; setCurrentStep(4); }, []);
  const handleContinueToStep4 = useCallback(() => { stepDirectionRef.current = 1; setCurrentStep(4); }, []);
  const handleContinueToStep5 = useCallback(() => { stepDirectionRef.current = 1; setCurrentStep(5); }, []);

  // Use function form of setState to avoid dependency on showAdvanced
  const handleShowAdvancedToggle = useCallback(() => {
    setShowAdvanced(prev => !prev);
  }, []);

  // Test handler for skipping payment (temporary - remove in production)
  const _handleTestSkipPayment = useCallback(() => {
    const testHash = 'test_flux_hash_' + Date.now();
    const testStripeId = 'cs_test_' + Date.now();
    setPaymentHash(testHash);
    setStripeSessionId(testStripeId);
    saveServerToLocalStorage(testHash, testStripeId);
    setWaitingForPayment(false);
    setPaymentResult('success');
    setCurrentStep(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverConfig, selectedPlan, subscriptionMonths]);

  const handleDeployImpl = async () => {
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    // Handle Enterprise (contact required)
    if (selectedPlan.contactRequired) {
      toast('Please contact us for Enterprise pricing');
      return;
    }

    setIsDeploying(true);
    setPaymentResult(null);
    try {
      console.log('🚀 ========== DEPLOYMENT DEBUG LOG ==========');

      // Get authentication
      const zelidauth = await apiService.getStoredAuth();
      console.log('🔍 Retrieved zelidauth:', zelidauth ? 'PRESENT' : 'MISSING');

      if (!zelidauth || !zelidauth.zelid) {
        console.error('❌ No Flux authentication found');
        toast.error('Authentication error - please log in again');
        setIsDeploying(false);
        return;
      }

      console.log('✅ Auth:', {
        zelid: zelidauth.zelid,
        hasSignature: !!zelidauth.signature,
        hasLoginPhrase: !!zelidauth.loginPhrase
      });

      // Build app specification (FluxOS format)
      // Use the appName from serverConfig (generated in StepConfigure)
      const appName = serverConfig.appName;

      console.log('📦 Building App Spec:', {
        appName,
        plan: selectedPlan.name
      });

      // Get geolocation codes
      const geolocationCodes = getGeolocationCodes();
      console.log('🌍 Geolocation:', {
        codes: geolocationCodes,
        count: geolocationCodes.length,
        type: geolocationCodes.length === 0 ? 'Global deployment' : 'Regional deployment'
      });

      // Build environment parameters array (FluxOS format: ["KEY=value"])
      const envParamsArray = [];
      Object.entries(environmentParams).forEach(([key, value]) => {
        if (value) {
          envParamsArray.push(`${key}=${value}`);
        }
      });
      console.log('⚙️ Environment Parameters:', {
        object: environmentParams,
        array: envParamsArray
      });

      // Upload email to Flux Storage
      console.log('📧 Uploading email to Flux Storage...');
      const email = user?.email || 'no-email@flux.local';
      const contactsId = storageService.generateContactsId();

      await storageService.uploadContacts({
        contactsid: contactsId,
        contacts: [email]
      });

      const contactsReference = storageService.getContactsStorageReference(contactsId);
      console.log('✅ Email uploaded, reference:', contactsReference);

      // Upload environment parameters to Flux Storage if any
      let envReference = null;
      if (envParamsArray.length > 0) {
        console.log('📦 Uploading environment parameters to Flux Storage...');
        const envId = storageService.generateEnvId();

        await storageService.uploadEnv({
          envid: envId,
          env: envParamsArray
        });

        envReference = storageService.getEnvStorageReference(envId);
        console.log('✅ Environment uploaded, reference:', envReference);
      }

      // Build compose array - use parent app compose as base, override CPU/RAM/HDD from config
      // This matches FluxCloud InstallDialog.vue behavior exactly
      const parentCompose = selectedPlan._app.compose || [];
      const configComponents = selectedPlan._config?.components || [];
      const compose = parentCompose.map((component, componentIndex) => {
        const configComponent = configComponents[componentIndex] || configComponents[0] || {};

        // Parent compose env is the base; the config's env overrides it by key
        const environmentParameters = mergeEnvParams(
          component.environmentParameters,
          configComponent.environmentParameters
        );
        if (envReference) {
          environmentParameters.push(envReference);
        }

        // Use parent compose for repotag/ports/etc, override only CPU/RAM/HDD from config
        const cpuValue = configComponent.cpu || component.cpu || 1;
        const ramValue = configComponent.ram || component.ram || 2000;
        const hddValue = configComponent.hdd || component.hdd || 10;

        return {
          name: component.name || 'component',
          description: component.description || 'Palworld server component',
          repotag: component.repotag || '',
          ports: Array.isArray(component.ports) ? component.ports : [],
          domains: Array.isArray(component.domains) ? component.domains : [],
          environmentParameters: environmentParameters,
          commands: Array.isArray(component.commands) ? component.commands : [],
          containerPorts: Array.isArray(component.containerPorts) ? component.containerPorts : [],
          containerData: withModsMount(component.containerData),
          tiered: typeof component.tiered === 'boolean' ? component.tiered : false,
          cpu: Math.round(cpuValue * 10) / 10,
          ram: Math.round(ramValue),
          hdd: Math.round(hddValue),
          secrets: component.secrets || '',
          repoauth: component.repoauth || '',
          envFluxStorage: component.envFluxStorage || '',
        };
      });

      // Build full app spec (FluxOS v8 format)
      // CRITICAL: Field order MUST match FluxOS for signature verification!
      const appSpec = {
        version: 8,
        name: appName,
        description: 'Palworld Server on Flux Decentralized Cloud',
        owner: zelidauth.zelid,
        compose: compose,
        instances: getPlanInstances(selectedPlan),
        expire: 88000 * subscriptionMonths, // PON Fork support
        contacts: [contactsReference], // Flux Storage reference
        geolocation: geolocationCodes,
        nodes: [],
        staticip: false,
        enterprise: '',
      };

      console.log('📋 Complete App Spec:', JSON.stringify(appSpec, null, 2));

      // Step 1: Register app spec (or reuse existing hash if specs unchanged)
      let hash;
      if (paymentHash) {
        console.log('♻️ Fiat: Reusing existing payment hash:', paymentHash);
        hash = paymentHash;
      } else {
        console.log('📝 Step 1: Registering app spec with FluxOS...');
        try {
          hash = await apiService.registerAppSpec(appSpec);
          console.log('✅ Step 1 complete - Payment hash received:', hash);
        } catch (error) {
          console.error('❌ Step 1 failed - App registration error:', error);
          toast.error('Failed to register app specification');
          setIsDeploying(false);
          return;
        }
      }

      // Step 2: Create Stripe checkout with payment hash
      console.log('💳 Step 2: Creating Stripe checkout session with payment hash...');
      const successUrl = `${window.location.origin}/success?deployment=true&hash=${hash}`;
      const cancelUrl = `${window.location.origin}/cancel?deployment=true`;

      try {
        const appDescription = 'Palworld Server on Flux Decentralized Cloud';
        const sessionId = autoRenewal
          ? await stripeService.createSubscriptionSession(
              appName.toLowerCase(),
              successUrl,
              cancelUrl,
              hash,
              totalCost,
              appName.toLowerCase(),
              subscriptionMonths,
              appDescription
            )
          : await stripeService.createCheckoutSession(
              appName.toLowerCase(),
              successUrl,
              cancelUrl,
              hash,
              totalCost,
              appName.toLowerCase(),
              appDescription
            );

        console.log('✅ Step 2 complete - Stripe session created:', sessionId);
        console.log('🔀 Opening Stripe checkout in new window...');
        console.log('========================================');

        // Open Stripe checkout in popup window (FluxOS pattern)
        // sessionId is already the full checkout URL from bridge
        const win = window.open(sessionId, '_blank', 'width=600,height=800,resizable=yes,scrollbars=yes');

        // Check if popup was blocked
        if (!win || win.closed || typeof win.closed === 'undefined') {
          // Popup blocked - show dialog
          setBlockedPaymentUrl(sessionId);
          setShowPopupBlockedDialog(true);
        } else {
          // Monitor popup - if closed without completing payment, treat as cancelled
          const checkPopup = setInterval(() => {
            if (win.closed) {
              clearInterval(checkPopup);
              // Remove from ref
              popupIntervalsRef.current = popupIntervalsRef.current.filter(id => id !== checkPopup);
              // Give a moment for the message to arrive
              setTimeout(() => {
                // If still waiting (no message received), treat as cancelled
                setWaitingForPayment(prev => {
                  if (prev) {
                    setPaymentResult('cancelled');
                    setIsDeploying(false);
                  }
                  return false;
                });
              }, 500);
            }
          }, 500);
          // Store interval ID for cleanup
          popupIntervalsRef.current.push(checkPopup);
        }

        // Save payment hash and set waiting state
        setPaymentHash(hash);
        setWaitingForPayment(true); // Show waiting indicator
        setIsDeploying(false);

      } catch (error) {
        console.error('❌ Step 2 failed - Stripe checkout error:', error);
        toast.error('Failed to create payment session');
        setIsDeploying(false);
        return;
      }
    } catch (error) {
      console.error('❌ Deployment failed:', error);
      toast.error('Failed to deploy server. Please try again.');
      setIsDeploying(false);
    }
  };
  const handleDeployRef = useRef(handleDeployImpl);
  handleDeployRef.current = handleDeployImpl;
  const handleDeploy = useCallback(() => handleDeployRef.current(), []);

  // ========== Crypto Payment Flow ==========

  const handleCryptoDeployImpl = async (walletType) => {
    if (isDeploying) return;

    // Validate wallet availability
    if (walletType === 'ssp' && !isSSPAvailable()) {
      toast.error('SSP Wallet not found. Please install the SSP browser extension.');
      return;
    }

    setIsDeploying(true);

    try {
      // Reuse same registration logic as Stripe flow
      const zelidauth = await apiService.getStoredAuth();
      if (!zelidauth) {
        toast.error('Please log in to continue');
        setIsDeploying(false);
        return;
      }

      // Upload contacts (same as handleDeployImpl)
      const email = user?.email || 'no-email@flux.local';
      const contactsId = storageService.generateContactsId();
      await storageService.uploadContacts({ contactsid: contactsId, contacts: [email] });
      const contactsReference = storageService.getContactsStorageReference(contactsId);

      // Upload environment params
      const envParamsArray = [];
      Object.entries(environmentParams).forEach(([key, value]) => {
        if (value) envParamsArray.push(`${key}=${value}`);
      });
      let envReference = null;
      if (envParamsArray.length > 0) {
        const envId = storageService.generateEnvId();
        await storageService.uploadEnv({ envid: envId, env: envParamsArray });
        envReference = storageService.getEnvStorageReference(envId);
      }

      // Build app spec (same as handleDeployImpl) - use parent compose, override CPU/RAM/HDD from config
      const appName = serverConfig.appName;
      const geolocationCodes = allowedLocations;
      const parentCompose = selectedPlan._app.compose || [];
      const configComponents = selectedPlan._config?.components || [];
      const compose = parentCompose.map((component, componentIndex) => {
        const configComp = configComponents[componentIndex] || configComponents[0] || {};

        // Parent compose env is the base; the config's env overrides it by key
        const environmentParameters = mergeEnvParams(
          component.environmentParameters,
          configComp.environmentParameters
        );
        if (envReference) {
          environmentParameters.push(envReference);
        }
        const cpuValue = parseNumericValue(configComp.cpu) || parseNumericValue(component.cpu) || 1;
        const ramValue = parseRamValue(configComp.ram) || parseRamValue(component.ram) || 1000;
        const hddValue = parseHddValue(configComp.hdd) || parseHddValue(component.hdd) || 10;
        return {
          name: component.name || appName,
          description: component.description || 'Palworld Server',
          repotag: component.repotag || '',
          ports: Array.isArray(component.ports) ? component.ports : [],
          domains: Array.isArray(component.domains) ? component.domains : [''],
          environmentParameters,
          commands: Array.isArray(component.commands) ? component.commands : [],
          containerPorts: Array.isArray(component.containerPorts) ? component.containerPorts : [],
          containerData: withModsMount(component.containerData),
          tiered: typeof component.tiered === 'boolean' ? component.tiered : false,
          cpu: Math.round(cpuValue * 10) / 10,
          ram: Math.round(ramValue),
          hdd: Math.round(hddValue),
          secrets: component.secrets || '',
          repoauth: component.repoauth || '',
          envFluxStorage: component.envFluxStorage || '',
        };
      });

      const appSpec = {
        version: 8,
        name: appName,
        description: 'Palworld Server on Flux Decentralized Cloud',
        owner: zelidauth.zelid,
        compose: compose,
        instances: getPlanInstances(selectedPlan),
        expire: 88000 * subscriptionMonths,
        contacts: [contactsReference],
        geolocation: geolocationCodes,
        nodes: [],
        staticip: false,
        enterprise: '',
      };

      // Step 1: Register app spec (or reuse existing hash from cancelled fiat flow)
      let hash;
      if (paymentHash) {
        console.log('♻️ Crypto: Reusing existing payment hash from previous registration:', paymentHash);
        hash = paymentHash;
      } else {
        console.log('📝 Crypto: Registering app spec...');
        try {
          hash = await apiService.registerAppSpec(appSpec);
          console.log('✅ Payment hash:', hash);
        } catch {
          toast.error('Failed to register app specification');
          setIsDeploying(false);
          return;
        }
      }

      // Step 2: Get payment address
      console.log('📡 Fetching deployment info for payment address...');
      const deploymentInfo = await apiService.getDeploymentInfo();
      const paymentAddress = deploymentInfo?.address;
      if (!paymentAddress) {
        toast.error('Failed to get payment address');
        setIsDeploying(false);
        return;
      }

      // Step 3: Open wallet
      const amount = String(fluxPrice);
      console.log(`💰 Crypto payment: ${amount} FLUX to ${paymentAddress} (hash: ${hash})`);

      let txid;
      setWaitingForCrypto(true);
      try {
        if (walletType === 'zelcore') {
          const abortController = new AbortController();
          cryptoAbortRef.current = abortController;
          const result = await payWithZelcore({ address: paymentAddress, amount, message: hash, signal: abortController.signal });
          txid = result.txid;
        } else {
          const response = await payWithSSP({ message: hash, amount, address: paymentAddress, chain: 'flux' });
          txid = response.txid;
        }
      } catch (error) {
        setWaitingForCrypto(false);
        cryptoAbortRef.current = null;
        if (error.message === 'Payment cancelled') {
          toast.error('Payment cancelled');
        } else {
          toast.error(error.message || `Failed to pay with ${walletType === 'zelcore' ? 'ZelCore' : 'SSP'}`);
        }
        setIsDeploying(false);
        return;
      }
      setWaitingForCrypto(false);
      cryptoAbortRef.current = null;

      // Payment confirmed — got txid, save to localStorage (dashboard monitors from here)
      console.log(`✅ Crypto payment confirmed — txid: ${txid}`);
      toast.success('Payment confirmed!');
      setPaymentHash(hash);
      setCryptoTxid(txid);
      saveServerToLocalStorage(hash);
      setPaymentResult('success');
      setIsDeploying(false);
      stepDirectionRef.current = 1;
      setCurrentStep(6);

    } catch (error) {
      console.error('❌ Crypto deployment failed:', error);
      toast.error('Failed to deploy server. Please try again.');
      setIsDeploying(false);
    }
  };
  const handleCryptoDeployRef = useRef(handleCryptoDeployImpl);
  handleCryptoDeployRef.current = handleCryptoDeployImpl;
  const handleCryptoDeploy = useCallback((walletType) => handleCryptoDeployRef.current(walletType), []);

  // Handle free first month deployment — register spec, skip payment, appsmonitor pays on-chain
  const handleFreeDeployImpl = async () => {
    if (!selectedPlan) return;
    setIsDeploying(true);
    setPaymentResult(null);

    try {
      const zelidauth = await apiService.getStoredAuth();
      if (!zelidauth) throw new Error('Authentication required');

      console.log('🎉 ========== FREE FIRST MONTH DEPLOYMENT ==========');

      // Build app spec (same as handleDeployImpl)
      const appName = serverConfig.appName || serverConfig.name;

      // Upload contact email to Flux Storage (same as the fiat/crypto flows) so the
      // registered app spec carries a real F_S_CONTACTS reference instead of an
      // empty contacts array.
      const email = user?.email || 'no-email@flux.local';
      const contactsId = storageService.generateContactsId();
      await storageService.uploadContacts({ contactsid: contactsId, contacts: [email] });
      const contactsReference = storageService.getContactsStorageReference(contactsId);
      const geolocationCodes = allowedLocations.length > 0 ? allowedLocations : [];

      const selectedConfig = selectedPlan._config;
      const parentCompose = selectedPlan._app?.compose || [];
      const compose = (selectedConfig.components || [selectedConfig]).map((component, componentIndex) => {
        const cpuValue = component.cpu || component.cpubasic || 0;
        const ramValue = component.ram || component.rambasic || 0;
        const hddValue = component.hdd || component.hddbasic || 0;
        // Parent compose env is the base, config env overrides it, wizard params win last
        const environmentParameters = mergeEnvParams(
          parentCompose[componentIndex]?.environmentParameters,
          component.environmentParameters,
          Object.entries(environmentParams).map(([key, value]) => `${key}=${value}`)
        );

        return {
          name: component.name || 'component',
          description: component.description || 'Palworld server component',
          repotag: component.repotag || '',
          ports: Array.isArray(component.ports) ? component.ports : [],
          domains: Array.isArray(component.domains) ? component.domains : [],
          environmentParameters,
          commands: Array.isArray(component.commands) ? component.commands : [],
          containerPorts: Array.isArray(component.containerPorts) ? component.containerPorts : [],
          containerData: withModsMount(component.containerData),
          tiered: typeof component.tiered === 'boolean' ? component.tiered : false,
          cpu: Math.round(cpuValue * 10) / 10,
          ram: Math.round(ramValue),
          hdd: Math.round(hddValue),
          secrets: component.secrets || '',
          repoauth: component.repoauth || '',
          envFluxStorage: component.envFluxStorage || '',
        };
      });

      const appSpec = {
        version: 8,
        name: appName,
        description: 'Palworld Server on Flux Decentralized Cloud',
        owner: zelidauth.zelid,
        compose,
        instances: getPlanInstances(selectedPlan),
        expire: 88000, // Always 1 month for free first month
        contacts: [contactsReference],
        geolocation: geolocationCodes,
        nodes: [],
        staticip: false,
        enterprise: '',
      };

      // Register app spec
      console.log('📝 Registering app spec (free first month)...');
      const hash = await apiService.registerAppSpec(appSpec);
      console.log('✅ App registered, hash:', hash);

      // If auto-renewal, create Stripe subscription with trial
      if (autoRenewal) {
        console.log('💳 Creating Stripe subscription with 30-day trial...');
        const successUrl = `${window.location.origin}/success?deployment=true&hash=${hash}`;
        const cancelUrl = `${window.location.origin}/cancel?deployment=true`;
        const appDescription = 'Palworld Server on Flux Decentralized Cloud';

        const sessionUrl = await stripeService.createSubscriptionSession(
          appName.toLowerCase(),
          successUrl,
          cancelUrl,
          hash,
          totalCost,
          appName.toLowerCase(),
          1,
          appDescription,
          30 // 30-day free trial
        );

        // Open Stripe for card setup (no charge now)
        const win = window.open(sessionUrl, '_blank', 'width=600,height=800,resizable=yes,scrollbars=yes');
        if (!win || win.closed) {
          setBlockedPaymentUrl(sessionUrl);
          setShowPopupBlockedDialog(true);
        } else {
          const checkPopup = setInterval(() => {
            if (win.closed) {
              clearInterval(checkPopup);
              popupIntervalsRef.current = popupIntervalsRef.current.filter(id => id !== checkPopup);
              setTimeout(() => {
                setWaitingForPayment(prev => {
                  if (prev) { setPaymentResult('cancelled'); setIsDeploying(false); }
                  return false;
                });
              }, 500);
            }
          }, 500);
          popupIntervalsRef.current.push(checkPopup);
        }
        setPaymentHash(hash);
        setWaitingForPayment(true);
        setIsDeploying(false);
      } else {
        // No auto-renewal — skip payment entirely, appsmonitor pays on-chain
        setPaymentHash(hash);
        saveServerToLocalStorage(hash);
        setPaymentResult('success');
        setIsDeploying(false);
        stepDirectionRef.current = 1;
        setCurrentStep(6);
        toast.success('🎉 Free first month activated!');
      }
    } catch (error) {
      console.error('❌ Free deployment failed:', error);
      toast.error('Failed to deploy server. Please try again.');
      setIsDeploying(false);
    }
  };
  const handleFreeDeployRef = useRef(handleFreeDeployImpl);
  handleFreeDeployRef.current = handleFreeDeployImpl;
  const handleFreeDeploy = useCallback(() => handleFreeDeployRef.current(), []);

  // Handle opening blocked payment popup (FluxOS pattern)
  const openBlockedPayment = () => {
    if (blockedPaymentUrl) {
      const win = window.open(blockedPaymentUrl, '_blank');
      setShowPopupBlockedDialog(false);
      setBlockedPaymentUrl(null);

      // Monitor the manually opened tab
      if (win) {
        const checkPopup = setInterval(() => {
          if (win.closed) {
            clearInterval(checkPopup);
            // Remove from ref
            popupIntervalsRef.current = popupIntervalsRef.current.filter(id => id !== checkPopup);
            // Give a moment for the message to arrive
            setTimeout(() => {
              // If still waiting (no message received), treat as cancelled
              setWaitingForPayment(prev => {
                if (prev) {
                  setPaymentResult('cancelled');
                  setIsDeploying(false);
                }
                return false;
              });
            }, 500);
          }
        }, 500);
        // Store interval ID for cleanup
        popupIntervalsRef.current.push(checkPopup);
      }
    }
  };

  // Save server to localStorage for dashboard monitoring
  const saveServerToLocalStorage = (hash, stripeSessionId = null) => {
    const server = {
      name: serverConfig.name, // Use name as unique identifier
      plan: selectedPlan.name,
      status: 'payment_pending',
      instances: serverConfig.instances,
      cpu: parseNumericValue(selectedPlan.specs?.cpu || selectedPlan._config?.cpu),
      ram: parseRamValue(selectedPlan.specs?.ram || selectedPlan._config?.ram),
      hdd: parseHddValue(selectedPlan.specs?.storage || selectedPlan.specs?.hdd || selectedPlan._config?.hdd),
      paymentHash: hash,
      stripeSessionId: stripeSessionId, // Stripe transaction ID
      subscriptionMonths: subscriptionMonths,
      autoRenewal: autoRenewal,
      pendingTimestamp: Date.now(), // Auto-expire after 1 hour if payment not completed
    };

    // Get existing servers from localStorage
    const existingServers = JSON.parse(localStorage.getItem('deployedServers') || '[]');

    // Check for duplicates (same name or same payment hash)
    const isDuplicate = existingServers.some(s =>
      s.name === server.name || (s.paymentHash && s.paymentHash === server.paymentHash)
    );

    if (!isDuplicate) {
      existingServers.push(server);
      localStorage.setItem('deployedServers', JSON.stringify(existingServers));
      console.log('✅ Server saved to dashboard:', server);
    } else {
      console.log('⚠️ Server already exists, skipping:', server.name);
    }
  };

  // Keep ref in sync to avoid stale closure in message listener
  saveServerToLocalStorageRef.current = saveServerToLocalStorage;

  // Format location label for display
  const formatLocationLabel = useCallback((geoCode) => {
    const code = geoCode.replace(/^ac/, '');
    const parts = code.split('_');

    const continentNames = {
      'AF': 'Africa',
      'AS': 'Asia',
      'EU': 'Europe',
      'NA': 'North America',
      'OC': 'Oceania',
      'SA': 'South America',
    };

    if (parts.length === 1) {
      return continentNames[parts[0]] || parts[0];
    } else {
      const continent = continentNames[parts[0]] || parts[0];
      const country = getCountryName(parts[1]);
      return `${country} (${continent})`;
    }
  }, [getCountryName]);

  // Get flag icon for country code
  const getFlagIcon = useCallback((code) => {
    return `flag:${code.toLowerCase()}-4x3`;
  }, []);

  // Add allowed location
  const handleAddLocation = useCallback(() => {
    if (!geolocationForm.continent) {
      toast.error('Please select a continent');
      return;
    }

    let geoCode = `ac${geolocationForm.continent}`;
    if (geolocationForm.country) {
      geoCode += `_${geolocationForm.country}`;
    }

    setAllowedLocations(prev => {
      if (prev.includes(geoCode)) return prev;
      // Adding whole continent — remove individual countries from that continent
      if (!geolocationForm.country) {
        const prefix = `${geoCode}_`;
        return [...prev.filter(code => !code.startsWith(prefix)), geoCode];
      }
      return [...prev, geoCode];
    });
    setPaymentHash(null); // Spec changed
    setGeolocationForm({ continent: '', country: '' });
  }, [geolocationForm]);

  // Remove allowed location
  const handleRemoveLocation = useCallback((geoCode) => {
    setAllowedLocations(prev => prev.filter(code => code !== geoCode));
    setPaymentHash(null); // Spec changed
  }, []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2.5">
          <Rocket className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
          <span>Deploy New Server</span>
        </div>
      }
      size="full"
      headerContent={<StepProgressBar currentStep={currentStep} />}
      noMinHeight={true}
    >
      <AnimatePresence mode="wait" custom={stepDirectionRef.current}>
        {currentStep === 1 && !skippedStep1Ref.current && (
          <StepPlanSelection
            direction={stepDirectionRef.current}
            availablePlans={availablePlans}
            selectedPlan={selectedPlan}
            onPlanSelect={handlePlanSelect}
            loading={plansLoading}
          />
        )}

        {currentStep === 2 && (
          <StepConfigure
            direction={stepDirectionRef.current}
            selectedPlan={selectedPlan}
            serverConfig={serverConfig}
            onServerConfigChange={(val) => { setServerConfig(val); setPaymentHash(null); }}
            subscriptionMonths={subscriptionMonths}
            onSubscriptionChange={(val) => { setSubscriptionMonths(val); setPaymentHash(null); }}
            loadingPricing={loadingPricing}
            totalCost={totalCost}
            currentDiscount={currentDiscount}
            onBack={handleBackToStep1}
            onContinue={handleConfigure}
            isFreeFirstMonth={isFreeFirstMonth}
          />
        )}

        {currentStep === 3 && (
          <StepEnvironment
            direction={stepDirectionRef.current}
            selectedPlan={selectedPlan}
            environmentParams={environmentParams}
            onEnvironmentParamsChange={(val) => { setEnvironmentParams(val); setPaymentHash(null); }}
            showAdvanced={showAdvanced}
            onShowAdvancedToggle={handleShowAdvancedToggle}
            onBack={handleBackToStep2}
            onContinue={handleContinueToStep4}
          />
        )}

        {currentStep === 4 && (
          <StepLocation
            direction={stepDirectionRef.current}
            geolocationForm={geolocationForm}
            onGeolocationFormChange={setGeolocationForm}
            availableContinents={availableContinents}
            availableCountries={availableCountries}
            allowedLocations={allowedLocations}
            onAddLocation={handleAddLocation}
            onRemoveLocation={handleRemoveLocation}
            formatLocationLabel={formatLocationLabel}
            getFlagIcon={getFlagIcon}
            onBack={handleBackToStep3OrSkip}
            onContinue={handleContinueToStep5}
          />
        )}

        {currentStep === 5 && (
          <>
            {waitingForCrypto ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-500 border-t-transparent"></div>
                <h3 className="text-lg font-semibold text-white">Waiting for Payment</h3>
                <p className="text-sm text-gray-400 text-center">
                  Please complete the payment in your wallet.
                </p>
                <button
                  onClick={() => {
                    cryptoAbortRef.current?.abort();
                    setWaitingForCrypto(false);
                    setIsDeploying(false);
                  }}
                  className="mt-4 px-8 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 hover:border-red-400/30 rounded-lg transition-colors flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Cancel Payment
                </button>
              </div>
            ) : (
              <StepReview
                direction={stepDirectionRef.current}
                selectedPlan={selectedPlan}
                serverConfig={serverConfig}
                subscriptionMonths={subscriptionMonths}
                monthlyPrice={monthlyPrice}
                totalCost={totalCost}
                currentDiscount={currentDiscount}
                environmentParams={environmentParams}
                allowedLocations={allowedLocations}
                formatLocationLabel={formatLocationLabel}
                getFlagIcon={getFlagIcon}
                isDeploying={isDeploying}
                autoRenewal={autoRenewal}
                onAutoRenewalChange={setAutoRenewal}
                onBack={handleBackToStep4}
                onDeploy={handleDeploy}
                fluxPrice={fluxPrice}
                fluxDiscount={apiPricing.fluxDiscount || 0}
                onCryptoPay={handleCryptoDeploy}
                isFreeFirstMonth={isFreeFirstMonth}
                checkingEligibility={checkingEligibility}
                existingCustomer={existingCustomer}
                onFreeDeploy={handleFreeDeploy}
              />
            )}
          </>
        )}
        {currentStep === 6 && (
          <StepFinalizing
            serverConfig={serverConfig}
            selectedPlan={selectedPlan}
            subscriptionMonths={subscriptionMonths}
            autoRenewal={autoRenewal}
            paymentHash={paymentHash}
            stripeSessionId={stripeSessionId}
            cryptoTxid={cryptoTxid}
            isFreeFirstMonth={isFreeFirstMonth}
            onSuccess={onSuccess}
            onClose={onClose}
          />
        )}
      </AnimatePresence>

      {/* Waiting for Payment Overlay */}
      {waitingForPayment && !paymentResult && currentStep === 5 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-blue-500/30">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-blue-400 mb-2">Waiting for Payment</h4>
                <p className="text-sm text-blue-300 mb-3">
                  Please complete your payment in the popup window to continue deployment.
                </p>
                <p className="text-xs text-gray-400">
                  If the popup was blocked, click "Open Payment Window" to complete your purchase.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentResult === 'cancelled' && currentStep === 5 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full border border-yellow-500/30">
            <div className="text-center">
              <svg className="w-12 h-12 text-orange-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h4 className="text-xl font-semibold text-orange-400 mb-2">Payment Cancelled</h4>
              <p className="text-sm text-yellow-300 mb-4">
                The payment was cancelled. No charges were made.
              </p>
              <button
                onClick={() => {
                  setPaymentResult(null);
                  setIsDeploying(false);
                  setWaitingForPayment(false);
                }}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Blocked Dialog (FluxOS pattern) */}
      {showPopupBlockedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4 border border-gray-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Popup Blocked
                </h3>
                <p className="text-sm text-gray-300 mb-4">
                  Your browser blocked the payment window. Please click the button below to open the Stripe checkout page.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={openBlockedPayment}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Open Payment Window
                  </button>
                  <button
                    onClick={() => {
                      setShowPopupBlockedDialog(false);
                      setBlockedPaymentUrl(null);
                      setWaitingForPayment(false);
                      setPaymentResult('cancelled');
                      setIsDeploying(false);
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DeploymentDialog;
