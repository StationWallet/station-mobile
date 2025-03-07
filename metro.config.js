const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const config = {
    transformer: {
        getTransformOptions: async () => ({
            transform: {
                experimentalImportSupport: false,
                inlineRequires: true,
            },
        }),
    },
    resolver: {
        extraNodeModules: require('node-libs-react-native'),
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
