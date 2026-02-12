const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add resolver configuration to handle Supabase
config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'cjs'],
  extraNodeModules: {
    stream: require.resolve('readable-stream'),
  },
};

module.exports = config;
