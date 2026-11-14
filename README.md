# Going, Going, BOOM!

**Bid. Build. Battle.** A complete browser auction autobattler for 2–10 players. Play solo against 1–9 bots, or create a room for friends and fill spare seats with bots.

## Play

- **Solo:** choose your name, bot count, and difficulty. No bidding timer. Matches save on the current device, so you can resume later.
- **With friends:** create a room, share its six-character code or invite link, and add optional bots. The host starts and advances the match.
- Start with **90 coins**. Each round has **two sealed-bid auctions**, followed by one automatic arena battle. Distribute your budget across the items; a zero bid passes. Highest bid wins and only the winner pays. Tied bids pick one winner randomly.
- Every purchased item is permanently equipped. Two or four matching **Spark**, **Scrap**, or **Wild** pieces give attack, health, or critical-hit bonuses.
- All players return for all **five rounds**. Each new round grants **55 coins**. Battle placement awards N points to first place, N−1 to second, and so on, with **2 extra points** for the winner. Highest total score wins; ties break by battle wins, then unspent coins (an exact remaining tie uses a stable player-ID order).
- Bots have three difficulty settings and varied budgets. They do not inspect human bids.

## GitHub Pages deployment

The included `.github/workflows/pages.yml` validates the JavaScript, runs the tests, builds the static `dist/` folder, and deploys it after a push to `main`.

1. In the repository, choose **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Push this project to `main` (or run **Test and deploy to GitHub Pages** from the Actions tab).
3. The deployment job reports the live URL. For this repository it is expected to be `https://jenschristianschroder.github.io/Going-Going-BOOM/`.

No Node process, database, API key, or game backend is deployed. All asset paths are relative, so repository subpaths work. Node is only needed for local development and CI.

## Run locally

Requires Node 22+; there are no npm dependencies to install.

```sh
npm run dev
# Open http://localhost:5173
npm test
npm run check
npm run build
```

Use HTTP locally, not a `file://` URL, because the game uses JavaScript modules. Offline solo works after the page and its service worker have loaded once online. Local saves are browser/device-specific, not cloud saves.

## Multiplayer architecture and current limits

GitHub Pages hosts the static files. A vendored, pinned **PeerJS 1.5.5** client uses the public PeerJS signaling service to establish **WebRTC data channels**. Gameplay is host-authoritative in a star topology, with up to nine remote guests. This is not a serverless guarantee: initial connections use external signaling and STUN services.

The host validates budgets, bids, phase numbers, and player identity before applying actions. Each guest gets its own sanitized snapshot: no opponent bids or private random seed are transmitted before the reveal. The host produces one battle event stream for all clients to replay. This is intended for trusted friends, not competitive anti-cheat: the host controls the game process.

**Online play is experimental.** The default configuration preserves PeerJS 1.5.5's STUN and shared public TURN relay. This is a best-effort public service, not a dedicated relay with guaranteed availability. Some cellular, corporate, guest Wi-Fi, or restrictive networks may still fail. Try a common Wi-Fi network without client isolation. A dedicated TURN integration hook is provided in `src/config.js`: point `turnCredentialsUrl` at your own HTTPS service returning `{ "iceServers": [...] }` with temporary TURN credentials. Never put your own long-lived credentials in this public repository. A custom PeerServer can also be configured in `peerOptions`.

The host must keep the page open and active. Closing or reloading the host ends the room; host migration is not implemented. Guest disconnects switch that seat to bot bidding. A guest can reclaim the same seat by rejoining from the same browser tab, where its random reconnection token is kept in session storage. A missed timed bid becomes zero; an already locked bid is never replaced. Late new joins are allowed only in the lobby. Keep the room code private to invited friends.

## Verification

The initial release passed 16 automated tests, including complete 2-, 4-, and 10-player matches, bid privacy, budget validation, tie handling, timeouts, bot takeover, and connection identity checks. Live GitHub Pages browser checks covered a complete five-round solo match, item bonuses, scores, save/resume, rematch, room creation, and a 10-seat room with timed auctions.

Remote guest joining timed out in the cloud test browser, including after enabling the bundled relay fallback. Successful human-to-human play across real devices has therefore **not yet been verified**. The deployed multiplayer feature remains experimental; a dedicated relay may be needed for your networks.

## Structure

| File | Purpose |
| --- | --- |
| `src/engine.js` | Pure game rules, bids, bots, combinations, battle simulation, private snapshots |
| `src/network.js` | WebRTC room lifecycle, connection identity, reconnection, message validation |
| `src/app.js` | Responsive screens, input, host coordination, local saves, sound |
| `src/art.js` | Original vector gadget illustrations and icons |
| `src/battle.js` | Canvas battle replay and reduced-motion support |
| `src/config.js` | Public networking configuration and optional TURN endpoint |
| `tests/` | Rule, privacy, full-match, timeout, and networking-boundary tests |

The build fingerprints every JavaScript import and CSS entry point, and generates a matching service-worker cache version. The service worker uses network-first requests with cache validation, falling back to cached assets offline. This prevents a deploy from mixing old networking code with a new interface.

## Credits

Original game code and vector illustrations created for this project. PeerJS is MIT-licensed; its license is included in `vendor/peerjs.LICENSE`. Typefaces: Barlow Condensed and DM Sans, distributed under the SIL Open Font License (included alongside the font files).
