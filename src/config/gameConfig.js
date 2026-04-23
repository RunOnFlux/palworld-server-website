// Game-specific configuration
// MODIFY THIS FILE for each different game

export const gameConfig = {
  // Game Info
  gameName: "Palworld",
  gameType: "palworld",
  serverName: "Palworld on Flux",
  tagline: "Host Your Palworld Server on the Decentralized Cloud",
  description: "Host your own Palworld dedicated server on the Flux decentralized cloud. Catch Pals, build bases, and survive together. Deploy across 50+ countries with DDoS protection and 99.9% uptime.",

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
    discord: "https://discord.gg/flux",
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

  // FAQ (verified information only)
  faq: [
    {
      question: "What is Flux decentralized cloud?",
      answer: "Flux is a decentralized cloud infrastructure running on thousands of independent nodes across 50+ countries worldwide, providing redundancy and eliminating single points of failure."
    },
    {
      question: "How long does deployment take?",
      answer: "Your Palworld server can be deployed and running in under 30 seconds with our automated deployment system."
    },
    {
      question: "How many players can join?",
      answer: "Palworld supports up to 32 players. Choose a plan that matches your group size: 5GB for small groups, 7GB for medium, or 10GB for large servers."
    },
    {
      question: "How does pricing work?",
      answer: "We use transparent pay-as-you-go pricing. Plans start at $3.99/month with no hidden fees or long-term contracts."
    },
    {
      question: "Is DDoS protection included?",
      answer: "Yes, all servers include enterprise-grade DDoS protection to keep your server online and players connected during attacks."
    }
  ]
};
