import { useState, useCallback } from 'react'
import RichTextCell from './RichTextCell'

// デフォルト行高と同じ最小値（これより小さくは縮まない）
const MIN_ROW_HEIGHT = 96

// グリッド（ヘッダー・行番号・リサイズなし）
export default function ScheduleGrid({
  rows,
  cols,
  colWidths,
  rowHeights,
  cells,
  selectedCell,
  onSelectCell,
  selectedCells,
  onSelectCells,
  onCellChange,
  onSaveSelection,
  onRowHeightChange,
}) {
  // セルごとの実コンテンツ高さ（キー: "ri_ci"）
  const [cellContentHeights, setCellContentHeights] = useState({})

  // 各セルからコンテンツ高さを受け取り、行の最大値で rowHeights を更新
  const handleCellContentHeight = useCallback((ri, ci, h) => {
    setCellContentHeights(prev => {
      const key = `${ri}_${ci}`
      if (prev[key] === h) return prev
      const updated = { ...prev, [key]: h }
      const rowMaxH = Math.max(
        MIN_ROW_HEIGHT,
        ...Object.entries(updated)
          .filter(([k]) => k.startsWith(`${ri}_`))
          .map(([, v]) => v)
      )
      onRowHeightChange(ri, rowMaxH)
      return updated
    })
  }, [onRowHeightChange])
  // セルクリック処理（Shift/Ctrl対応）
  function handleCellSelect(key, e) {
    const parseKey = k => {
      const [rp, cp] = k.split('_')
      return [parseInt(rp.slice(1)), parseInt(cp.slice(1))]
    }

    if (e.shiftKey && selectedCell) {
      const [ar, ac] = parseKey(selectedCell)
      const [tr, tc] = parseKey(key)
      const newSet = new Set()
      for (let r = Math.min(ar, tr); r <= Math.max(ar, tr); r++) {
        for (let c = Math.min(ac, tc); c <= Math.max(ac, tc); c++) {
          newSet.add(`r${r}_c${c}`)
        }
      }
      onSelectCells(newSet)
    } else if (e.ctrlKey || e.metaKey) {
      const newSet = new Set(selectedCells)
      if (newSet.has(key)) newSet.delete(key)
      else newSet.add(key)
      onSelectCells(newSet)
      onSelectCell(key)
    } else {
      onSelectCells(new Set([key]))
      onSelectCell(key)
    }
  }

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          width: colWidths.reduce((a, b) => a + b, 0),
        }}
      >
        <colgroup>
          {colWidths.map((w, ci) => (
            <col key={ci} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {Array.from({ length: rows }, (_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }, (_, ci) => {
                const key = `r${ri}_c${ci}`
                const cellData = cells[key] || {}
                return (
                  <td key={ci} style={{ padding: 0 }}>
                    <RichTextCell
                      cellKey={key}
                      html={cellData.html || ''}
                      textAlign={cellData.textAlign || 'center'}
                      verticalAlign={cellData.verticalAlign || 'middle'}
                      colWidth={colWidths[ci]}
                      rowHeight={rowHeights[ri]}
                      rowIndex={ri}
                      colIndex={ci}
                      isSelected={selectedCell === key}
                      isMultiSelected={selectedCells.has(key) && selectedCell !== key}
                      isResizingCol={false}
                      isResizingRow={false}
                      onSelect={handleCellSelect}
                      onChange={onCellChange}
                      onSaveSelection={onSaveSelection}
                      onRowHeightChange={handleCellContentHeight}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
