import { useState, useRef, useEffect } from 'react'
import DatePickerModal from './DatePickerModal'

// 工程表の選択・新規作成・削除・名前変更
export default function ScheduleSelector({
  schedules, currentId, currentName,
  onSelect, onCreate, onDelete, onOpenManager, onCreateNextWeek, onRename,
}) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showRename, setShowRename] = useState(false)
  const [renameName, setRenameName] = useState('')
  const renameRef = useRef(null)

  // 名前変更入力欄が表示されたらフォーカス
  useEffect(() => {
    if (showRename && renameRef.current) {
      setTimeout(() => renameRef.current?.focus(), 50)
    }
  }, [showRename])

  function handleRenameStart() {
    setRenameName(currentName || '')
    setShowRename(true)
  }

  function handleRenameCommit() {
    const name = renameName.trim()
    if (name && name !== currentName) onRename(name)
    setShowRename(false)
  }

  function handleCreate(params) {
    onCreate(params)
    setShowDatePicker(false)
  }

  return (
    <>
      {/* カレンダーモーダル */}
      {showDatePicker && (
        <DatePickerModal
          onConfirm={handleCreate}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        background: '#1565c0',
        color: 'white',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '15px', marginRight: '8px' }}>📋 工程表管理</span>

        {/* 工程表選択ドロップダウン */}
        <select
          value={currentId || ''}
          onChange={e => onSelect(e.target.value)}
          style={{
            padding: '4px 8px',
            fontSize: '13px',
            borderRadius: '4px',
            border: 'none',
            minWidth: '160px',
          }}
        >
          <option value="" disabled>工程表を選択...</option>
          {schedules.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* 新規作成・次の週を作成 */}
        <button onClick={() => setShowDatePicker(true)} style={btnStyle('#43a047')}>＋ 新規作成</button>
        {currentId && (
          <button onClick={onCreateNextWeek} style={btnStyle('#0277bd')}>📅 次の週を作成</button>
        )}

        {/* 名前変更（工程表選択中のみ） */}
        {currentId && !showRename && (
          <button onClick={handleRenameStart} style={btnStyle('#546e7a')} title="表示名を変更">✏</button>
        )}
        {showRename && (
          <>
            <input
              ref={renameRef}
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameCommit()
                if (e.key === 'Escape') setShowRename(false)
              }}
              style={{ padding: '4px 8px', fontSize: '13px', borderRadius: '4px', border: 'none', width: '160px' }}
            />
            <button onClick={handleRenameCommit} style={btnStyle('#43a047')}>変更</button>
            <button onClick={() => setShowRename(false)} style={btnStyle('#757575')}>×</button>
          </>
        )}

        {/* 削除ボタン */}
        {currentId && !showRename && (
          <button
            onClick={() => {
              if (window.confirm('この工程表を削除しますか？')) onDelete(currentId)
            }}
            style={btnStyle('#c62828')}
          >削除</button>
        )}

        {/* 管理ボタン（一括削除・PDF一括出力） */}
        <button
          onClick={onOpenManager}
          style={{ ...btnStyle('#0d47a1'), marginLeft: 'auto' }}
        >⚙ 管理</button>
      </div>
    </>
  )
}

function btnStyle(bg) {
  return {
    padding: '4px 10px',
    background: bg,
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  }
}
