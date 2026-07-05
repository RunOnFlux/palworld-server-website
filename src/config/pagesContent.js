// Long-form content for the SEO landing/guide pages.
//
// This is the SINGLE SOURCE OF TRUTH for the new content pages. It is consumed
// by two very different renderers:
//   1. The React `ArticlePage` component (styled, interactive) — client render.
//   2. `scripts/prerender.mjs` (plain-HTML) — the static crawler fallback that
//      ships in dist/<route>/index.html so non-JS crawlers and AI engines see
//      real content immediately (same idea as the homepage static fallback).
// Keeping the copy here means both renderers stay in sync automatically.
//
// A page `body` is an array of typed blocks. Renderers switch on `block.type`.

const SITE = 'https://palworld.runonflux.com';

// -------------------------------------------------------------------------
// Page content
// -------------------------------------------------------------------------

export const pagesContent = {
  'setup-guide': {
    slug: '/setup-guide',
    title: 'How to Make a Palworld Dedicated Server (2026 Guide)',
    metaTitle: 'How to Make a Palworld Dedicated Server (2026 Guide)',
    description:
      'How to make a Palworld dedicated server in 2026: manual SteamCMD install vs a one-click Flux deploy in 30 seconds from $3.99/mo. Ports and config explained.',
    h1: 'How to Make a Palworld Dedicated Server (2026)',
    lead:
      'There are two ways to run a Palworld dedicated server: install and maintain it yourself with SteamCMD on your own hardware, or rent a pre-configured dedicated server and deploy it in about 30 seconds. This guide walks through both so you can pick the right path, then covers the ports, config, and admin tasks every Palworld server owner needs.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Setup Guide', url: '/setup-guide' },
    ],
    body: [
      { type: 'h2', text: 'Why run a dedicated server instead of hosting from the game?' },
      { type: 'p', text: 'Palworld lets you host a co-op session directly from the game client, but that mode is capped at 4 players and only stays online while the host is in the game. A dedicated server is a separate always-on process that keeps your world running 24/7, supports up to 32 players, and gives everyone a persistent world they can join at any time — even when you are offline. If you want a community server, a friends group larger than four, or a world that keeps progressing while you are away, you need a dedicated server.' },
      { type: 'p', text: 'A dedicated server also unlocks full administrative control: you can edit every value in PalWorldSettings.ini (XP rate, gather and damage multipliers, day/night length, death penalty, PvP), run the REST admin API, kick or ban players, and take backups. None of that is available from the in-game 4-player co-op host.' },

      { type: 'h2', text: 'Method 1 — Self-host with SteamCMD (manual)' },
      { type: 'p', text: 'The manual route installs the Palworld Dedicated Server tool from Steam onto a machine you own and manage. It is free of hosting fees but you are responsible for the hardware, the operating system, port forwarding, updates, and uptime. Here is the full process on Windows or Linux:' },
      { type: 'ol', items: [
        'Install SteamCMD, Valve\'s command-line tool for downloading dedicated server files. On Windows download the SteamCMD zip and extract it; on Linux install the steamcmd package for your distribution.',
        'From SteamCMD, run login anonymous, then app_update 2394010 validate to download the Palworld Dedicated Server (app ID 2394010). On Linux you will also need the 32-bit and 64-bit compatibility libraries and, in most cases, Proton or the Windows build under a compatibility layer.',
        'Launch the server once (PalServer.exe on Windows, PalServer.sh on Linux) to generate the default configuration files, then shut it down.',
        'Open DefaultPalWorldSettings.ini, copy the settings block into Pal/Saved/Config/<Platform>/PalWorldSettings.ini, and edit the values you want (server name, password, player count, XP and gather rates).',
        'Forward the required ports on your router and firewall: UDP 8211 for game traffic, and optionally TCP 8212 for the REST admin API. Without the UDP 8211 port open, players will not see or be able to connect to your server.',
        'Restart the server. Share your public IP and port (for example 203.0.113.10:8211) so players can add it as a community server or connect directly.',
      ] },
      { type: 'p', text: 'The manual method works, but the ongoing burden is real: you keep the host machine powered and online, patch it whenever Pocketpair ships an update, secure the box, and troubleshoot your own networking. A home connection also exposes your IP address and offers no DDoS protection, which matters for a public community server.' },

      { type: 'h2', text: 'Method 2 — Deploy a managed Palworld server on Flux (30 seconds)' },
      { type: 'p', text: 'The faster path skips the installation entirely. A managed Palworld dedicated server on the Flux decentralized cloud is pre-built with the correct SteamCMD image, the right ports already exposed, and DDoS protection on by default. Instead of an afternoon of setup, deployment takes about 30 seconds:' },
      { type: 'ol', items: [
        'Create a free account with Google or email.',
        'Choose a plan sized to your group — 5GB RAM for small groups up to 8 players, 7GB for up to 16, or 10GB for a full 32-player server.',
        'Pick a server region close to your players from 50+ countries to keep latency low.',
        'Click deploy. Your Palworld dedicated server is provisioned, the game port is opened, and it comes online in under 30 seconds.',
        'Open the web dashboard to edit PalWorldSettings.ini, browse files, take backups, and use the console — no SSH or port forwarding required.',
      ] },
      { type: 'p', text: 'Because the server runs on Flux\'s distributed network rather than your home connection, your personal IP is never exposed, the server stays online 24/7, and enterprise-grade DDoS protection is included at no extra cost. Updates and the base image are handled for you.' },
      { type: 'cta', text: 'Deploy a Palworld dedicated server on Flux →', href: '/#pricing' },

      { type: 'h2', text: 'Ports and configuration every Palworld server needs' },
      { type: 'p', text: 'Whichever method you choose, two ports define a Palworld dedicated server. UDP 8211 is the game port players connect through — it must be open and reachable or the server will not show up. TCP 8212 is the optional REST admin API used to query players, save the world, broadcast announcements, and shut down gracefully. If you rent on Flux both are handled for you; if you self-host you must forward them manually.' },
      { type: 'p', text: 'Core settings live in PalWorldSettings.ini. The most-changed values are ServerName, ServerPassword, AdminPassword, PublicPort (default 8211), ServerPlayerMaxNum (up to 32), and the multipliers for experience, gathering, and damage. See our dedicated guide to the best Palworld server settings for a full breakdown of every option and recommended values.' },

      { type: 'h2', text: 'Next steps' },
      { type: 'p', text: 'Once your server is live, point your friends to it. If they are on the same platform they can add it as a community server or connect by IP and port; cross-platform play between Steam and Xbox/Game Pass has specific caveats covered in our guide on how to join a friend\'s Palworld server. To fine-tune the experience — faster leveling, harder bosses, longer days — head to our best Palworld server settings guide.' },
    ],
    faq: [
      { question: 'How do I make a Palworld dedicated server?', answer: 'Either install the Palworld Dedicated Server tool (Steam app ID 2394010) with SteamCMD on your own machine and forward UDP port 8211, or rent a managed dedicated server that deploys in about 30 seconds with the ports and DDoS protection already configured.' },
      { question: 'Do I need a dedicated server to play Palworld with friends?', answer: 'For up to 4 players you can host co-op directly from the game. For more players (up to 32), a persistent world, or a server that stays online when you are offline, you need a dedicated server.' },
      { question: 'Which ports does a Palworld dedicated server use?', answer: 'UDP 8211 is the game port and must be open for players to connect. TCP 8212 is the optional REST admin API for managing the server.' },
      { question: 'How long does it take to set up a Palworld server?', answer: 'A manual SteamCMD install can take 30 minutes to an hour including downloads and port forwarding. A managed Flux deployment is live in about 30 seconds.' },
    ],
    howTo: {
      name: 'How to Make a Palworld Dedicated Server',
      description: 'Deploy a Palworld dedicated server the fast way — a managed one-click deploy on the Flux decentralized cloud.',
      steps: [
        { name: 'Create an account', text: 'Sign up for free with Google or email.' },
        { name: 'Choose a plan', text: 'Pick 5GB RAM for up to 8 players, 7GB for up to 16, or 10GB for a full 32-player server.' },
        { name: 'Choose a region', text: 'Select a server location close to your players from 50+ countries.' },
        { name: 'Deploy', text: 'Click deploy — the game port opens and your server is online in about 30 seconds.' },
        { name: 'Configure and invite', text: 'Edit PalWorldSettings.ini from the dashboard and share your server address with your friends.' },
      ],
    },
    related: ['server-requirements', 'server-settings', 'join-server', 'pricing'],
  },

  'server-requirements': {
    slug: '/server-requirements',
    title: 'Palworld Dedicated Server Requirements (CPU, RAM, Ports)',
    metaTitle: 'Palworld Dedicated Server Requirements (CPU, RAM, Ports)',
    description:
      'Palworld dedicated server requirements: RAM and CPU by player count (up to 32), ports 8211 UDP and 8212 TCP, disk space. Skip setup — deploy from $3.99/mo.',
    h1: 'Palworld Dedicated Server Requirements',
    lead:
      'A Palworld dedicated server is CPU- and RAM-hungry, and its footprint grows as players build bases and capture Pals. This page covers exactly how much RAM and CPU you need for your player count, the ports you must open, and how much disk space to plan for.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Server Requirements', url: '/server-requirements' },
    ],
    body: [
      { type: 'h2', text: 'How much RAM does a Palworld server need?' },
      { type: 'p', text: 'RAM is the most important resource for a Palworld dedicated server. Pocketpair recommends a minimum of 8GB, but real-world usage climbs as more players join and as bases, captured Pals, and world objects accumulate. A long-running server with a busy world uses noticeably more memory than a freshly created one, so size up if you plan to run a persistent community world.' },
      { type: 'table', head: ['Plan / RAM', 'Recommended players', 'Best for'], rows: [
        ['5GB RAM', 'Up to 8 players', 'Small friends group, casual co-op'],
        ['7GB RAM', 'Up to 16 players', 'Medium group, active base building'],
        ['10GB RAM', 'Up to 32 players', 'Full-size community server (max players)'],
      ] },
      { type: 'p', text: 'These tiers map directly to the Flux hosting plans. If you are self-hosting, treat them as a guide: 5GB is a practical floor for a handful of players, and you should provision 10GB or more before opening a public 32-player server.' },

      { type: 'h2', text: 'CPU requirements' },
      { type: 'p', text: 'Palworld\'s server process benefits from strong single-thread performance. The simulation — Pal AI, base automation, and world physics — is sensitive to per-core speed, so a modern CPU with good single-core throughput matters more than a high core count. On a managed Flux plan the vCPU allocation scales with the plan tier, so a larger player cap comes with more CPU headroom automatically.' },

      { type: 'h2', text: 'Which ports does a Palworld dedicated server use?' },
      { type: 'p', text: 'Two ports matter. Get these wrong and players cannot connect — this is the single most common reason a Palworld server does not show up.' },
      { type: 'ul', items: [
        'UDP 8211 — the game port. This is how players connect to the server. It must be open and reachable on your public IP. This is required.',
        'TCP 8212 — the REST admin API. Optional, used for remote administration: querying online players, saving the world, broadcasting announcements, and graceful shutdown.',
      ] },
      { type: 'p', text: 'On a Flux-hosted server these ports are exposed for you at deploy time, so there is no router or firewall configuration to do. If you self-host, forward UDP 8211 (and TCP 8212 if you want the admin API) on both your router and OS firewall.' },

      { type: 'h2', text: 'Disk space and saves' },
      { type: 'p', text: 'The Palworld dedicated server files are a few gigabytes, and the save data grows with world size, base count, and player activity. Plan for enough SSD/NVMe headroom to hold the server build plus a growing world and a couple of backups. Managed Flux plans include SSD/NVMe storage sized to the plan, and you can take on-demand backups and restore them with one click from the dashboard.' },

      { type: 'h2', text: 'Network and uptime' },
      { type: 'p', text: 'A public server needs stable bandwidth and, ideally, DDoS protection — a real concern for any exposed game server. Self-hosting from a home connection exposes your IP and offers no protection. Every Palworld server on Flux includes DDoS protection at no extra cost and runs on a distributed network for 99.9% uptime, so the world stays online without tying up your own machine.' },
      { type: 'cta', text: 'See Palworld hosting plans and pricing →', href: '/pricing' },
    ],
    faq: [
      { question: 'How much RAM do I need for a Palworld dedicated server?', answer: 'At least 5GB for small groups up to 8 players, 7GB for up to 16, and 10GB or more for a full 32-player server. Memory use grows as bases and captured Pals accumulate, so size up for long-running worlds.' },
      { question: 'What ports does a Palworld server need?', answer: 'UDP port 8211 for game traffic (required) and TCP port 8212 for the optional REST admin API.' },
      { question: 'How many CPU cores does a Palworld server need?', answer: 'Palworld favors strong single-core performance over many cores. A modern CPU with good per-core speed handles the Pal AI and base simulation best; managed plans scale vCPU with the player tier.' },
      { question: 'How much disk space does a Palworld server use?', answer: 'The server build is a few gigabytes and the save grows with world size and base count. Allow headroom for the build plus a growing world and backups.' },
    ],
    related: ['setup-guide', 'pricing', 'server-settings', 'join-server'],
  },

  pricing: {
    slug: '/pricing',
    title: 'Palworld Server Hosting Pricing & Plans',
    metaTitle: 'Palworld Server Hosting Pricing — Plans from $3.99/mo',
    description:
      'Palworld server hosting plans from $3.99/mo: 5GB, 7GB & 10GB RAM tiers for up to 32 players. First month free, DDoS protection included. Deploy in 30 seconds.',
    h1: 'Palworld Server Hosting Pricing',
    lead:
      'Simple, transparent Palworld dedicated server pricing. Plans start at $3.99/month, every plan includes DDoS protection and full admin access, and new users get their first month free. Pick a tier by how many players you expect.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Pricing', url: '/pricing' },
    ],
    body: [
      { type: 'h2', text: 'Palworld hosting plans' },
      { type: 'p', text: 'Every plan is a full Palworld dedicated server with DDoS protection, a web dashboard, file manager, console access, and on-demand backups. The only difference between tiers is the RAM and CPU allocation, which determines how many players your server comfortably supports.' },
      { type: 'table', head: ['Plan', 'RAM', 'Players', 'Price'], rows: [
        ['Starter', '5GB', 'Up to 8', 'from $3.99/mo'],
        ['Standard', '7GB', 'Up to 16', 'from $9.99/mo'],
        ['Performance', '10GB', 'Up to 32', 'from $19.99/mo'],
      ] },
      { type: 'p', text: 'Prices shown are indicative starting points; the exact monthly price for each plan is calculated live at checkout based on the selected region and resources. There is no long-term contract and no hidden setup fee.' },

      { type: 'h2', text: 'What every plan includes' },
      { type: 'ul', items: [
        'Up to 32-player Palworld dedicated server (by tier)',
        'Instant deployment — online in about 30 seconds',
        'Enterprise-grade DDoS protection at no extra cost',
        '99.9% uptime on the Flux decentralized network',
        'Servers in 50+ countries to minimize latency',
        'Full admin access: web console, file manager, PalWorldSettings.ini editing',
        'On-demand backups and one-click restore',
        'Save transfer — upload an existing Palworld world',
      ] },

      { type: 'h2', text: 'First month free' },
      { type: 'p', text: 'New users get their first month free on any plan, so you can build a world, invite your friends, and test performance before you pay. If it is not the right fit you can cancel any time.' },

      { type: 'h2', text: 'Flexible payments' },
      { type: 'p', text: 'Pay however you prefer. Card payments (including Apple Pay and Google Pay) are handled through Stripe, and you can also pay in crypto with FLUX. Billing is month-to-month with no lock-in.' },

      { type: 'h2', text: 'Which plan should I choose?' },
      { type: 'p', text: 'Choose Starter (5GB) for a small friends group, Standard (7GB) for an active mid-size group that builds a lot, and Performance (10GB) for a full 32-player community server. You can start small and move up later — see the Palworld dedicated server requirements guide if you are unsure how much RAM your group needs.' },
      { type: 'cta', text: 'Deploy your Palworld server — first month free →', href: '/#pricing' },
    ],
    product: {
      name: 'Palworld Dedicated Server Hosting',
      description: 'Managed Palworld dedicated server hosting on the Flux decentralized cloud. Up to 32 players, DDoS protection, 99.9% uptime, plans from $3.99/month with the first month free.',
      image: '/games/palworld/banner.webp',
      lowPrice: '3.99',
      highPrice: '19.99',
      offerCount: '3',
    },
    related: ['setup-guide', 'server-requirements', 'server-settings', 'join-server', 'decentralized-palworld-hosting'],
  },

  'guides/join-server': {
    slug: '/guides/join-server',
    title: "How to Join a Friend's Palworld Server (incl. Crossplay)",
    metaTitle: "How to Join a Friend's Palworld Server (Crossplay Guide)",
    description:
      "Join a friend's Palworld server by IP and port or via the community list, plus Steam vs Xbox crossplay limits. Host your own 32-player server from $3.99/mo.",
    h1: "How to Join a Friend's Palworld Server",
    lead:
      "Joining a friend's Palworld dedicated server takes just the server address and, sometimes, a password. This guide covers every way to connect, how crossplay works between Steam and Xbox/Game Pass, and what to do when a server will not show up.",
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Guides', url: '/guides/join-server' },
      { name: "Join a Friend's Server", url: '/guides/join-server' },
    ],
    body: [
      { type: 'h2', text: 'Co-op vs a dedicated server' },
      { type: 'p', text: 'Palworld has two multiplayer modes. In-game co-op is hosted straight from a player\'s game, supports up to 4 players, and only runs while that host is online. A dedicated server is a separate always-on world that supports up to 32 players and stays up 24/7. The way you join differs slightly between them.' },

      { type: 'h2', text: 'Join by IP address and port' },
      { type: 'p', text: 'The most reliable way to join a dedicated server is by its address. Ask the server owner for the IP and port — it looks like 203.0.113.10:8211, where 8211 is the default Palworld game port.' },
      { type: 'ol', items: [
        'Launch Palworld and choose Join Multiplayer Game (Dedicated Server).',
        'At the bottom of the server list, enter the server address in the IP:Port field (for example 203.0.113.10:8211).',
        'Click Connect. If the server has a password, you will be prompted for it.',
        'Once you connect, the server is saved so you can rejoin it quickly next time.',
      ] },

      { type: 'h2', text: 'Use the community server list' },
      { type: 'p', text: 'Public dedicated servers can also appear in the in-game Community Servers browser. You can search by the server name the owner set in PalWorldSettings.ini. For a busy public list, joining by direct IP is usually faster and more reliable than scrolling the browser.' },

      { type: 'h2', text: 'Palworld crossplay: Steam and Xbox/Game Pass' },
      { type: 'p', text: 'Crossplay is the most common source of confusion. Palworld is available on Steam and on Xbox/Microsoft Store (including Game Pass), and the two versions do not always share the same multiplayer plumbing. Dedicated-server crossplay support has expanded over time, but there are important caveats:' },
      { type: 'ul', items: [
        'A dedicated server can be configured to allow crossplay, but the server owner must enable the appropriate crossplay/platform settings for it to accept players from another platform.',
        'The connection experience differs by platform: Steam players typically join by IP and port, while Xbox/Game Pass players may rely on the in-game server browser and invites.',
        'If crossplay is not enabled or the platforms are incompatible for a given server, players on different stores may not be able to see or join the same dedicated server.',
      ] },
      { type: 'p', text: 'If you are setting up a server for a mixed Steam and Xbox group, confirm crossplay is enabled in the server configuration first, then test with one player from each platform before inviting everyone.' },

      { type: 'h2', text: "My friend's server won't show up — troubleshooting" },
      { type: 'p', text: 'If you cannot see or connect to a server, work through these in order:' },
      { type: 'ol', items: [
        'Double-check the IP and port. The default game port is UDP 8211 — a wrong port is the most common mistake.',
        'Confirm the server is actually online and that the owner has forwarded UDP 8211 (self-hosted servers often miss this).',
        'Make sure both of you are on the same game version — a server on an older or newer build than your client will not accept the connection.',
        'Verify crossplay settings if you and the owner are on different platforms (Steam vs Xbox/Game Pass).',
        'Try joining by direct IP instead of the community browser, which can be slow to refresh.',
      ] },
      { type: 'p', text: 'Servers hosted on Flux have the game port open by default and stay online 24/7, which removes the two most common causes — a closed port and an offline host machine.' },
      { type: 'cta', text: 'Host a Palworld server your friends can always reach →', href: '/#pricing' },
    ],
    related: ['setup-guide', 'server-settings', 'server-requirements', 'pricing'],
  },

  'guides/server-settings': {
    slug: '/guides/server-settings',
    title: 'Best Palworld Server Settings (PalWorldSettings.ini)',
    metaTitle: 'Best Palworld Server Settings (PalWorldSettings.ini)',
    description:
      'Best Palworld server settings: XP rate, gather and damage multipliers, day length, PvP in PalWorldSettings.ini — plus tuned 32-player hosting from $3.99/mo.',
    h1: 'Best Palworld Server Settings',
    lead:
      'Every Palworld dedicated server is tuned through a single file, PalWorldSettings.ini. This guide explains the settings that matter most, what each one does, and recommended values for casual, balanced, and hardcore playstyles.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Guides', url: '/guides/server-settings' },
      { name: 'Server Settings', url: '/guides/server-settings' },
    ],
    body: [
      { type: 'h2', text: 'Where the settings live' },
      { type: 'p', text: 'All server tuning happens in PalWorldSettings.ini, found under Pal/Saved/Config/<Platform>/. On a Flux-hosted server you edit this file directly from the web dashboard\'s file manager and apply changes with a single restart — no SSH needed. If you self-host, copy the block out of DefaultPalWorldSettings.ini and edit it there; the server only reads your custom file, not the default one.' },
      { type: 'p', text: 'Always stop or restart the server after editing the file. Changes are read at startup, so edits made while the server is running will not take effect until the next restart.' },

      { type: 'h2', text: 'The settings that matter most' },
      { type: 'p', text: 'PalWorldSettings.ini has dozens of options, but a handful define the feel of your world. Here is what each key setting controls and a sensible range for it.' },
      { type: 'table', head: ['Setting', 'What it controls', 'Recommended'], rows: [
        ['ExpRate', 'How fast players and Pals gain experience', '1.0 balanced, 2.0–3.0 casual'],
        ['PalCaptureRate', 'Likelihood of catching a Pal', '1.0 default, up to 2.0 for faster collecting'],
        ['CollectionDropRate', 'Resources gathered per node', '1.0–2.0'],
        ['PalDamageRateAttack', 'Damage your Pals deal', '1.0 balanced, higher for faster fights'],
        ['EnemyDamageRateAttack', 'Damage enemies deal to you', '1.0 default, lower for casual'],
        ['DayTimeSpeedRate', 'How fast daytime passes', '1.0 default, lower for longer days'],
        ['NightTimeSpeedRate', 'How fast nighttime passes', '1.0 default, raise to shorten nights'],
        ['DeathPenalty', 'What you drop on death', 'ItemDrop (balanced) / None (casual)'],
        ['bEnablePlayerToPlayerDamage', 'PvP on or off', 'False for PvE, True for PvP servers'],
        ['ServerPlayerMaxNum', 'Maximum players', 'Up to 32'],
      ] },

      { type: 'h2', text: 'Recommended presets' },
      { type: 'h3', text: 'Casual / relaxed' },
      { type: 'p', text: 'Raise ExpRate to around 2.0–3.0, bump CollectionDropRate and PalCaptureRate up, lower EnemyDamageRateAttack, and set DeathPenalty to None or ItemDrop. This gets your group leveling, collecting, and building quickly without harsh setbacks — ideal for a friends server that wants to see the content without a grind.' },
      { type: 'h3', text: 'Balanced (close to default)' },
      { type: 'p', text: 'Leave the multipliers at 1.0, keep DeathPenalty on ItemDrop, and keep PvP off. This preserves the intended survival pacing while still being fair for a co-op group — a good starting point you can adjust from once you see how your players progress.' },
      { type: 'h3', text: 'Hardcore / PvP' },
      { type: 'p', text: 'Lower ExpRate toward 0.5–1.0, raise EnemyDamageRateAttack, set a heavier DeathPenalty, and enable bEnablePlayerToPlayerDamage for PvP. Combine with a full 32-player cap for a competitive community server where progression is earned and encounters are dangerous.' },

      { type: 'h2', text: 'Death penalty options explained' },
      { type: 'p', text: 'DeathPenalty is one of the most impactful settings. Options range from None (drop nothing) through ItemDrop (drop items but keep equipment and Pals) to All (drop items, equipment, and Pals in your party). Pick based on how punishing you want death to feel — None for a relaxed build server, All for hardcore survival.' },

      { type: 'h2', text: 'Applying your changes' },
      { type: 'p', text: 'After editing PalWorldSettings.ini, save the file and restart the server. On Flux you can do this from the dashboard in seconds; the world persists and only the settings reload. If a value seems to have no effect, confirm you edited the active config file (not the default template) and that the server fully restarted.' },
      { type: 'cta', text: 'Get a server with one-click config editing →', href: '/#pricing' },
    ],
    faq: [
      { question: 'What are the best Palworld server settings?', answer: 'For a balanced world keep the multipliers at 1.0 with DeathPenalty on ItemDrop. For a casual server raise ExpRate to 2.0–3.0, increase gather and capture rates, and lower enemy damage. For hardcore, lower ExpRate, raise enemy damage, and enable PvP.' },
      { question: 'How do I change Palworld server settings?', answer: 'Edit PalWorldSettings.ini (under Pal/Saved/Config) and restart the server. On a Flux-hosted server you can edit it directly in the web file manager and restart with one click.' },
      { question: 'How do I turn on PvP in Palworld?', answer: 'Set bEnablePlayerToPlayerDamage to True in PalWorldSettings.ini and restart the server.' },
    ],
    related: ['setup-guide', 'join-server', 'server-requirements', 'pricing'],
  },

  'decentralized-palworld-hosting': {
    slug: '/decentralized-palworld-hosting',
    title: 'Why Host Your Palworld Server on a Decentralized Cloud',
    metaTitle: 'Decentralized Palworld Server Hosting on Flux Cloud',
    description:
      'Decentralized Palworld hosting on Flux: no single point of failure, DDoS protection, 99.9% uptime. Deploy a 32-player server in 30s from $3.99/mo.',
    h1: 'Why Host Your Palworld Server on a Decentralized Cloud',
    lead:
      'Most game servers live in a single data center owned by one company. A decentralized cloud works differently: your Palworld dedicated server runs on a global network of independent nodes, so there is no single point of failure and no vendor holding your world hostage. This guide explains what decentralized hosting is, why it matters for Palworld, how it works, and who it is for.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Decentralized Palworld Hosting', url: '/decentralized-palworld-hosting' },
    ],
    body: [
      { type: 'h2', text: 'What is decentralized cloud hosting?' },
      { type: 'p', text: 'Traditional game hosting runs your server on hardware inside one company\'s data center. If that data center has an outage, a network problem, or a billing dispute, your server goes with it. A decentralized cloud spreads compute across thousands of independent nodes run by many different operators around the world. Flux is one such network, with capacity in 50+ countries. When you deploy a Palworld dedicated server on Flux, it runs on this distributed infrastructure rather than a single machine in a single location — the same idea that makes blockchains resilient, applied to game servers.' },
      { type: 'p', text: 'For a Palworld world that you want to keep alive for months, that structural difference is the whole point. Your server is not tied to the fate of one building, one provider, or one region.' },

      { type: 'h2', text: 'No single point of failure' },
      { type: 'p', text: 'A centralized host is only as reliable as its weakest link — one data center, one upstream network, one power feed. When any of those fail, every server in that facility drops at once. Because a decentralized network is spread across many independent nodes and regions, there is no single component whose failure takes your server down. The network is designed to keep running even when individual nodes go offline, which is why Flux targets 99.9% uptime. For a persistent Palworld world that your friends or community rely on being able to join at any hour, that resilience is worth more than a slightly cheaper monthly bill on fragile infrastructure.' },

      { type: 'h2', text: 'No vendor lock-in' },
      { type: 'p', text: 'Lock-in is the quiet cost of most hosting. Long contracts, prepaid credit that only works with one provider, proprietary control panels, and save formats you cannot easily export all make it hard to leave. Decentralized hosting flips that. Your Palworld server on Flux is billed month-to-month with no contract — cancel any time. You get a full file manager and direct access to your world save and PalWorldSettings.ini, so your data is always yours to download, back up, or move elsewhere. You are renting capacity on an open network, not signing yourself into a walled garden.' },

      { type: 'h2', text: 'Dedicated resources and performance' },
      { type: 'p', text: 'Palworld is demanding. Its simulation — Pal AI, base automation, and world physics — leans on strong single-core CPU performance, and memory use climbs steadily as players build bases and capture Pals. A decentralized deployment gives your server dedicated RAM and vCPU sized to your plan rather than a slice of a heavily oversold box shared with noisy neighbours. That means your world stays smooth as your group grows, whether you run a small co-op server or a full 32-player community. Storage is fast SSD/NVMe, and you can take on-demand backups and restore them with one click.' },

      { type: 'h2', text: 'DDoS protection and security' },
      { type: 'p', text: 'Any public game server is a target. Self-hosting from a home connection exposes your personal IP address and offers no protection against attacks, and a single motivated griefer can knock an unprotected server offline. Every Palworld server on Flux includes enterprise-grade DDoS protection at no extra cost, and because the server runs on the network rather than your own line, your home IP is never exposed. The distributed nature of the network also means an attack aimed at one node does not take the platform down.' },

      { type: 'h2', text: 'Everything a great Palworld server needs' },
      { type: 'p', text: 'Decentralized does not mean stripped-down. A Palworld server on Flux gives you the full feature set players expect:' },
      { type: 'ul', items: [
        'Up to 32 players on a single persistent dedicated server that stays online 24/7.',
        'Crossplay support — configure your server for Steam and Xbox/Game Pass players to play together.',
        'Full mod and configuration control: edit every value in PalWorldSettings.ini (XP rate, gather and damage multipliers, day/night length, death penalty, PvP) straight from the web dashboard.',
        'A web file manager, live console, and the REST admin API for kicking or banning players, saving the world, and broadcasting announcements.',
        'On-demand backups and one-click restore, plus the ability to upload an existing Palworld world.',
        'Enterprise DDoS protection and 99.9% uptime on every plan.',
      ] },

      { type: 'h2', text: 'How it works: deploy in 30 seconds' },
      { type: 'p', text: 'The decentralized part is invisible in day-to-day use — deploying is faster and simpler than a manual SteamCMD install, not harder. The Palworld image ships pre-built with the correct server, the game port already exposed, and DDoS protection on by default, so there is no router or firewall configuration to do.' },
      { type: 'ol', items: [
        'Create a free account with Google or email.',
        'Choose a plan sized to your group — 5GB RAM for small groups up to 8 players, 7GB for up to 16, or 10GB for a full 32-player server.',
        'Pick a server region close to your players from 50+ countries to keep latency low.',
        'Click deploy. Your server is provisioned on the network, the game port opens, and it is online in about 30 seconds.',
        'Open the web dashboard to edit PalWorldSettings.ini, browse files, take backups, and use the console — no SSH or port forwarding required.',
      ] },

      { type: 'h2', text: 'Pay-as-you-go pricing' },
      { type: 'p', text: 'Billing matches the no-lock-in philosophy: month-to-month, no long-term contract, and no hidden setup fee. Plans start at $3.99/month for the 5GB Starter tier, $9.99/month for 7GB, and $19.99/month for the 10GB Performance tier that runs a full 32-player world. New users get their first month free, so you can build a world and test performance before you pay. You can pay however you prefer — card, Apple Pay, and Google Pay through Stripe, or in crypto with FLUX — which fits the open, permissionless nature of the network.' },
      { type: 'cta', text: 'Deploy a Palworld server on Flux — first month free →', href: '/#pricing' },

      { type: 'h2', text: 'Who is decentralized hosting for?' },
      { type: 'p', text: 'A decentralized Palworld server is the right fit if you want a persistent world that stays online without tying up your own machine, full control over configuration and your save data, resilience that does not depend on one company\'s data center, and month-to-month billing you can walk away from at any time. It suits friends groups who want a world that keeps running while they are offline, community owners running a public 32-player server, and anyone who values owning their data and paying only for what they use — including with crypto.' },
      { type: 'p', text: 'Whichever route you take, the mechanics of running the server are the same: open UDP 8211, tune PalWorldSettings.ini for your group, and confirm crossplay if you mix Steam and Xbox/Game Pass players. Our guides on how to make a Palworld dedicated server and the best Palworld server settings apply no matter where you host.' },
    ],
    faq: [
      { question: 'What is a decentralized cloud for game hosting?', answer: 'Instead of running your server in one company\'s data center, a decentralized cloud spreads compute across thousands of independent nodes worldwide. Flux is one such network, with capacity in 50+ countries, so your Palworld server has no single point of failure and is not tied to one provider or region.' },
      { question: 'Is a decentralized Palworld server reliable?', answer: 'Yes. Because the network is spread across many independent nodes and regions, there is no single component whose failure takes your server down. Flux targets 99.9% uptime and includes DDoS protection on every plan, so a persistent world stays online 24/7.' },
      { question: 'Does decentralized hosting support 32 players, crossplay and mods?', answer: 'Yes. A Palworld server on Flux supports the full 32-player cap, can be configured for Steam and Xbox/Game Pass crossplay, and gives you full access to PalWorldSettings.ini and a file manager to change any setting or mod your world.' },
      { question: 'How do I pay for a decentralized Palworld server?', answer: 'Billing is month-to-month with no contract and the first month free. You can pay by card, Apple Pay, or Google Pay through Stripe, or in crypto with FLUX. Plans start at $3.99/month and scale to a full 32-player server.' },
      { question: 'What does no vendor lock-in actually mean?', answer: 'No long-term contract, no prepaid credit tied to one provider, and full access to your world save and config files so you can back them up or move them at any time. You rent capacity on an open network rather than signing into a walled garden, and you can cancel whenever you like.' },
    ],
    related: ['pricing', 'setup-guide', 'server-requirements', 'server-settings'],
  },
};

