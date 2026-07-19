import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Server, Rocket, Users } from 'lucide-react';

/**
 * Long-form homepage content section.
 *
 * Adds the informational depth search engines and AI engines reward — "Why host
 * on Flux", "How it works", and "Palworld server features explained" — plus a
 * keyword-rich internal-links block that passes authority to the guide pages and
 * gives crawlers a path to the rest of the site.
 */

const gridBg = {
  backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px),
    repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(33,150,243,0.1) 8px, rgba(33,150,243,0.1) 16px)`,
};

const steps = [
  { icon: Users, title: '1. Create an account', text: 'Sign up free with Google or email — no credit card needed to get started.' },
  { icon: Server, title: '2. Pick a plan & region', text: 'Choose a RAM tier for your group size and a server location from 50+ countries.' },
  { icon: Rocket, title: '3. Deploy in 30 seconds', text: 'Click deploy and your Palworld dedicated server comes online in about 30 seconds.' },
];

const internalLinks = [
  { to: '/rent-palworld-server', anchor: 'Rent a Palworld dedicated server', desc: 'What you get, how much it costs, and how to deploy in 30 seconds.' },
  { to: '/setup-guide', anchor: 'How to make a Palworld dedicated server', desc: 'Full 2026 setup walkthrough — SteamCMD vs one-click deploy.' },
  { to: '/server-requirements', anchor: 'Palworld dedicated server requirements', desc: 'How much RAM and CPU you need, plus ports 8211 and 8212.' },
  { to: '/pricing', anchor: 'Palworld server hosting pricing', desc: 'Compare 5GB, 8GB, 12GB and 16GB plans by player count.' },
  { to: '/guides/join-server', anchor: "How to join a friend's Palworld server", desc: 'Connect by IP, use the browser, and understand crossplay.' },
  { to: '/guides/server-settings', anchor: 'Best Palworld server settings', desc: 'Tune XP, gather, damage and PvP in PalWorldSettings.ini.' },
  { to: '/decentralized-palworld-hosting', anchor: 'Why host on the Flux decentralized cloud →', desc: 'No single point of failure, no lock-in, dedicated resources, DDoS, 99.9% uptime and 32 players.' },
];

const HomeContent = () => {
  return (
    <section id="learn-more" className="relative py-12 bg-background border-t border-border/20 overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={gridBg} />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Why host on Flux */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">
            Why host your <span className="text-primary">Palworld server</span> on Flux?
          </h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Palworld server hosting is a crowded market dominated by traditional data-center providers.
            Flux takes a different approach: instead of a handful of centralized data centers, your
            Palworld dedicated server runs on a decentralized network of thousands of independent nodes
            across 50+ countries. That means no single point of failure, 99.9% uptime, and a server
            region close enough to your players to keep latency low — often at a lower cost than legacy
            cloud hosts.
          </p>
          <p className="text-text-secondary leading-relaxed mb-4">
            Every Palworld server on Flux ships with enterprise-grade DDoS protection at no extra cost,
            so a public community server stays online even under attack, and your personal IP address is
            never exposed the way it is when you self-host from home. You get full admin control through a
            web dashboard — a live console, a file manager for editing PalWorldSettings.ini, and on-demand
            backups with one-click restore — without ever touching SSH or router port forwarding. Plans
            start at $2.61/month with the first month free, billed month-to-month with no long-term
            contract, and you can pay by card, Apple Pay, Google Pay, or crypto.
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl font-bold mb-6">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.title} className="bg-surface border border-border rounded-xl p-6">
                <div className="w-11 h-11 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
                  <s.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text mb-2">{s.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Features explained */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">Palworld server features explained</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            <strong className="text-text">Up to 32 players.</strong> A Palworld dedicated server supports
            up to 32 players at once — far beyond the 4-player limit of in-game co-op. Pick 5GB RAM for a
            small co-op group, 8GB for up to 8, 12GB for up to 16, or 16GB for a full 32-player world on
            the 1.0 update. See the{' '}
            <Link to="/server-requirements" className="text-primary hover:text-primary-light">
              Palworld dedicated server requirements
            </Link>{' '}
            for how to size your plan.
          </p>
          <p className="text-text-secondary leading-relaxed mb-4">
            <strong className="text-text">Always-on and persistent.</strong> Unlike co-op hosted from the
            game, a dedicated server keeps your world running 24/7 so players can jump in at any time —
            even when you are offline — and progress is never lost when the host leaves.
          </p>
          <p className="text-text-secondary leading-relaxed mb-4">
            <strong className="text-text">Crossplay ready.</strong> Palworld runs on Steam and Xbox/Game
            Pass, and a dedicated server can be configured for crossplay between them. Our{' '}
            <Link to="/guides/join-server" className="text-primary hover:text-primary-light">
              guide to joining a friend&apos;s Palworld server
            </Link>{' '}
            covers the platform caveats.
          </p>
          <p className="text-text-secondary leading-relaxed mb-4">
            <strong className="text-text">Fully configurable.</strong> Every rule of your world — XP rate,
            gather and damage multipliers, day/night length, death penalty, and PvP — is editable in
            PalWorldSettings.ini straight from the dashboard. Our{' '}
            <Link to="/guides/server-settings" className="text-primary hover:text-primary-light">
              best Palworld server settings
            </Link>{' '}
            guide has recommended presets for casual, balanced, and hardcore play.
          </p>
        </motion.div>

        {/* Internal links block */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Palworld hosting guides</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {internalLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="group flex items-start gap-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/40 rounded-lg p-4 transition-colors"
              >
                <ArrowRight className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <span>
                  <span className="block font-semibold text-text group-hover:text-primary transition-colors">
                    {l.anchor}
                  </span>
                  <span className="block text-sm text-text-secondary mt-0.5">{l.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HomeContent;
