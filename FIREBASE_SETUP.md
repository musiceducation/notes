# Firebase & sign-in (Google / Facebook / Apple)

The app uses **Firebase Authentication** with the Web SDK in [`auth-social.js`](auth-social.js). Configuration lives in [`auth-config.js`](auth-config.js).

## 1. Create a Firebase project

1. [Firebase Console](https://console.firebase.google.com) → Add project.
2. **Authentication** → Get started → enable:
   - **Google**
   - **Facebook** (requires a [Meta for Developers](https://developers.facebook.com) app: add iOS bundle ID, copy App ID/secret into Firebase).
   - **Apple** (recommended for App Store; see below).

## 2. Register apps

- **Web app**: copy the `firebaseConfig` object into [`auth-config.js`](auth-config.js) under `firebase`.
- **iOS app**: add with bundle ID **`com.notessprite.musicapp`** (or your custom ID if you change [`capacitor.config.json`](capacitor.config.json) and Xcode—keep all three in sync).

## 3. Authorized domains

Authentication → Settings → **Authorized domains**: include your Firebase `authDomain` and any custom domain you use. For Capacitor, also allow domains Firebase documents for redirect-based sign-in (often `localhost` for dev; production uses your `authDomain`).

## 4. Enable the gate in the app

In [`auth-config.js`](auth-config.js):

- Set **`enabled: true`** for production iOS builds that require login.
- Keep **`requireOnNativeOnly: true`** so the website stays usable in the browser without OAuth (set to `false` only if you want the web build to require login too).

## 5. Sign in with Apple (App Review)

If you offer Google or Facebook login, Apple often expects **Sign in with Apple** as well (Guideline 4.8).

1. [Apple Developer](https://developer.apple.com) → Identifiers → enable **Sign In with Apple** for your App ID (same bundle ID as the app).
2. Create a **Services ID** (if using web flow) and configure return URLs as Firebase documents for Apple provider.
3. Firebase Console → Authentication → **Apple** → enable and paste **Services ID**, **Team ID**, **Key ID**, and **private key** (.p8).
4. The app shows an **Apple 登入** button when `appleSignInEnabled` is `true` in [`auth-config.js`](auth-config.js) (default on).

## 6. Verify on a real device

- Install the app from Xcode on a device.
- With `enabled: true` and valid Firebase config, the overlay should appear; complete Google, Facebook, or Apple sign-in and confirm you reach the hub.

## 7. TestFlight matrix (quick)

| Step | Check |
|------|--------|
| Cold start | Splash hides; status bar readable on purple header |
| Auth overlay | Can sign in with at least one provider |
| Hub | Identity card + game cards work |
| Game entry | Open one game, return to hub |
