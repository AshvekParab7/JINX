const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const projectNodeModules = path.resolve(__dirname, "node_modules");
const itsFinePackagePath = path.resolve(projectNodeModules, "its-fine");
const itsFineEntry = path.resolve(itsFinePackagePath, "dist/index.cjs");
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.nodeModulesPaths = [
  projectNodeModules,
  ...(config.resolver.nodeModulesPaths || []),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  "its-fine": itsFinePackagePath,
};

if (!config.resolver.sourceExts.includes("cjs")) {
  config.resolver.sourceExts.push("cjs");
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "its-fine") {
    return {
      filePath: itsFineEntry,
      type: "sourceFile",
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
