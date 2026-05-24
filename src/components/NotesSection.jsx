import { useRef, useEffect, useCallback } from 'react'

// 今後の予定欄（会社2つ分）
export default function NotesSection({ notes, onChange }) {
  const c1NameRef = useRef(null)
  const c2NameRef = useRef(null)
  const c1ContentRef = useRef(null)
  const c2ContentRef = useRef(null)
  const freeTextRef = useRef(null)
  const remarksRef = useRef(null)

  // 外部更新時にDOMを反映（フォーカス中は更新しない）
  useEffect(() => {
    syncRef(c1NameRef, notes.company1Name)
    syncRef(c2NameRef, notes.company2Name)
    syncRef(c1ContentRef, notes.company1Content)
    syncRef(c2ContentRef, notes.company2Content)
    syncRef(freeTextRef, notes.freeText)
    syncRef(remarksRef, notes.remarks)
  }, [notes])

  function syncRef(ref, value) {
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || ''
    }
  }

  const handleChange = useCallback((field, value) => {
    onChange({ ...notes, [field]: value })
  }, [notes, onChange])

  return (
    <div style={{
      borderTop: '2px solid #1565c0',
      background: 'white',
      flexShrink: 0,
    }}>
      {/* 会社2列（全体幅の1/2で中央配置） */}
      <div style={{
        display: 'flex',
        width: '50%',
        margin: '0 auto',
        borderBottom: '1px solid #ccc',
        borderLeft: '1px solid #ccc',
        borderRight: '1px solid #ccc',
      }}>
        {/* 会社1 */}
        <div style={{ flex: 1, borderRight: '1px solid #ccc' }}>
          {/* 会社名ヘッダー */}
          <div
            ref={c1NameRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => handleChange('company1Name', e.currentTarget.innerHTML)}
            style={headerStyle}
            data-placeholder="会社名・現場名を入力"
          />
          {/* 内容 */}
          <div
            ref={c1ContentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => handleChange('company1Content', e.currentTarget.innerHTML)}
            style={contentStyle}
            data-placeholder="予定を入力（例：1. 人孔蓋取替）"
          />
        </div>

        {/* 会社2 */}
        <div style={{ flex: 1 }}>
          <div
            ref={c2NameRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => handleChange('company2Name', e.currentTarget.innerHTML)}
            style={headerStyle}
            data-placeholder="会社名・現場名を入力"
          />
          <div
            ref={c2ContentRef}
            contentEditable
            suppressContentEditableWarning
            onInput={e => handleChange('company2Content', e.currentTarget.innerHTML)}
            style={contentStyle}
            data-placeholder="予定を入力"
          />
        </div>
      </div>

      {/* 自由入力欄（全幅） */}
      <div
        ref={freeTextRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => handleChange('freeText', e.currentTarget.innerHTML)}
        style={{
          ...contentStyle,
          minHeight: 100,
          borderTop: '1px solid #ccc',
        }}
        data-placeholder="自由記入欄（工程・備考など）"
      />

      {/* ※備考欄 */}
      <div
        ref={remarksRef}
        contentEditable
        suppressContentEditableWarning
        onInput={e => handleChange('remarks', e.currentTarget.innerHTML)}
        style={{
          ...contentStyle,
          minHeight: 60,
          borderTop: '1px solid #eee',
          color: '#333',
          fontSize: '12px',
        }}
        data-placeholder="※備考・メモ（例：※毎週金曜日　工程会議）"
      />
    </div>
  )
}

const headerStyle = {
  padding: '4px 8px',
  background: '#e3f2fd',
  fontWeight: 'bold',
  fontSize: '13px',
  borderBottom: '1px solid #90caf9',
  outline: 'none',
  minHeight: '28px',
  cursor: 'text',
}

const contentStyle = {
  padding: '6px 8px',
  fontSize: '13px',
  lineHeight: '1.8',
  outline: 'none',
  minHeight: '80px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  cursor: 'text',
}
