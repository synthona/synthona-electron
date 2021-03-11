require('dotenv').config();

module.exports = {
  packagerConfig: {
    ignore: '/node_modules/electron-packager|/server/database.sqlite3',
    prune: true,
    icon: 'build/synthona.icns',
    overwrite: true,
    appBundleId: process.env.APPLE_BUNDLE_ID,
    osxSign: {
      'hardened-runtime': true,
      'gatekeeper-assess': false,
      'entitlements': 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
    },
  },
  hooks: {
    'postPackage': require('./notarize.js'),
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        'name': 'synthona',
        'icon': 'build/synthona.ico',
        'loadingGif': 'build/initializing.gif',
      },
    },
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
      config: {
        'name': 'synthona',
        'icon': 'build/synthona.icns',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        'name': 'synthona',
        'icon': 'build/synthona.icns',
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};
