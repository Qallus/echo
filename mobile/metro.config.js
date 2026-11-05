// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// The app shares a few plain TypeScript files with the website (feature names,
// call types, the demo call): ../src/lib/redial, imported as @shared/*. They
// have no imports of their own.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src/lib/redial")];

module.exports = config;
