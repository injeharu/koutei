import { useRef, useEffect, useCallback } from 'react'

// 1つのセル（contentEditable）- 横/縦揃え・複数選択対応
export default function RichTextCell({
  cellKey,
  html,
  colWidth,
  rowHeight,
  rowIndex,
  colIndex,
  textAlign = 'center',
  verticalAlign = 'middle',
  isSelected,
  isMultiSelected,
  isResizingCol,
  isResizingRow,
  onSelect,
  onChange,
  onSaveSelection,
  onRowHeightChange,
}) {
  const divRef = useRef(null)

  // 外部からhtmlが更新された時のみDOMを更新（カーソル位置を壊さないため）
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    if (document.activeElement !== el && el.innerHTML !== (html || '')) {
      el.innerHTML = html || ''
    }
  }, [html])

  // 入力のたびにonChangeを呼ぶ（debounceはApp側）
  const handleInput = useCallback(() => {
    onChange(cellKey, divRef.current.innerHTML)
  }, [cellKey, onChange])

  // テキスト選択が変わったらツールバー用に保存
  const handleSelectionChange = useCallback(() => {
    if (document.activeElement !== divRef.current) return
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      onSaveSelection(sel.getRangeAt(0).cloneRange())
    }
  }, [onSaveSelection])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  // 内側 contentEditable div の実コンテンツ高さを監視して親へ報告
  // wrapperではなく内側divを監視する（wrapperはminHeight: rowHeightで縮まないため）
  // 通知高さ = contentRect.height（コンテンツ）+ padding上下(8px) + border(2px)
  useEffect(() => {
    if (!divRef.current || !onRowHeightChange || rowIndex == null || colIndex == null) return
    const el = divRef.current
    const observer = new ResizeObserver(entries => {
      const contentH = Math.ceil(entries[0].contentRect.height)
      const totalH = contentH + 8 + 2  // padding(4px*2) + border(1px*2)
      onRowHeightChange(rowIndex, colIndex, totalH)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [rowIndex, colIndex, onRowHeightChange])

  // Enterキーで<br>改行（divが増えないようにする）
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak')
    }
  }

  // 縦揃えをflexboxで表現
  const vJustify = verticalAlign === 'top' ? 'flex-start'
    : verticalAlign === 'bottom' ? 'flex-end'
    : 'center'

  // 選択状態のスタイル
  const borderColor = isSelected ? '#1565c0'
    : isMultiSelected ? '#42a5f5'
    : '#ccc'
  const borderWidth = (isSelected || isMultiSelected) ? '2px' : '1px'
  const bgColor = isSelected ? '#e3f2fd'
    : isMultiSelected ? '#f0f8ff'
    : 'white'

  return (
    <div
      style={{
        width: colWidth,
        minHeight: rowHeight,    // ← 内容が増えたら縦に自動拡張（固定高さから変更）
        height: '100%',          // 同じ行で隣のセルが伸びた時に追従させる
        border: `${borderWidth} solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: vJustify,
        overflowX: 'hidden',     // 横はみ出しのみ隠す（縦は自由）
        background: bgColor,
        cursor: 'text',
        boxSizing: 'border-box',
      }}
      onMouseDown={e => {
        if (isResizingCol || isResizingRow) return
        // Shift/Ctrl クリックはフォーカスを奪わず選択だけ
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault()
        }
        onSelect(cellKey, e)
        // ラッパー自体をクリックした場合は内側にフォーカスを移す
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && e.target === e.currentTarget) {
          setTimeout(() => divRef.current?.focus(), 0)
        }
      }}
    >
      <div
        ref={divRef}
        data-cell-key={cellKey}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          textAlign,
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
  )
}
