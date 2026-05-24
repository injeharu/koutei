import { useState, useEffect, useRef } from 'react'

// テキスト書式ツールバー（Excelライクなアクティブ状態付き）
export default function Toolbar({ savedSelection, onFormat, activeCellData, onHAlignChange, onVAlignChange }) {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [boldActive, setBoldActive] = useState(false)
  const [underlineActive, setUnderlineActive] = useState(false)
  const [currentColor, setCurrentColor] = useState('#000000')
  const pickerRef = useRef(null)

  const COLORS = [
    { label: '黒', value: '#000000' },
    { label: '赤', value: '#e53935' },
    { label: '青', value: '#1565c0' },
    { label: '緑', value: '#2e7d32' },
    { label: '橙', value: '#e65100' },
    { label: '紫', value: '#6a1b9a' },
    { label: '灰', value: '#757575' },
  ]

  const SIZES = ['10', '12', '14', '16', '18', '20', '24']

  // カーソル位置の書式状態をリアルタイム取得
  useEffect(() => {
    function updateActiveState() {
      try {
        setBoldActive(document.queryCommandState('bold'))
        setUnderlineActive(document.queryCommandState('underline'))
        const rawColor = document.queryCommandValue('foreColor')
        if (rawColor) {
          const hex = rgbToHex(rawColor)
          if (hex.startsWith('#')) setCurrentColor(hex)
        }
      } catch (e) {}
    }
    document.addEventListener('selectionchange', updateActiveState)
    return () => document.removeEventListener('selectionchange', updateActiveState)
  }, [])

  // ツールバー外クリックでカラーピッカーを閉じる
  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowColorPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function restoreAndExec(command, value) {
    if (savedSelection) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedSelection)
    }
    document.execCommand(command, false, value)
    onFormat?.()
  }

  function applyColor(color) {
    restoreAndExec('foreColor', color)
    setCurrentColor(color)
    setShowColorPicker(false)
  }

  // 文字サイズ適用
  function applySize(size) {
    if (savedSelection) {
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(savedSelection)
    }

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return

    const range = sel.getRangeAt(0)

    // 選択範囲を抽出し、内側の既存 font-size を除去してから新しい span でラップ
    // （外側からラップする方式だと内側 span の font-size が CSS カスケードで優先されるため）
    const fragment = range.extractContents()
    stripFontSize(fragment)

    const span = document.createElement('span')
    span.style.fontSize = size + 'px'
    span.appendChild(fragment)
    range.insertNode(span)

    // 新しい span を再選択（次の操作のために）
    const newRange = document.createRange()
    newRange.selectNodeContents(span)
    sel.removeAllRanges()
    sel.addRange(newRange)

    onFormat?.()
  }

  // 要素ツリー内の全 span/font から font-size 指定を除去
  function stripFontSize(root) {
    const elements = root.querySelectorAll ? root.querySelectorAll('[style]') : []
    for (const el of elements) {
      el.style.fontSize = ''
    }
    if (root.style) root.style.fontSize = ''
  }

  const textAlign = activeCellData?.textAlign || 'center'
  const verticalAlign = activeCellData?.verticalAlign || 'middle'

  const base = {
    padding: '3px 8px',
    margin: '0 1px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '13px',
    lineHeight: '1.4',
  }

  // アクティブ状態のスタイル
  const btn = (active) => ({
    ...base,
    background: active ? '#1565c0' : 'white',
    color: active ? 'white' : '#333',
    borderColor: active ? '#1565c0' : '#ccc',
    fontWeight: active ? 'bold' : 'normal',
  })

  const divider = (
    <div style={{ width: '1px', height: '20px', background: '#ddd', margin: '0 4px' }} />
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px',
      padding: '4px 8px', background: '#f8f8f8',
      borderBottom: '1px solid #ddd', flexWrap: 'wrap', userSelect: 'none',
    }}>
      {/* 太字 */}
      <button
        style={{ ...btn(boldActive), fontWeight: 'bold' }}
        onMouseDown={e => { e.preventDefault(); restoreAndExec('bold') }}
        title="太字 (Ctrl+B)"
      >B</button>

      {/* 下線 */}
      <button
        style={{ ...btn(underlineActive), textDecoration: underlineActive ? 'none' : 'underline' }}
        onMouseDown={e => { e.preventDefault(); restoreAndExec('underline') }}
        title="下線 (Ctrl+U)"
      >U</button>

      {/* 書式クリア */}
      <button
        style={btn(false)}
        onMouseDown={e => { e.preventDefault(); restoreAndExec('removeFormat') }}
        title="書式をクリア"
      >✕書式</button>

      {divider}

      {/* フォントサイズ */}
      <select
        style={{ ...base, padding: '2px 4px', background: 'white', margin: '0 1px' }}
        value=""
        onMouseDown={e => e.stopPropagation()}
        onChange={e => { applySize(e.target.value); e.target.value = '' }}
        title="文字サイズ"
      >
        <option value="" disabled>サイズ</option>
        {SIZES.map(s => (
          <option key={s} value={s}>{s}px</option>
        ))}
      </select>

      {divider}

      {/* 文字色（現在色をバーで表示） */}
      <div style={{ position: 'relative' }} ref={pickerRef}>
        <button
          style={{ ...base, padding: '2px 8px 1px', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '38px', background: 'white' }}
          onMouseDown={e => { e.preventDefault(); setShowColorPicker(v => !v) }}
          title="文字色"
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px', lineHeight: '1.2' }}>A色▼</span>
          <div style={{ width: '100%', height: '4px', background: currentColor, borderRadius: '2px', marginTop: '2px' }} />
        </button>

        {showColorPicker && (
          <div style={{
            position: 'absolute', top: '34px', left: 0,
            background: 'white', border: '1px solid #ccc',
            borderRadius: '4px', padding: '6px',
            display: 'flex', gap: '4px', zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            {COLORS.map(c => (
              <button
                key={c.value}
                title={c.label}
                onMouseDown={e => { e.preventDefault(); applyColor(c.value) }}
                style={{
                  width: '24px', height: '24px', background: c.value,
                  border: c.value === currentColor ? '2px solid #333' : '1px solid #999',
                  borderRadius: '3px', cursor: 'pointer',
                }}
              />
            ))}
            <input
              type="color"
              title="カスタムカラー"
              style={{ width: '24px', height: '24px', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => applyColor(e.target.value)}
            />
          </div>
        )}
      </div>

      {divider}

      {/* 横揃え */}
      <span style={{ fontSize: '11px', color: '#888', marginRight: '1px' }}>横:</span>
      <button
        style={btn(textAlign === 'left')}
        onMouseDown={e => { e.preventDefault(); onHAlignChange?.('left') }}
        title="左揃え"
      >左</button>
      <button
        style={btn(textAlign === 'center')}
        onMouseDown={e => { e.preventDefault(); onHAlignChange?.('center') }}
        title="中央揃え"
      >中</button>
      <button
        style={btn(textAlign === 'right')}
        onMouseDown={e => { e.preventDefault(); onHAlignChange?.('right') }}
        title="右揃え"
      >右</button>

      {divider}

      {/* 縦揃え */}
      <span style={{ fontSize: '11px', color: '#888', marginRight: '1px' }}>縦:</span>
      <button
        style={btn(verticalAlign === 'top')}
        onMouseDown={e => { e.preventDefault(); onVAlignChange?.('top') }}
        title="上揃え"
      >上</button>
      <button
        style={btn(verticalAlign === 'middle')}
        onMouseDown={e => { e.preventDefault(); onVAlignChange?.('middle') }}
        title="中央揃え"
      >中</button>
      <button
        style={btn(verticalAlign === 'bottom')}
        onMouseDown={e => { e.preventDefault(); onVAlignChange?.('bottom') }}
        title="下揃え"
      >下</button>
    </div>
  )
}

// rgb(r,g,b) → #rrggbb
function rgbToHex(rgb) {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return '#000000'
  return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
}
