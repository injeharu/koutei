import { useState, useRef, useEffect } from 'react'
import { formatDateRange } from '../utils/dateUtils'

// 工程表管理ダイアログ（複数選択・一括削除・PDF一括出力・名前変更）
export default function ScheduleManagerModal({
  schedules,
  exportProgress,
  onClose,
  onBulkDelete,
  onBulkExportPDF,
  onRename,
}) {
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef(null)

  // 名前変更入力欄が表示されたらフォーカス
  useEffect(() => {
    if (editingId && editInputRef.current) {
      setTimeout(() => editInputRef.current?.focus(), 30)
    }
  }, [editingId])

  const allChecked = schedules.length > 0 && checkedIds.size === schedules.length
  const someChecked = checkedIds.size > 0

  function toggleAll() {
    if (allChecked) {
      setCheckedIds(new Set())
    } else {
      setCheckedIds(new Set(schedules.map(s => s.id)))
    }
  }

  function toggleOne(id) {
    const next = new Set(checkedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCheckedIds(next)
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditingName(s.name)
  }

  function commitEdit() {
    const name = editingName.trim()
    if (name && editingId) onRename(editingId, name)
    setEditingId(null)
    setEditingName('')
  }

  const isExporting = exportProgress !== null

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 9000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        width: 460,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* ヘッダー */}
        <div style={{
          background: '#1565c0', color: 'white',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '15px', flex: 1 }}>
            📋 工程表管理
          </span>
          <button onClick={toggleAll} style={headerBtn('#1976d2')}>
            {allChecked ? '全解除' : '全選択'}
          </button>
          <button onClick={onClose} style={headerBtn('#546e7a')}>✕ 閉じる</button>
        </div>

        {/* 工程表リスト */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {schedules.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#999' }}>
              工程表がありません
            </div>
          ) : (
            schedules.map(s => (
              <div
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px',
                  borderBottom: '1px solid #eee',
                  background: checkedIds.has(s.id) ? '#e3f2fd' : 'white',
                  transition: 'background 0.1s',
                }}
              >
                {/* チェックボックス */}
                <input
                  type="checkbox"
                  checked={checkedIds.has(s.id)}
                  onChange={() => toggleOne(s.id)}
                  style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                />

                {/* 工程表名 or 編集中 */}
                {editingId === s.id ? (
                  <>
                    <input
                      ref={editInputRef}
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') { setEditingId(null) }
                      }}
                      style={{
                        flex: 1, padding: '3px 6px', fontSize: '13px',
                        border: '1px solid #1565c0', borderRadius: '4px',
                      }}
                    />
                    <button onClick={commitEdit} style={smallBtn('#43a047')}>変更</button>
                    <button onClick={() => setEditingId(null)} style={smallBtn('#757575')}>×</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name}
                      </div>
                      {s.startDate && (
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                          {formatDateRange(s.startDate, s.endDate)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(s)}
                      title="名前を変更"
                      style={{ ...smallBtn('#546e7a'), padding: '2px 8px', fontSize: '12px' }}
                    >✏</button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* フッター操作ボタン */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid #ddd',
          display: 'flex', gap: '8px',
          background: '#fafafa',
        }}>
          {isExporting ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: '10px',
              color: '#1565c0', fontSize: '14px',
            }}>
              <span style={{ fontSize: '18px' }}>⏳</span>
              PDF出力中… {exportProgress.current} / {exportProgress.total} 件
            </div>
          ) : (
            <>
              <button
                onClick={() => someChecked && onBulkExportPDF(checkedIds)}
                disabled={!someChecked}
                style={actionBtn('#c62828', !someChecked)}
                title="選択した工程表をPDFで一括保存"
              >
                📄 PDF一括出力 {someChecked ? `(${checkedIds.size}件)` : ''}
              </button>
              <button
                onClick={() => someChecked && onBulkDelete(checkedIds)}
                disabled={!someChecked}
                style={actionBtn('#37474f', !someChecked)}
                title="選択した工程表を削除"
              >
                🗑 選択消去 {someChecked ? `(${checkedIds.size}件)` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function headerBtn(bg) {
  return {
    padding: '4px 12px', background: bg, color: 'white',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
    cursor: 'pointer', fontSize: '12px',
  }
}

function smallBtn(bg) {
  return {
    padding: '3px 10px', background: bg, color: 'white',
    border: 'none', borderRadius: '4px',
    cursor: 'pointer', fontSize: '12px', flexShrink: 0,
  }
}

function actionBtn(bg, disabled) {
  return {
    padding: '7px 14px', background: disabled ? '#ccc' : bg,
    color: 'white', border: 'none', borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px', flex: 1,
  }
}
