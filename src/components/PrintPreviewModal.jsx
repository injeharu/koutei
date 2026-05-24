import { useState, useEffect, useRef, useCallback } from 'react'

// A4縦向き（96dpi）
const A4_W = 794
const A4_H = 1123
// A4のpadding（上下14mm）を引いた内容域の高さ
const A4_PAD_V = Math.round(28 * 96 / 25.4)  // ≈ 106px
const A4_CONTENT_H = A4_H - A4_PAD_V

export default function PrintPreviewModal({ scheduleData, globalNotes, onPrint, onClose }) {
  const [scale, setScale] = useState(0.7)
  // 外枠div の実測高さから動的に計算（推定値ではなく実値を使う）
  const [contentZoom, setContentZoom] = useState(1)
  const [measuredH, setMeasuredH] = useState(0)

  useEffect(() => {
    function calcScale() {
      const sw = (window.innerWidth - 80) / A4_W
      const sh = (window.innerHeight - 100) / A4_H
      setScale(Math.min(sw, sh, 0.95))
    }
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [])

  // プレビュー用 PrintContent からの実測値を受け取り contentZoom を更新
  const handleHeightMeasured = useCallback((h) => {
    setMeasuredH(h)
    setContentZoom(Math.min(1, A4_CONTENT_H / h))
  }, [])

  const { rows, cols, colWidths, rowHeights, cells } = scheduleData
  const totalColWidth = colWidths.reduce((a, b) => a + b, 0)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.78)',
        zIndex: 9999,
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ヘッダーバー（印刷時非表示） */}
      <div
        className="no-print"
        style={{
          background: '#263238', padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0,
        }}
      >
        <span style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>🖨️ 印刷プレビュー</span>
        <button onClick={onPrint} style={actionBtn('#1565c0')}>印刷実行</button>
        <button onClick={onClose} style={actionBtn('#546e7a')}>✕ 閉じる</button>
        <span style={{ color: '#ccc', fontSize: '12px', marginLeft: '8px' }}>A4 縦向き</span>
        <span style={{ color: contentZoom < 1 ? '#ffcc02' : '#aaa', fontSize: '12px' }}>
          縮小率 {Math.round(contentZoom * 100)}%
        </span>
      </div>

      {/* プレビューエリア（印刷時非表示） */}
      <div
        className="no-print"
        style={{
          flex: 1, overflow: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px', background: '#616161',
        }}
      >
        <div style={{ width: A4_W * scale, height: A4_H * scale, position: 'relative', flexShrink: 0 }}>
          <div style={{
            position: 'absolute', top: 0, left: 0,
            width: A4_W, height: A4_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: 'white',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            overflow: 'hidden',
          }}>
            {/* プレビュー用：onHeightMeasuredを渡して実測する */}
            <PrintContent
              rows={rows} cols={cols}
              colWidths={colWidths} rowHeights={rowHeights}
              totalColWidth={totalColWidth} cells={cells}
              globalNotes={globalNotes}
              contentZoom={contentZoom}
              measuredH={measuredH}
              onHeightMeasured={handleHeightMeasured}
            />
          </div>
        </div>
      </div>

      {/* A4印刷用コンテンツ（印刷時のみ表示） */}
      <div
        id="a4-print-page"
        style={{ display: 'none', width: A4_W, height: A4_H, background: 'white', overflow: 'hidden' }}
      >
        {/* 印刷用：計測済みの contentZoom / measuredH をそのまま使う */}
        <PrintContent
          rows={rows} cols={cols}
          colWidths={colWidths} rowHeights={rowHeights}
          totalColWidth={totalColWidth} cells={cells}
          globalNotes={globalNotes}
          contentZoom={contentZoom}
          measuredH={measuredH}
        />
      </div>
    </div>
  )
}

