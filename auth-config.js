/**
 * Firebase Auth config for Capacitor / web.
 * Fill firebase.* from Firebase Console → Project settings.
 * Enable Authentication providers: Google, Apple.
 * iOS: add GoogleService-Info.plist to ios/App/App/; Android: google-services.json.
 * Bundle / applicationId must match Capacitor appId: com.notessprite.musicapp
 *
 * enabled: true → native iOS/Android gate with Google (Apple kept for App Store 4.8).
 * requireOnNativeOnly: true → web keeps grade/class/name hub login.
 */
window.MUSIC_APP_AUTH = {
  enabled: true,
  requireOnNativeOnly: true,
  appleSignInEnabled: true,
  firestoreCollection: 'players',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  }
};
