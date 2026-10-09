const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("desktopPet", {
  bounds: (rects) => ipcRenderer.send("pet-bounds", rects),
  drag: (value) => ipcRenderer.send("pet-drag", !!value),
  calendar: () => ipcRenderer.invoke("calendar-get"),
  state: (value) => ipcRenderer.send("pet-state", value),
  command: (name) => ipcRenderer.send("dock-command", name),
  panel: (expanded) => ipcRenderer.invoke("dock-panel", !!expanded),
  dockDrag: (phase) => ipcRenderer.send("dock-drag", phase),
  shortcut: () => ipcRenderer.invoke("desktop-shortcut"),
  quit: () => ipcRenderer.send("rabbit-quit"),
  onAction: (fn) => ipcRenderer.on("pet-action", (_, value) => fn(value)),
  onCursor: (fn) => ipcRenderer.on("pet-cursor", (_, value) => fn(value)),
  onState: (fn) => ipcRenderer.on("pet-state", (_, value) => fn(value)),
});