// -------------------------------------------------------------------------
// Reviews / ratings (AggregateRating + Review schema)
// -------------------------------------------------------------------------
//
// Real reviews ONLY. This array is EMPTY by design and MUST stay empty until
// you have genuine, verifiable customer reviews to show. Google's structured-
// data policy prohibits fabricated or self-serving ratings, and emitting an
// AggregateRating with no real reviews behind it risks a manual action.
//
// While this array is empty, NO AggregateRating and NO Review JSON-LD is
// emitted anywhere (see buildProductSchema below). Nothing extra ships.
//
// TO POPULATE (only with real reviews you can substantiate):
//   export const reviews = [
//     {
//       author: 'Jane D.',            // real reviewer name/handle
//       rating: 5,                    // integer or decimal 1–5
//       body: 'Deployed in seconds and the config editor is great.',
//       datePublished: '2026-07-01',  // ISO date
//     },
//     // ...more real reviews
//   ];
// The AggregateRating (average + count) and individual Review nodes are then
// attached automatically to the Product schema on the /pricing page.

export const reviews = [];

export function computeAggregateRating(list = reviews) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const total = list.reduce((sum, r) => sum + Number(r.rating), 0);
  const ratingValue = (total / list.length).toFixed(1);
  return {
    '@type': 'AggregateRating',
    ratingValue,
    reviewCount: String(list.length),
    bestRating: '5',
    worstRating: '1',
  };
}

