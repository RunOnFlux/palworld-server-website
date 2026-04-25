import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { gameConfig } from '../../config/gameConfig';

/**
 * FAQ Section with Accordion
 * Accessible with keyboard navigation
 */
const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const toggleQuestion = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Emit FAQPage JSON-LD only on the page that actually renders the FAQ.
  // Keeping it in index.html duplicated the schema across every SPA route.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: gameConfig.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <section id="faq" className="relative py-6 bg-background-alt border-t border-border/20 overflow-hidden">
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
      </Helmet>
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
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
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
          {gameConfig.faq.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
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

                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      id={`faq-answer-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-4 text-text-secondary leading-relaxed border-t border-border pt-4">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
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
