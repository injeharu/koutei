const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  printToPDF: (scheduleName) => ipcRenderer.invoke('print-to-pdf', scheduleName),
  // フォルダ選択ダイアログ（PDF一括出力用）
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  // パス直接指定でPDF出力（ダイアログなし・一括出力用）
  printToPDFPath: (folderPath, scheduleName) =>
    ipcRenderer.invoke('print-to-pdf-path', folderPath, scheduleName),
  // 印刷実行：一時PDF生成 → OSのPDFビューアで開く
  printPage: () => ipcRenderer.invoke('print-page'),
  // モーダル後のキーボードフォーカス復帰
  focusWebContents: () => ipcRenderer.invoke('focus-webcontents'),
})
