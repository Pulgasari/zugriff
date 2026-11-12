// .github/config.js
// what the workflows do, as data:
// read by .github/scripts (config.mjs hands values to the yaml)

export default {
  debounce : 420,   // seconds a push waits before it builds, a newer one cancels it
  node     : 24,

  // checked out next to zugriff: rat builds the apps, its import map points into the others
  repos : ['aufbau', 'bunker', 'domina', 'gestalt', 'htx', 'js-packages', 'rat'],

  // actions -> build android apps
  android : {
    apps     : [], // none: every app with android in its config.rat.js
    java     : 21, // capacitor 8 compiles against 21
    sdk      : ['platform-tools', 'platforms;android-36', 'build-tools;36.0.0'],
    name     : '{app}_{yyyy}{MM}{dd}{HH}{mm}.apk', // noisy_202610291917.apk
    timezone : 'Europe/Berlin', // of the time in the name
    keep     : 10, // releases of apks kept, older ones go
  },
};
