# iPhone build & App Store release

App display name: **Music Adventure** (zh-Hant hub title: **音樂大冒險**).

Bundle ID (must match Firebase iOS app): **`com.notessprite.musicapp`** — see [`capacitor.config.json`](capacitor.config.json).

## Prerequisites (Mac)

1. **Xcode** from the App Store (full app, not only Command Line Tools).
2. Set developer tools:  
   `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. **CocoaPods**: `brew install cocoapods` (or `sudo gem install cocoapods`).
4. **Apple Developer Program** membership for device builds and App Store upload.

## One-time / after pulling native changes

```bash
cd /path/to/iPhoneapp
npm install
npm run build:www
cd ios/App && pod install && cd ../..
npx cap sync ios
```

Open **`ios/App/App.xcworkspace`** (not `.xcodeproj`).

## Every release (web assets → iOS)

```bash
npm run build          # syntax + asset validation
npm run build:www      # copies static files + bundles capacitor-native.js
npx cap sync ios       # copies www → ios/App/App/public, updates native project
```

Then in Xcode: **Product → Archive → Distribute App** to App Store Connect.

## After adding / updating Capacitor plugins

```bash
npm install
npx cap sync ios
cd ios/App && pod install
```

This links native code for **@capacitor/splash-screen** and **@capacitor/status-bar** (used by the bundled `capacitor-native.js`).

## TestFlight checklist

- [ ] Version + build number bumped in Xcode (target **App**).
- [ ] Signing: correct team, **Release** profile for archive.
- [ ] [`auth-config.js`](auth-config.js): production Firebase keys; `enabled: true` for store builds if login is required.
- [ ] Privacy Policy URL in App Store Connect; App Privacy questionnaire completed.

## TestFlight smoke test (device)

| Step | Pass? |
|------|--------|
| Cold start: splash hides, status bar visible on purple UI | |
| If auth on: can complete at least one of Apple / Google / Facebook | |
| Hub: app bar (👥 👤), identity card, game grid | |
| Open one game, use back to hub | |
| Sound toggle + music panel | |

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `pod install` fails | `pod repo update`; Xcode license: `sudo xcodebuild -license accept` |
| Blank WebView | Confirm `npm run build:www` ran; check **ionic capacitor** copy in sync output |
| OAuth redirect loop | Firebase authorized domains; see [FIREBASE_SETUP.md](FIREBASE_SETUP.md) |
