import { useState } from 'react'
import { addDays, formatDateRange } from '../utils/dateUtils'

const DOW_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// カレンダーモーダル（2週間選択・表示名設定）
export default function DatePickerModal({ onConfirm, onClose }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth()) // 0-indexed
  const [startDate, setStartDate] = useState(null) // "YYYY-MM-DD"
  const [displayName, setDisplayName] = useState('')

  // startDate から endDate を計算
  const endDate = startDate ? addDays(startDate, 13) : null

  // 日付クリック時の処理
  function handleDayClick(dateStr) {
    setStartDate(dateStr)
    const end = addDays(dateStr, 13)
    setDisplayName(formatDateRange(dateStr, end))
  }

  // 前月・次月ナビゲーション
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // カレンダーセルを生成（前後の空白 + 当月の日付）
  function buildCalendarDays() {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay() // 0=日
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days = []
    // 月初の空白
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(viewYear, viewMonth, d))
    }
    return days
  }

  // 日付が選択範囲内かどうか
  function isInRange(date) {
    if (!startDate || !endDate) return false
    const ds = dateToStr(date)
    return ds >= startDate && ds <= endDate
  }
  function isStart(date) { return startDate && dateToStr(date) === startDate }
  function isEnd(date) { return endDate && dateToStr(date) === endDate }

  function dateToStr(date) {
    if (!date) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  function handleConfirm() {
    if (!startDate) return
    // モーダル内の input にフォーカスが残っていると Electron の IME 状態が壊れるため明示的に blur
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    onConfirm({ startDate, endDate, name: displayName || formatDateRange(startDate, endDate) })
  }

  const calDays = buildCalendarDays()

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
        width: 360,
        overflow: 'hidden',
      }}>
        {/* ヘッダー */}
        <div style={{
          background: '#1565c0', color: 'white',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 'bold', fontSize: '15px', flex: 1 }}>📅 期間を選択（2週間）</span>
          <button onClick={onClose} style={closeBtn}>✕ 閉じる</button>
        </div>

        {/* 月ナビゲーション */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 16px 4px', gap: '16px',
        }}>
          <button onClick={prevMonth} style={navBtn}>◀</button>
          <span style={{ fontWeight: 'bold', fontSize: '15px', minWidth: '100px', textAlign: 'center' }}>
            {viewYear}年 {viewMonth + 1}月
          </span>
          <button onClick={nextMonth} style={navBtn}>▶</button>
        </div>

        {/* 曜日ヘッダー */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px' }}>
          {DOW_LABELS.map((d, i) => (
            <div key={d} style={{
              textAlign: 'center', fontSize: '12px', fontWeight: 'bold', padding: '4px 0',
              color: i === 0 ? '#e53935' : i === 6 ? '#1565c0' : '#555',
            }}>{d}</div>
          ))}
        </div>

        {/* 日付セル */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 8px 8px' }}>
          {calDays.map((date, i) => {
            if (!date) return <div key={`blank-${i}`} />
            const ds = dateToStr(date)
            const inRange = isInRange(date)
            const start = isStart(date)
            const end = isEnd(date)
            const isSun = date.getDay() === 0
            const isSat = date.getDay() === 6
            return (
              <div
                key={ds}
                onClick={() => handleDayClick(ds)}
                style={{
                  textAlign: 'center', padding: '5px 2px', fontSize: '13px',
                  cursor: 'pointer', borderRadius: '4px',
                  background: start || end ? '#1565c0' : inRange ? '#bbdefb' : 'transparent',
                  color: start || end ? 'white' : isSun ? '#e53935' : isSat ? '#1565c0' : '#333',
                  fontWeight: start || end ? 'bold' : 'normal',
                  margin: '1px 0',
                  userSelect: 'none',
                }}
              >
                {date.getDate()}
              </div>
            )
          })}
        </div>

        {/* 選択期間表示・表示名入力 */}
        <div style={{ padding: '10px 16px 16px', borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px' }}>
            選択期間:&nbsp;
            <span style={{ fontWeight: 'bold', color: startDate ? '#1565c0' : '#aaa' }}>
              {startDate ? formatDateRange(startDate, endDate) : '日付を選択してください'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#555', whiteSpace: 'nowrap' }}>表示名:</span>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="例: 1月第2週"
              style={{
                flex: 1, padding: '5px 8px', fontSize: '13px',
                border: '1px solid #ccc', borderRadius: '4px',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleConfirm}
              disabled={!startDate}
              style={{
                padding: '7px 20px',
                background: startDate ? '#43a047' : '#ccc',
                color: 'white', border: 'none', borderRadius: '4px',
                cursor: startDate ? 'pointer' : 'not-allowed',
                fontSize: '14px', fontWeight: 'bold',
              }}
            >作成する</button>
          </div>
        </div>
      </div>
    </div>
  )
}

const closeBtn = {
  padding: '4px 10px', background: '#546e7a', color: 'white',
  border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px',
  cursor: 'pointer', fontSize: '12px',
}

const navBtn = {
  padding: '4px 10px', background: '#e3f2fd', color: '#1565c0',
  border: '1px solid #90caf9', borderRadius: '4px',
  cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
}
