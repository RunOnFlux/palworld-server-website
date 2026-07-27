// Game-specific configuration
// MODIFY THIS FILE for each different game

export const gameConfig = {
  // Game Info
  gameName: "Palworld",
  gameType: "palworld",
  serverName: "Palworld on Flux",
  tagline: "Palworld 1.0 Server Hosting — Rent a Dedicated Palworld Server from $2.61/mo",

  // Site-wide announcement bar (rendered at the very top of the fixed header)
  announcement: {
    enabled: true,
    text: "🎉 Updated for Palworld 1.0 — Sky Islands, 70+ new Pals & full crossplay",
  },
  description: "Palworld server hosting on the decentralized Flux cloud, updated for the 1.0 release with full crossplay. Rent a dedicated Palworld server for up to 32 players with instant deployment in under 30 seconds, DDoS protection, 99.9% uptime, and nodes in 50+ countries. Plans from $2.61/month — first month free for new users.",

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

  // Cross-links to sibling Flux hosting products + Flux Cloud, rendered in the
  // footer ("Explore other Flux hosting") for both the React app and the static
  // prerendered HTML (see Footer.jsx and scripts/prerender.mjs). Keyword-rich
  // anchors, all followed (no nofollow), opened in a new tab. This is the SINGLE
  // SOURCE OF TRUTH — add/remove a sibling here and both renderers pick it up.
  ecosystemLinks: [
    { href: "https://minecraft.runonflux.com", label: "Minecraft Server Hosting" },
    { href: "https://enshrouded.runonflux.com", label: "Enshrouded Server Hosting" },
    { href: "https://rust.runonflux.com", label: "Rust Server Hosting" },
    { href: "https://windrose.runonflux.com", label: "Windrose Server Hosting" },
    { href: "https://projectzomboid.runonflux.com", label: "Project Zomboid Server Hosting" },
    { href: "https://wordpress.runonflux.com", label: "Web3 WordPress Hosting" },
    { href: "https://n8n.runonflux.com", label: "n8n Hosting" },
    { href: "https://openclaw.runonflux.com", label: "OpenClaw AI Assistant Hosting" },
    { href: "https://hermes.runonflux.com", label: "Hermes AI Agent Hosting" },
    { href: "https://orbit.runonflux.com", label: "Orbit — Deploy with Git" },
    { href: "https://cloud.runonflux.com", label: "Flux Cloud" },
  ],

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
      question: "Do you limit how many players can join?",
      answer: "No. We don't sell player slots and we never cap your server. The player count shown on each plan is a guide to what its CPU and RAM handle comfortably — you can set your server to any number you like. The only hard limit is Palworld's own: the game caps a dedicated server at 32 players."
    },
    {
      question: "Is Flux server hosting updated for Palworld 1.0?",
      answer: "Yes. All Palworld servers on Flux run the latest dedicated server build, including the 1.0 release with Sky Islands, 70+ new Pals, and full crossplay between Steam, Xbox, PS5, and Mac. Servers pull the current version automatically on deploy and on restart."
    },
    {
      question: "How much does Palworld server hosting cost?",
      answer: "Palworld server hosting on Flux starts at $2.61/month for a 5GB RAM plan, with 8GB, 12GB, and 16GB plans available for larger groups. New users get their first month free, with no long-term contract or hidden fees."
    },
    {
      question: "How many players can a Palworld dedicated server host?",
      answer: "A Palworld dedicated server supports up to 32 players simultaneously. Pick 5GB RAM for small co-op groups, 8GB or 12GB for medium groups, or 16GB for a full 32-player server."
    },
    {
      question: "How much RAM do I need for a Palworld server?",
      answer: "Since the 1.0 update, Palworld needs at least 5GB of RAM for small co-op groups of up to 4 players, 8GB for up to 8 players, 12GB for up to 16, and 16GB or more for the full 32-player cap. Base building and captured Pals increase memory usage over time, so sizing up is recommended for long-term worlds."
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
    },
    {
      question: "What are the system requirements for a Palworld dedicated server?",
      answer: "A Palworld dedicated server needs at least 5GB of RAM for small co-op groups, 8-12GB for medium groups, and 16GB or more for a full 32-player server on the 1.0 update, plus a modern CPU with good single-core performance. It also needs UDP port 8211 open for game traffic. On Flux the resources and ports are provisioned for you at deploy time."
    },
    {
      question: "Does Palworld support crossplay on a dedicated server?",
      answer: "Palworld is available on Steam and Xbox/Game Pass, and a dedicated server can be configured to allow crossplay between them. The server owner must enable the appropriate crossplay settings, and the connection experience differs by platform — Steam players typically join by IP and port while Xbox/Game Pass players use the in-game browser and invites. If crossplay is not enabled, players on different stores may not see the same server."
    },
    {
      question: "Why is my Palworld dedicated server not showing up or not connectable?",
      answer: "The most common cause is the game port. Palworld uses UDP port 8211, and it must be open and reachable for players to see and join the server. Also confirm the server is online, that everyone is on the same game version, and that crossplay is enabled if players are on different platforms. Flux-hosted servers have the port open by default and stay online 24/7."
    },
    {
      question: "Do I need a dedicated server to play Palworld co-op with friends?",
      answer: "For up to 4 players you can host co-op directly from the game, but it only runs while the host is in the game. For up to 32 players, a persistent world, or a server that stays online when you are offline, you need a dedicated server."
    },
    {
      question: "How do I join my friend's Palworld server?",
      answer: "Choose Join Multiplayer Game (Dedicated Server), enter your friend's server address in the IP:Port field (for example 203.0.113.10:8211, where 8211 is the default game port), and click Connect. Enter the password if one is set. Public servers can also be found by name in the community server browser."
    },
    {
      question: "Can I run mods on a Palworld dedicated server?",
      answer: "Palworld's dedicated server supports configuration changes through PalWorldSettings.ini out of the box, and because you have full file access on Flux you can add server-side modifications where the game and community tooling allow. All players generally need matching files for client-side mods to work."
    },
    {
      question: "Which ports does a Palworld dedicated server use?",
      answer: "A Palworld dedicated server uses UDP port 8211 for game traffic (required for players to connect) and TCP port 8212 for the optional REST admin API used to manage the server."
    }
  ]
};