export function buildReviewNodes(list = reviews) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list.map((r) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: r.author },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: String(r.rating),
      bestRating: '5',
      worstRating: '1',
    },
    reviewBody: r.body,
    ...(r.datePublished ? { datePublished: r.datePublished } : {}),
  }));
}

// Human-readable labels for related-link anchors (keyword-rich).
export const pageAnchors = {
  'setup-guide': 'How to make a Palworld dedicated server',
  'server-requirements': 'Palworld dedicated server requirements',
  pricing: 'Palworld server hosting pricing',
  'guides/join-server': "How to join a friend's Palworld server",
  'guides/server-settings': 'Best Palworld server settings',
  'join-server': "How to join a friend's Palworld server",
  'server-settings': 'Best Palworld server settings',
  'decentralized-palworld-hosting': 'Why host on the Flux decentralized cloud',
};

// Map short related keys to full page keys.
const relatedKeyMap = {
  'join-server': 'guides/join-server',
  'server-settings': 'guides/server-settings',
};

export function resolveRelated(key) {
  const fullKey = relatedKeyMap[key] || key;
  const page = pagesContent[fullKey];
  if (!page) return null;
  return { key: fullKey, slug: page.slug, anchor: pageAnchors[fullKey] || page.title };
}

// -------------------------------------------------------------------------
// Schema builders (shared by React SEO and the prerender script)
// -------------------------------------------------------------------------

