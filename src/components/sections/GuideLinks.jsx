import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Server, Users, Settings, Tag, GitCompare, LifeBuoy, ArrowRight } from 'lucide-react';

const guides = [
  { to: '/nitrado-alternative', icon: GitCompare, label: 'Nitrado alternative', desc: 'Decentralized Nitrado alternative for Palworld — 32 players, dedicated resources, from $2.61/mo.' },
  { to: '/gportal-alternative', icon: GitCompare, label: 'GPORTAL alternative', desc: 'Decentralized GPORTAL alternative for Palworld — no single point of failure, no egress fees.' },
  { to: '/setup-guide', icon: BookOpen, label: 'How to make a Palworld dedicated server', desc: 'Full 2026 setup walkthrough — SteamCMD vs one-click deploy.' },
  { to: '/server-requirements', icon: Server, label: 'Palworld dedicated server requirements', desc: 'How much RAM and CPU you need, plus ports 8211 and 8212.' },
  { to: '/guides/join-server', icon: Users, label: "How to join a friend's Palworld server", desc: 'Connect by IP, use the browser, and understand crossplay.' },
  { to: '/guides/server-settings', icon: Settings, label: 'Best Palworld server settings', desc: 'Tune XP, gather, damage and PvP in PalWorldSettings.ini.' },
  { to: '/pricing', icon: Tag, label: 'Palworld server hosting pricing', desc: 'Compare 5GB, 8GB, 12GB and 16GB plans by player count.' },
  { to: '/decentralized-palworld-hosting', icon: GitCompare, label: 'Why host on the Flux decentralized cloud →', desc: 'No single point of failure, no lock-in, dedicated resources, DDoS, 99.9% uptime and 32 players.' },
  {
    // External: the Flux support-ticket portal (the in-app /support page
    // requires login and bounces anonymous visitors to the homepage).
    href: 'https://support.runonflux.com',
    icon: LifeBuoy,
    label: 'Support & help center',
    desc: 'Open a support ticket — our team will get back to you by email.',
  },
];

/**
 * Internal-links block with keyword-rich anchors pointing at the guide hub.
 * Feeds link equity to the new informational pages and helps users navigate.
 */
const GuideLinks = () => {
  return (
    <section id="guides" className="relative py-12 bg-background-alt border-t border-border/20">
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px),
            repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px)`,
        }}
      />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-4xl font-bold mb-3">
            Palworld <span className="text-primary">Server Guides</span>
          </h2>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Everything you need to set up, join, and configure a Palworld dedicated server.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {guides.map((guide, i) => {
            // External entries (href) render a plain anchor in a new tab;
            // internal ones use the router Link.
            const CardTag = guide.href ? 'a' : Link;
            const cardProps = guide.href
              ? { href: guide.href, target: '_blank', rel: 'noopener noreferrer' }
              : { to: guide.to };

            return (
            <motion.div
              key={guide.href || guide.to}
              // With an odd number of cards, stretch the last one across both
              // columns so the grid has no orphan cell.
              className={guides.length % 2 === 1 && i === guides.length - 1 ? 'sm:col-span-2' : undefined}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <CardTag
                {...cardProps}
                className="group flex items-start gap-4 h-full px-5 py-4 rounded-xl border border-border/40 bg-surface/30 hover:bg-surface/60 hover:border-primary/40 transition-colors"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/15 border border-primary/30 flex-shrink-0">
                  <guide.icon className="w-5 h-5 text-primary" />
                </span>
                <span className="flex-1">
                  <span className="flex items-center gap-1.5 font-semibold text-text group-hover:text-primary transition-colors">
                    {guide.label}
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>
                  <span className="block text-sm text-text-secondary mt-1">{guide.desc}</span>
                </span>
              </CardTag>
            </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default GuideLinks;
