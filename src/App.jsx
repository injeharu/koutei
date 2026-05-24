import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import {
  collection, doc, setDoc, deleteDoc,
  onSnapshot, serverTimestamp, getDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import Toolbar from './components/Toolbar'
import ScheduleGrid from './components/ScheduleGrid'
import MemoSection from './components/MemoSection'
import ScheduleSelector from './components/ScheduleSelector'
import NotesSection from './components/NotesSection'
import PrintPreviewModal from './components/PrintPreviewModal'
import ScheduleManagerModal from './components/ScheduleManagerModal'
import { addDays, formatDateRange, generateDateCells } from './utils/dateUtils'

const DEFAULT_ROWS = 7
const DEFAULT_COLS = 4
const DEFAULT_COL_WIDTHS = [90, 280, 90, 280]
const DEFAULT_ROW_HEIGHT = 96

// グローバルノートのデフォルト値
const DEFAULT_NOTES = {
  company1Name: '会社名・現場名',
  company1Content: '',
  company2Name: '会社名・現場名',
  company2Content: '',
  freeText: '',
  remarks: '',
}

export default function App() {
  const [schedules, setSchedules] = useState([])
  const [currentId, setCurrentId] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)
  const [globalNotes, setGlobalNotes] = useState(DEFAULT_NOTES) // 全工程表共通の下部予定
  const [selectedCell, setSelectedCell] = useState(null)
  const [selectedCells, setSelectedCells] = useState(new Set())
  const [selectedMemoCell, setSelectedMemoCell] = useState(null)
  const [savedSelection, setSavedSelection] = useState(null)
  const [saveStatus, setSaveStatus] = useState('saved')
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [showManager, setShowManager] = useState(false)
  const [exportProgress, setExportProgress] = useState(null) // { current, total } | null
  const [printAreaZoom, setPrintAreaZoom] = useState(1)
  const printAreaRef = useRef(null)
  const saveTimer = useRef(null)
  const notesSaveTimer = useRef(null)
  const unsubscribeRef = useRef(null)
  const focusOnLoad = useRef(false) // 工程表作成直後のフォーカス復帰フラグ
  const activeNotesField = useRef(null) // ノート欄でフォーカス中のフィールド情報 { element, field }
  const activeMemoField = useRef(null)  // メモ欄でフォーカス中の情報

  // グリッドセル選択時にノート欄・メモ欄のフォーカス追跡をクリア
  function handleSelectCell(key) {
    setSelectedCell(key)
    setSelectedMemoCell(null)
    activeNotesField.current = null
    activeMemoField.current = null
  }

  // メモセル選択時にグリッドセル・ノート欄の選択をクリア
  function handleSelectMemoCell(key) {
    setSelectedMemoCell(key)
    setSelectedCell(null)
    setSelectedCells(new Set())
    activeNotesField.current = null
  }

  // 工程表一覧を監視
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, name: d.data().name, startDate: d.data().startDate || null, endDate: d.data().endDate || null }))
      // 日付あり工程表は日付順、日付なしは末尾に名前順
      list.sort((a, b) => {
        if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate)
        if (a.startDate) return -1
        if (b.startDate) return 1
        return a.name.localeCompare(b.name, 'ja')
      })
      setSchedules(list)
    })
    return () => unsub()
  }, [])

  // グローバルノートを監視（全工程表共通）
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'globalNotes'), snap => {
      if (snap.exists()) {
        setGlobalNotes({ ...DEFAULT_NOTES, ...snap.data() })
      }
    })
    return () => unsub()
  }, [])

  // 工程表を選択
  function selectSchedule(id) {
    setCurrentId(id)
    setSelectedCell(null)
    setSelectedCells(new Set())
    if (unsubscribeRef.current) unsubscribeRef.current()
    const ref = doc(db, 'schedules', id)
    unsubscribeRef.current = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data()
        const storedHeights = data.rowHeights ?? Array(data.rows ?? DEFAULT_ROWS).fill(DEFAULT_ROW_HEIGHT)
        // 旧デフォルト(48px)のままなら新デフォルトに自動更新
        const rowHeights = storedHeights.every(h => h === 48)
          ? Array(storedHeights.length).fill(DEFAULT_ROW_HEIGHT)
          : storedHeights
        setScheduleData({
          rows: data.rows ?? DEFAULT_ROWS,
          cols: data.cols ?? DEFAULT_COLS,
          colWidths: data.colWidths ?? DEFAULT_COL_WIDTHS,
          rowHeights,
          cells: data.cells ?? {},
          memoCells: data.memoCells ?? {},
          name: data.name,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
        })
      }
    })
  }

  // 新規工程表作成（DatePickerModal の onConfirm から呼ばれる）
  async function handleCreate({ name, startDate, endDate }) {
    const id = Date.now().toString()
    // startDate があれば狭い列（c0/c2）に日付を自動入力
    const initialCells = startDate ? generateDateCells(startDate, DEFAULT_ROWS) : {}
    await setDoc(doc(db, 'schedules', id), {
      name,
      startDate: startDate || null,
      endDate: endDate || null,
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      colWidths: DEFAULT_COL_WIDTHS,
      rowHeights: Array(DEFAULT_ROWS).fill(DEFAULT_ROW_HEIGHT),
      cells: initialCells,
      memoCells: {},
      updatedAt: serverTimestamp(),
    })
    focusOnLoad.current = true
    selectSchedule(id)
  }

  // 工程表の表示名を変更
  async function handleRename(id, newName) {
    await setDoc(doc(db, 'schedules', id), { name: newName }, { merge: true })
  }

  // 工程表を削除
  async function handleDelete(id) {
    if (unsubscribeRef.current) unsubscribeRef.current()
    await deleteDoc(doc(db, 'schedules', id))
    setCurrentId(null)
    setScheduleData(null)
  }

  // グリッドデータをFirestoreへ保存（debounce 1秒）
  function scheduleSave(updatedData) {
    setSaveStatus('unsaved')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!currentId) return
      setSaveStatus('saving')
      try {
        await setDoc(doc(db, 'schedules', currentId), {
          ...updatedData,
          updatedAt: serverTimestamp(),
        })
        setSaveStatus('saved')
      } catch (e) {
        console.error('保存エラー:', e)
        setSaveStatus('unsaved')
      }
    }, 1000)
  }

  // グローバルノートをFirestoreへ保存（debounce 1秒）
  function saveGlobalNotes(notes) {
    clearTimeout(notesSaveTimer.current)
    notesSaveTimer.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'settings', 'globalNotes'), {
          ...notes,
          updatedAt: serverTimestamp(),
        })
      } catch (e) {
        console.error('ノート保存エラー:', e)
      }
    }, 1000)
  }

  const handleCellChange = useCallback((cellKey, html) => {
    setScheduleData(prev => {
      if (!prev) return prev
      // htmlのみ更新（textAlign/verticalAlignは維持）
      const updated = { ...prev, cells: { ...prev.cells, [cellKey]: { ...prev.cells[cellKey], html } } }
      scheduleSave(updated)
      return updated
    })
  }, [currentId])

  // メモセル変更
  const handleMemoCellChange = useCallback((cellKey, html) => {
    setScheduleData(prev => {
      if (!prev) return prev
      const updated = {
        ...prev,
        memoCells: { ...(prev.memoCells || {}), [cellKey]: { html } },
      }
      scheduleSave(updated)
      return updated
    })
  }, [currentId])

  // 横揃えを選択中の全セルに適用
  const handleHAlignChange = useCallback((textAlign) => {
    setScheduleData(prev => {
      if (!prev) return prev
      const targets = selectedCells.size > 0 ? selectedCells : (selectedCell ? new Set([selectedCell]) : new Set())
      if (targets.size === 0) return prev
      const cells = { ...prev.cells }
      for (const key of targets) {
        cells[key] = { ...(cells[key] || {}), textAlign }
      }
      const updated = { ...prev, cells }
      scheduleSave(updated)
      return updated
    })
  }, [selectedCells, selectedCell, currentId])

  // 縦揃えを選択中の全セルに適用
  const handleVAlignChange = useCallback((verticalAlign) => {
    setScheduleData(prev => {
      if (!prev) return prev
      const targets = selectedCells.size > 0 ? selectedCells : (selectedCell ? new Set([selectedCell]) : new Set())
      if (targets.size === 0) return prev
      const cells = { ...prev.cells }
      for (const key of targets) {
        cells[key] = { ...(cells[key] || {}), verticalAlign }
      }
      const updated = { ...prev, cells }
      scheduleSave(updated)
      return updated
    })
  }, [selectedCells, selectedCell, currentId])

  const handleColWidthChange = useCallback((ci, width) => {
    setScheduleData(prev => {
      if (!prev) return prev
      const colWidths = [...prev.colWidths]
      colWidths[ci] = width
      const updated = { ...prev, colWidths }
      scheduleSave(updated)
      return updated
    })
  }, [currentId])

  const handleRowHeightChange = useCallback((ri, height) => {
    setScheduleData(prev => {
      if (!prev) return prev
      const rowHeights = [...prev.rowHeights]
      rowHeights[ri] = height
      const updated = { ...prev, rowHeights }
      scheduleSave(updated)
      return updated
    })
  }, [currentId])

  function changeGridSize(newRows, newCols) {
    setScheduleData(prev => {
      if (!prev) return prev
      const rowHeights = Array(newRows).fill(DEFAULT_ROW_HEIGHT)
      prev.rowHeights.forEach((h, i) => { if (i < newRows) rowHeights[i] = h })
      const colWidths = [...DEFAULT_COL_WIDTHS.slice(0, newCols)]
      prev.colWidths.forEach((w, i) => { if (i < newCols) colWidths[i] = w })
      while (colWidths.length < newCols) colWidths.push(120)
      const updated = { ...prev, rows: newRows, cols: newCols, rowHeights, colWidths }
      scheduleSave(updated)
      return updated
    })
  }

  // 工程表作成後のフォーカス復帰（Electronでモーダル操作後にキーボード入力が効かなくなる問題の対策）
  useEffect(() => {
    if (!focusOnLoad.current || !scheduleData) return
    focusOnLoad.current = false
    setTimeout(() => {
      // 既存のフォーカスを完全にクリア（IME状態リセット）
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        document.activeElement.blur()
      }
      // Electron に webContents フォーカス復帰を依頼
      window.electronAPI?.focusWebContents?.()
      // 次のフレームで最初のセルにフォーカス+クリックを発火（IME再初期化）
      requestAnimationFrame(() => {
        const firstCell = document.querySelector('[data-cell-key][contenteditable="true"]')
        if (firstCell) {
          firstCell.focus()
          firstCell.click()
        }
      })
    }, 200)
  }, [scheduleData])

  // 画面全体にフィットするzoomを計算
  useEffect(() => {
    if (!scheduleData) return
    function calcZoom() {
      // UI上部の高さ（ヘッダー＋ツールバー＋操作バー）
      const UI_H = 130
      const gridH = (scheduleData.rowHeights || []).reduce((a, b) => a + b, 0)
      const notesH = 300 // 下部予定欄の概算高さ
      const totalH = gridH + notesH
      const memoW = 200 // メモ欄: 2列 × 100px
      const totalW = (scheduleData.colWidths || []).reduce((a, b) => a + b, 0) + memoW
      const availH = window.innerHeight - UI_H
      const availW = window.innerWidth
      const newZoom = Math.min(availH / totalH, availW / totalW, 1)
      setPrintAreaZoom(Math.max(newZoom, 0.3))
    }
    calcZoom()
    window.addEventListener('resize', calcZoom)
    return () => window.removeEventListener('resize', calcZoom)
  }, [scheduleData])

  // グローバルノート変更
  const handleNotesChange = useCallback((newNotes) => {
    setGlobalNotes(newNotes)
    saveGlobalNotes(newNotes)
  }, [])

  // 複数工程表を一括削除
  async function handleBulkDelete(ids) {
    if (!window.confirm(`${ids.size}件の工程表を削除しますか？`)) return
    for (const id of ids) {
      await deleteDoc(doc(db, 'schedules', id))
    }
    // 現在表示中の工程表が含まれていたら選択解除
    if (ids.has(currentId)) {
      if (unsubscribeRef.current) unsubscribeRef.current()
      setCurrentId(null)
      setScheduleData(null)
    }
    setShowManager(false)
  }

  // 複数工程表をPDF一括出力
  async function handleBulkExportPDF(ids) {
    if (!window.electronAPI?.printToPDFPath) {
      alert('PDF一括出力はElectronアプリ専用です')
      return
    }
    // 保存先フォルダを1回選択
    const folderPath = await window.electronAPI.selectFolder()
    if (!folderPath) return

    const idList = [...ids]
    setExportProgress({ current: 0, total: idList.length })

    const prevId = currentId
    const prevData = scheduleData

    // #a4-print-pageをDOMに存在させるためプレビューを表示したままループ
    setShowPrintPreview(true)
    await new Promise(r => setTimeout(r, 300))

    for (let i = 0; i < idList.length; i++) {
      const id = idList[i]
      // Firestoreから直接データ取得
      const snap = await getDoc(doc(db, 'schedules', id))
      if (!snap.exists()) continue
      const data = snap.data()

      // React に一時的にレンダリングさせる
      const storedHeights = data.rowHeights ?? Array(data.rows ?? DEFAULT_ROWS).fill(DEFAULT_ROW_HEIGHT)
      const rowHeights = storedHeights.every(h => h === 48)
        ? Array(storedHeights.length).fill(DEFAULT_ROW_HEIGHT)
        : storedHeights
      setScheduleData({
        rows: data.rows ?? DEFAULT_ROWS,
        cols: data.cols ?? DEFAULT_COLS,
        colWidths: data.colWidths ?? DEFAULT_COL_WIDTHS,
        rowHeights,
        cells: data.cells ?? {},
        memoCells: data.memoCells ?? {},
        name: data.name,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
      })

      // レンダリング完了を待機
      await new Promise(r => setTimeout(r, 600))

      // PDF出力
      const result = await window.electronAPI.printToPDFPath(folderPath, data.name || `schedule_${id}`)
      if (!result.success) {
        console.error('PDF出力失敗:', result.error)
      }

      setExportProgress({ current: i + 1, total: idList.length })
    }

    // プレビューを閉じて元の工程表に戻す
    setShowPrintPreview(false)
    if (prevId) {
      setScheduleData(prevData)
      setCurrentId(prevId)
    } else {
      setScheduleData(null)
      setCurrentId(null)
    }

    setExportProgress(null)
    alert(`PDF出力完了：${idList.length}件を「${folderPath}」に保存しました`)
    setShowManager(false)
  }

  // 次の週の工程表を作成（現在の右2列→新しい工程表の左2列にコピー）
  async function handleCreateNextWeek() {
    if (!scheduleData || !currentId) return

    const { rows, cols, colWidths, rowHeights, cells } = scheduleData
    const halfCols = Math.floor(cols / 2)

    // 右半分の列インデックス（例: cols=4 → [2, 3]）
    const rightCols = Array.from({ length: halfCols }, (_, i) => i + halfCols)

    // 右列（c2, c3）→ 左列（c0, c1）にコピー
    const newCells = {}
    for (let ri = 0; ri < rows; ri++) {
      rightCols.forEach((srcCol, dstIdx) => {
        const srcKey = `r${ri}_c${srcCol}`
        if (cells[srcKey]) {
          newCells[`r${ri}_c${dstIdx}`] = { ...cells[srcKey] }
        }
      })
    }

    // 列幅: 右列の幅→左列にコピー
    const newColWidths = [...colWidths]
    rightCols.forEach((srcCol, dstIdx) => {
      newColWidths[dstIdx] = colWidths[srcCol]
    })

    // 日付がある場合: startDate+7日（1週間スライド）から新しい14日間を計算
    // → 元の2週目（c2/c3）が新しい1週目（c0/c1）になり、新しい2週目（c2/c3）が追加される
    let newStartDate = null, newEndDate = null, newName
    if (scheduleData.startDate && scheduleData.endDate) {
      newStartDate = addDays(scheduleData.startDate, 7)
      newEndDate = addDays(newStartDate, 13)
      newName = formatDateRange(newStartDate, newEndDate)
      // c0/c2 の日付を新しい期間で上書き（コピーされた旧日付を差し替え）
      Object.assign(newCells, generateDateCells(newStartDate, rows))
    } else {
      newName = `${scheduleData.name || ''}（次週）`
    }

    const newId = Date.now().toString()
    await setDoc(doc(db, 'schedules', newId), {
      name: newName,
      startDate: newStartDate,
      endDate: newEndDate,
      rows,
      cols,
      colWidths: newColWidths,
      rowHeights,
      cells: newCells,
      updatedAt: serverTimestamp(),
    })

    // 作成後すぐ新しい工程表に切り替え（フォーカス復帰フラグをセット）
    focusOnLoad.current = true
    selectSchedule(newId)
  }

  // 印刷プレビューを表示
  function handlePrint() {
    setShowPrintPreview(true)
  }

  // プレビューから印刷実行
  async function handlePrintExecute() {
    if (window.electronAPI?.printPage) {
      // Electron環境：モーダルを閉じる前にPDF生成（閉じるとDOM上の#a4-print-pageが消えて空白になるため）
      await window.electronAPI.printPage()
      setShowPrintPreview(false)
    } else {
      // ブラウザ環境：従来通り window.print()
      setShowPrintPreview(false)
      setTimeout(() => window.print(), 100)
    }
  }

  // PDF出力
  async function handleExportPDF() {
    if (window.electronAPI?.printToPDF) {
      // #a4-print-pageがDOMに存在する必要があるためプレビューを一時表示してからPDF生成
      setShowPrintPreview(true)
      await new Promise(r => setTimeout(r, 400))
      const result = await window.electronAPI.printToPDF(scheduleData?.name || '工程表')
      setShowPrintPreview(false)
      if (!result.success && result.error) {
        alert('PDF出力に失敗しました: ' + result.error)
      }
    } else {
      // ブラウザの場合は印刷ダイアログ（PDF選択）
      window.print()
    }
  }

  const statusLabel = { saved: '✓ 保存済み', saving: '保存中…', unsaved: '● 未保存' }
  const statusColor = { saved: '#43a047', saving: '#ff9800', unsaved: '#e53935' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* 印刷プレビューモーダル */}
      {showPrintPreview && scheduleData && (
        <PrintPreviewModal
          scheduleData={scheduleData}
          globalNotes={globalNotes}
          onPrint={handlePrintExecute}
          onClose={() => setShowPrintPreview(false)}
        />
      )}
      {/* 印刷用スタイル */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden !important; }
          #a4-print-page {
            visibility: visible !important;
            display: block !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 794px !important;
            height: 1123px !important;
            transform: none !important;
            overflow: hidden !important;
            background: white !important;
          }
          #a4-print-page * { visibility: visible !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* 工程表管理モーダル */}
      {showManager && (
        <ScheduleManagerModal
          schedules={schedules}
          exportProgress={exportProgress}
          onClose={() => setShowManager(false)}
          onBulkDelete={handleBulkDelete}
          onBulkExportPDF={handleBulkExportPDF}
          onRename={handleRename}
        />
      )}

      {/* ヘッダー（印刷非表示） */}
      <div className="no-print">
        <ScheduleSelector
          schedules={schedules}
          currentId={currentId}
          currentName={scheduleData?.name || ''}
          onSelect={selectSchedule}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onOpenManager={() => setShowManager(true)}
          onCreateNextWeek={handleCreateNextWeek}
          onRename={name => handleRename(currentId, name)}
        />
      </div>

      {scheduleData ? (
        <>
          {/* ツールバー（印刷非表示） */}
          <div className="no-print">
            <Toolbar
              savedSelection={savedSelection}
              activeCellData={selectedCell ? (scheduleData.cells[selectedCell] || {}) : {}}
              onHAlignChange={handleHAlignChange}
              onVAlignChange={handleVAlignChange}
              onFormat={() => {
                if (selectedCell) {
                  const el = document.querySelector('[data-cell-key="' + selectedCell + '"]')
                    || document.activeElement
                  if (el) handleCellChange(selectedCell, el.innerHTML)
                } else if (selectedMemoCell) {
                  // メモセルへの書式適用後にFirestoreへ保存
                  const el = document.querySelector('[data-memo-key="' + selectedMemoCell + '"]')
                    || document.activeElement
                  if (el) handleMemoCellChange(selectedMemoCell, el.innerHTML)
                } else if (activeNotesField.current) {
                  // ノート欄への書式適用後にFirestoreへ保存
                  const { element, field } = activeNotesField.current
                  if (element) handleNotesChange({ ...globalNotes, [field]: element.innerHTML })
                }
              }}
            />
          </div>

          {/* 操作バー（印刷非表示） */}
          <div className="no-print" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '4px 10px', background: '#fafafa',
            borderBottom: '1px solid #ddd', fontSize: '13px',
          }}>
            <button
              onClick={handlePrint}
              style={{
                marginLeft: '12px', padding: '3px 12px',
                background: '#455a64', color: 'white',
                border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontSize: '13px',
              }}
            >🖨️ 印刷</button>
            <button
              onClick={handleExportPDF}
              style={{
                padding: '3px 12px',
                background: '#c62828', color: 'white',
                border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontSize: '13px',
              }}
            >📄 PDF出力</button>
            <span style={{ marginLeft: 'auto', color: statusColor[saveStatus], fontSize: '12px' }}>
              {statusLabel[saveStatus]}
            </span>
          </div>

          {/* 印刷対象エリア */}
          <div className="print-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
          <div ref={printAreaRef} style={{ zoom: printAreaZoom, display: 'flex', flexDirection: 'column', flex: 1 }}>
            {/* 外枠ボーダー（印刷時も表示） */}
            <div className="print-outer-border" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              {/* グリッドとメモ欄を横並びに配置 */}
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
                <ScheduleGrid
                  rows={scheduleData.rows}
                  cols={scheduleData.cols}
                  colWidths={scheduleData.colWidths}
                  rowHeights={scheduleData.rowHeights}
                  cells={scheduleData.cells}
                  selectedCell={selectedCell}
                  onSelectCell={handleSelectCell}
                  selectedCells={selectedCells}
                  onSelectCells={setSelectedCells}
                  onCellChange={handleCellChange}
                  onSaveSelection={setSavedSelection}
                  onRowHeightChange={handleRowHeightChange}
                />
                {/* メモ欄（グリッド右側、印刷対象外） */}
                <div className="no-print">
                  <MemoSection
                    memoCells={scheduleData.memoCells || {}}
                    selectedCell={selectedMemoCell}
                    onSelectCell={handleSelectMemoCell}
                    onCellChange={handleMemoCellChange}
                    onSaveSelection={setSavedSelection}
                    onFocusEnter={() => {
                      setSelectedCell(null)
                      setSelectedCells(new Set())
                      activeNotesField.current = null
                    }}
                  />
                </div>
              </div>
              <NotesSection
                notes={globalNotes}
                onChange={handleNotesChange}
                onSaveSelection={setSavedSelection}
                onActiveField={info => { activeNotesField.current = info }}
                onFocusEnter={() => { setSelectedCell(null); setSelectedCells(new Set()); setSelectedMemoCell(null) }}
              />
            </div>
          </div>{/* zoom wrapper */}
          </div>{/* print-area */}
        </>
      ) : (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '16px', color: '#999',
        }}>
          <div style={{ fontSize: '48px' }}>📋</div>
          <div style={{ fontSize: '18px' }}>工程表を選択、または新規作成してください</div>
        </div>
      )}
    </div>
  )
}
