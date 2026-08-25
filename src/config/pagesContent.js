// Long-form content for the SEO landing/guide pages.
//
// This is the SINGLE SOURCE OF TRUTH for the content pages. `src/pages/ArticlePage`
// renders a page from here, and that same React tree is what scripts/prerender.mjs
// server-renders into dist/<route>/index.html — so non-JS crawlers see exactly what
// a user sees, and the two can no longer drift apart (they used to: this file also
// carried a hand-written HTML renderer for the crawler fallback, now deleted).
//
// A page `body` is an array of typed blocks. ArticlePage switches on `block.type`.
// The prerender still reads the metadata here (title/description/slug) to stamp
// each shell's <head>.

const SITE = 'https://palworld.runonflux.com';

// -------------------------------------------------------------------------
// Page content
// -------------------------------------------------------------------------

export const pagesContent = {
  'rent-palworld-server': {
    slug: '/rent-palworld-server',
    published: '2026-07-19',
    title: 'Rent a Palworld Server',
    metaTitle: 'Rent a Palworld Dedicated Server — from $2.61/mo',
    description:
      'Rent a Palworld dedicated server on the Flux decentralized cloud: up to 32 players, crossplay, DDoS protection, deploy in 30s from $2.61/mo. First month free.',
    h1: 'Rent a Palworld Dedicated Server',
    lead:
      'Renting a Palworld dedicated server means someone else handles the hardware, the install, the port forwarding, and the uptime — you pick a plan, click deploy, and your world is online in about 30 seconds. This page covers what you get when you rent, how much a Palworld server costs, and how renting on the Flux decentralized cloud compares to running one yourself.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Rent a Server', url: '/rent-palworld-server' },
    ],
    body: [
      { type: 'h2', text: 'Why rent a Palworld server instead of self-hosting?' },
      { type: 'p', text: 'You can run a Palworld dedicated server on your own PC with SteamCMD, but you then own every part of keeping it alive: the machine has to stay powered and online 24/7, you patch it whenever Pocketpair ships an update, you forward UDP 8211 on your router and firewall, and you expose your home IP address with no DDoS protection. Renting removes all of that. The server runs on managed infrastructure, the correct ports are already open, updates and the base image are handled for you, and your personal connection is never exposed.' },
      { type: 'p', text: 'Renting also frees your own hardware. A Palworld world is CPU- and RAM-hungry and gets heavier as players build bases and capture Pals, so hosting it locally ties up your machine and your bandwidth for as long as you want the world online. A rented server keeps the world running while your PC is off.' },

      { type: 'h2', text: 'How much does it cost to rent a Palworld server?' },
      { type: 'p', text: 'Palworld server rental is priced by RAM, which maps to how many players your world comfortably supports. Plans start at $2.61/month, every plan includes DDoS protection and full admin access, and new users get their first month free.' },
      { type: 'table', head: ['Plan / RAM', 'Recommended players', 'Price'], rows: [
        ['5GB RAM', 'Up to 4 players', 'from $2.61/mo'],
        ['8GB RAM', 'Up to 8 players', 'from $4.38/mo'],
        ['12GB RAM', 'Up to 16 players', 'from $6.11/mo'],
        ['16GB RAM', 'Up to 32 players', 'from $8.55/mo'],
      ] },
      { type: 'p', text: 'Prices shown are indicative starting points; the exact monthly price is calculated live at checkout based on the region and resources you choose. Billing is month-to-month — there is no long-term contract and no hidden setup fee, so you can cancel any time.' },
      { type: 'cta', text: 'Rent a Palworld server — first month free →', href: '/#pricing' },

      { type: 'h2', text: 'What you get when you rent on Flux' },
      { type: 'p', text: 'Every rented Palworld server is a full dedicated server, not a shared slot. The plan sets your RAM and vCPU; everything else is included:' },
      { type: 'ul', items: [
        'Up to 32 players on a single persistent server that stays online 24/7.',
        'Crossplay support — configure for Steam and Xbox/Game Pass players to play together.',
        'Enterprise-grade DDoS protection on every plan, at no extra cost.',
        '99.9% uptime on the Flux decentralized network, with servers in 50+ countries.',
        'Full admin access: web console, file manager, and direct PalWorldSettings.ini editing.',
        'On-demand backups and one-click restore, plus save transfer so you can upload an existing world.',
        'Ports handled for you — UDP 8211 and the REST admin API (TCP 8212) are exposed at deploy time.',
      ] },

      { type: 'h2', text: 'Rent a server close to your players' },
      { type: 'p', text: 'Latency is set by distance, so where you rent matters. Traditional hosts run a fixed set of data centers; Flux is a decentralized network with capacity in 50+ countries, so you pick a region near your group at deploy time and can move if your community shifts. There is no single point of failure and no egress (bandwidth) fee.' },

      { type: 'h2', text: 'How to rent a Palworld server in 30 seconds' },
      { type: 'ol', items: [
        'Create a free account with Google or email — no card needed to start.',
        'Choose a plan sized to your group: 5GB for up to 4 players, 8GB for up to 8, 12GB for up to 16, or 16GB for a full 32-player server.',
        'Pick a server region close to your players from 50+ countries.',
        'Click deploy. The game port opens and your Palworld dedicated server is online in about 30 seconds.',
        'Open the web dashboard to edit PalWorldSettings.ini, browse files, take backups, and invite your friends — no SSH or port forwarding required.',
      ] },
      { type: 'p', text: 'Prefer to compare against a specific host first? See how renting on Flux stacks up as a GPORTAL alternative or a Nitrado alternative for Palworld, or read the full Palworld dedicated server requirements to size your plan.' },
      { type: 'cta', text: 'Rent a Palworld dedicated server on Flux →', href: '/#pricing' },
    ],
    faq: [
      { question: 'How much does it cost to rent a Palworld server?', answer: 'Palworld server rental starts at $2.61/month for a 5GB plan (up to 4 players) and scales to $8.55/month for a 16GB plan that runs a full 32-player server. Every plan includes DDoS protection, and new users get the first month free. The exact price depends on the region and resources you pick at checkout.' },
      { question: 'Where can I rent a Palworld dedicated server?', answer: 'You can rent a Palworld dedicated server on the Flux decentralized cloud with deployment in about 30 seconds, servers in 50+ countries, DDoS protection included, and month-to-month billing with no contract.' },
      { question: 'Is renting a Palworld server better than self-hosting?', answer: 'Renting removes the work and cost of self-hosting: no dedicated hardware to keep powered, no manual updates or port forwarding, no exposed home IP, and DDoS protection included. Self-hosting is free of hosting fees but you take on the machine, networking, and uptime yourself.' },
      { question: 'Can I rent a Palworld server for 32 players?', answer: 'Yes. The 16GB plan supports the full 32-player cap. Smaller plans suit co-op groups: 5GB for up to 4, 8GB for up to 8, and 12GB for up to 16 players.' },
      { question: 'Can I cancel my Palworld server rental any time?', answer: 'Yes. Billing is month-to-month with no long-term contract and the first month is free, so you can cancel whenever you like and download your world save from the file manager to keep it.' },
    ],
    product: {
      name: 'Palworld Dedicated Server Rental',
      description: 'Rent a managed Palworld dedicated server on the Flux decentralized cloud. Up to 32 players, DDoS protection, 99.9% uptime, plans from $2.61/month with the first month free.',
      image: '/games/palworld/banner.webp',
      lowPrice: '2.61',
      highPrice: '8.55',
      offerCount: '3',
    },
    related: ['palworld-server-cost', 'pricing', 'server-requirements', 'setup-guide', 'gportal-alternative', 'nitrado-alternative'],
  },

  'setup-guide': {
    slug: '/setup-guide',
    published: '2026-07-04',
    title: 'How to Make a Palworld Dedicated Server (2026 Guide)',
    metaTitle: 'How to Make a Palworld Dedicated Server (2026 Guide)',
    description:
      'How to make a Palworld dedicated server in 2026: manual SteamCMD install vs a one-click Flux deploy in 30 seconds from $2.61/mo. Ports and config explained.',
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
      { type: 'p', text: 'The manual method works, but the ongoing burden is real: you keep the host machine powered and online, patch it whenever Pocketpair ships an update, secure the box, and troubleshoot your own networking. A home connection also exposes your IP address and offers no DDoS protection, which matters for a public community server. You also own the failures: when a Palworld server keeps crashing, or keeps running while nobody can join, something has to notice at three in the morning.', links: [{ text: 'a Palworld server keeps crashing', href: '/guides/server-keeps-crashing' }] },

      { type: 'h2', text: 'Method 2 — Deploy a managed Palworld server on Flux (30 seconds)' },
      { type: 'p', text: 'The faster path skips the installation entirely. Rent a Palworld dedicated server on the Flux decentralized cloud and it arrives pre-built with the correct SteamCMD image, the right ports already exposed, and DDoS protection on by default. Instead of an afternoon of setup, deployment takes about 30 seconds:', links: [{ text: 'Rent a Palworld dedicated server', href: '/rent-palworld-server' }] },
      { type: 'ol', items: [
        'Create a free account with Google or email.',
        'Choose a plan sized to your group — 5GB RAM for small co-op groups up to 4 players, 8GB for up to 8, 12GB for up to 16, or 16GB for a full 32-player server.',
        'Pick a server region close to your players from 50+ countries to keep latency low.',
        'Click deploy. Your Palworld dedicated server is provisioned, the game port is opened, and it comes online in under 30 seconds.',
        'Open the web dashboard to edit PalWorldSettings.ini, browse files, take backups, and use the console — no SSH or port forwarding required.',
      ] },
      { type: 'p', text: 'Because the server runs on Flux\'s distributed network rather than your home connection, your personal IP is never exposed, the server stays online 24/7, and enterprise-grade DDoS protection is included at no extra cost. Updates and the base image are handled for you.' },
      { type: 'cta', text: 'Deploy a Palworld dedicated server on Flux →', href: '/#pricing' },

      { type: 'h2', text: 'Ports and configuration every Palworld server needs' },
      { type: 'p', text: 'Whichever method you choose, two ports define a Palworld dedicated server. UDP 8211 is the game port players connect through — it must be open and reachable or the server will not show up. TCP 8212 is the optional REST admin API used to query players, save the world, broadcast announcements, and shut down gracefully. If you rent on Flux both are handled for you; if you self-host you must forward them manually.' },
      { type: 'p', text: 'Core settings live in PalWorldSettings.ini. The most-changed values are ServerName, ServerPassword, AdminPassword, PublicPort (default 8211), ServerPlayerMaxNum (up to 32), and the multipliers for experience, gathering, and damage. See our dedicated guide to the best Palworld server settings for a full breakdown of every option and recommended values.', links: [{ text: 'best Palworld server settings', href: '/guides/server-settings' }] },

      { type: 'h2', text: 'Next steps' },
      { type: 'p', text: 'Once your server is live, point your friends to it. If they are on the same platform they can add it as a community server or connect by IP and port; cross-platform play between Steam and Xbox/Game Pass has specific caveats covered in our guide on how to join a friend\'s Palworld server. To fine-tune the experience — faster leveling, harder bosses, longer days — head to our best Palworld server settings guide.', links: [
        { text: 'how to join a friend\'s Palworld server', href: '/guides/join-server' },
        { text: 'best Palworld server settings', href: '/guides/server-settings' },
      ] },
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
        { name: 'Choose a plan', text: 'Pick 5GB RAM for up to 4 players, 8GB for up to 8, 12GB for up to 16, or 16GB for a full 32-player server.' },
        { name: 'Choose a region', text: 'Select a server location close to your players from 50+ countries.' },
        { name: 'Deploy', text: 'Click deploy — the game port opens and your server is online in about 30 seconds.' },
        { name: 'Configure and invite', text: 'Edit PalWorldSettings.ini from the dashboard and share your server address with your friends.' },
      ],
    },
    related: ['palworld-server-cost', 'server-requirements', 'server-settings', 'join-server', 'pricing', 'rent-palworld-server', 'guides/server-keeps-crashing'],
  },

  'server-requirements': {
    slug: '/server-requirements',
    published: '2026-07-04',
    title: 'Palworld Dedicated Server Requirements (CPU, RAM, Ports)',
    metaTitle: 'Palworld Dedicated Server Requirements: 16GB RAM, 4 Cores',
    description:
      'Palworld server requirements: Pocketpair officially requires 16GB RAM and 4+ cores, and prefers 32GB+. Real sizing by player count, ports 8211 UDP / 8212 TCP.',
    h1: 'Palworld Dedicated Server Requirements',
    lead:
      'Pocketpair officially requires 16GB of RAM for a Palworld dedicated server, prefers more than 32GB for larger servers, and recommends four or more CPU cores. 8GB will boot, but Pocketpair warns it raises the chance of out-of-memory crashes — which is why so many hosting pages quote 8GB as the requirement. It is not. That said, a four-player co-op world and a 32-player community server are not the same machine, so this page gives both: the official specification, and what each player count actually needs in practice — plus the ports to open, the disk warning most guides skip, and why memory use climbs the longer a world stays live.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Server Requirements', url: '/server-requirements' },
    ],
    body: [
      { type: 'h2', text: 'The official Palworld server requirements' },
      { type: 'p', text: 'Start with what Pocketpair publishes, because it is the number the game is tested against and it is stricter than most hosting pages admit:' },
      { type: 'table', head: ['Resource', 'Pocketpair\'s official requirement'], rows: [
        ['RAM', '16GB required; more than 32GB preferred for larger servers. 8GB is bootable, but Pocketpair warns it increases the chance of out-of-memory crashes'],
        ['CPU', '4 cores or more (recommended)'],
        ['Storage', 'An SSD is strongly recommended — Pocketpair warns that low-performance storage can corrupt save data'],
        ['Ports', 'UDP 8211 (default, changeable)'],
        ['OS', 'Windows 64-bit, or Linux 64-bit (Ubuntu, AlmaLinux and similar)'],
      ] },
      { type: 'p', text: 'Read the 8GB line carefully, because most hosting pages quote it as the requirement. Pocketpair\'s own words are that 8GB \u201cis also bootable, but increases the possibility of server crashes due to out of memory\u201d. The requirement is 16GB. The distinction matters more than it looks, because Palworld\'s memory use climbs steadily while a world is live — players build bases, capture Pals, and fill the map with objects — so a long-running 1.0 world sits far above where it started. If yours already dies after a few hours, the guide on why a Palworld server keeps crashing covers how to confirm it is the memory and what to change.', links: [{ text: 'why a Palworld server keeps crashing', href: '/guides/server-keeps-crashing' }] },

      { type: 'h2', text: 'How much RAM does a Palworld server need in practice?' },
      { type: 'p', text: 'Official minimums are written for a single spec that has to cover every case. Sizing by player count is more useful, so the table below is how we allocate memory across our own hosting plans — our operational sizing, not Pocketpair\'s specification:' },
      { type: 'table', head: ['RAM', 'Players it comfortably supports', 'Best for'], rows: [
        ['5GB', 'Up to 4 players', 'Small co-op group, casual play'],
        ['8GB', 'Up to 8 players', 'Friends group, regular sessions'],
        ['12GB', 'Up to 16 players', 'Medium group, active base building'],
        ['16GB', 'Up to 32 players', 'Full-size community server (max players)'],
      ] },
      { type: 'p', text: 'Every tier below 16GB sits under Pocketpair\'s official requirement, so it is worth being straight about why those tiers work on managed hosting and often will not on your own machine. Two things differ. The memory is dedicated — nothing else on the box competes for it, which is not true of a PC that is also running the game, a browser and Discord. And the server watches itself. Our Palworld image samples the server every minute and restarts it when it has stopped serving — no setting to enable — on top of a nightly restart you can schedule from the dashboard to hand the accumulated memory back before it reaches the ceiling. That second half is the important one: Palworld grows its memory use over a session rather than holding steady, and a four-player world with around 80 Pals commonly climbs from roughly 3GB to over 8GB inside four hours. A 5GB plan runs a four-player world comfortably with a nightly restart scheduled; left running untouched for a week, it would not. If you are opening a public server, expect long unbroken sessions, or you are self-hosting on a shared machine, take Pocketpair\'s number over ours and start at 16GB.' },

      { type: 'h2', text: 'CPU requirements' },
      { type: 'p', text: 'Pocketpair recommends four cores or more. Beyond that count, per-core speed is what you feel: the simulation — Pal AI, base automation, and world physics — is sensitive to single-thread performance, so a modern CPU with good per-core throughput does more for tick rate than a high core count does. On a managed Flux plan the vCPU allocation scales with the plan tier, so a larger player cap comes with more CPU headroom automatically.' },

      { type: 'h2', text: 'Which ports does a Palworld dedicated server use?' },
      { type: 'p', text: 'Two ports matter. Get these wrong and players cannot connect — this is the single most common reason a Palworld server does not show up.' },
      { type: 'ul', items: [
        'UDP 8211 — the game port. This is how players connect to the server. It must be open and reachable on your public IP. This is required.',
        'TCP 8212 — the REST admin API. Optional, used for remote administration: querying online players, saving the world, broadcasting announcements, and graceful shutdown.',
      ] },
      { type: 'p', text: 'On a Flux-hosted server these ports are exposed for you at deploy time, so there is no router or firewall configuration to do. If you self-host, forward UDP 8211 (and TCP 8212 if you want the admin API) on both your router and OS firewall.' },

      { type: 'h2', text: 'Disk space and saves' },
      { type: 'p', text: 'The Palworld dedicated server files are a few gigabytes, and the save data grows with world size, base count, and player activity. Plan for enough headroom to hold the server build plus a growing world and a couple of backups. What matters more than capacity is the kind of disk: Pocketpair explicitly warns that low-performance storage can corrupt save data, which makes an SSD a correctness requirement here rather than a speed upgrade. Managed Flux plans include SSD/NVMe storage sized to the plan, and you can take on-demand backups and restore them with one click from the dashboard.' },

      { type: 'h2', text: 'Network and uptime' },
      { type: 'p', text: 'A public server needs stable bandwidth and, ideally, DDoS protection — a real concern for any exposed game server. Self-hosting from a home connection exposes your IP and offers no protection. Every Palworld server on Flux includes DDoS protection at no extra cost and runs on a distributed network for 99.9% uptime — that is what decentralized Palworld hosting buys you over a single datacentre — so the world stays online without tying up your own machine.' , links: [{ text: 'decentralized Palworld hosting', href: '/decentralized-palworld-hosting' }] },
      { type: 'cta', text: 'See Palworld hosting plans and pricing →', href: '/pricing' },
    ],
    faq: [
      { question: 'How much RAM do I need for a Palworld dedicated server?', answer: 'Pocketpair officially requires 16GB and prefers more than 32GB for larger servers. 8GB will boot, but Pocketpair warns it raises the chance of out-of-memory crashes, so it is not the requirement even though most hosting pages quote it as one. By player count on managed hosting, where the memory is dedicated, the server restarts itself if it stops responding, and you can schedule a nightly restart on top: 5GB runs a small co-op group of up to 4, 8GB up to 8, 12GB up to 16, and 16GB a full 32-player server. Memory use grows as bases and captured Pals accumulate, so size up for long-running worlds.' },
      { question: 'What ports does a Palworld server need?', answer: 'UDP port 8211 for game traffic (required) and TCP port 8212 for the optional REST admin API.' },
      { question: 'What operating system does a Palworld dedicated server need?', answer: 'Pocketpair supports 64-bit Windows and 64-bit Linux (Ubuntu, AlmaLinux and similar). On managed hosting the OS is not something you choose or maintain — the server runs in a prepared Linux container.' },
      { question: 'How many CPU cores does a Palworld server need?', answer: 'Pocketpair recommends four cores or more. Past that, Palworld favors strong single-core performance over extra cores — a modern CPU with good per-core speed handles the Pal AI and base simulation best. Managed plans scale vCPU with the player tier.' },
      { question: 'How much disk space does a Palworld server use?', answer: 'The server build is a few gigabytes and the save grows with world size and base count. Allow headroom for the build plus a growing world and backups. Use an SSD: Pocketpair warns that low-performance storage can corrupt save data.' },
    ],
    related: ['palworld-server-cost', 'setup-guide', 'pricing', 'server-settings', 'join-server', 'rent-palworld-server', 'guides/server-keeps-crashing'],
  },

  'palworld-server-cost': {
    slug: '/palworld-server-cost',
    published: '2026-08-25',
    title: 'How Much Does a Palworld Dedicated Server Cost?',
    metaTitle: 'How Much Does a Palworld Dedicated Server Cost?',
    description:
      'A Palworld dedicated server costs $2.61/month for up to 4 players and $8.55/month for a full 32-player world. Full price breakdown, and what self-hosting costs.',
    h1: 'How Much Does a Palworld Dedicated Server Cost?',
    lead:
      'A managed Palworld dedicated server costs between $2.61 and $8.55 a month, depending on how many players it has to hold: $2.61/month for a 5GB plan that runs a four-player co-op world, and $8.55/month for a 16GB plan that runs the full 32-player cap. The Palworld dedicated server software itself is free — what you are paying for is a machine to run it on around the clock. This page breaks down where that number comes from, what changes it, and what self-hosting actually costs once you count the parts people forget.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Server Cost', url: '/palworld-server-cost' },
    ],
    body: [
      { type: 'h2', text: 'Palworld server cost by player count' },
      { type: 'p', text: 'Price follows memory, and memory follows player count. These are the current plans, with what each one includes:' },
      { type: 'table', head: ['Plan', 'Players', 'Resources', 'Price'], rows: [
        ['5GB', 'Up to 4', '5 GB RAM, 2 vCores, 30 GB SSD/NVMe', '$2.61/month'],
        ['8GB', 'Up to 8', '8 GB RAM, 3 vCores, 30 GB SSD/NVMe', '$4.38/month'],
        ['12GB', 'Up to 16', '12 GB RAM, 4 vCores, 35 GB SSD/NVMe', '$6.11/month'],
        ['16GB', 'Up to 32', '16 GB RAM, 6 vCores, 40 GB SSD/NVMe', '$8.55/month'],
      ] },
      { type: 'p', text: 'Every tier carries the same feature set — DDoS protection, unlimited bandwidth, full admin access, on-demand backups, and your choice of region at deploy. There is no setup fee, no separate charge for slots, and no long-term contract; billing is month to month and new accounts get their first month free. The price you see is the price you pay, and it does not change because you invited more friends or grew your base.' },
      { type: 'cta', text: 'See all Palworld hosting plans →', href: '/pricing' },

      { type: 'h2', text: 'Is the Palworld dedicated server free?' },
      { type: 'p', text: 'The software is. Pocketpair distributes the Palworld dedicated server tool for free through Steam, and you can install it on hardware you already own without paying anyone. What is not free is the thing people actually want, which is a world that stays online when they are asleep, at work, or on another continent from their friends.' },
      { type: 'p', text: 'So the honest framing of the question is not "does a Palworld server cost money" but "what does 24/7 uptime cost". On managed hosting that is $2.61 to $8.55 a month. Self-hosted, the number is less visible but it is not zero.' },

      { type: 'h2', text: 'What self-hosting a Palworld server actually costs' },
      { type: 'p', text: 'Running the server on your own PC looks free on the invoice. The costs move somewhere else:' },
      { type: 'ul', items: [
        'Electricity. A machine holding 16GB of RAM and several cores busy, running continuously instead of a few hours a day, draws power every one of those hours. Whether that outweighs a few dollars a month depends entirely on your tariff — work it out before assuming it is cheaper.',
        'Your PC. Palworld’s server process wants the memory it wants, and it wants it whether or not you are also trying to play the game on the same box. The usual result is that the machine becomes the server and stops being a gaming PC.',
        'Your IP address. A self-hosted server has to be reachable from the internet, which means your home IP is handed to everyone who joins. There is no DDoS protection in front of it, and in a game with public server lists that matters.',
        'Your time. Port forwarding, firewall rules, keeping the build updated after every patch, and restarting the process when it dies. None of that is difficult; all of it is recurring.',
        'The saves. There is no backup unless you build one, and Pocketpair warns that low-performance storage can corrupt Palworld save data outright.',
      ] },
      { type: 'p', text: 'A rented VPS removes some of those problems and keeps others, since a general-purpose VPS still leaves you installing, patching, port-forwarding and monitoring the server yourself. Compare on the delivered thing rather than on the RAM figure: a game-specific plan arrives configured, exposed on the right ports, backed up, and behind DDoS protection. For a like-for-like against the big game hosts, we set out GPORTAL vs Flux and Nitrado vs Flux in full.', links: [
        { text: 'GPORTAL vs Flux', href: '/gportal-alternative' },
        { text: 'Nitrado vs Flux', href: '/nitrado-alternative' },
      ] },

      { type: 'h2', text: 'Why the price depends on RAM rather than slots' },
      { type: 'p', text: 'Palworld is memory-hungry in a way most survival games are not, and it gets hungrier the longer a world is live. Every base, every captured Pal, and every object placed in the world adds to the footprint, so a server that started at 3GB can be well past 8GB after an evening of play. That is why hosting for this game is priced by memory: memory is the resource that actually runs out.' },
      { type: 'p', text: 'It is also why a plan two tiers below your player count is a false economy. Pocketpair officially requires 16GB for a dedicated server and prefers more than 32GB for larger ones, and while managed plans run comfortably below that — dedicated memory, a server image that restarts itself when it stops responding, and a nightly restart you can schedule — the sizing still has to match the group. See the Palworld dedicated server requirements guide for the full breakdown.', links: [{ text: 'Palworld dedicated server requirements', href: '/server-requirements' }] },
      { type: 'cta', text: 'Palworld dedicated server requirements →', href: '/server-requirements' },

      { type: 'h2', text: 'What you are not charged for' },
      { type: 'p', text: 'A lot of the Palworld hosting market prices the base plan low and charges for the rest. Here is what is included at every tier rather than sold on top: DDoS protection, unlimited bandwidth, on-demand backups and one-click restore, full file and console access, mod support, the region of your choice at deploy time, and the full player cap the plan’s memory supports. Crossplay between Steam and Xbox players is a property of the game, not an upsell.' },
      { type: 'p', text: 'Billing is month to month with no minimum term, payable by card, Apple Pay or Google Pay through Stripe, or in FLUX if you would rather pay in crypto. New accounts get the first month free, so the practical cost of finding out whether it suits your group is nothing.' },
      { type: 'cta', text: 'Deploy a Palworld server — first month free →', href: '/#pricing' },
    ],
    faq: [
      { question: 'How much does a Palworld dedicated server cost?', answer: 'A managed Palworld dedicated server costs $2.61/month for a 5GB plan that runs up to 4 players, $4.38/month for 8GB and up to 8 players, $6.11/month for 12GB and up to 16 players, and $8.55/month for a 16GB plan that runs the full 32-player cap. Every plan includes DDoS protection, backups and unlimited bandwidth, there is no setup fee, and new accounts get the first month free.' },
      { question: 'Does a Palworld dedicated server cost money?', answer: 'The dedicated server software from Pocketpair is free to download and run on your own hardware. What costs money is keeping it online 24/7 — either the electricity and the tied-up PC if you self-host, or $2.61 to $8.55 a month on managed hosting.' },
      { question: 'How much does it cost to run a Palworld server for 32 players?', answer: 'A full 32-player Palworld server needs 16GB of RAM, which is $8.55/month on the Performance plan. That includes 6 vCores, 40 GB of SSD/NVMe storage, DDoS protection and unlimited bandwidth, with no per-slot charge.' },
      { question: 'Is it cheaper to host a Palworld server yourself?', answer: 'Not reliably. Self-hosting has no monthly invoice, but it draws electricity around the clock, occupies the PC you would otherwise play on, exposes your home IP address with no DDoS protection, and leaves patching, port forwarding and backups to you. Against $2.61 to $8.55 a month, the saving is usually smaller than it looks.' },
      { question: 'Are there setup fees or hidden costs?', answer: 'No. There is no setup fee, no per-slot charge and no long-term contract. DDoS protection, unlimited bandwidth, backups, mod support and region choice are included at every tier, and billing is month to month.' },
    ],
    product: {
      name: 'Palworld Dedicated Server Hosting',
      description: 'Managed Palworld dedicated server hosting on the Flux decentralized cloud, priced from $2.61/month for 4 players to $8.55/month for a full 32-player world. First month free.',
      image: '/games/palworld/logo.webp',
      lowPrice: '2.61',
      highPrice: '8.55',
      offerCount: 4,
      plans: [
        { name: 'Palworld 5GB', price: '2.61', description: '5 GB RAM, 2 vCores, 30 GB SSD/NVMe — up to 4 players' },
        { name: 'Palworld 8GB', price: '4.38', description: '8 GB RAM, 3 vCores, 30 GB SSD/NVMe — up to 8 players' },
        { name: 'Palworld 12GB', price: '6.11', description: '12 GB RAM, 4 vCores, 35 GB SSD/NVMe — up to 16 players' },
        { name: 'Palworld 16GB', price: '8.55', description: '16 GB RAM, 6 vCores, 40 GB SSD/NVMe — up to 32 players' },
      ],
    },
    related: ['pricing', 'server-requirements', 'rent-palworld-server', 'setup-guide', 'gportal-alternative', 'nitrado-alternative'],
  },

  pricing: {
    slug: '/pricing',
    published: '2026-07-04',
    title: 'Palworld Server Hosting Pricing & Plans',
    metaTitle: 'Palworld Server Hosting Pricing — Plans from $2.61/mo',
    description:
      'Palworld server hosting from $2.61/mo: 5GB, 8GB, 12GB and 16GB tiers for up to 32 players. DDoS protection included, first month free, deploy in 30 seconds.',
    h1: 'Palworld Server Hosting Pricing',
    lead:
      'Simple, transparent Palworld dedicated server pricing. Plans start at $2.61/month, every plan includes DDoS protection and full admin access, and new users get their first month free. Pick a tier by how many players you expect.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Pricing', url: '/pricing' },
    ],
    body: [
      { type: 'h2', text: 'Palworld hosting plans' },
      { type: 'p', text: 'Every plan is a full Palworld dedicated server with DDoS protection, a web dashboard, file manager, console access, and on-demand backups. The only difference between tiers is the RAM and CPU allocation, which determines how many players your server comfortably supports.' },
      { type: 'table', head: ['Plan', 'RAM', 'Players', 'Price'], rows: [
        ['Starter', '5GB', 'Up to 4', 'from $2.61/mo'],
        ['Standard', '8GB', 'Up to 8', 'from $4.38/mo'],
        ['Advanced', '12GB', 'Up to 16', 'from $6.11/mo'],
        ['Performance', '16GB', 'Up to 32', 'from $8.55/mo'],
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
      { type: 'p', text: 'Choose Starter (5GB) for a small co-op group, Standard (8GB) or Advanced (12GB) for an active mid-size group that builds a lot, and Performance (16GB) for a full 32-player community server on the 1.0 update. You can start small and move up later — see the Palworld dedicated server requirements guide if you are unsure how much RAM your group needs.', links: [{ text: 'Palworld dedicated server requirements', href: '/server-requirements' }] },
      { type: 'p', text: 'If you are still weighing whether to pay for hosting at all, the full cost breakdown — including what self-hosting works out to once electricity and a tied-up PC are counted — is on the Palworld server cost page. If you are comparing us against a traditional game host instead, we put the trade-offs side by side for GPORTAL vs Flux and for Nitrado vs Flux.', links: [
        { text: 'Palworld server cost', href: '/palworld-server-cost' },
        { text: 'GPORTAL vs Flux', href: '/gportal-alternative' },
        { text: 'Nitrado vs Flux', href: '/nitrado-alternative' },
      ] },
      { type: 'cta', text: 'How much does a Palworld server cost? →', href: '/palworld-server-cost' },
      { type: 'cta', text: 'Deploy your Palworld server — first month free →', href: '/#pricing' },
    ],
    faq: [
      { question: 'How much does Palworld server hosting cost?', answer: 'Plans start at $2.61/month for a 5GB server that runs up to 4 players and go to $8.55/month for a 16GB server that runs the full 32-player cap, with 8GB ($4.38) and 12GB ($6.11) tiers in between. Every plan includes DDoS protection, backups and unlimited bandwidth, and new accounts get the first month free.' },
      { question: 'Is there a setup fee or a minimum contract?', answer: 'No. There is no setup fee and no minimum term — billing is month to month and you can cancel at any time.' },
      { question: 'Which Palworld plan do I need?', answer: 'Size the plan by player count: 5GB for up to 4 players, 8GB for up to 8, 12GB for up to 16, and 16GB for a full 32-player server. Palworld uses more memory the longer a world runs, so pick the tier above your group if you expect long sessions or a lot of base building.' },
      { question: 'Can I change plan later?', answer: 'Yes. You can scale the server up or down from the dashboard as your group grows, without rebuilding the world.' },
      { question: 'How do I pay?', answer: 'Card, Apple Pay and Google Pay through Stripe, or in crypto with FLUX.' },
    ],
    product: {
      name: 'Palworld Dedicated Server Hosting',
      description: 'Managed Palworld dedicated server hosting on the Flux decentralized cloud. Up to 32 players, DDoS protection, 99.9% uptime, plans from $2.61/month with the first month free.',
      image: '/games/palworld/banner.webp',
      lowPrice: '2.61',
      highPrice: '8.55',
      offerCount: 4,
      plans: [
        { name: 'Palworld 5GB', price: '2.61', description: '5 GB RAM, 2 vCores, 30 GB SSD/NVMe — up to 4 players' },
        { name: 'Palworld 8GB', price: '4.38', description: '8 GB RAM, 3 vCores, 30 GB SSD/NVMe — up to 8 players' },
        { name: 'Palworld 12GB', price: '6.11', description: '12 GB RAM, 4 vCores, 35 GB SSD/NVMe — up to 16 players' },
        { name: 'Palworld 16GB', price: '8.55', description: '16 GB RAM, 6 vCores, 40 GB SSD/NVMe — up to 32 players' },
      ],
    },
    related: ['palworld-server-cost', 'setup-guide', 'server-requirements', 'server-settings', 'join-server', 'decentralized-palworld-hosting', 'rent-palworld-server', 'nitrado-alternative', 'gportal-alternative'],
  },

  'guides/join-server': {
    slug: '/guides/join-server',
    published: '2026-07-04',
    title: "How to Join a Friend's Palworld Server (incl. Crossplay)",
    metaTitle: "How to Join a Friend's Palworld Server (Crossplay Guide)",
    description:
      "Enter your friend's address as IP:8211 in Palworld's IP:Port field. Full steps for Steam and Xbox, plus why a server hides from the community list.",
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
      { type: 'p', text: 'The most reliable way to join a dedicated server is by its address. Ask the server owner for the IP and port — it looks like 203.0.113.10:8211, where 8211 is the default Palworld game port. If nobody in your group has one yet, you can rent a Palworld dedicated server and hand out the address in about 30 seconds.', links: [{ text: 'rent a Palworld dedicated server', href: '/rent-palworld-server' }] },
      { type: 'p', text: 'If you rented your server on Flux, you do not need a numeric IP: your server has a permanent address in the form yourserver.app.runonflux.io, and you connect using that address plus the game port — the same IP:Port field, just with a domain instead of raw numbers (for example palworld-yourname.app.runonflux.io:32871). You will find the full address, port included and ready to copy, on your dashboard.' },
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
    published: '2026-07-04',
    title: 'Best Palworld Server Settings (PalWorldSettings.ini)',
    metaTitle: 'Best Palworld Server Settings (PalWorldSettings.ini)',
    description:
      'Best Palworld server settings: XP rate, gather and damage multipliers, day length, PvP in PalWorldSettings.ini — plus tuned 32-player hosting from $2.61/mo.',
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
    related: ['setup-guide', 'join-server', 'server-requirements', 'pricing', 'guides/server-keeps-crashing'],
  },

  'decentralized-palworld-hosting': {
    slug: '/decentralized-palworld-hosting',
    published: '2026-07-04',
    title: 'Why Host Your Palworld Server on a Decentralized Cloud',
    metaTitle: 'Decentralized Palworld Server Hosting on Flux Cloud',
    description:
      'Decentralized Palworld hosting on Flux: no single point of failure, DDoS protection, 99.9% uptime. Deploy a 32-player server in 30s from $2.61/mo.',
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
        'Choose a plan sized to your group — 5GB RAM for small co-op groups up to 4 players, 8GB for up to 8, 12GB for up to 16, or 16GB for a full 32-player server.',
        'Pick a server region close to your players from 50+ countries to keep latency low.',
        'Click deploy. Your server is provisioned on the network, the game port opens, and it is online in about 30 seconds.',
        'Open the web dashboard to edit PalWorldSettings.ini, browse files, take backups, and use the console — no SSH or port forwarding required.',
      ] },

      { type: 'h2', text: 'Pay-as-you-go pricing' },
      { type: 'p', text: 'Billing matches the no-lock-in philosophy: month-to-month, no long-term contract, and no hidden setup fee. Plans start at $2.61/month for the 5GB Starter tier, with 8GB and 12GB tiers in between, up to $8.55/month for the 16GB Performance tier that runs a full 32-player world on the 1.0 update. New users get their first month free, so you can build a world and test performance before you pay. You can pay however you prefer — card, Apple Pay, and Google Pay through Stripe, or in crypto with FLUX — which fits the open, permissionless nature of the network.' },
      { type: 'cta', text: 'Deploy a Palworld server on Flux — first month free →', href: '/#pricing' },

      { type: 'h2', text: 'Who is decentralized hosting for?' },
      { type: 'p', text: 'A decentralized Palworld server is the right fit if you want a persistent world that stays online without tying up your own machine, full control over configuration and your save data, resilience that does not depend on one company\'s data center, and month-to-month billing you can walk away from at any time. It suits friends groups who want a world that keeps running while they are offline, community owners running a public 32-player server, and anyone who values owning their data and paying only for what they use — including with crypto.' },
      { type: 'p', text: 'Whichever route you take, the mechanics of running the server are the same: open UDP 8211, tune PalWorldSettings.ini for your group, and confirm crossplay if you mix Steam and Xbox/Game Pass players. Our guides on how to make a Palworld dedicated server and the best Palworld server settings apply no matter where you host.' },
    ],
    faq: [
      { question: 'What is a decentralized cloud for game hosting?', answer: 'Instead of running your server in one company\'s data center, a decentralized cloud spreads compute across thousands of independent nodes worldwide. Flux is one such network, with capacity in 50+ countries, so your Palworld server has no single point of failure and is not tied to one provider or region.' },
      { question: 'Is a decentralized Palworld server reliable?', answer: 'Yes. Because the network is spread across many independent nodes and regions, there is no single component whose failure takes your server down. Flux targets 99.9% uptime and includes DDoS protection on every plan, so a persistent world stays online 24/7.' },
      { question: 'Does decentralized hosting support 32 players, crossplay and mods?', answer: 'Yes. A Palworld server on Flux supports the full 32-player cap, can be configured for Steam and Xbox/Game Pass crossplay, and gives you full access to PalWorldSettings.ini and a file manager to change any setting or mod your world.' },
      { question: 'How do I pay for a decentralized Palworld server?', answer: 'Billing is month-to-month with no contract and the first month free. You can pay by card, Apple Pay, or Google Pay through Stripe, or in crypto with FLUX. Plans start at $2.61/month and scale to a full 32-player server.' },
      { question: 'What does no vendor lock-in actually mean?', answer: 'No long-term contract, no prepaid credit tied to one provider, and full access to your world save and config files so you can back them up or move them at any time. You rent capacity on an open network rather than signing into a walled garden, and you can cancel whenever you like.' },
    ],
    related: ['palworld-server-cost', 'pricing', 'setup-guide', 'server-requirements', 'server-settings', 'rent-palworld-server', 'nitrado-alternative', 'gportal-alternative'],
  },

  'nitrado-alternative': {
    slug: '/nitrado-alternative',
    published: '2026-07-08',
    title: 'Nitrado vs Flux for Palworld',
    metaTitle: 'Nitrado vs Flux for Palworld: Which Should You Pick?',
    description:
      'Nitrado vs Flux for a Palworld server: dedicated resources instead of shared slots, the full 32-player cap, DDoS included. From $2.61/mo, first month free.',
    h1: 'Nitrado vs Flux for a Palworld Server',
    lead:
      'Nitrado is one of the best-known Palworld hosts, and it is a capable provider. But like most traditional hosts it runs your server in a fixed set of company-owned data centers with a single point of failure, and its slot-based plans tie pricing to player count. Palworld on Flux takes a different approach — a decentralized cloud of independent nodes across 50+ countries, dedicated resources, and pay-as-you-go pricing.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Nitrado vs Flux', url: '/nitrado-alternative' },
    ],
    body: [
      { type: 'h2', text: 'Why look for a Nitrado alternative' },
      { type: 'p', text: 'Nitrado works well for many Palworld owners. The reasons players compare it against other hosts are usually structural rather than about any one feature:' },
      { type: 'ul', items: [
        'Single points of failure — a fixed set of data centers means an outage in one takes the servers there offline together.',
        'Slot-based pricing — paying per player slot can be less flexible than paying for the resources you actually use.',
        'Region distance — if the nearest region is far from your group, everyone feels the latency.',
        'Control and payment — some owners want full config access, no contract, and the option to pay in crypto as well as by card.',
      ] },
      { type: 'h2', text: 'How Palworld on Flux is different' },
      { type: 'p', text: 'Flux runs your Palworld dedicated server on a decentralized network of independent nodes with dedicated CPU, RAM and storage reserved for you, a 99.9% uptime target, and nodes in 50+ countries so you can host near your players. You get the full 32-player cap, Steam and Xbox/Game Pass crossplay, and complete access to PalWorldSettings.ini through a file manager. DDoS protection is included on every plan, there are no egress (bandwidth) fees, deployment takes about 30 seconds with UDP 8211 and the REST API (TCP 8212) already configured, and pricing is transparent pay-as-you-go from $2.61/mo with the first month free — pay by card, Apple Pay, Google Pay, or in crypto with FLUX, no contract.' },
      { type: 'h2', text: 'Palworld on Flux vs Nitrado at a glance' },
      { type: 'table', head: ['Feature', 'Traditional host', 'Palworld on Flux'], rows: [
        ['Infrastructure', 'Single company data centers', 'Decentralized cloud, 50+ countries'],
        ['Single point of failure', 'Yes', 'No — distributed nodes'],
        ['Dedicated resources', 'Plan-dependent', 'Dedicated CPU/RAM/storage per server'],
        ['Player slots', 'Sold in slot tiers', 'No slot limits — the game caps at 32'],
        ['Crossplay (Steam + Xbox)', 'Supported', 'Supported'],
        ['Config access', 'Panel', 'Full PalWorldSettings.ini + file manager'],
        ['DDoS protection', 'Varies by plan', 'Included on every plan'],
        ['Egress / bandwidth fees', 'Possible', 'None'],
        ['Deploy time', 'Minutes', 'About 30 seconds'],
        ['Payment', 'Card', 'Card, Apple/Google Pay, or crypto'],
        ['Pricing', 'Slot-based tiers', 'Pay-as-you-go from $2.61/mo, first month free'],
      ] },
      { type: 'h2', text: 'Which should you choose?' },
      { type: 'p', text: 'If you prefer a large legacy brand and slot-based plans in a single region, Nitrado is a fine option. If you want decentralized resilience with no single point of failure, multi-region hosting close to your players, no egress fees, full config control with no contract, and card-or-crypto payment, Palworld on Flux is designed for that. Your world is portable — download your save and PalWorldSettings.ini and move them across in minutes.' },
      { type: 'cta', text: 'Deploy a Palworld dedicated server on Flux →', href: '/#pricing' },
    ],
    faq: [
      { question: 'What is a good Nitrado alternative for Palworld?', answer: 'Palworld on Flux is a decentralized alternative: your server runs across 50+ countries with dedicated resources, the full 32-player cap, crossplay, included DDoS protection, and no egress fees — from $2.61/mo with the first month free.' },
      { question: 'Is Palworld on Flux cheaper than Nitrado?', answer: 'Flux uses pay-as-you-go pricing from $2.61/mo with the first month free, so you pay for the RAM and region you pick rather than a fixed slot tier. The exact cost depends on your configuration.' },
      { question: 'Can I move my Palworld server from Nitrado to Flux?', answer: 'Yes. Download your world save and PalWorldSettings.ini from your current host and upload them to Flux through the file manager. A Palworld world is not locked to any provider.' },
      { question: 'Does Flux support 32 players and crossplay like Nitrado?', answer: 'Yes. A Palworld server on Flux supports the full 32-player cap and can be configured for Steam and Xbox/Game Pass crossplay, with full access to every setting.' },
    ],
    related: ['palworld-server-cost', 'pricing', 'setup-guide', 'server-requirements', 'decentralized-palworld-hosting'],
  },

  'gportal-alternative': {
    slug: '/gportal-alternative',
    published: '2026-07-08',
    // Deliberately NOT the same page as /nitrado-alternative. Both came off one template and
    // measured 70% identical on visible text, which is a near-duplicate pair competing with
    // each other for the same reader. This one is about infrastructure: where the machine
    // sits, what holds the save, and how far the player is from it. The Nitrado page is about
    // ownership and portability. House rules unchanged: no competitor prices, no claims about
    // their features, the comparison is between hosting models.
    title: 'GPORTAL vs Flux for Palworld',
    metaTitle: 'GPORTAL vs Flux for Palworld: Which Should You Pick?',
    description:
      'GPORTAL vs Flux for a Palworld server: what each does well, how region choice and dedicated resources differ, and when GPORTAL is the better pick. $2.61/mo.',
    h1: 'GPORTAL vs Flux for a Palworld Server',
    lead:
      'GPORTAL is a capable host and a common first stop for a Palworld world. People who go looking for an alternative are usually not unhappy with the panel. They are asking an infrastructure question: where does the server actually run, and what happens to the save if that machine has a bad day.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'GPORTAL vs Flux', url: '/gportal-alternative' },
    ],
    body: [
      { type: 'h2', text: 'What GPORTAL does well' },
      { type: 'p', text: 'GPORTAL is a large, established host with a polished control panel and a very broad game catalogue. If you run several different games and would rather keep them under one vendor and one invoice, that breadth is worth something real, and no comparison page should pretend otherwise.' },

      { type: 'h2', text: 'Four infrastructure questions' },
      { type: 'p', text: 'Ask these of any host, including this one. They are the answers that stop mattering the day everything works and start mattering enormously on the day something does not.' },
      { type: 'h3', text: 'Where does the machine sit, and can I change it?' },
      { type: 'p', text: 'A traditional host runs a fixed estate of data centres and you pick from that list. Flux is a network of independent nodes in more than 50 countries, and the region is a field on the deploy form. If your group drifts from EU evenings to NA evenings, you move the server from the dashboard rather than opening a ticket to migrate between facilities.' },
      { type: 'h3', text: 'What actually holds the world save?' },
      { type: 'p', text: 'A Palworld world is a save directory and a settings file, and losing it is the one failure a group does not forgive. On a single-machine plan your protection is whatever backup you last took. Worth asking any host how often it snapshots, how far back it keeps them, and whether you can pull one down yourself without asking.' },
      { type: 'h3', text: 'How many machines does the app run on?' },
      { type: 'p', text: 'On Flux the app is placed across independent nodes rather than living on one box in one rack, so losing a machine is not the same event as losing the deployment. Neither model removes the need for your own backups, but the two fail very differently.' },
      { type: 'h3', text: 'What is the price attached to?' },
      { type: 'p', text: 'Slot-based pricing is a proxy for resources and a reasonable one, until two hosts quote the same slot count on very different hardware. Flux prices the CPU, RAM and disk and tells you what the player figure assumes. Whichever model a host uses, compare the specification behind the number rather than the number.' },

      { type: 'h2', text: 'Latency is a distance problem' },
      { type: 'p', text: 'Palworld is co-op rather than competitive, so a hundred milliseconds will not lose you a match. It will still decide whether capturing a Pal in a fight feels crisp or soupy, and whether base building at a distance stutters. Ping is set by how far the player sits from the node, which is why the region you deploy in matters more than most specification sheets suggest.' },
      { type: 'p', text: 'That is also why the dashboard reports two different numbers rather than one. Our monitoring server measures whether your server is answering, which is a health check. Separately, your browser measures its own round trip to the node your server runs on, which is the figure that actually resembles what your group feels.' },

      { type: 'h2', text: 'What a Palworld plan on Flux includes' },
      { type: 'ul', items: [
        'Dedicated CPU, RAM and storage reserved for your server rather than a shared slot.',
        'The full 32-player cap, with Steam and Xbox or Game Pass crossplay configurable.',
        'Complete access to PalWorldSettings.ini through the file manager, plus a web terminal.',
        'UDP 8211 and the REST API on TCP 8212 published at deploy, so there is no forwarding to get wrong.',
        'DDoS protection on every plan and no egress fees.',
        'A region you choose at deploy from more than 50 countries, changeable later.',
      ] },
      { type: 'p', text: 'Pricing is pay-as-you-go from $2.61 a month with the first month free for accounts new to Flux Cloud, billed monthly with no contract. Card, Apple Pay, Google Pay or FLUX.' },

      { type: 'h2', text: 'When GPORTAL is the better choice' },
      { type: 'p', text: 'If you want a heavily productized panel, a single vendor across many different games, or the reassurance of a brand your group already recognises, GPORTAL is a sound answer. Flux fits better when you want the region under your control, the deployment spread across independent machines, the settings file genuinely yours to edit, and no contract underneath any of it. Those are the trade-offs, stated plainly.' },
      { type: 'cta', text: 'Deploy a Palworld dedicated server on Flux →', href: '/#pricing' },
    ],
    faq: [
      { question: 'What is a good GPORTAL alternative for Palworld?', answer: 'Palworld on Flux is a decentralized one: your server runs on independent nodes across more than 50 countries with dedicated resources, the full 32-player cap, crossplay, included DDoS protection and no egress fees. Plans start at $2.61 a month with the first month free.' },
      { question: 'Can I choose which country my Palworld server runs in?', answer: 'Yes, at deploy time, from more than 50 countries, and you can change region later from the dashboard. Because ping is decided by distance, that choice matters more than most specification sheets suggest.' },
      { question: 'What happens to my world if a machine fails?', answer: 'The app is placed across independent nodes rather than living on one box in one rack, so losing a machine is not the same event as losing the deployment. Take your own backups regardless: the save directory and PalWorldSettings.ini are both downloadable from the file manager.' },
      { question: 'Can I move my Palworld server from GPORTAL to Flux?', answer: 'Yes. Download your world save and PalWorldSettings.ini from your current host and upload them through the file manager. A Palworld world is a save directory and a settings file, so it is not locked to any provider.' },
      { question: 'Does decentralized hosting mean higher ping?', answer: 'No. Your server runs on one specific node with its own CPU and RAM exactly as it would in a data centre. What is distributed is where those nodes are and how the deployment is spread between them. Latency is decided by the node you pick, and the dashboard measures it from your own browser rather than from our monitoring server.' },
    ],
    related: ['palworld-server-cost', 'nitrado-alternative', 'pricing', 'setup-guide', 'server-requirements', 'decentralized-palworld-hosting'],
  },

  'guides/server-keeps-crashing': {
    slug: '/guides/server-keeps-crashing',
    published: '2026-08-22',
    title: 'Palworld server keeps crashing',
    metaTitle: 'Palworld Server Keeps Crashing? Fix It and Stay Online',
    description:
      'Why a Palworld server crashes or goes unreachable while the process is still running, how to tell the failure modes apart, and how to keep one online 24/7.',
    h1: 'Palworld Server Keeps Crashing: How to Diagnose and Fix It',
    lead:
      'A Palworld dedicated server that runs fine for two hours and then freezes, rubber-bands and dies is almost never a bad host or a bad plan. It is the dedicated server binary leaking memory until the machine runs out of it. But there are two other failures that are worse, because the server does not crash at all — it keeps running while nobody can play, and every monitoring signal a host can see says it is fine. This guide covers all three: how to tell them apart, what to change so they stop, and what it takes to keep a Palworld server online around the clock.',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Guides', url: '/#guides' },
      { name: 'Server keeps crashing', url: '/guides/server-keeps-crashing' },
    ],
    body: [
      { type: 'h2', text: 'The short version' },
      { type: 'p', text: 'Palworld has a long-standing memory leak in its dedicated server build. RAM usage climbs steadily for as long as the server is up, roughly in proportion to how many players are online and how many Pals exist in the world, and it is never released. Eventually the process exhausts the RAM it was given and the operating system kills it. From the outside that looks like a random crash, which is why so many people blame their host first.' },
      { type: 'p', text: 'Server operators report the shape of it consistently: a four-player world with around 80 Pals typically grows from about 3 GB to over 8 GB inside four hours, and a busy 16-player community server can reach 12 GB in half an hour. Those numbers vary with your world, but the pattern does not. If your crashes arrive on a rough schedule rather than at random, that is the leak.' },

      { type: 'h2', text: 'The two failures that do not look like a crash' },
      { type: 'p', text: 'A crash is the easy case: the process dies, and anything watching it notices. The two failures that generate the most confused support tickets leave the process alive and every health check passing. We diagnosed both from 22 hours of one-minute samples off a customer\'s 16GB server, and they look like this:' },
      { type: 'table', head: ['What you see', 'What is actually happening'], rows: [
        ['Nobody can join. The server shows as online everywhere, including your dashboard.', 'The server has stalled. It stops draining its own network socket — the receive queue fills and sticks, inbound packets drop to zero, and the admin API stops answering. The process is alive the whole time. Only a restart clears it.'],
        ['Players connect and get a black screen. The server answers, the port is open, but there is no world.', 'The world has unloaded. Memory drops by over a gigabyte in a single sample, the server\'s own uptime counter restarts from zero, and it stops reporting a world — with the same process throughout. It never recovers on its own.'],
      ] },
      { type: 'p', text: 'Neither of these is the memory leak. The world-unload failure happened three times in two hours on a server using under 2.3GB, so it is not the leak and not the RAM limit. What makes them expensive is that the usual health check — is the game process running — passes in both states, so nothing restarts the server and it can sit there dead for hours while you are asleep.' },

      { type: 'h2', text: 'Confirm it is memory before you change anything' },
      { type: 'p', text: 'Open the resource graph in your dashboard and watch RAM across a session. The memory leak has a signature that is hard to mistake:' },
      { type: 'ul', items: [
        'RAM climbs in a near-straight line from the moment the server starts and never drops back after players leave.',
        'The crash happens when that line reaches the ceiling of your plan, not at a particular in-game event.',
        'There is no useful crash message. The process simply disappears, because the operating system killed it rather than the game choosing to exit.',
        'Restarting the server fixes it completely, for another few hours.',
      ] },
      { type: 'p', text: 'If instead your server dies at the same moment every single time, or fails within seconds of starting, skip to the last section. Those are different problems with different fixes.' },

      { type: 'h2', text: 'Fix 1: restart on a schedule' },
      { type: 'p', text: 'This is the unglamorous answer and it is also the effective one. Because the leak is linear and a restart clears all of it, a scheduled restart resets the clock before the ceiling is ever reached. Experienced operators typically restart every three to six hours on a busy public server, and once or twice a day on a small private one.' },
      { type: 'p', text: 'A Palworld restart takes about a minute and the world is saved first, so the cost to players is small. Pick a slot when your group is usually offline, announce it in Discord, and the problem stops being a problem. On Flux you can restart from the dashboard in one click, and because a restart also picks up any pending game update it doubles as your patch routine.' },
      { type: 'p', text: 'One trap worth knowing about if you self-host or use another provider: the scheduled restart script in the standard Palworld server image asks the server to save first, and refuses to shut down if that save fails. On a server that is leaking, frozen or worldless — which is to say, the only kind of server a nightly restart exists for — the save is exactly what fails. So the restart silently does nothing on precisely the nights it was needed, and the logs show it as having run. Check that yours actually restarted rather than assuming it did.' },

      { type: 'h2', text: 'Fix 2: disable Pal invaders' },
      { type: 'p', text: 'Raids spawn waves of hostile Pals that the server keeps in memory long after the raid is over. Turning them off is the closest thing Palworld has to a community-agreed workaround for the leak, and operators consistently report RAM climbing at roughly half the previous rate afterwards.' },
      { type: 'p', text: 'In PalWorldSettings.ini set bEnableInvaderEnemy=False and restart. You lose base raids, which some groups will miss and many will not, and in exchange you roughly double the time between restarts. Edit the file from the dashboard config editor; there is no need to open a terminal.' },

      { type: 'h2', text: 'Fix 3: cap the things that grow' },
      { type: 'p', text: 'The leak scales with how much world there is to hold in memory, so limiting how much your players can create slows it down. Two settings do most of the work:' },
      { type: 'table', head: ['Setting', 'What it limits', 'Practical value'], rows: [
        ['BaseCampWorkerMaxNum', 'Pals assigned to a single base', 'Up to 50 is the game maximum; 15 to 20 is plenty for most bases'],
        ['BaseCampMaxNum', 'Total bases across the whole server', 'Scale it to your player count rather than leaving it wide open'],
        ['bEnableInvaderEnemy', 'Raid spawns held in memory', 'False on any server that crashes'],
      ] },
      { type: 'p', text: 'A guild that has parked 50 working Pals in each of several bases is holding a large amount of persistent simulation in RAM, and every one of those Pals contributes to the leak. Capping worker counts is not just a memory fix either: it is the single biggest lever on server CPU load in Palworld, so it usually improves lag at the same time.' },

      { type: 'h2', text: 'Fix 4: give it headroom' },
      { type: 'p', text: 'None of the above stops the leak, they only slow it. The remaining variable is how much room the server has before it hits the ceiling, and that is your plan size. If you are running 16 players on 8 GB you are asking the leak to kill you inside an hour no matter how well you configure the world.' },
      { type: 'table', head: ['Players', 'Recommended RAM', 'Plan'], rows: [
        ['Up to 4', '5 GB', 'from $2.61/mo'],
        ['Up to 8', '8 GB', 'from $4.38/mo'],
        ['Up to 16', '12 GB', 'from $6.11/mo'],
        ['Up to 32', '16 GB', 'from $8.55/mo'],
      ] },
      { type: 'p', text: 'Those tiers already assume a leaking server rather than a theoretical idle one. If you are crashing on the tier that matches your player count, the usual cause is a very built-up world, and the two settings above will do more for you than the next plan up. If you are one tier below your player count, move up. Scaling RAM on Flux does not touch your world save.' },
      { type: 'cta', text: 'See Palworld plans by player count →', href: '/pricing' },

      { type: 'h2', text: 'How to keep a Palworld server online 24/7' },
      { type: 'p', text: 'Everything above slows the failures down. None of it makes a server that has already failed come back, and that is the difference between a server that is up most of the time and one that is up all of the time. Something has to notice and act while you are asleep.' },
      { type: 'p', text: 'That is the gap our Palworld server image closes, and it is why we build our own rather than shipping the standard one. It checks the server every minute, from inside the container, on the things a player would actually notice: whether the network socket is draining, whether the admin API answers, whether the world is loaded and ticking, and whether the save file is still on disk. If the answer is no it restarts the server. There is nothing to enable and no setting to find.' },
      { type: 'p', text: 'The restraint matters as much as the trigger, because a monitor that restarts healthy servers is worse than none:' },
      { type: 'ul', items: [
        'It needs the same verdict three times in a row, a minute apart, before it acts — one bad sample is not a fault.',
        'It never acts on a server it has not yet seen working, and never during the first minutes after boot. Loading a large world takes time, and a restart loop does not help a server that came up broken.',
        'It announces the restart in game and counts down 60 seconds, with reminders at 30 and 10 seconds, then takes one last sample. A server that recovered during the countdown is left alone and the countdown is called off out loud.',
        'It never saves. In every state that gets it this far the world in memory is already gone or frozen, and asking a broken server to save risks writing that emptiness over your last good save. What a restart costs you is the minutes since the last autosave — which were already lost when the fault happened.',
      ] },
      { type: 'p', text: 'The nightly restart on this image is fixed too. It warns your players, saves only if the world is still loaded and actually ticking, asks the server to shut down, and then stops asking — after a grace period it ends the process, and a fresh server is up seconds later. It never silently skips.' },
      { type: 'p', text: 'One thing worth doing yourself: set an admin password in the Server Settings tab. The socket and save-file checks work regardless, but the checks that catch an unloaded world talk to the server\'s admin API, and a server with no password set refuses those calls. We deliberately never treat a rejected call as a dead server — doing so would restart healthy worlds every few minutes — so the effect of leaving it blank is quieter protection, not louder.' },
      { type: 'cta', text: 'See Palworld plans →', href: '/pricing' },

      { type: 'h2', text: 'When it is not the memory leak' },
      { type: 'h3', text: 'It crashes seconds after starting, right after a game update' },
      { type: 'p', text: 'Pocketpair ships client and server updates together, and a server still on the previous build will refuse connections or fall over as soon as an updated client joins. Update the server as soon as the client patch lands rather than waiting for a report from your players. On Flux a restart pulls the current image, so this is one click.' },
      { type: 'h3', text: 'It crashes at the same point every time' },
      { type: 'p', text: 'A crash that reproduces exactly, for instance whenever a specific player logs in or whenever the world reaches a particular area, points at a corrupted save rather than at memory. Restore the most recent backup taken before the behaviour started. Keep backups on a schedule for exactly this reason: a save you cannot roll back is a save you can lose.' },
      { type: 'h3', text: 'It never starts at all' },
      { type: 'p', text: 'If the server has never come up, this is a configuration or port problem and not a crash. Check that UDP 8211 is the port your players are dialling and that PalWorldSettings.ini is valid, since one malformed line will stop the file being read. The setup guide walks through both.' },

      { type: 'h2', text: 'A checklist you can work through' },
      { type: 'ol', items: [
        'Work out which failure you have. A straight climb in RAM to the ceiling is the leak. Online but unjoinable is a stall. Joinable but no world is an unloaded world. They need different answers.',
        'Set bEnableInvaderEnemy=False in PalWorldSettings.ini and restart.',
        'Cap BaseCampWorkerMaxNum to something sane for your group, and cap BaseCampMaxNum to your player count.',
        'Schedule a restart every three to six hours on a busy server, or daily on a private one.',
        'Confirm your plan RAM matches your player count, and move up a tier if it does not.',
        'Keep automatic backups on, so a corrupted save is an inconvenience and not the end of the world.',
        'Set an admin password, so the checks that catch an unloaded world can reach your server.',
        'Make sure something restarts the server when it stops responding, not only when it dies. On Flux that is built into the server image.',
      ] },
      { type: 'p', text: 'Work through it in that order and the great majority of Palworld crash reports stop. What remains is a game engine limitation nobody can patch for you — so the question stops being how to prevent every failure and becomes how quickly the server comes back from one.' },
      { type: 'cta', text: 'Deploy a Palworld server with one-click restarts and backups →', href: '/#pricing' },
    ],
    faq: [
      { question: 'Why does my Palworld dedicated server keep crashing?', answer: 'In almost all cases it is the memory leak in the Palworld dedicated server build. RAM usage climbs steadily with player count and Pal count and is never released, so the process is eventually killed for running out of memory. Crashes that arrive after a predictable number of hours, with no error message and a clean start after a restart, are this and not a hosting fault.' },
      { question: 'How much RAM does a Palworld server actually use?', answer: 'Far more over time than at startup. A four-player world with around 80 Pals commonly grows from about 3 GB to over 8 GB in four hours, and a 16-player server can reach 12 GB within half an hour. Size your plan for where the server ends up rather than where it starts.' },
      { question: 'How often should I restart a Palworld server?', answer: 'Every three to six hours on a busy public server, and once or twice a day on a small private one. A restart clears all leaked memory and takes about a minute, with the world saved first, so it is the single most effective thing you can do about crashes.' },
      { question: 'Does disabling invaders really help the memory leak?', answer: 'Yes. Raid spawns are held in memory after the raid ends, and operators consistently report RAM climbing at roughly half the previous rate with bEnableInvaderEnemy=False. It is not an official fix, because there is no official fix, but it is the most reliable single setting change available.' },
      { question: 'Will a bigger plan stop my Palworld server crashing?', answer: 'It buys time rather than fixing the leak. More RAM means longer before the ceiling is reached, which for many groups is enough to get through an evening. If you are already on the plan that matches your player count, capping base workers and disabling invaders will do more than another tier.' },
      { question: 'My server crashes immediately after a Palworld update. Is that the leak?', answer: 'No. That is a version mismatch: the server is still on the previous build while the clients have updated. Update the server as soon as the client patch lands. On Flux a restart pulls the current image, so it is one click from the dashboard.' },
      { question: 'How do I keep my Palworld server always online?', answer: 'Three things together: cap what grows in the world and disable invaders to slow the memory leak, schedule a restart so the leak never reaches the ceiling, and make sure something restarts the server when it stops responding rather than only when it dies. That last one is the gap most setups have, because the usual health check only asks whether the game process is running — which stays true when a Palworld server stalls or loses its world. Our server image checks the socket, the admin API, the world and the save file every minute and restarts the server when they say it has stopped serving.' },
      { question: 'Why does my Palworld server show as online when nobody can join?', answer: 'The server has stalled. It stops draining its network socket, so the receive queue fills, inbound packets stop arriving and the admin API goes quiet — but the process is still alive, so anything that checks whether the game is running reports it as healthy. Only a restart clears it.' },
      { question: 'Why do players connect to my Palworld server and get a black screen?', answer: 'The world has unloaded. The server keeps answering and the port stays open, but there is no longer a world behind it — memory drops sharply, the uptime counter restarts from zero, and it stops reporting a loaded world, all with the same process. It does not recover on its own and needs a restart.' },
      { question: 'Does a scheduled restart always work?', answer: 'Not in the standard Palworld server image. Its restart script saves the world first and refuses to shut down if that save fails — and on a server that is frozen, leaking or worldless the save is exactly what fails, so the restart silently does nothing on the nights it matters. Ours saves only when the world is still ticking, and restarts regardless.' },
      { question: 'Can a corrupted save cause Palworld server crashes?', answer: 'Yes, and it looks different from the leak. Save corruption crashes reproduce exactly, for instance whenever one particular player joins or whenever a certain area loads, rather than after a number of hours. Restore the most recent backup taken before the behaviour started.' },
    ],
    related: ['server-requirements', 'guides/server-settings', 'setup-guide', 'pricing', 'guides/join-server'],
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
  'rent-palworld-server': 'Rent a Palworld dedicated server',
  'setup-guide': 'How to make a Palworld dedicated server',
  'server-requirements': 'Palworld dedicated server requirements',
  pricing: 'Palworld server hosting pricing',
  'palworld-server-cost': 'How much does a Palworld dedicated server cost?',
  'guides/join-server': "How to join a friend's Palworld server",
  'guides/server-settings': 'Best Palworld server settings',
  'join-server': "How to join a friend's Palworld server",
  'server-settings': 'Best Palworld server settings',
  'decentralized-palworld-hosting': 'Why host on the Flux decentralized cloud',
  'nitrado-alternative': 'Nitrado vs Flux for Palworld',
  'gportal-alternative': 'GPORTAL vs Flux for Palworld',
  'guides/server-keeps-crashing': 'Palworld server keeps crashing: memory leak fix',
  'server-keeps-crashing': 'Palworld server keeps crashing: memory leak fix',
};

