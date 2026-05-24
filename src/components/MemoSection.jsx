import { useRef, useEffect, useCallback } from 'react'

const MEMO_ROWS = 7
const MEMO_COLS = 2
const CELL_W = 100
const CELL_H = 96

// 工程表ごとのメモ欄（2行×7列、固定サイズ）
export default function MemoSection({
  memoCells = {},
  selectedCell,
  onSelectCell,
  onCellChange,
  onSaveSelection,
  onFocusEnter,
}) {
  const cellRefs = useRef({})

  // 外部からhtmlが更新された時のみDOMを更新（フォーカス中は更新しない）
  useEffect(() => {
    for (let ri = 0; ri < MEMO_ROWS; ri++) {
      for (let ci = 0; ci < MEMO_COLS; ci++) {
        const key = `m${ri}_c${ci}`
        const el = cellRefs.current[key]
        if (!el) continue
        if (document.activeElement !== el) {
          const html = memoCells[key]?.html || ''
          if (el.innerHTML !== html) {
            el.innerHTML = html
          }
        }
      }
    }
  }, [memoCells])

  // テキスト選択が変わったらツールバー用に選択範囲を保存
  const handleSelectionChange = useCallback(() => {
    const active = document.activeElement
    if (!active || !active.getAttribute('data-memo-key')) return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      onSaveSelection(sel.getRangeAt(0).cloneRange())
    }
  }, [onSaveSelection])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  // Enterキーで<br>改行（divが増えないように）
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ラベル */}
      <div style={{
        padding: '2px 8px',
        background: '#f5f5f5',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#666',
        borderTop: '1px solid #ccc',
        borderLeft: '1px solid #ccc',
        borderRight: '1px solid #ccc',
        borderBottom: '1px solid #ddd',
      }}>メモ</div>

      {/* 2行×7列グリッド */}
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {Array.from({ length: MEMO_COLS }, (_, ci) => (
            <col key={ci} style={{ width: CELL_W }} />
          ))}
        </colgroup>
        <tbody>
          {Array.from({ length: MEMO_ROWS }, (_, ri) => (
            <tr key={ri}>
              {Array.from({ length: MEMO_COLS }, (_, ci) => {
                const key = `m${ri}_c${ci}`
                const isSelected = selectedCell === key
                return (
                  <td key={ci} style={{ padding: 0 }}>
                    <div
                      style={{
                        width: CELL_W,
                        height: CELL_H,
                        border: `${isSelected ? '2px' : '1px'} solid ${isSelected ? '#1565c0' : '#ccc'}`,
                        background: isSelected ? '#e3f2fd' : 'white',
                        cursor: 'text',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      }}
                      onMouseDown={e => {
                        // ラッパーのクリックで内側にフォーカス
                        if (e.target === e.currentTarget) {
                          setTimeout(() => cellRefs.current[key]?.focus(), 0)
                        }
                      }}
                    >
                      <div
                        ref={el => { cellRefs.current[key] = el }}
                        data-memo-key={key}
                        contentEditable
                        suppressContentEditableWarning
                        onFocus={() => {
                          onFocusEnter()
                          onSelectCell(key)
                        }}
                        onInput={e => onCellChange(key, e.currentTarget.innerHTML)}
                        onKeyDown={handleKeyDown}
                        style={{
                          outline: 'none',
                          padding: '4px 6px',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          minHeight: '1em',
                        }}
                      />
                    </div>
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
