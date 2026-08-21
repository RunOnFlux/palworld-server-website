import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import { Helmet } from 'react-helmet-async';
import { Star, Users, Cpu, HardDrive, Network, Flame, Check, BarChart3, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import marketplaceService from '../../services/marketplaceService';
import plansSnapshot from '../../config/snapshots/plans.json';
import { gameConfig } from '../../config/gameConfig';
import { useAuth } from '../../context/AuthContext';
import Card, { CardBody, CardFooter, CardHeader } from '../common/Card';
import Button from '../common/Button';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Get icon for spec type
 */
const getSpecIcon = (key) => {
  const iconMap = {
    players: Users,
    ram: Cpu,
    storage: HardDrive,
    cpu: Cpu,
    bandwidth: Network
  };
  return iconMap[key.toLowerCase()] || Network;
};

/**
 * Get proper label for spec type
 */
const getSpecLabel = (key) => {
  const labelMap = {
    players: 'Recommended for',
    ram: 'RAM',
    storage: 'Storage',
    cpu: 'CPU',
    bandwidth: 'Bandwidth'
  };
  return labelMap[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1);
};

/**
 * Get gradient background for each plan tier
 */
const getPlanGradient = (planId) => {
  const gradients = {
    basic: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(74, 46, 27, 0.05) 100%)', // Amber/brown
    standard: 'linear-gradient(135deg, rgba(33, 150, 243, 0.05) 0%, rgba(13, 71, 161, 0.05) 100%)', // Blue
    premium: 'linear-gradient(135deg, rgba(77, 208, 225, 0.08) 0%, rgba(0, 188, 212, 0.08) 100%)', // Cyan/diamond
    enterprise: 'linear-gradient(135deg, rgba(156, 39, 176, 0.05) 0%, rgba(74, 20, 140, 0.05) 100%)', // Purple
  };
  return gradients[planId] || gradients.basic;
};

/**
 * Get discount/promo badge for a plan based on gameConfig.planBadges
 */
const getPlanBadge = (plan, index) => {
  const badges = gameConfig.planBadges || [];
  return badges.find(badge => {
    if (!badge.match) return false;
    if (badge.match.all) return true;
    if (badge.match.index !== undefined && badge.match.index === index) return true;
    if (badge.match.name && plan.name.toLowerCase().includes(badge.match.name.toLowerCase())) return true;
    return false;
  });
};

/**
 * Pricing Plans Section
 * Fetches plans from Flux Marketplace API
 */
