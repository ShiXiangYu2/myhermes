import { contextBridge, ipcRenderer } from 'electron';
// Hermes API 实现
const hermesAPI = {
    checkInstall: () => ipcRenderer.invoke('hermes:checkInstall'),
    getStatus: () => ipcRenderer.invoke('hermes:getStatus'),
    startGateway: () => ipcRenderer.invoke('hermes:startGateway'),
    stopGateway: () => ipcRenderer.invoke('hermes:stopGateway'),
    getConfig: () => ipcRenderer.invoke('hermes:getConfig'),
    setConfig: (key, value) => ipcRenderer.invoke('hermes:setConfig', key, value),
    getPlatforms: () => ipcRenderer.invoke('hermes:getPlatforms'),
    setupPlatform: (platform, config) => ipcRenderer.invoke('hermes:setupPlatform', platform, config),
    onNavigate: (callback) => {
        const handler = (_, page) => callback(page);
        ipcRenderer.on('navigate', handler);
        return () => ipcRenderer.off('navigate', handler);
    },
};
// 暴露到 window 对象
contextBridge.exposeInMainWorld('hermes', hermesAPI);
