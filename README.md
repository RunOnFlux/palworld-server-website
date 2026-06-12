# Universal Game Server Hosting Website

A universal, reusable game server hosting platform powered by **Flux Decentralized Cloud**. Built with React, designed to be easily adapted for any game (Minecraft, Rust, ARK, etc.) by simply changing configuration and assets.

🏢 **Owned by:** InFlux Technologies
⚡ **Powered by:** [Flux](https://runonflux.io)

---

## 🌟 Features

### Security & Privacy
- 🔐 **Non-extractable encryption keys** (Web Crypto API + IndexedDB)
- 🔒 **AES-GCM 256-bit encryption** for secure storage
- 🛡️ **Binary encrypted storage** - maximum client-side security
- 🍪 **GDPR-compliant cookie consent** for analytics
- 🔄 **Sticky backend routing** for Flux API load balancing

### Authentication
- 📧 **Firebase Email Authentication**
- 🔑 **Google OAuth** (Firebase)
- 🔐 **Secure session management** with auto-logout
- ⏱️ **Session timeout warnings** (configurable)

### Payments
- 💳 **Stripe Checkout** - one-time fiat payments via Flux bridge
- 🔄 **Stripe Subscriptions** - auto-renewal with subscription management
- 💰 **Crypto Payments** - FLUX payments via ZelCore and SSP Wallet
- 🧾 **Billing Portal** - Stripe billing management for subscriptions

### Global Server Network
- 🌍 **Interactive world map** - SVG map with country-level node clusters
- 🔍 **Click-to-zoom** - drill into countries to see city-level distribution
- 🏳️ **Country carousel** - auto-scrolling flags with server counts
- 📊 **Live stats** - animated counters for nodes and countries
- 🖱️ **Drag-to-pan** - interactive map navigation
- 💾 **Smart caching** - localStorage with 30min TTL, stale fallback

### Server Management Dashboard
- 🎮 **Multi-server management** - deploy and manage multiple game servers
- 📊 **Real-time stats** - CPU, RAM, Disk usage with segmented bars and live indicator
- 🖥️ **Integrated terminal** - full bash console access with xterm.js
- 📁 **File browser** - upload, download, edit, delete files with Monaco Editor
- 💾 **Backup & Restore** - Full server backup and restore functionality
- 🔄 **Multi-location support** - automatic master node detection via DNS
- 📱 **Real-time server status** - online/offline detection
- 💳 **Billing management** - renewal, auto-renewal toggle, crypto & fiat payments
- ⏰ **Expiration countdown** - LCD-style timer for server expiry
- 🗑️ **Server deletion** - with confirmation dialog and subscription cancellation
- 🌐 **FDM domain access** - domain verification before server management

### Developer Experience
- 🎨 **Fully responsive** - mobile-optimized across all pages
- ♿ **Accessible** - WAI-ARIA, prefers-reduced-motion, cursor-pointer on all interactive elements
- 🎬 **Animated** - smooth transitions with Framer Motion
- 🔍 **SEO optimized** - meta tags, Open Graph, JSON-LD structured data
- 📦 **Code splitting** - optimized bundle sizes with lazy loading
- 🚀 **Fast** - Vite build system with HMR, 3.3 MB total bundle
- 🖼️ **Image optimization** - WebP format with Sharp scripts, 79% size reduction
- 🌐 **Universal** - easily adaptable for any game

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase project with Authentication enabled
- Flux account (google or email login)
- Access to Flux Jetpack Bridge API

### Installation

```bash
# Clone repository
git clone <repository-url>
cd game-server-website

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration (see Environment Setup below)
nano .env

# Run development server
npm run dev
```

The app will open at: **http://localhost:4000**

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview

# Output is in /dist directory
```

### Image Optimization

The project includes a Sharp-based optimization script for converting images to WebP:

```bash
# Optimize all images
node scripts/optimize-images.js
```

This script automatically converts PNG/JPG images to WebP format with optimal quality settings:
- **Logo**: 512x512px @ 90% quality
- **Banner**: 1200x630px @ 85% quality (Open Graph standard)
- **Feature icons**: 256x256px @ 75% quality (batch conversion)
- **UI elements**: Optimized for display size and quality

**Results:** ~90-95% size reduction, ~9.5 MB saved

---

## ⚙️ Environment Setup

Create a `.env` file in the project root:

```bash
# App Configuration
VITE_APP_URL=http://localhost:4000

# Google Analytics (Optional)
VITE_ENABLE_ANALYTICS=false
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Production Environment

For production deployment, update:

```bash
VITE_APP_URL=https://your-production-domain.com
VITE_ENABLE_ANALYTICS=true
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## 🔥 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add a web app to your project

### 2. Enable Authentication

1. Navigate to **Authentication** → **Sign-in method**
2. Enable **Email/Password** authentication
3. Enable **Google** authentication
4. Add authorized domains: `localhost`, `your-domain.com`

### 3. Configure Firebase

Firebase config is hardcoded in `src/utils/firebase.js`. Update the config object with your project credentials:

```javascript
const firebaseConfig = {
  apiKey: "your_api_key_here",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
  measurementId: "G-XXXXXXXXXX"
};
```

### 4. Security Rules (Optional)

Set up Firestore security rules if using Firestore for data storage.

---

## 🎮 Adapting for Another Game

This website template can be adapted for any game. Only game-specific content changes - **payment API and backend integration stay the same**.

### Example: Converting from Minecraft to Rust

**1. Update Game Content** (`src/config/gameConfig.js`)

Change game-specific information like name, description, features, and FAQ:

```javascript
export const gameConfig = {
  // Game Info
  gameName: "Rust",
  gameType: "rust",
  serverName: "FluxRust Network",
  tagline: "Survive on the Decentralized Cloud",
  description: "High-performance Rust servers on decentralized infrastructure",

  // Assets (place in public/games/rust/)
  assets: {
    logo: "/games/rust/logo.webp",
    banner: "/games/rust/banner.webp",
    background: "/games/rust/background.jpg",
    favicon: "/games/rust/favicon.ico"
  },

  // Game-specific features (displayed on landing page)
  features: [
    {
      title: "PvP Combat",
      icon: "⚔️",
      description: "Intense player vs player combat with no rules"
    },
    {
      title: "Base Building",
      icon: "🏗️",
      description: "Construct and defend your base from raiders"
    }
    // ... add more game features
  ],

  // Platform features stay the same (Flux hosting features)
  platformFeatures: [
    // Keep these - they describe Flux platform, not game-specific features
  ],

  // Game-specific FAQ
  faq: [
    {
      question: "What is the server wipe schedule?",
      answer: "Servers wipe monthly on the first Thursday..."
    }
    // ... add more FAQ items
  ],

  // Update social links, rules, connection info as needed
}
```

**2. Update Theme Colors** (`src/config/themeConfig.js`)

Change the color scheme to match your game's branding:

```javascript
export const theme = {
  colors: {
    primary: "#CE422B",        // Rust red/orange
    primaryHover: "#b33823",
    primaryLight: "#e6502f",
    primaryDark: "#9a2f1f",

    secondary: "#8B4513",      // Brown
    accent: "#D2691E",         // Copper

    // Keep other colors or adjust as needed
  }
  // Other theme properties stay the same unless you want custom styling
}
```

**3. Environment Variables** (`.env`)

Update `.env` file with your game's website URL:

```bash
# Local development
VITE_APP_URL=http://localhost:4000

# Google Analytics (optional)
VITE_ENABLE_ANALYTICS=false
VITE_GA_MEASUREMENT_ID=
```

**For production:** Set these in your hosting platform dashboard with production values (e.g., `VITE_APP_URL=https://yourgame.com`).

**4. Update Deployment UI Parameter Descriptions**

Environment parameters come from your plan API, but help text must be updated in `src/components/dashboard/deployment-steps/StepEnvironment.jsx`:

```javascript
const PARAMETER_DESCRIPTIONS = {
  // These descriptions appear with info icon (ℹ️) below each parameter in deployment UI
  SERVER_NAME: 'The name displayed in your Rust server browser',
  SEED: 'World generation seed for reproducible maps',
  MAP_SIZE: 'Map size in meters (2000-6000). Larger maps require more RAM',
  // Remove Minecraft descriptions, add your game's parameters
};
```

Shown below each input field during server deployment with info icon.

**5. Replace Assets**

Create folder `public/games/rust/` with your game images:

```
public/games/rust/
├── logo.png          → Convert to logo.webp (512x512px)
├── banner.png        → Convert to banner.webp (1200x630px, for SEO)
├── timer.png         → Convert to timer.webp (512x512px, for session timer)
├── login.png         → Convert to no-servers.webp (512x512px, dashboard empty state)
├── background.jpg    → Background image (optimized by Vite)
├── favicon.ico       → Browser favicon (32x32px, keep as .ico)
└── features/
    └── *.png         → Convert to *.webp (256x256px, platform feature icons)
```

**Image Optimization:**

1. Add your PNG images to `public/games/rust/`
2. Update `scripts/optimize-images.js` with your game paths:

```javascript
const optimizations = [
  {
    name: 'Logo',
    input: 'public/games/rust/logo.png',
    output: 'public/games/rust/logo.webp',
    width: 512, height: 512, quality: 90, fit: 'contain'
  },
  {
    name: 'Banner',
    input: 'public/games/rust/banner.png',
    output: 'public/games/rust/banner.webp',
    width: 1200, height: 630, quality: 85, fit: 'cover'
  },
  {
    name: 'Timer',
    input: 'public/games/rust/timer.png',
    output: 'public/games/rust/timer.webp',
    width: 512, height: 512, quality: 95, fit: 'contain'
  },
  {
    name: 'No-servers',
    input: 'public/games/rust/login.png',
    output: 'public/games/rust/no-servers.webp',
    width: 512, height: 512, quality: 90, fit: 'contain'
  }
];

// Feature icons array - update icon names
const featureIcons = [
  'deployment-icon', 'ddos-shield', 'decentralized-nodes',
  'global-network', 'monitoring-chart', 'payment-icon',
  'uptime-clock', 'cost-savings'
];
```

3. Run optimization: `node scripts/optimize-images.js`

**Expected Results:**
- Logos: ~60-80 KB (90% quality)
- Banners: ~150 KB (85% quality)
- Timer/Icons: ~25-50 KB (90-95% quality)
- Feature icons: ~25-35 KB each (75% quality)
- Total bundle: ~3.3 MB (including all JS, CSS, and images)

**What Doesn't Change:**
- ✅ Payment API integration (Stripe bridge)
- ✅ Flux API endpoints
- ✅ Authentication system (Firebase)
- ✅ Platform features (DDoS protection, global network, etc.)
- ✅ Core hosting functionality

**6. Update SEO Metadata** (`src/components/common/SEO.jsx`)

Default meta tags are pulled from `gameConfig.js`, but you can customize further if needed.

**7. Done!** 🎉

```bash
npm run dev
```

Your Rust hosting site is ready!

---

## 🔌 API Requirements

This frontend is fully serverless and uses the following APIs:

### 1. Authentication

**Firebase Auth** (client-side):
- Email/password authentication
- Google OAuth
- No backend server required

### 2. Flux Marketplace API

**Endpoints Used:**

```
GET https://jetpackbridge.runonflux.io/api/v1/marketplace/trending
GET https://jetpackbridge.runonflux.io/api/v1/marketplace/plans
POST https://jetpackbridge.runonflux.io/api/v1/marketplace/deploy
```

Authentication: Uses encrypted `zelidauth` header.

### 3. FluxOS API (Per-App APIs)

Each deployed app exposes FluxOS APIs:

```
# Stats
GET https://{ip}-{port}.node.api.runonflux.io/apps/appstatshash/{appname}

# Terminal
WS https://{ip}-{port}.node.api.runonflux.io/apps/appexec/{container}/{command}

# Files
GET  https://{ip}-{port}.node.api.runonflux.io/apps/appfilesfolders/{appname}/...
POST https://{ip}-{port}.node.api.runonflux.io/apps/appuploadfile/{appname}/...
POST https://{ip}-{port}.node.api.runonflux.io/apps/appdownloadfile/{appname}/...

# Backup (Optional - if implementing backup functionality)
# POST {your-backup-endpoint}/backup/create/...
# GET  {your-backup-endpoint}/backup/list/...
```

Authentication: All requests require `zelidauth` header with user credentials.

---

## 📁 Project Structure

```
game-server-website/
├── scripts/
│   └── optimize-images.js     # Image optimization script (Sharp)
├── public/
│   ├── games/
│   │   ├── minecraft/         # Game-specific assets
│   │   │   ├── logo.webp           # Optimized logo (63 KB)
│   │   │   ├── banner.webp         # Social media banner (149 KB)
│   │   │   ├── background.jpg      # Hero background
│   │   │   ├── pricing-background.jpg
│   │   │   ├── timer.webp          # Session timer icon
│   │   │   ├── no-servers.webp     # Empty state image
│   │   │   ├── planLoader.webp     # Plan loading animation
│   │   │   ├── java.webp           # Java Edition icon
│   │   │   ├── bedrock.webp        # Bedrock Edition icon
│   │   │   ├── 404.png             # 404 page graphic
│   │   │   ├── faq-character-*.png # FAQ section characters
│   │   │   ├── favicon.ico
│   │   │   └── features/           # Feature icons (256x256 WebP)
│   │   │       ├── deployment-icon.webp
│   │   │       ├── ddos-shield.webp
│   │   │       ├── global-network.webp
│   │   │       ├── monitoring-chart.webp
│   │   │       ├── payment-icon.webp
│   │   │       ├── uptime-clock.webp
│   │   │       ├── cost-savings.webp
│   │   │       └── decentralized-nodes.webp
│   │   └── [your-game]/       # Add new games here
│   ├── wallets/               # Wallet brand assets
│   │   ├── zelcore.svg
│   │   └── ssp.svg
│   ├── flux-icon.svg          # Flux currency icon
│   └── robots.txt
│
├── src/
│   ├── components/
│   │   ├── auth/              # Authentication components
│   │   │   ├── index.js
│   │   │   ├── LoginModal.jsx
│   │   │   ├── GoogleLoginButton.jsx
│   │   │   ├── ZelCoreLoginButton.jsx
│   │   │   └── SessionTimer.jsx
│   │   │
│   │   ├── common/            # Reusable UI components
│   │   │   ├── index.js
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── CustomSelect.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   ├── SEO.jsx             # SEO meta tags
│   │   │   ├── CookieConsent.jsx
│   │   │   ├── CookieSettingsDialog.jsx
│   │   │   ├── ErrorBoundary.jsx
│   │   │   └── MinecraftBlocks.jsx
│   │   │
│   │   ├── dashboard/         # Server management
│   │   │   ├── index.js
│   │   │   ├── GameServersDashboard.jsx
│   │   │   ├── ServerManagementPanel.jsx
│   │   │   ├── ServerStats.jsx      # CPU/RAM/Disk stats
│   │   │   ├── ServerTerminal.jsx   # Bash console
│   │   │   ├── VirtualizedFileList.jsx
│   │   │   ├── DeploymentDialog.jsx
│   │   │   └── deployment-steps/    # Multi-step deployment wizard
│   │   │       ├── StepPlanSelection.jsx
│   │   │       ├── StepConfigure.jsx
│   │   │       ├── StepEnvironment.jsx
│   │   │       ├── StepLocation.jsx
│   │   │       ├── StepReview.jsx
│   │   │       ├── StepFinalizing.jsx
│   │   │       └── StepProgressBar.jsx
│   │   │
│   │   ├── sections/          # Landing page sections
│   │   │   ├── index.js
│   │   │   ├── Hero.jsx
│   │   │   ├── Features.jsx
│   │   │   ├── PricingPlans.jsx
│   │   │   ├── ServerLocations.jsx  # Interactive world map
│   │   │   └── FAQ.jsx
│   │   │
│   │   └── layout/            # Layout components
│   │       ├── Header.jsx
│   │       └── Footer.jsx
│   │
│   ├── config/                # 🔧 MODIFY FOR EACH GAME
│   │   ├── gameConfig.js      # Game content & assets
│   │   ├── serverPlans.js     # Server plan configurations
│   │   ├── themeConfig.js     # Colors & styling
│   │   └── apiConfig.js       # API endpoints
│   │
│   ├── services/              # API & business logic
│   │   ├── index.js
│   │   ├── apiService.js      # Flux API calls
│   │   ├── authService.js     # Firebase auth
│   │   ├── stripeService.js   # Stripe payments (checkout + subscriptions)
│   │   ├── walletService.js   # Crypto payments (ZelCore + SSP Wallet)
│   │   ├── marketplaceService.js
│   │   └── storageService.js
│   │
│   ├── utils/                 # Utilities
│   │   ├── secureStorage.js   # Encrypted storage (Web Crypto)
│   │   ├── firebase.js        # Firebase config
│   │   └── geolocation.js     # Geolocation data (continents/countries)
│   │
│   ├── context/               # React Context
│   │   └── AuthContext.jsx    # Auth state management
│   │
│   ├── pages/                 # Route pages
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Success.jsx        # Payment success
│   │   ├── Cancel.jsx         # Payment cancelled
│   │   └── NotFound.jsx       # 404 page
│   │
│   ├── App.jsx                # Main app component
│   ├── App.css                # Global app styles
│   ├── index.css              # Tailwind imports & base styles
│   └── main.jsx               # Entry point
│
├── .env                       # Environment variables (create this)
├── server.js                  # Development server (Vercel-compatible)
├── vercel.json                # Vercel deployment config
├── vite.config.js             # Vite configuration
├── tailwind.config.js         # Tailwind CSS config
├── postcss.config.js          # PostCSS config
├── eslint.config.js           # ESLint config
├── package.json               # Dependencies
└── README.md                  # This file
```

---

## 🏗️ Technology Stack

### Core Framework
- **React 19** - UI library
- **Vite 7** - Build tool & dev server
- **React Router v7** - Client-side routing

### Styling & Animation
- **Tailwind CSS 3.4** - Utility-first CSS
- **Framer Motion 12** - Animation library
- **Lucide React** - Icon library
- **React Simple Maps 3** - SVG world map visualization

### State & Data Fetching
- **React Query (TanStack Query) 5** - Server state management
- **Zustand 5** - Client state management (if needed)
- **React Hook Form 7** - Form validation

### Authentication & Storage
- **Firebase 12** - Authentication (Email + Google)
- **Web Crypto API** - Encryption for secure storage
- **IndexedDB** - Non-extractable key storage

### Server Management Features
- **xterm.js 6** - Terminal emulator
- **Socket.io Client 4** - WebSocket for terminal
- **Monaco Editor 4** - Code editor for file editing
- **React Virtuoso / React Window** - Virtualized lists for file browser

### Payments & Analytics
- **Stripe Payment Bridge API** - Fiat payments via FluxOS bridge (fiatpaymentsbridge.runonflux.io)
- **Stripe Subscriptions** - Auto-renewal with subscription lifecycle management
- **Crypto Payments** - FLUX payments via ZelCore (deeplink) and SSP Wallet (WebSocket)
- No client-side Stripe.js - payments handled through secure backend bridge
- **Google Analytics 4 (gtag.js)** - Website analytics with cookie consent (optional, loaded from CDN)

### Developer Tools
- **ESLint 9** - Code linting
- **PostCSS 8** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

---

## 📊 Dashboard Features

### Server Management Panel

**Overview Tab:**
- Real-time server status with pulsing indicator
- CPU, RAM, Disk usage with segmented bars and live timestamp
- Master node detection via DNS resolution
- Server information display
- Tab fade-in transitions

**Terminal Tab:**
- Full bash console access via xterm.js
- Multiple terminal sessions support
- Auto-reconnect on connection loss
- Component selection for multi-service apps
- Copy/paste support
- Resizable terminal

**Files Tab:**
- Browse server filesystem
- Upload files (single or multiple)
- Download files
- Edit files with Monaco Editor (syntax highlighting)
- Create/rename/delete folders
- Grid and list view modes
- File icons by type
- Virtualized list for large directories

**Backup Tab:**
- Create full server backups
- List existing backups
- Restore from backup
- Upload backup files
- Remote URL restore
- Progress indicators
- Automated backup system

**Billing Tab:**
- LCD-style expiration countdown timer
- One-click renewal (Stripe checkout or crypto)
- Auto-renewal toggle (creates/cancels Stripe subscription)
- Crypto payment support (FLUX via ZelCore or SSP Wallet)
- Payment history tracking
- Manage billing via Stripe portal
- Server deletion with confirmation dialog

---

## 🔒 Security Features

### Client-Side Encryption
```javascript
// Encryption keys are non-extractable
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  false,  // ❌ Not extractable - can't be stolen
  ['encrypt', 'decrypt']
);

// Data stored as encrypted binary
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  data
);
```

### Authentication Security
- Session timeout with warnings
- Secure token storage (encrypted)
- Firebase Auth with proper security rules
- CORS protection

### GDPR Compliance
- Cookie consent banner
- User-configurable analytics
- Data processing transparency
- Privacy-first approach

---

## 🚀 Performance Optimizations

### Bundle Optimization
```javascript
// Automatic code splitting (vite.config.js)
manualChunks: {
  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
  'query-vendor': ['@tanstack/react-query'],
  'ui-vendor': ['framer-motion', 'lucide-react'],
  'firebase-vendor': ['firebase/app', 'firebase/auth'],
  'terminal-vendor': [
    '@xterm/xterm',
    '@xterm/addon-fit',
    '@xterm/addon-serialize',
    '@xterm/addon-unicode11',
    '@xterm/addon-web-links',
    'socket.io-client'
  ]
}
```

**Build Sizes:**
- **Total bundle: 3.3 MB** (1.6 MB JS + 1.7 MB images)
- React vendor: ~47 KB (16 KB gzipped)
- Query vendor: ~33 KB (10 KB gzipped)
- UI vendor: ~133 KB (43 KB gzipped)
- Firebase vendor: ~156 KB (45 KB gzipped)
- Terminal vendor: ~410 KB (107 KB gzipped) - Lazy loaded
- Main index: ~245 KB (78 KB gzipped)
- CSS: ~80 KB total

**Initial Page Load (Home):**
- ~330 KB gzipped JS (code split)
- Images load progressively
- Dashboard chunks load on navigation

### Image Optimization
- **WebP format** for all custom images (logo, banner, icons)
- **Sharp** pre-optimization scripts for manual image conversion
- **Vite plugin** automatically optimizes images during build (~79% reduction)
- Lazy loading with Intersection Observer
- Responsive image sizing
- `loading="lazy"` and `decoding="async"` attributes

**Optimization Results:**
- Feature icons: 16 MB → 236 KB (98.5% reduction)
- Logo: 1.7 MB → 63 KB (96.3% reduction)
- Banner: 2.2 MB → 149 KB (93.2% reduction)
- Timer: 2.1 MB → 77 KB (96.3% reduction)
- **Total image savings: ~9.5 MB**

### Lazy Loading
```javascript
// Pages lazy loaded
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Success = lazy(() => import('./pages/Success'));
const Cancel = lazy(() => import('./pages/Cancel'));

// Monaco Editor lazy loaded (4.7MB - only loads when editing)
const Editor = lazy(() => import('@monaco-editor/react'));
```

### DNS Optimization
- Single DNS resolution per panel open
- Master node detection cached
- Automatic failover on errors

---

## 🔍 SEO Optimization

### Meta Tags
- Dynamic title tags per page
- Meta descriptions
- Open Graph tags for social sharing
- Twitter Card tags
- Canonical URLs
- robots meta tags

### Structured Data (JSON-LD)
- Organization schema
- WebSite schema with SearchAction
- BreadcrumbList schema
- Product schema for pricing plans
- FAQ schema

### Sitemap & Robots
- Auto-generated sitemap.xml
- robots.txt configured
- Crawl directives set
- Important pages indexed

### Performance
- Lighthouse SEO score: 90+
- Mobile-friendly design
- Fast page loads (<2s)
- Core Web Vitals optimized

---

## 🐛 Common Issues & Solutions

### "Module not found" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Firebase authentication not working
```bash
# Check .env file has correct Firebase config
# Verify Firebase Authentication is enabled in console
# Check authorized domains in Firebase console
```

### Terminal not connecting
```bash
# Verify backend Socket.io server is running
# Check CORS configuration allows your domain
# Check browser console for errors
```

### Images not loading
```bash
# Verify images exist in public/games/[game-name]/
# Check file paths in gameConfig.js
# Clear browser cache
```

### Build fails
```bash
# Update dependencies
npm update

# Clear Vite cache
rm -rf node_modules/.vite

# Rebuild
npm run build
```

---

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style
- Use ESLint configuration provided
- Follow React best practices
- Write descriptive commit messages
- Add comments for complex logic

---

## 📄 License

Copyright © 2026 **InFlux Technologies**. All rights reserved.

Powered by [Flux](https://runonflux.io)

---

## 🆘 Support

- **Documentation:** This README
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)
- **Flux Discord:** [Join Community](https://discord.com/invite/runonflux)

---

**Built with ❤️ by InFlux Technologies**

Deploying game servers on the decentralized cloud has never been easier.