// Map short related keys to full page keys.
const relatedKeyMap = {
  'join-server': 'guides/join-server',
  'server-settings': 'guides/server-settings',
  'server-keeps-crashing': 'guides/server-keeps-crashing',
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

/**
 * Article schema for a content page.
 *
 * Nothing emitted one before, so none of these pages carried any signal of when they were
 * written or last touched — on a set that includes a page titled "(2026 Guide)".
 *
 * `published` is stated per page in this file rather than derived from git, because .git is
 * in .dockerignore and the release build has no history to read. It came from the commit
 * that introduced each page; update it only if a page is genuinely rewritten.
 *
 * `dateModified` is passed in by scripts/prerender.mjs as the build timestamp: a release
 * rebuilds every shell from the current source, so that is the honest claim. It is a
 * parameter rather than a default so this builder stays pure — React renders the other
 * schemas into the SSR body, and a value that differed between server and browser would be
 * a hydration mismatch.
 */
export function buildArticleSchema(page, dateModified) {
  if (!page.published) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.title,
    description: page.description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}${page.slug}` },
    url: `${SITE}${page.slug}`,
    inLanguage: 'en',
    datePublished: page.published,
    ...(dateModified ? { dateModified } : {}),
    author: { '@type': 'Organization', name: 'Palworld on Flux', url: `${SITE}/` },
    publisher: {
      '@type': 'Organization',
      name: 'Palworld on Flux',
      url: `${SITE}/`,
      logo: { '@type': 'ImageObject', url: `${SITE}/games/palworld/logo.webp` },
    },
  };
}

// Typed as Service (not Product) so Google doesn't apply Product Snippet rating
// requirements or Merchant Listings validation — neither applies to a hosted service.
export function buildProductSchema(page) {
  if (!page.product) return null;
  const p = page.product;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: p.name,
    description: p.description,
    serviceType: 'Palworld Server Hosting',
    image: `${SITE}${p.image}`,
    brand: { '@type': 'Brand', name: 'Palworld on Flux' },
    provider: { '@type': 'Organization', name: 'Palworld on Flux', url: `${SITE}/` },
    areaServed: 'Worldwide',
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

  // Individual plan Offers, when the page lists them. Attached as an OfferCatalog
  // rather than replacing the AggregateOffer above: schema.org allows a Service only
  // one `offers` value, and the price *range* is what the pricing pages are about.
  // This does not produce a merchant rich result (those are Product-only) — it exists
  // so the per-tier prices are machine-readable to answer engines rather than being
  // locked inside a <table>.
  if (Array.isArray(p.plans) && p.plans.length) {
    schema.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: `${p.name} plans`,
      itemListElement: p.plans.map((plan, i) => ({
        '@type': 'Offer',
        position: i + 1,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: `${SITE}${page.slug}`,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: plan.price,
          priceCurrency: 'USD',
          unitCode: 'MON',
          billingDuration: 1,
        },
      })),
    };
  }

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

// Page-specific JSON-LD, rendered by <SEO schemas={...}> inside the React tree and
// therefore present in the server-rendered body. BreadcrumbList is deliberately NOT
// here: <SEO> already builds it from the `breadcrumbs` prop, and emitting it twice
// would give every content page two BreadcrumbList entities.
export function buildPageSchemas(page) {
  return [
    buildHowToSchema(page),
    buildFaqSchema(page),
    buildProductSchema(page),
  ].filter(Boolean);
}
