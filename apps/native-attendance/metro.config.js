const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
const workspacePackages = path.resolve(projectRoot, '../../packages');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [workspacePackages],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(projectRoot, '../../node_modules'),
    ],
    /**
     * `whatwg-url-without-unicode` (via react-native-url-polyfill) uses
     * `require("./lib/URLSearchParams")` without an extension. Some Metro setups
     * (Windows paths, monorepo watchFolders, or LAN dev clients) fail to resolve
     * it even though `lib/URLSearchParams.js` exists.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (
        context.originModulePath &&
        context.originModulePath.includes('whatwg-url-without-unicode') &&
        (moduleName === './lib/URLSearchParams' || moduleName === './lib/URL')
      ) {
        const dir = path.dirname(context.originModulePath);
        const filePath =
          moduleName === './lib/URLSearchParams'
            ? path.join(dir, 'lib', 'URLSearchParams.js')
            : path.join(dir, 'lib', 'URL.js');
        return { type: 'sourceFile', filePath };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

const merged = mergeConfig(getDefaultConfig(projectRoot), config);
merged.resolver.assetExts = [...new Set([...(merged.resolver.assetExts ?? []), 'tflite'])];
module.exports = merged;
