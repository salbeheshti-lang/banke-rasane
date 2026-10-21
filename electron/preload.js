// Electron Preload Script
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:version'),
  getDatabasePath: () => ipcRenderer.invoke('app:getDatabasePath'),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  
  // App info
  platform: process.platform,
  isElectron: true,
});
