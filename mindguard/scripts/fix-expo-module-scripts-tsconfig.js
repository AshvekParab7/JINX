const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const expoModuleScriptsDir = path.join(
  packageRoot,
  "node_modules",
  "expo-module-scripts",
);
const shimPath = path.join(expoModuleScriptsDir, "tsconfig.base");
const targetPath = path.join(expoModuleScriptsDir, "tsconfig.base.json");

if (!fs.existsSync(expoModuleScriptsDir) || !fs.existsSync(targetPath)) {
  process.exit(0);
}

if (!fs.existsSync(shimPath)) {
  fs.writeFileSync(shimPath, '{\n  "extends": "./tsconfig.base.json"\n}\n');
}
