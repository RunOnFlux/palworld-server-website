
import { useRef, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import { motion } from 'framer-motion';
import { ArrowRight, Gift, Server, Zap, Sparkles } from 'lucide-react';
import PropTypes from 'prop-types';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gameConfig } from '../../config/gameConfig';
import Button from '../common/Button';
import PalworldParticles from '../common/PalworldParticles';

gsap.registerPlugin(ScrollTrigger);

const Hero = ({ onGetStarted }) => {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const headingRef = useRef(null);
  const subheadingRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {

      // Split text animation — heading
      const headingEl = headingRef.current;
      if (headingEl) {
        const text = headingEl.textContent;
        headingEl.innerHTML = '';
        text.split('').forEach((char) => {
          const span = document.createElement('span');
          span.textContent = char === ' ' ? '\u00A0' : char;
          span.style.display = 'inline-block';
          span.style.opacity = '0';
          span.style.transform = 'translateY(40px) rotateX(90deg)';
          headingEl.appendChild(span);
        });

        gsap.to(headingEl.children, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.6,
          stagger: 0.03,
          ease: 'back.out(1.7)',
          delay: 0.3,
        });
      }

      // Subheading — simple fade in (no split, preserves gradient)
      const subEl = subheadingRef.current;
      if (subEl) {
        gsap.fromTo(subEl, {
          opacity: 0,
          y: 30,
        }, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power2.out',
          delay: 0.8,
        });
      }

    }, sectionRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <section ref={sectionRef} className="relative min-h-[85vh] sm:min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image — parallax target */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${gameConfig.assets.background})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-black/35"></div>
      </div>

      {/* Animated Palworld Particles */}
      <PalworldParticles />

      {/* Animated accent elements */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute bottom-1/3 left-1/3 w-96 h-96 bg-primary/20 rounded-full blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div>
          {/* Palworld 1.0 announcement badge — promoted */}
          {gameConfig.announcement?.enabled && (
            <motion.div
              className="relative flex w-fit max-w-full mx-auto items-center justify-center gap-2.5 px-4 sm:px-5 py-2 mb-5 rounded-full overflow-hidden text-xs sm:text-sm font-bold text-white text-center leading-snug border border-white/40 shadow-[0_0_30px_rgba(33,150,243,0.55),0_0_70px_rgba(33,150,243,0.3)]"
              style={{ background: 'linear-gradient(135deg, rgba(33,150,243,0.9), rgba(76,175,80,0.85))' }}
              initial={{ y: -14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.6, ease: 'backOut' }}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[shimmer_3s_infinite]" />
              <span className="relative flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider flex-shrink-0">
                <Sparkles className="w-3 h-3" /> New
              </span>
              <span className="relative">{gameConfig.announcement.text.replace(/^\s*🎉\s*/, '')}</span>
            </motion.div>
          )}

          {/* Badge */}
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/70 border border-primary rounded-full text-white text-sm font-semibold mb-8 shadow-[0_0_20px_rgba(33,150,243,0.6),0_0_40px_rgba(33,150,243,0.3)]"
            initial={{ scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Zap className="w-4 h-4" />
            Powered by Flux Decentralized Cloud
          </motion.div>

          {/* Main heading — GSAP text split target */}
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 leading-tight drop-shadow-2xl">
            {/* No opacity-0 class and an explicit space: the second half of the heading used
                to ship invisible and glued to the first, because <br /> contributes no
                whitespace to textContent and gsap.fromTo below already starts it at 0. */}
            <span ref={headingRef} className="text-white drop-shadow-lg inline-block">{gameConfig.heroHeading}</span>
            {' '}
            <br />
            <span ref={subheadingRef} className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent drop-shadow-lg inline-block">
              {gameConfig.heroHeadingAccent}
            </span>
          </h1>

          {/* Tagline */}
          <motion.p
            className="text-base sm:text-xl lg:text-2xl text-white mb-3 sm:mb-4 max-w-3xl mx-auto drop-shadow-lg"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            {gameConfig.tagline}
          </motion.p>

          {/* Description */}
          <motion.p
            className="text-sm sm:text-base lg:text-lg text-white/90 mb-8 sm:mb-12 max-w-2xl mx-auto drop-shadow-lg"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            {gameConfig.description}
          </motion.p>

          {/* First month free */}
          <motion.div
            className="inline-flex items-center gap-3 px-6 py-3 mb-6 sm:mb-8 rounded-xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(33,150,243,0.5), rgba(21,101,192,0.4))',
              border: '1.5px solid rgba(255,255,255,0.4)',
              boxShadow: '0 0 40px rgba(33,150,243,0.4), 0 0 80px rgba(33,150,243,0.2), inset 0 1px 0 rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)',
            }}
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.8 }}
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_3s_infinite]" />
            <Gift className="relative w-5 h-5 sm:w-6 sm:h-6 text-white flex-shrink-0" />
            <span className="relative text-lg sm:text-2xl font-bold text-white drop-shadow-lg">
              First month free for new users
            </span>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-row gap-3 sm:gap-4 justify-center items-center mb-8 sm:mb-12"
            initial={{ y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6 }}
          >
            <Button
              variant="outline"
              size="md"
              className="sm:!px-7 sm:!py-3.5 sm:!text-lg whitespace-nowrap !bg-primary/40 !backdrop-blur-sm !border-primary/60 !text-white hover:!bg-primary/40 hover:!border-white/60"
              onClick={onGetStarted}
              rightIcon={<ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />}
            >
              Get Your Server
            </Button>
            <Button
              variant="outline"
              size="md"
              className="sm:!px-7 sm:!py-3.5 sm:!text-lg whitespace-nowrap !bg-primary/40 !backdrop-blur-sm !border-primary/60 !text-white hover:!bg-primary/40 hover:!border-white/60"
              onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
              leftIcon={<Server className="w-4 h-4 sm:w-5 sm:h-5" />}
            >
              View Plans
            </Button>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-xs sm:max-w-3xl mx-auto">
            {[
              { value: '99.9%', label: 'Uptime Guarantee', color: 'text-white', delay: 1.8 },
              { value: '24/7', label: 'Support Available', color: 'text-yellow-300', delay: 1.9 },
              { value: 'Instant', label: 'Deployment', color: 'text-white', delay: 2.0 },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                className="text-center bg-primary/20 backdrop-blur-md border border-white/10 rounded-xl py-3 px-4"
                initial={{ y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: stat.delay }}
              >
                <div className={`text-xl sm:text-3xl font-bold ${stat.color} mb-1 sm:mb-2`}>{stat.value}</div>
                <div className="text-[10px] sm:text-sm text-white/90">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-6 h-10 border-2 border-primary/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1 h-3 bg-primary rounded-full"></div>
        </div>
      </motion.div>
    </section>
  );
};

Hero.propTypes = {
  onGetStarted: PropTypes.func.isRequired,
};

export default Hero;