const PricingPlans = ({ onGetStarted, onBuyNow }) => {
  const { isAuthenticated } = useAuth();
  const planCardsRef = useRef([]);

  // Fetch server plans from API.
  //
  // The placeholder falls back to src/config/snapshots/plans.json (refreshed at build time
  // by scripts/sync-snapshots.mjs). Without it the query has no data during
  // renderToString — nothing fetches on the server — so the prerendered HTML shipped a
  // "Loading pricing plans..." spinner instead of the plan tiers, the specs and the Offer
  // JSON-LD below. It is placeholderData rather than initialData on purpose: placeholder
  // data is never written to the cache and never counts as fresh, so the live fetch still
  // runs on mount and overwrites it.
  const { data: plans = [], isPlaceholderData, error } = useQuery({
    queryKey: ['serverPlans'],
    queryFn: () => marketplaceService.getServerPlans(),
    staleTime: 10 * 60 * 1000, // 10 min - after this, show cached + refetch silently
    gcTime: Infinity, // never garbage collect - cache lives for entire session
    placeholderData: (prev) => prev ?? plansSnapshot,
  });

  // Snapshot plans carry display fields only — the compose spec the deploy dialog needs
  // (`_config` / `_app`) is deliberately not snapshotted, so checkout stays disabled until
  // the live fetch lands. In practice that is the first few hundred ms.
  const plansPending = isPlaceholderData || plans.some((p) => p.snapshot);

  // GSAP scroll-driven 3D tilt for pricing cards
  useEffect(() => {
    if (plans.length === 0) return;

    const ctx = gsap.context(() => {
      planCardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card, {
          opacity: 0,
          y: 80,
          rotateX: 15,
          scale: 0.9,
        }, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          scale: 1,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 90%',
            toggleActions: 'play none none none',
          },
          delay: i * 0.12,
        });
      });
    });

    return () => ctx.revert();
  }, [plans]);

  const handleSelectPlan = (plan) => {
    // Snapshot plans have no compose spec to deploy from. The button is disabled in that
    // state; this is the belt-and-braces for a programmatic call.
    if (plan.snapshot) {
      return;
    }

    if (!isAuthenticated) {
      onGetStarted(); // Show login modal
      return;
    }

    if (plan.contactRequired) {
      return;
    }

    if (onBuyNow) {
      onBuyNow(plan);
    }
  };

  // No isLoading branch: the snapshot means `plans` is populated from the very first
  // render, on the server and in the browser. An empty list now only happens when the
  // snapshot is missing AND the API failed, which the error branch below covers.
  if (plans.length === 0) {
    return (
      <section id="pricing" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <LoadingSpinner size="lg" text="Loading pricing plans..." />
        </div>
      </section>
    );
  }

  if (error && plans.length === 0) {
    return (
      <section id="pricing" className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-red-500">Failed to load pricing plans. Please try again later.</p>
        </div>
      </section>
    );
  }

  // Generate structured data for search engines.
  // Each Product needs an absolute `image` URL — Google flags it as a critical
  // missing field for merchant listing rich results otherwise.
  const siteUrl = import.meta.env.VITE_APP_URL || 'https://palworld.runonflux.com';
  const productImage = `${siteUrl}${gameConfig.assets.banner}`;
  const offerUrl = `${siteUrl}/#pricing`;
  // Hosting plans are typed as Service (not Product) so Google doesn't apply
  // Merchant Listings validation (image/brand/shipping/returns) or Product Snippet
  // rating requirements — neither applies to a hosted service.

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: plans.map((plan, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: plan.name,
        description: plan.description,
        image: productImage,
        sku: plan.id || `palworld-plan-${index + 1}`,
        brand: { '@type': 'Brand', name: gameConfig.serverName },
        offers: plan.price ? {
          '@type': 'Offer',
          price: (plan.price.monthly / 100).toFixed(2),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          url: offerUrl,
          description: 'First month free for new users',
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: (plan.price.monthly / 100).toFixed(2),
            priceCurrency: 'USD',
            referenceQuantity: {
              '@type': 'QuantitativeValue',
              value: 1,
              unitCode: 'MON',
            },
          },
        } : undefined,
      },
    })),
  };

  return (
    <section id="pricing" className="relative py-4 bg-background-alt border-t border-border/20">
      {/* Structured Data for SEO */}
      {plans.length > 0 && (
        <Helmet>
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        </Helmet>
      )}
      {/* Background image */}
      <div
        className="absolute inset-0 opacity-[0.45] pointer-events-none bg-center bg-cover"
        style={{
          backgroundImage: `url(/games/palworld/pricing-background.webp)`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-3">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Choose the perfect plan for your community. Start playing in minutes.
          </p>

          {/* Free first month badge */}
          <motion.div
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(33,150,243,0.15), rgba(25,118,210,0.1))',
              border: '1px solid rgba(33,150,243,0.3)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/10 to-transparent animate-[shimmer_3s_infinite]" />
            <span className="relative text-base sm:text-lg font-bold text-blue-300">🎁 First month free for new users*</span>
          </motion.div>

        </motion.div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-4 overflow-visible">
          {plans.map((plan, index) => (
            <div
              key={plan.id}
              ref={el => planCardsRef.current[index] = el}
              className="overflow-visible"
              style={{ perspective: '1200px' }}
            >
              <Card
                hover
                shadow="lg"
                className={`h-full relative flex flex-col transition-all duration-300 overflow-visible ${
                  plan.popular ? 'border-2 border-primary shadow-primary/20' : ''
                }`}
                style={{
                  boxShadow: plan.popular
                    ? '0 25px 60px -5px rgba(33, 150, 243, 0.4), 0 35px 80px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                    : '0 25px 60px -5px rgba(0, 0, 0, 0.3), 0 35px 80px -15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                  transform: 'perspective(1200px) translateY(-12px) translateZ(20px) rotateX(3deg)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'perspective(1200px) translateY(-18px) translateZ(35px) rotateX(5deg)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 35px 80px -5px rgba(33, 150, 243, 0.5), 0 50px 120px -20px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2), 0 0 0 3px rgba(33, 150, 243, 0.6), 0 0 30px 3px rgba(33, 150, 243, 0.4)'
                    : '0 35px 80px -5px rgba(0, 0, 0, 0.4), 0 50px 120px -20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 0 0 2px rgba(77, 208, 225, 0.5), 0 0 25px 2px rgba(77, 208, 225, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'perspective(1200px) translateY(-12px) translateZ(20px) rotateX(3deg)';
                  e.currentTarget.style.boxShadow = plan.popular
                    ? '0 25px 60px -5px rgba(33, 150, 243, 0.4), 0 35px 80px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15)'
                    : '0 25px 60px -5px rgba(0, 0, 0, 0.3), 0 35px 80px -15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                }}
              >
                {/* Corner ribbon discount badge */}
                {(() => {
                  const badge = getPlanBadge(plan, index);
                  if (!badge) return null;
                  const bg = badge.bgColor || '#e53e3e';
                  return (
                    <div
                      className="absolute z-20 overflow-hidden pointer-events-none"
                      style={{ top: 0, right: 0, width: '120px', height: '120px' }}
                    >
                      <div
                        className="absolute flex items-center justify-center gap-1 font-bold"
                        style={{
                          width: '170px',
                          top: '22px',
                          right: '-40px',
                          transform: 'rotate(45deg)',
                          background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
                          color: badge.color || '#fff',
                          fontSize: '14px',
                          padding: '6px 0',
                          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                          boxShadow: `0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.15)`,
                          letterSpacing: '0.03em',
                        }}
                      >
                        <Flame className="w-4.5 h-4.5 fill-orange-400 text-yellow-300 animate-[flicker_0.8s_ease-in-out_infinite_alternate]" style={{ filter: 'drop-shadow(0 0 4px rgba(255,165,0,0.8))' }} />
                        {badge.text}
                      </div>
                    </div>
                  );
                })()}

                {/* Gradient background */}
                <div
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{
                    background: getPlanGradient(plan.id),
                  }}
                />

                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div
                      className="bg-primary px-3 py-1 rounded-full flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
                      style={{
                        boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3), 0 6px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.2)',
                        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                        border: '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <Star
                        className="w-3.5 h-3.5 fill-current"
                        style={{
                          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                        }}
                      />
                      Recommended
                    </div>
                  </div>
                )}

                <CardHeader className="text-center pt-6 relative z-10 flex flex-col items-center">
                  <div
                    className="inline-block px-4 py-2 mb-3 rounded"
                    style={{
                      background: 'linear-gradient(135deg, rgba(33, 150, 243, 0.1), rgba(0, 0, 0, 0.2))',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
                      border: '2px solid rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    <h3
                      className="text-2xl font-bold"
                      style={{
                        textShadow: '3px 3px 0 rgba(0,0,0,0.5), 0 0 20px rgba(33, 150, 243, 0.4)',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {plan.name}
                    </h3>
                  </div>
                  {/* Price */}
                  {(() => {
                    const priceBadge = getPlanBadge(plan, index);
                    const pct = priceBadge?.text?.match(/(\d+)%/);
                    const discountFrac = pct ? parseInt(pct[1]) / 100 : 0;
                    const originalPrice = discountFrac ? (plan.price?.monthly / 100 / (1 - discountFrac)).toFixed(2) : null;
                    return (
                  <div
                    className="mb-0 mt-2 inline-block rounded-lg overflow-hidden min-w-[130px]"
                    style={{
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(0,0,0,0.05))',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="px-6 py-2">
                    {plan.price ? (
                      <>
                        {originalPrice && (
                          <div className="text-text-muted text-xl line-through">${originalPrice}</div>
                        )}
                        <div
                          className="text-4xl font-bold text-primary"
                          style={{
                            textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 15px rgba(33, 150, 243, 0.3)',
                          }}
                        >
                          {plan.price.displayPrice}
                        </div>
                        <div className="text-text-muted text-sm">per month</div>
                      </>
                    ) : (
                      <div className="text-2xl font-bold text-text">
                        Contact Us
                      </div>
                    )}
                    </div>
                  </div>
                    );
                  })()}
                </CardHeader>

                <CardBody className="flex-1 pt-1.5">
                  {/* Specs */}
                  <div className="space-y-2">
                    {Object.entries(plan.specs).map(([key, value]) => {
                      const IconComponent = getSpecIcon(key);

                      // Smart wrap only for storage
                      const isStorage = key.toLowerCase() === 'storage';
                      let firstPart = value;
                      let secondPart = '';

                      if (isStorage) {
                        const valueParts = value.split(' ');
                        firstPart = valueParts.slice(0, 2).join(' '); // e.g., "100 GB"
                        secondPart = valueParts.slice(2).join(' '); // e.g., "SSD/NVMe"
                      }

                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 text-sm bg-surface/30 rounded-lg px-3 py-2 relative z-10 transition-colors duration-200 hover:bg-surface/50"
                          style={{
                            boxShadow: '0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.1)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.1)';
                          }}
                        >
                          <IconComponent
                            className="w-5 h-5 text-primary flex-shrink-0"
                            style={{
                              filter: 'drop-shadow(0 2px 4px rgba(33, 150, 243, 0.3))',
                            }}
                          />
                          <span className="text-text-secondary flex-1">{getSpecLabel(key)}</span>
                          {isStorage ? (
                            <div className="text-right flex flex-col items-end">
                              <span className="text-text font-semibold whitespace-nowrap">{firstPart}</span>
                              {secondPart && <span className="text-text-muted text-xs">{secondPart}</span>}
                            </div>
                          ) : (
                            <span className="text-text font-semibold text-right whitespace-nowrap">{value}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>

                <CardFooter className="relative z-10">
                  <div
                    style={{
                      filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
                    }}
                  >
                    <Button
                      variant={plan.popular ? 'primary' : 'outline'}
                      size="md"
                      fullWidth
                      onClick={() => handleSelectPlan(plan)}
                      // Greyed for the few hundred ms until the live fetch replaces the
                      // snapshot with plans that carry a deployable compose spec. The label
                      // deliberately stays the real CTA rather than "Loading…": this markup
                      // is what crawlers read, and a card whose button says "Loading" reads
                      // like a broken page.
                      disabled={plansPending && !plan.contactRequired}
                      style={{
                        boxShadow: plan.popular
                          ? '0 4px 12px rgba(33, 150, 243, 0.4), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 0 rgba(0,0,0,0.2)'
                          : '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.15)',
                        textShadow: plan.popular ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                      }}
                    >
                      {plan.contactRequired ? 'Contact Sales' : isAuthenticated ? 'Buy Now' : 'Get Started'}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </div>
          ))}
        </div>

        {/* No player-slot limits — plan numbers are capacity guidance, not a quota */}
        <p className="mt-10 max-w-3xl mx-auto text-center text-sm text-text-secondary leading-relaxed px-4">
          <strong className="text-text">We don&apos;t sell player slots.</strong> The player count on each plan is a
          guide to what its CPU and RAM handle comfortably — not a limit we enforce. Palworld itself caps a dedicated server at 32 players — that is the game&apos;s limit, not ours.
        </p>

        {/* Guarantees */}
        <motion.div
          className="mt-12 max-w-3xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              <span className="text-xs sm:text-sm text-blue-300 font-semibold whitespace-nowrap">First Month Free*</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-3 bg-surface/30 border border-border/30 rounded-lg">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <span className="text-xs sm:text-sm text-text-secondary font-medium whitespace-nowrap">30-day money-back*</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-3 bg-surface/30 border border-border/30 rounded-lg">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <span className="text-xs sm:text-sm text-text-secondary font-medium whitespace-nowrap">No setup fees</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-3 bg-surface/30 border border-border/30 rounded-lg">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <span className="text-xs sm:text-sm text-text-secondary font-medium whitespace-nowrap">No player slot limits</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-3 bg-surface/30 border border-border/30 rounded-lg">
              <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
              <span className="text-xs sm:text-sm text-text-secondary font-medium whitespace-nowrap">Cancel anytime</span>
            </div>
          </div>

          {/* Free-month & money-back terms */}
          <p className="mt-4 max-w-2xl mx-auto text-center text-[11px] sm:text-xs text-text-secondary/70 leading-relaxed px-4">
            *The first month is free for customers new to Flux Cloud — one free month per account, not per app or per server. If you've deployed any app on Flux before, standard pricing applies. Our 30-day money-back guarantee covers your first paid month only and does not apply when the first month was free.
          </p>
        </motion.div>

        {/* Other Games CTA */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <a
            href="https://cloud.runonflux.com/marketplace/games"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-col sm:flex-row items-center gap-1 sm:gap-2 px-5 py-2.5 rounded-xl border border-border/40 bg-surface/30 hover:bg-surface/60 hover:border-primary/40 transition-all duration-200 text-sm text-text-secondary hover:text-text group"
          >
            <span>Looking for other games?</span>
            <span className="inline-flex items-center gap-1.5 text-primary font-semibold text-sm group-hover:underline">Check out all games we offer <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></span>
          </a>
        </motion.div>

        {/* Why host on Flux — comparison CTA */}
        <motion.div
          className="mt-8 max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to="/decentralized-palworld-hosting"
            className="group flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 p-6 sm:p-8 rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 hover:border-primary/70 hover:from-primary/20 hover:to-primary/20 transition-all duration-300 shadow-lg shadow-primary/5 hover:shadow-primary/20"
          >
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="hidden sm:flex flex-shrink-0 items-center justify-center w-14 h-14 rounded-xl bg-primary/20 border border-primary/30">
                <BarChart3 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-text">
                  Why host on the Flux decentralized cloud
                </h3>
                <p className="text-sm text-text-secondary mt-1">
                  No single point of failure, no lock-in, dedicated resources, DDoS protection, 99.9% uptime and 32 players.
                </p>
              </div>
            </div>
            <span className="inline-flex flex-shrink-0 items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold whitespace-nowrap shadow-md group-hover:gap-3 transition-all duration-300">
              Learn why
              <ArrowRight className="w-5 h-5" />
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingPlans;
