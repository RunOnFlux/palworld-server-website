import { useState } from 'react';
import { Github, MessageCircle, ExternalLink } from 'lucide-react';
import { RiTwitterXFill } from 'react-icons/ri';
import { gameConfig } from '../../config/gameConfig';
import { version } from '../../../package.json';
import { CookieSettingsDialog } from '../common';

/**
 * Footer Component
 * Compact footer with social links
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  const socialLinks = [
    {
      name: 'Discord',
      icon: MessageCircle,
      href: gameConfig.social.discord,
    },
    {
      name: 'X',
      icon: RiTwitterXFill,
      href: gameConfig.social.twitterUrl,
    },
    {
      name: 'GitHub',
      icon: Github,
      href: gameConfig.social.github,
    },
  ];

  return (
    <footer className="relative bg-background-alt border-t border-border/20 py-6">
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
        {/* Main content */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-6">
          {/* Left: Brand */}
          <div className="text-center md:text-left">
            <h3 className="text-lg font-bold mb-1">{gameConfig.serverName}</h3>
            <p className="text-text-secondary text-sm">{gameConfig.tagline}</p>
          </div>

          {/* Center: Social icons */}
          <div className="flex gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-surface/50 hover:bg-surface border border-border/50 rounded-lg transition-colors cursor-pointer"
                aria-label={social.name}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>

          {/* Right: Powered by Flux */}
          <a
            href="https://runonflux.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-text-secondary hover:text-primary transition-colors text-sm"
          >
            <span>Powered by Flux</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Bottom: Copyright & Cookie Settings */}
        <div className="text-center pt-4 border-t border-border/30">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <p className="text-text-muted text-sm">
              © {currentYear} InFlux Technologies. All rights reserved. <span className="text-text-muted/50">v{version}</span>
            </p>
            <button
              onClick={() => setShowCookieSettings(true)}
              className="text-text-secondary hover:text-primary text-sm transition-colors underline cursor-pointer"
            >
              Cookie Settings
            </button>
          </div>
        </div>
      </div>

      {/* Cookie Settings Dialog */}
      <CookieSettingsDialog
        isOpen={showCookieSettings}
        onClose={() => setShowCookieSettings(false)}
      />
    </footer>
  );
};

export default Footer;
