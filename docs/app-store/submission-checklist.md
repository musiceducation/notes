# Music Adventure / 音樂大冒險 — App Store Submission Checklist

## Prerequisites (your Apple account)

- [ ] Apple Developer Program membership ($99/year)
- [ ] Register bundle ID `com.notessprite.musicapp` in Certificates, Identifiers & Profiles
- [ ] Create App Store Connect app record
- [ ] Host privacy policy and support pages (host HTTPS yourself): Privacy docs/app-store/privacy-policy.html (host HTTPS yourself) · Support docs/app-store/support.html (host HTTPS yourself) · email kennethchan3868@hotmail.com

## Local build steps

```bash
cd "/Users/kenneth/Desktop/music-games-cap"
npm install
npm test
npm run build
npm run cap:sync
npm run cap:open
```

In Xcode (`ios/App/App.xcworkspace`):

- [ ] Select your Team under Signing & Capabilities
- [ ] Confirm bundle ID `com.notessprite.musicapp`
- [ ] Set version (Marketing) = 1.0, build = 1
- [ ] Build for Any iOS Device (arm64)
- [ ] Product → Archive → Distribute App → App Store Connect

## App Store Connect listing

- [ ] Upload 1024×1024 app icon (from `resources/icon.png`)
- [ ] iPhone 6.7" screenshots (1290×2796)
- [ ] iPad 12.9" screenshots (2048×2732)
- [ ] Copy metadata from `metadata.md`
- [ ] Set category: Music
- [ ] Complete App Privacy: **Data Not Collected**
- [ ] Complete age rating questionnaire
- [ ] Add support and privacy URLs
- [ ] Export compliance: No non-exempt encryption

## TestFlight

- [ ] Upload build via Xcode Organizer
- [ ] Add internal testers
- [ ] Verify on physical iPhone and iPad:
  - Audio unlock overlay → tap to start
  - Piano keys respond to touch
  - Stats persist after force-quit
  - Airplane mode works (offline)
  - Safe areas on notched devices

## Known environment blockers on this machine

If `pod install` or archive fails:

1. Install full **Xcode** from the Mac App Store (not only Command Line Tools)
2. Run `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
3. Re-run `npm run cap:sync`

## Post-approval

- [ ] Monitor crash reports in App Store Connect
- [ ] Tag release in git
- [ ] Increment build number for next submission

## Must-fixes already applied (like Chord Trainer)

- [x] ITSAppUsesNonExemptEncryption = false
- [x] UIRequiresFullScreen = true (+ full iPhone/iPad orientations)
- [x] PrivacyInfo.xcprivacy (no tracking / no collected data)
- [x] Removed NSMicrophoneUsageDescription / NSAppleMusicUsageDescription (Web Audio only)
- [x] Offline system fonts (no Google Fonts CDN)
- [x] Auth disabled

## ASC manual remaining

- [ ] Privacy Policy URL hosting (HTTPS)
- [ ] Support URL hosting (HTTPS)
- [ ] Screenshots (iPhone + iPad)
- [ ] Content Rights
- [ ] Age Rating
- [ ] App Privacy: Data Not Collected
