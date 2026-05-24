import { useState, useEffect } from 'react'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { useRegisterSW } from 'virtual:pwa-register/react'

const DEFAULT_NOTES = {
  company1Name: '会社名・現場名',
  company1Content: '',
  company2Name: '会社名・現場名',
  company2Content: '',
  freeText: '',
  remarks: '',
}

// スマホ閲覧用（読み取り専用）
export default function ViewerApp() {
  // PWA更新通知
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const [schedules, setSchedules] = useState([])
  const [currentId, setCurrentId] = useState('')
  const [scheduleData, setScheduleData] = useState(null)
  const [globalNotes, setGlobalNotes] = useState(DEFAULT_NOTES)
  const [lastUpdated, setLastUpdated] = useState(null)

  // 工程表の列幅合計からviewportのinitial-scaleを設定（ピンチズームは自由に使える）
  useEffect(() => {
    if (!scheduleData) return
    const colWidths = scheduleData.colWidths || []
    const totalWidth = colWidths.reduce((a, b) => a + b, 0) + 32 + 16 // 行番号+余白
    const screenWidth = window.screen.width
    const initialScale = Math.min(1, screenWidth / totalWidth)
    const viewport = document.querySelector('meta[name="viewport"]')
    if (viewport) {
      viewport.setAttribute('content',
        `width=device-width, initial-scale=${initialScale.toFixed(3)}, minimum-scale=0.1, maximum-scale=10, user-scalable=yes`
      )
    }
  }, [scheduleData])

  // グローバルノートを監視
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'globalNotes'), snap => {
      if (snap.exists()) setGlobalNotes({ ...DEFAULT_NOTES, ...snap.data() })
    })
    return () => unsub()
  }, [])

  // 工程表一覧を監視
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'schedules'), snap => {
      const list = snap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        startDate: d.data().startDate ?? '',
      }))
      // startDate降順（新しい工程表が先頭）、なければname順
      list.sort((a, b) => {
        if (a.startDate && b.startDate) return b.startDate.localeCompare(a.startDate)
        return a.name.localeCompare(b.name, 'ja')
      })
      setSchedules(list)
      // 初回は一番新しい工程表（startDate最大）を自動選択
      if (!currentId && list.length > 0) {
        setCurrentId(list[0].id)
      }
    })
    return () => unsub()
  }, [])

  // 選択中の工程表をリアルタイム監視
  useEffect(() => {
    if (!currentId) return
    const unsub = onSnapshot(doc(db, 'schedules', currentId), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setScheduleData(data)
        if (data.updatedAt?.toDate) {
          setLastUpdated(data.updatedAt.toDate())
        }
      }
    })
    return () => unsub()
  }, [currentId])

  const rows = scheduleData?.rows ?? 0
  const cols = scheduleData?.cols ?? 0
  const colWidths = scheduleData?.colWidths ?? []
  const rowHeights = scheduleData?.rowHeights ?? []
  const cells = scheduleData?.cells ?? {}

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* ヘッダー */}
      <div style={{
        background: '#1565c0', color: 'white',
        padding: '12px 16px', position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '16px' }}>📋 工程表</span>
        <select
          value={currentId}
          onChange={e => setCurrentId(e.target.value)}
          style={{
            padding: '6px 10px', fontSize: '14px',
            borderRadius: '6px', border: 'none',
            minWidth: '160px', flex: 1, maxWidth: '260px',
          }}
        >
          {schedules.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {lastUpdated && (
          <span style={{ fontSize: '11px', opacity: 0.8, marginLeft: 'auto' }}>
            更新: {lastUpdated.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* 新バージョン更新バナー */}
      {needRefresh && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#1565c0', color: 'white',
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
        }}>
          <span style={{ fontSize: '14px' }}>🔄 新しいバージョンがあります</span>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{
              background: 'white', color: '#1565c0',
              border: 'none', borderRadius: '6px',
              padding: '6px 14px', fontSize: '14px',
              fontWeight: 'bold', cursor: 'pointer',
            }}
          >更新する</button>
        </div>
      )}

      {/* グリッド */}
      {scheduleData ? (
        <div style={{ padding: '8px' }}>
        <div>
          <table style={{
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            background: 'white',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}>
            <colgroup>
              <col style={{ width: 32 }} />
              {colWidths.map((w, ci) => <col key={ci} style={{ width: w }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={viewerThStyle(32, 22)} />
                {colWidths.map((w, ci) => (
                  <th key={ci} style={viewerThStyle(w, 22)}>
                    {String.fromCharCode(65 + ci)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, ri) => (
                <tr key={ri}>
                  <td style={{ ...viewerThStyle(32, rowHeights[ri] ?? 40), fontSize: '11px' }}>
                    {ri + 1}
                  </td>
                  {Array.from({ length: cols }, (_, ci) => {
                    const key = `r${ri}_c${ci}`
                    return (
                      <td
                        key={ci}
                        dangerouslySetInnerHTML={{ __html: cells[key]?.html || '' }}
                        style={{
                          width: colWidths[ci],
                          height: rowHeights[ri] ?? 40,
                          border: '1px solid #ccc',
                          padding: '4px 6px',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          verticalAlign: 'middle',
                          textAlign: 'center',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          overflow: 'hidden',
                        }}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 今後の予定欄（全工程表共通） */}
          <div style={{ marginTop: '8px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', borderTop: '2px solid #1565c0' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
              <div style={{ flex: 1, borderRight: '1px solid #ccc' }}>
                <div dangerouslySetInnerHTML={{ __html: globalNotes.company1Name || '会社1' }}
                  style={{ padding: '4px 8px', background: '#e3f2fd', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #90caf9' }} />
                <div dangerouslySetInnerHTML={{ __html: globalNotes.company1Content || '' }}
                  style={{ padding: '6px 8px', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div dangerouslySetInnerHTML={{ __html: globalNotes.company2Name || '会社2' }}
                  style={{ padding: '4px 8px', background: '#e3f2fd', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #90caf9' }} />
                <div dangerouslySetInnerHTML={{ __html: globalNotes.company2Content || '' }}
                  style={{ padding: '6px 8px', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} />
              </div>
            </div>
            {globalNotes.freeText && (
              <div dangerouslySetInnerHTML={{ __html: globalNotes.freeText }}
                style={{ padding: '6px 8px', fontSize: '13px', borderTop: '1px solid #ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.8' }} />
            )}
            {globalNotes.remarks && (
              <div dangerouslySetInnerHTML={{ __html: globalNotes.remarks }}
                style={{ padding: '6px 8px', fontSize: '12px', borderTop: '1px solid #eee', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }} />
            )}
          </div>

          {/* メモ欄（工程表ごとのメモ、最下部に常に表示） */}
          {scheduleData && (
            <div style={{ marginTop: '8px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              <div style={{
                padding: '3px 8px',
                background: '#f5f5f5',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#666',
                borderBottom: '1px solid #ddd',
              }}>メモ</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gridTemplateRows: 'repeat(7, auto)',
              }}>
                {Array.from({ length: 7 }, (_, ri) =>
                  Array.from({ length: 2 }, (_, ci) => {
                    const key = `m${ri}_c${ci}`
                    return (
                      <div
                        key={key}
                        dangerouslySetInnerHTML={{ __html: scheduleData?.memoCells?.[key]?.html || '' }}
                        style={{
                          border: '1px solid #ddd',
                          padding: '4px 6px',
                          fontSize: '13px',
                          lineHeight: '1.6',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          minHeight: '48px',
                          overflow: 'hidden',
                        }}
                      />
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>{/* scaleコンテナ終わり */}
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '12px', color: '#999', padding: '60px',
        }}>
          <div style={{ fontSize: '40px' }}>📋</div>
          <div>工程表を選択してください</div>
        </div>
      )}
    </div>
  )
}

function viewerThStyle(width, height) {
  return {
    width, height, minWidth: width,
    background: '#e8e8e8',
    border: '1px solid #bbb',
    fontSize: '11px',
    textAlign: 'center',
    fontWeight: 'normal',
    color: '#555',
  }
}
