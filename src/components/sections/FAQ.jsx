import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { gameConfig } from '../../config/gameConfig';

/**
 * FAQ Section with Accordion
 * Accessible with keyboard navigation
 *
 * The FAQPage JSON-LD is emitted STATICALLY into the built homepage HTML by
 * scripts/prerender.mjs (from gameConfig.faq), so it is present for non-JS
 * crawlers and appears exactly once. This component therefore renders only the
 * visible accordion and does not emit schema itself.
 */

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = gameConfig.faq;

  const toggleQuestion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="relative py-6 bg-background-alt border-t border-border/20 overflow-hidden">
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

      {/* Left Character */}
      <div
        className="hidden xl:block absolute left-[12%] top-1/4 pointer-events-none"
        style={{
          opacity: 0.9,
        }}
      >
        <img
          src="/games/palworld/faq-character-left.webp"
          alt=""
          style={{
            height: '400px',
            width: 'auto',
          }}
          width={512}
          height={1024}
          decoding="async"
        />
      </div>

      {/* Right Character */}
      <div
        className="hidden xl:block absolute right-[12%] top-1/4 pointer-events-none"
        style={{
          opacity: 0.9,
        }}
      >
        <img
          src="/games/palworld/faq-character-right.webp"
          alt=""
          style={{
            height: '400px',
            width: 'auto',
          }}
          width={512}
          height={1024}
          decoding="async"
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-8"
          initial={{ y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Frequently Asked <span className="text-primary">Questions</span>
          </h2>
          <p className="text-xl text-text-secondary">
            Everything you need to know about our hosting service
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((item, index) => {
            // Cap the stagger so a late item is not still waiting after it is on screen.
            const i = Math.min(index, 5);
            return (
            <motion.div
              key={index}
              initial={{ y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleQuestion(index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-lg font-semibold text-text pr-8">
                    {item.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3, type: 'tween' }}
                    style={{ willChange: 'transform' }}
                  >
                    <ChevronDown className="w-5 h-5 text-primary flex-shrink-0" />
                  </motion.div>
                </button>


                {/* The answer stays mounted and collapses to height 0 rather than unmounting, so it


                    is in the server-rendered HTML that crawlers and AI answer engines read. They do


                    not click accordions, and the FAQPage schema stopped carrying this for them when


                    Google dropped FAQ rich results in May 2026. */}
                <motion.div
                  id={`faq-answer-${index}`}
                  initial={false}
                  animate={{ height: openIndex === index ? 'auto' : 0, opacity: openIndex === index ? 1 : 0 }}


                  style={{ overflow: 'hidden' }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="px-6 pb-4 text-text-secondary leading-relaxed border-t border-border pt-4">
                    {item.answer}
                  </div>
                </motion.div>
              </div>
            </motion.div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <motion.div
          className="text-center mt-12"
          initial={false}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-text-secondary mb-4">
            Still have questions?
          </p>
          <a
            href={gameConfig.social.discord}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-light font-medium"
          >
            Join our Discord community →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