export function buildBreadcrumbSchema(page) {
  if (!page.breadcrumbs || page.breadcrumbs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: page.breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: `${SITE}${b.url === '/' ? '/' : b.url}`,
    })),
  };
}

export function buildHowToSchema(page) {
  if (!page.howTo) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: page.howTo.name,
    description: page.howTo.description,
    step: page.howTo.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function buildFaqSchema(page) {
  if (!page.faq || page.faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function buildProductSchema(page) {
  if (!page.product) return null;
  const p = page.product;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: `${SITE}${p.image}`,
    brand: { '@type': 'Brand', name: 'Palworld on Flux' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: p.lowPrice,
      highPrice: p.highPrice,
      offerCount: p.offerCount,
      availability: 'https://schema.org/InStock',
      url: `${SITE}${page.slug}`,
    },
  };

  // AggregateRating + Review are emitted ONLY when real reviews exist (the
  // `reviews` array is empty by default, so nothing is added here until it is
  // populated with genuine, verifiable reviews). This keeps the structured
  // data policy-compliant — no fabricated ratings ever ship.
  const aggregateRating = computeAggregateRating();
  if (aggregateRating) schema.aggregateRating = aggregateRating;
  const review = buildReviewNodes();
  if (review) schema.review = review;

  return schema;
}

export function buildPageSchemas(page) {
  return [
    buildBreadcrumbSchema(page),
    buildHowToSchema(page),
    buildFaqSchema(page),
    buildProductSchema(page),
  ].filter(Boolean);
}

// -------------------------------------------------------------------------
// Plain-HTML renderer for the static prerender fallback (no JSX).
// -------------------------------------------------------------------------

const escHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function renderPageBodyHtml(page) {
  const parts = [];
  parts.push(`<h1>${escHtml(page.h1)}</h1>`);
  if (page.lead) parts.push(`<p>${escHtml(page.lead)}</p>`);

  for (const block of page.body) {
    switch (block.type) {
      case 'h2':
        parts.push(`<h2>${escHtml(block.text)}</h2>`);
        break;
      case 'h3':
        parts.push(`<h3>${escHtml(block.text)}</h3>`);
        break;
      case 'p':
        parts.push(`<p>${escHtml(block.text)}</p>`);
        break;
      case 'ul':
        parts.push(`<ul>${block.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`);
        break;
      case 'ol':
        parts.push(`<ol>${block.items.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ol>`);
        break;
      case 'table':
        parts.push(
          `<table><thead><tr>${block.head
            .map((h) => `<th>${escHtml(h)}</th>`)
            .join('')}</tr></thead><tbody>${block.rows
            .map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join('')}</tr>`)
            .join('')}</tbody></table>`
        );
        break;
      case 'cta':
        parts.push(`<p><a href="${escHtml(block.href)}">${escHtml(block.text)}</a></p>`);
        break;
      default:
        break;
    }
  }

  // FAQ section (also feeds FAQPage schema)
  if (page.faq && page.faq.length) {
    parts.push('<h2>Frequently asked questions</h2>');
    for (const f of page.faq) {
      parts.push(`<h3>${escHtml(f.question)}</h3><p>${escHtml(f.answer)}</p>`);
    }
  }

  // Related links
  if (page.related && page.related.length) {
    const links = page.related
      .map((k) => resolveRelated(k))
      .filter(Boolean)
      .map((r) => `<li><a href="${escHtml(SITE + r.slug)}">${escHtml(r.anchor)}</a></li>`)
      .join('');
    if (links) parts.push(`<h2>Related guides</h2><ul>${links}</ul>`);
  }

  return parts.join('\n');
}
