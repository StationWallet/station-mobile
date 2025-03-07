module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          components: './src/components',
          consts: './src/consts',
          types: './src/types',
          styles: './src/styles',
          utils: './src/utils',
          assets: './src/assets',
          hooks: './src/hooks',
          stores: './src/stores',
          nativeModules: './src/nativeModules',
          lib: './src/lib',
          '@ledgerhq/devices/hid-framing': '@ledgerhq/devices/lib/hid-framing',
        },
      },
    ],
  ],
};
