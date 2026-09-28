// bundler.config.js
// the www/ of one app for @aufbau/bundler (aufbau/bundler), used by the
// capacitor build (.github/scripts/stage-capacitor-www.mjs): the root shell,
// .shared and the app where vercel's rewrite puts it on the live site, the
// first-party packages as local copies, and / moved to the app.
//
//   node <aufbau>/bundler/cli.js bundler.config.js slug=notes out=build/notes/www packages=build/_pkg

export default ({ out, packages = 'build/_pkg', slug }) => ({
  out,
  root : '.',

  copy : [
    { from: '.shared' },
    { from: `apps/${slug}`, to: slug },
    { from: 'icon.svg' },
    { from: 'index.html' },
    { from: 'logo.svg' },
  ],

  packages : {
    clone  : 'https://github.com/Pulgasari/{repo}.git',
    origin : 'https://code.pulgasari.dev',
    path   : '/_pkg',
    source : packages,
  },

  // capacitor opens https://localhost/, the shell reads its route from the path
  start : `/${slug}/`,
});
