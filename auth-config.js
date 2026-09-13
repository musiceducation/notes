/**
 * Social login (Google / Facebook) for the iOS app build.
 * Uses Firebase Auth — create a project at https://console.firebase.google.com
 * and enable Google + Facebook sign-in. Add this iOS bundle ID to the Firebase iOS app:
 *   com.notessprite.musicapp (or match capacitor.config.json appId)
 *
 * For App Store: Apple may require "Sign in with Apple" if you offer other social logins
 * (Guideline 4.8) — plan to add it before submission.
 *
 * Set enabled: true when shipping the Capacitor iOS app. Leave false for normal web use.
 * appleSignInEnabled: show Apple button (requires Apple provider in Firebase + Apple Developer).
 */
window.MUSIC_APP_AUTH = {
  enabled: false,
  requireOnNativeOnly: true,
  appleSignInEnabled: true,
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  }
};
