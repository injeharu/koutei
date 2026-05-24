// 日付関連ユーティリティ
const DOW = ['日', '月', '火', '水', '木', '金', '土']

// 日付文字列（YYYY-MM-DD）に n 日加算して返す
// ※ toISOString() は UTC 変換で日付がずれるため、ローカル時刻メソッドで組み立てる
export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 期間を "2026/01/06〜01/19"（同年）or "2026/12/29〜2027/01/11"（年越し）で返す
export function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const pad = n => String(n).padStart(2, '0')
  const startStr = `${s.getFullYear()}/${pad(s.getMonth() + 1)}/${pad(s.getDate())}`
  if (s.getFullYear() === e.getFullYear()) {
    return `${startStr}〜${pad(e.getMonth() + 1)}/${pad(e.getDate())}`
  }
  return `${startStr}〜${e.getFullYear()}/${pad(e.getMonth() + 1)}/${pad(e.getDate())}`
}

// グリッドの狭い列（c0 / c2）に日付を自動入力するセルデータを生成
// 形式: "1/6(火)"、日曜日は <span style="color:red">1/11(日)</span>
// c0: startDate 当日〜+(rows-1)日（1週目）
// c2: startDate +rows日〜+(rows*2-1)日（2週目）
export function generateDateCells(startDate, rows) {
  const cells = {}
  for (let ri = 0; ri < rows; ri++) {
    // 左半分（c0）: startDate + ri 日目
    const d1 = new Date(startDate + 'T00:00:00')
    d1.setDate(d1.getDate() + ri)
    const label1 = `${d1.getMonth() + 1}/${d1.getDate()}(${DOW[d1.getDay()]})`
    cells[`r${ri}_c0`] = {
      html: d1.getDay() === 0 ? `<span style="color: red;">${label1}</span>` : label1,
      textAlign: 'center',
      verticalAlign: 'middle',
    }
    // 右半分（c2）: startDate + rows + ri 日目
    const d2 = new Date(startDate + 'T00:00:00')
    d2.setDate(d2.getDate() + rows + ri)
    const label2 = `${d2.getMonth() + 1}/${d2.getDate()}(${DOW[d2.getDay()]})`
    cells[`r${ri}_c2`] = {
      html: d2.getDay() === 0 ? `<span style="color: red;">${label2}</span>` : label2,
      textAlign: 'center',
      verticalAlign: 'middle',
    }
  }
  return cells
}
