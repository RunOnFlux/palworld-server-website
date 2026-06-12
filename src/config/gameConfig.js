// Game-specific configuration
// MODIFY THIS FILE for each different game

export const gameConfig = {
  // Game Info
  gameName: "Palworld",
  gameType: "palworld",
  serverName: "Palworld on Flux",
  tagline: "Palworld Server Hosting — Rent a Dedicated Palworld Server from $3.99/mo",
  description: "Palworld server hosting on the decentralized Flux cloud. Rent a dedicated Palworld server for up to 32 players with instant deployment in under 30 seconds, DDoS protection, 99.9% uptime, and nodes in 50+ countries. Plans from $3.99/month — first month free for new users.",

  // Graphics & Branding
  assets: {
    logo: "/games/palworld/logo.webp",
    banner: "/games/palworld/banner.webp",
    background: "/games/palworld/background.png",
    favicon: "/games/palworld/favicon.ico"
  },

  // Game Features (displayed on landing page)
  features: [
    {
      title: "Catch & Collect Pals",
      icon: "\uD83D\uDC3E",
      description: "Capture over 100 unique Pals, each with special abilities and skills"
    },
    {
      title: "Multiplayer Up to 32",
      icon: "\uD83D\uDC65",
      description: "Play with up to 32 friends on your own dedicated server"
    },
    {
      title: "Base Building",
      icon: "\uD83C\uDFD7\uFE0F",
      description: "Build and manage your base with Pals working alongside you"
    },
    {
      title: "Open World Survival",
      icon: "\uD83C\uDF0D",
      description: "Explore a vast open world filled with resources, dungeons, and dangers"
    },
    {
      title: "Breeding & Training",
      icon: "\uD83E\uDDEC",
      description: "Breed Pals to create powerful combinations and train them for battle"
    },
    {
      title: "Boss Battles",
      icon: "\u2694\uFE0F",
      description: "Challenge powerful bosses and tower guardians with your team of Pals"
    }
  ],

  // Platform Features (verified from FluxOS game hosting claims)
  platformFeatures: [
    {
      icon: "/games/palworld/features/deployment-icon.webp",
      title: "Instant Deployment",
      description: "Launch your game server in under 30 seconds with automated deployment"
    },
    {
      icon: "/games/palworld/features/ddos-shield.webp",
      title: "DDoS Protection",
      description: "Enterprise-grade DDoS protection keeps your server online during attacks"
    },
    {
      icon: "/games/palworld/features/global-network.webp",
      title: "Global Server Network",
      description: "Choose from 50+ countries worldwide to minimize latency for players"
    },
    {
      icon: "/games/palworld/features/monitoring-chart.webp",
      title: "24/7 Monitoring",
      description: "Real-time performance monitoring with automatic alerts"
    },
    {
      icon: "/games/palworld/features/payment-icon.webp",
      title: "Pay-As-You-Go Pricing",
      description: "Only pay for resources you use with transparent, flexible pricing"
    },
    {
      icon: "/games/palworld/features/uptime-clock.webp",
      title: "99.9% Uptime",
      description: "Distributed network architecture ensures maximum availability"
    },
    {
      icon: "/games/palworld/features/cost-savings.webp",
      title: "Cost Effective",
      description: "Save up to 70% compared to traditional cloud providers"
    },
    {
      icon: "/games/palworld/features/decentralized-nodes.webp",
      title: "Decentralized Infrastructure",
      description: "No single point of failure across thousands of independent nodes"
    }
  ],

  // Server Rules
  rules: [
    "Be respectful to all players",
    "No griefing or destroying other players' bases",
    "No exploiting bugs or glitches",
    "No harassment or toxic behavior",
    "Follow server admin instructions",
    "Report any issues to the server admin",
    "Have fun catching Pals!"
  ],

  // Social Links
  social: {
    discord: "https://discord.com/invite/runonflux",
    twitter: "@RunOnFlux",
    twitterUrl: "https://twitter.com/RunOnFlux",
    github: "https://github.com/RunOnFlux",
    website: "https://runonflux.io"
  },

  // How to Join (for existing servers)
  connection: {
    ip: "palworld.runonflux.io",
    port: "27015",
    version: "Latest"
  },

  // Plan Badges - customizable badges shown on pricing cards
  planBadges: [
    { match: { all: true }, text: "Save 40%", color: "#fff", bgColor: "#e53e3e" },
  ],

  // FAQ — written to target real Google/AI search queries for Palworld hosting.
  // Each question is a long-tail keyword; each answer is direct and citable (for GEO).
  faq: [
    {
      question: "How much does Palworld server hosting cost?",
      answer: "Palworld server hosting on Flux starts at $3.99/month for a 5GB RAM plan, with 7GB and 10GB plans available for larger groups. New users get their first month free, with no long-term contract or hidden fees."
    },
    {
      question: "How many players can a Palworld dedicated server host?",
      answer: "A Palworld dedicated server supports up to 32 players simultaneously. Pick 5GB RAM for small groups, 7GB for medium groups, or 10GB for a full 32-player server."
    },
    {
      question: "How much RAM do I need for a Palworld server?",
      answer: "Palworld needs at least 5GB of RAM for small groups of up to 8 players, 7GB for medium groups up to 16 players, and 10GB or more for the full 32-player cap. Base building and captured Pals increase memory usage over time, so sizing up is recommended for long-term worlds."
    },
    {
      question: "How do I host my own Palworld dedicated server?",
      answer: "The easiest way is to rent a pre-configured Palworld dedicated server. On Flux, pick a plan, choose a server region, and click deploy — your Palworld server is live in under 30 seconds. No manual installation, port forwarding, or Linux setup is required."
    },
    {
      question: "Is DDoS protection included with Palworld server hosting?",
      answer: "Yes. Every Palworld server hosted on Flux includes enterprise-grade DDoS protection at no extra cost, keeping your server online and your players connected during attacks."
    },
    {
      question: "Where are the Palworld servers located?",
      answer: "Flux runs decentralized nodes in 50+ countries across North America, Europe, Asia, South America, Africa, and Oceania. You can pick the closest region at deploy time to minimize latency for your players."
    },
    {
      question: "Can I transfer my existing Palworld save to a hosted server?",
      answer: "Yes. Upload your existing Palworld world files through the built-in file manager, and the dedicated server will continue from your saved world."
    },
    {
      question: "Can I change Palworld server settings like XP rate, damage, and night speed?",
      answer: "Yes. All Palworld server settings (XP rate, gather rate, damage multipliers, day/night speed, death penalty, PvP toggle, and more) can be edited directly from the web file manager and applied with a single restart."
    },
    {
      question: "What is Flux decentralized cloud?",
      answer: "Flux is a decentralized cloud infrastructure running on thousands of independent nodes across 50+ countries. Hosting on Flux gives you redundancy and eliminates the single points of failure typical of traditional cloud providers — often at lower cost."
    },
    {
      question: "Do you offer automatic backups for Palworld servers?",
      answer: "Yes. Full server backups can be created on demand and restored with one click from the dashboard, including uploading a backup archive or restoring from a remote URL."
    }
  ]
};
