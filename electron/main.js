const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '工程表管理',
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'ファイル',
      submenu: [
        { label: 'アプリを終了', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: '表示',
      submenu: [
        { label: '拡大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '縮小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '元のサイズ', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '全画面', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

// PDF出力のIPCハンドラー
ipcMain.handle('print-to-pdf', async (event, scheduleName) => {
  try {
    // 保存先ダイアログを表示
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'PDFを保存',
      defaultPath: path.join(app.getPath('documents'), `工程表_${scheduleName || 'output'}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    if (canceled || !filePath) return { success: false }

    // A4縦向きでPDF生成
    const data = await mainWindow.webContents.printToPDF({
      landscape: false,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })

    fs.writeFileSync(filePath, data)

    // 保存したPDFを自動的に開く
    shell.openPath(filePath)

    return { success: true, filePath }
  } catch (err) {
    console.error('PDF出力エラー:', err)
    return { success: false, error: err.message }
  }
})

// PDF保存先フォルダ選択ダイアログ
ipcMain.handle('select-folder', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'PDF保存先フォルダを選択',
    properties: ['openDirectory'],
  })
  return canceled ? null : filePaths[0]
})

// パス直接指定でPDF出力（一括出力用・ダイアログなし）
ipcMain.handle('print-to-pdf-path', async (event, folderPath, scheduleName) => {
  try {
    const filePath = path.join(folderPath, `工程表_${scheduleName || 'output'}.pdf`)
    const data = await mainWindow.webContents.printToPDF({
      landscape: false,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    })
    fs.writeFileSync(filePath, data)
    return { success: true, filePath }
  } catch (err) {
    console.error('PDF一括出力エラー:', err)
    return { success: false, error: err.message }
  }
})

// 印刷実行：一時PDFを生成してOSのPDFビューアで開く（Electronの印刷プレビュー非対応を回避）
ipcMain.handle('print-page', async () => {
  try {
    const tmpPath = path.join(os.tmpdir(), `schedule-print-${Date.now()}.pdf`)
    const data = await mainWindow.webContents.printToPDF({
      landscape: false,
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    fs.writeFileSync(tmpPath, data)
    shell.openPath(tmpPath)
    return { success: true }
  } catch (err) {
    console.error('印刷用PDF生成エラー:', err)
    return { success: false, error: err.message }
  }
})

// webContents フォーカス復帰（モーダル操作後にキーボード入力が効かなくなる問題の対策）
// Windows IME 状態が壊れた時、hide() → show() で完全にウィンドウを再アクティベートする
ipcMain.handle('focus-webcontents', () => {
  if (!mainWindow) return
  if (process.platform === 'win32') {
    // hide → show で Windows OS に再アクティベーションを強制（IME 状態リセット）
    mainWindow.hide()
    mainWindow.show()
  } else {
    mainWindow.focus()
    mainWindow.webContents.focus()
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})
