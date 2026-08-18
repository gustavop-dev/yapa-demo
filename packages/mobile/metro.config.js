// Configuracion de monorepo para Metro, segun la guia oficial de Expo.
// Sin esto, Metro no encuentra @yapa/engine porque vive fuera de la carpeta de la app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Metro tiene que vigilar la raiz del workspace para ver cambios en el motor.
config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Evita que Metro suba por el arbol buscando node_modules y termine resolviendo
// dos copias de react, que es el fallo clasico de monorepo.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
