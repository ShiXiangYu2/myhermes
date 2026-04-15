"use strict";
const electron = require("electron");
const hermesAPI = {
  checkInstall: () => electron.ipcRenderer.invoke("hermes:checkInstall"),
  getStatus: () => electron.ipcRenderer.invoke("hermes:getStatus"),
  startGateway: () => electron.ipcRenderer.invoke("hermes:startGateway"),
  stopGateway: () => electron.ipcRenderer.invoke("hermes:stopGateway"),
  getConfig: () => electron.ipcRenderer.invoke("hermes:getConfig"),
  setConfig: (key, value) => electron.ipcRenderer.invoke("hermes:setConfig", key, value),
  getPlatforms: () => electron.ipcRenderer.invoke("hermes:getPlatforms"),
  setupPlatform: (platform, config) => electron.ipcRenderer.invoke("hermes:setupPlatform", platform, config),
  onNavigate: (callback) => {
    const handler = (_, page) => callback(page);
    electron.ipcRenderer.on("navigate", handler);
    return () => electron.ipcRenderer.off("navigate", handler);
  }
};
electron.contextBridge.exposeInMainWorld("hermes", hermesAPI);
//# sourceMappingURL=index.js.map
