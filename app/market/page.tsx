import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

export const revalidate = 300

type GenreStat = {
  taste: string
  count: number
  min: number
  max: number
  avg: number
}

// ジャンルごとに個人の価格が特定できてしまわないよう、2人以上のデータがあるジャンルだけを集計対象にする
const MIN_SAMPLE_SIZE = 2

async function getGenreStats(): Promise<GenreStat[]> {
  const { data } = await supabase
    .from('profiles')
    .select('tastes, price_min')
    .eq('is_public', true)

  const priceByTaste: Record<string, number[]> = {}
  ;(data || []).forEach((p) => {
    if (p.price_min == null || p.price_min <= 0) return
    ;(p.tastes || []).forEach((t: string) => {
      if (!t) return
      if (!priceByTaste[t]) priceByTaste[t] = []
      priceByTaste[t].push(p.price_min as number)
    })
  })

  return Object.entries(priceByTaste)
    .filter(([, prices]) => prices.length >= MIN_SAMPLE_SIZE)
    .map(([taste, prices]) => ({
      taste,
      count: prices.length,
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((sum, v) => sum + v, 0) / prices.length),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)
}

export default async function MarketPage() {
  const stats = await getGenreStats()
  const overallMax = stats.reduce((max, s) => Math.max(max, s.max), 1)

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="相場マップ" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            💰 相場マップ
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">ジャンル別の依頼相場</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">
            掲載中クリエイターの最低料金（price_min）をもとにした目安です。実際の料金は依頼内容により変動します。
          </p>
        </div>

        {stats.length === 0 ? (
          <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-16">
            集計に十分なデータがまだありません。
          </p>
        ) : (
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.taste} className="bg-white rounded-2xl p-4 shadow-xs border border-sky-100/60 space-y-2">
                <div className="flex items-center justify-between">
                  <Link href={`/tags/${encodeURIComponent(s.taste)}`} className="text-sm font-black text-slate-800 hover:text-sky-600">
                    {s.taste}
                  </Link>
                  <span className="text-[10px] font-bold text-slate-400">{s.count}人のデータ</span>
                </div>
                <div className="relative h-2.5 rounded-full bg-sky-50 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-300 to-sky-500 rounded-full"
                    style={{
                      left: `${(s.min / overallMax) * 100}%`,
                      width: `${Math.max(((s.max - s.min) / overallMax) * 100, 2)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>{s.min.toLocaleString()}円〜</span>
                  <span className="text-sky-600">平均 {s.avg.toLocaleString()}円</span>
                  <span>〜{s.max.toLocaleString()}円</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center pt-2">
          <Link href="/match" className="text-xs font-bold text-sky-600 hover:underline">
            予算に合うクリエイターを診断で探す →
          </Link>
        </div>
      </div>
    </div>
  )
}
