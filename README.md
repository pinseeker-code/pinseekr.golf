# Pinseekr Golf

**The decentralized golf scoring app powered by Bitcoin and Nostr.**

Track scores, settle bets and costs with Lightning, and own your golf data. 

[![Live App](https://img.shields.io/badge/Live-pinseekr.golf-green?style=for-the-badge)](https://pinseekr.golf)

---

## ✨ Features

### 📊 Score Tracking
- **Real-time scoring**
- **Multiple game modes**: Stroke Play, Match Play, Stableford, Skins, Nassau, Vegas, Snake
- **Pinseekr Cup**: Innovative multi-game tournament format with combined scoring
- **Handicap support**: Net scoring with automatic adjustments

### ⚡ Lightning Settlements
- **Instant payouts** via Nostr Wallet Connect (NWC)
- **Automatic calculations** for complex side games
- **Multi-currency support**: USD, CAD, EUR, GBP, AUD, MXN, sats
- **Cost splitting** for green fees, carts, food & drinks

### 🌐 Decentralized & Private
- **Your data, your keys** — stored on Nostr relays you control
- **No subscriptions** — free forever
- **Works offline** — scores sync when you're back online

### 📱 Mobile-First
- **Progressive Web App** — use on any device
- **Touch-optimized** score entry
- **QR code sharing** — invite players instantly

---

## 🚀 Quick Start

### Use the Live App
Visit **[pinseekr.golf](https://pinseekr.golf)** and start scoring immediately.

### Run Locally

```bash
# Clone the repo
git clone https://github.com/pinseeker-code/pinseekr.golf.git
cd pinseekr.golf

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:8080](http://localhost:8080)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | TailwindCSS, shadcn/ui |
| **Protocol** | Nostr (via Nostrify) |
| **Payments** | Lightning Network (NWC, WebLN) |
| **State** | TanStack Query |
| **Testing** | Vitest |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [NOSTR_IMPLEMENTATION.md](NOSTR_IMPLEMENTATION.md) | How Pinseekr uses Nostr events |
| [NIP.md](NIP.md) | Custom NIP for golf data |
| [GOLF_GAMES_FRAMEWORK.md](GOLF_GAMES_FRAMEWORK.md) | Game rules and scoring engines |

---

## 🏌️ Supported Game Modes

| Game | Description |
|------|-------------|
| **Stroke Play** | Traditional total strokes format |
| **Match Play** | Hole-by-hole competition |
| **Stableford** | Points-based scoring (rewards birdies, protects against blowups) |
| **Skins** | Win the hole outright to take the pot |
| **Nassau** | Three separate bets: front 9, back 9, overall |
| **Vegas** | Team format with concatenated scores |
| **Snake** | First 3-putt takes the snake, last one holding pays |
| **Pinseekr Cup** | Ryder Cup style tournament combining multiple game formats.  |

---

## 🔧 Development

```bash
# Run tests (TypeScript + ESLint + Vitest + build)
npm run test

# Development server with hot reload
npm run dev

# Production build
npm run build
```

### Project Structure

```
src/
├── components/     # React components
│   ├── golf/       # Golf-specific components
│   ├── scoring/    # Score entry and display
│   └── ui/         # shadcn/ui components
├── hooks/          # Custom React hooks
├── lib/
│   └── golf/       # Scoring engines and types
├── pages/          # Route components
└── contexts/       # React contexts
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm run test`)
4. Commit your changes
5. Push to the branch
6. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Website**: [pinseekr.golf](https://pinseekr.golf)
- **Nostr**: Follow on Nostr npub12sl626zucwnkqwxnkm5y5knlnxycn2cx8vy3dhfghccqxvnkxvuqfy6dme
- **Issues**: [GitHub Issues](https://github.com/pinseeker-code/pinseekr.golf/issues)

---
