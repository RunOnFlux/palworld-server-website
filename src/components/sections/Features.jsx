
import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { gameConfig } from '../../config/gameConfig';
import Card, { CardBody } from '../common/Card';

gsap.registerPlugin(ScrollTrigger);

/**
 * Features Section
 * Displays platform features in a grid
 */
const Features = () => {
  const sectionRef = useRef(null);
  const headerRef = useRef(null);
  const cardsRef = useRef([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Header reveal
      if (headerRef.current) {
        gsap.fromTo(headerRef.current, {
          opacity: 0,
          y: 30,
        }, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: headerRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        });
      }

      // Staggered card reveal from bottom with scale
      cardsRef.current.forEach((card, i) => {
        if (!card) return;
        gsap.fromTo(card, {
          opacity: 0,
          y: 60,
          scale: 0.9,
        }, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
          delay: i * 0.08,
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="features" className="relative py-6 bg-background-alt border-t border-border/20">
      {/* Decorative background */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 8px,
            rgba(33, 150, 243, 0.1) 8px,
            rgba(33, 150, 243, 0.1) 16px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 8px,
            rgba(33, 150, 243, 0.1) 8px,
            rgba(33, 150, 243, 0.1) 16px
          )`,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div ref={headerRef} className="text-center mb-8 opacity-0">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Why Choose <span className="text-primary">Us</span>
          </h2>
          <p className="text-xl text-text-secondary max-w-2xl mx-auto">
            Experience the power of decentralized cloud infrastructure built on Web3 technology
          </p>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {gameConfig.platformFeatures.map((feature, index) => (
            <div key={index} ref={el => cardsRef.current[index] = el}>
              <Card hover shadow="md" className="h-full">
                <CardBody className="text-center">
                  {/* Icon */}
                  <div className="flex justify-center mb-4">
                    <img
                      src={feature.icon}
                      alt={feature.title}
                      className="w-36 h-36 object-contain"
                      width={144}
                      height={144}
                      decoding="async"
                    />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold mb-3 text-text">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardBody>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