// プレビューと印刷で共有するA4内容コンポーネント
function PrintContent({ rows, cols, colWidths, rowHeights, totalColWidth, cells, globalNotes, contentZoom, measuredH, onHeightMeasured }) {
  const outerRef = useRef(null)

  // 外枠div の実コンテンツ高さを計測して親へ通知（transform: scale は contentRect に影響しないため計測は transform 前の値）
  useEffect(() => {
    if (!outerRef.current || !onHeightMeasured) return
    const observer = new ResizeObserver(entries => {
      onHeightMeasured(Math.ceil(entries[0].contentRect.height))
    })
    observer.observe(outerRef.current)
    return () => observer.disconnect()
  }, [onHeightMeasured])

  // 縮小が必要な場合は transform: scale で縮小。占有スペースが変わらないので marginBottom で詰める
  const scaleStyle = contentZoom < 1 ? {
    transform: `scale(${contentZoom})`,
    transformOrigin: 'top center',
    marginBottom: measuredH > 0
      ? `${Math.round(measuredH * (contentZoom - 1))}px`
      : 0,
  } : {}

  return (
    <div style={{
      width: '100%', height: '100%',
      padding: '14mm 12mm',
      boxSizing: 'border-box',
    }}>
      <div style={scaleStyle}>
        {/* 外枠（実測用 ref を付ける） */}
        <div
          ref={outerRef}
          style={{
            border: '1.5px solid #222',
            display: 'flex',
            flexDirection: 'column',
          }}
        >

          {/* グリッド */}
          <table style={{
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
            width: '100%',
            flexShrink: 0,
          }}>
            <colgroup>
              {colWidths.map((w, ci) => (
                <col key={ci} style={{ width: `${(w / totalColWidth * 100).toFixed(2)}%` }} />
              ))}
            </colgroup>
            <tbody>
              {Array.from({ length: rows }, (_, ri) => (
                <tr key={ri}>
                  {Array.from({ length: cols }, (_, ci) => {
                    const key = `r${ri}_c${ci}`
                    const cell = cells[key] || {}
                    return (
                      <td
                        key={ci}
                        dangerouslySetInnerHTML={{ __html: cell.html || '' }}
                        style={{
                          border: '1px solid #bbb',
                          padding: '3px 6px',
                          height: rowHeights[ri] ?? 96,
                          textAlign: cell.textAlign || 'center',
                          verticalAlign: cell.verticalAlign || 'middle',
                          fontSize: '11px',
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* グリッドと下部予定の間のスペース */}
          <div style={{ height: 60, background: 'white', flexShrink: 0 }} />

          {/* 下部予定欄 */}
          <div style={{ borderTop: '2px solid #1565c0', flexShrink: 0 }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #ccc' }}>
              <div style={{ flex: 1, borderRight: '1px solid #ccc' }}>
                <div
                  dangerouslySetInnerHTML={{ __html: globalNotes.company1Name || '' }}
                  style={{ padding: '4px 8px', background: '#e3f2fd', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #90caf9' }}
                />
                <div
                  dangerouslySetInnerHTML={{ __html: globalNotes.company1Content || '' }}
                  style={{ padding: '5px 8px', fontSize: '11px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: 40 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  dangerouslySetInnerHTML={{ __html: globalNotes.company2Name || '' }}
                  style={{ padding: '4px 8px', background: '#e3f2fd', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #90caf9' }}
                />
                <div
                  dangerouslySetInnerHTML={{ __html: globalNotes.company2Content || '' }}
                  style={{ padding: '5px 8px', fontSize: '11px', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-all', minHeight: 40 }}
                />
              </div>
            </div>

            {globalNotes.freeText && (
              <div
                dangerouslySetInnerHTML={{ __html: globalNotes.freeText }}
                style={{ padding: '5px 8px', fontSize: '11px', borderTop: '1px solid #ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: '1.7' }}
              />
            )}
            {globalNotes.remarks && (
              <div
                dangerouslySetInnerHTML={{ __html: globalNotes.remarks }}
                style={{ padding: '5px 8px', fontSize: '10px', borderTop: '1px solid #eee', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#444' }}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

function actionBtn(bg) {
  return {
    padding: '6px 20px', background: bg, color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
  }
}
