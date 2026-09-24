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

type MenuStat = {
  title: string
  count: number
  min: number
  max: number
  avg: number
}

// ジャンル/メニューごとに個人の価格が特定できてしまわないよう、2人以上のデータがある場合だけ集計対象にする
const MIN_SAMPLE_SIZE = 2

// 「アイコン制作」→「アイコン」、「一枚絵制作」→「一枚絵」のように、装飾的な接尾辞の
// 有無だけの表記ゆれを吸収する。「一枚絵・胸上」のように部位まで指定されたものは
// 接尾辞が付いていないのでそのまま残り、価格帯の異なる項目として区別される。
const MENU_TITLE_SUFFIXES = /(制作|作成|描画|イラスト)$/u
function normalizeMenuTitle(raw: string): string {
  const unified = raw.normalize('NFKC').trim().replace(/\s+/g, '')
  const stripped = unified.replace(MENU_TITLE_SUFFIXES, '')
  return stripped || unified
}

async function getStats(): Promise<{ genreStats: GenreStat[]; menuStats: MenuStat[] }> {
  const { data } = await supabase
    .from('profiles')
    .select('tastes, price_min, menu_items')
    .eq('is_public', true)

  const priceByTaste: Record<string, number[]> = {}
  const priceByMenuTitle: Record<string, number[]> = {}

  ;(data || []).forEach((p) => {
    if (p.price_min != null && p.price_min > 0) {
      ;(p.tastes || []).forEach((t: string) => {
        if (!t) return
        if (!priceByTaste[t]) priceByTaste[t] = []
        priceByTaste[t].push(p.price_min as number)
      })
    }

    // メニュー名は自由入力のため、「アイコン制作」「一枚絵制作」のような装飾的な接尾辞の
    // 有無だけで別項目に分かれてしまう。全角/半角・空白の表記ゆれも正規化したうえで、
    // 末尾の「制作」等を取り除いてから完全一致でグルーピングする。
    // 「一枚絵・胸上」のように部位が付いたものは、価格帯が別物なので正規化後も区別したまま残す
    // （あいまいな部分一致にすると価格帯の異なる項目が混ざって相場としての精度が落ちるため避ける）。
    if (Array.isArray(p.menu_items)) {
      p.menu_items.forEach((item: any) => {
        const rawTitle = typeof item?.title === 'string' ? item.title : ''
        const title = normalizeMenuTitle(rawTitle)
        const price = typeof item?.price === 'number' ? item.price : null
        if (!title || price === null || price <= 0) return
        if (!priceByMenuTitle[title]) priceByMenuTitle[title] = []
        priceByMenuTitle[title].push(price)
      })
    }
  })

  const computeStats = (map: Record<string, number[]>) =>
    Object.entries(map)
      .filter(([, prices]) => prices.length >= MIN_SAMPLE_SIZE)
      .map(([label, prices]) => ({
        label,
        count: prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        avg: Math.round(prices.reduce((sum, v) => sum + v, 0) / prices.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 24)

  return {
    genreStats: computeStats(priceByTaste).map((s) => ({ taste: s.label, count: s.count, min: s.min, max: s.max, avg: s.avg })),
    menuStats: computeStats(priceByMenuTitle).map((s) => ({ title: s.label, count: s.count, min: s.min, max: s.max, avg: s.avg })),
  }
}

function PriceBar({ min, max, avg, overallMax }: { min: number; max: number; avg: number; overallMax: number }) {
  return (
    <>
      <div className="relative h-2.5 rounded-full bg-sky-50 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-300 to-sky-500 rounded-full"
          style={{
            left: `${(min / overallMax) * 100}%`,
            width: `${Math.max(((max - min) / overallMax) * 100, 2)}%`,
          }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
        <span>{min.toLocaleString()}円〜</span>
        <span className="text-sky-600">平均 {avg.toLocaleString()}円</span>
        <span>〜{max.toLocaleString()}円</span>
      </div>
    </>
  )
}

export default async function MarketPage() {
  const { genreStats, menuStats } = await getStats()
  const overallMenuMax = menuStats.reduce((max, s) => Math.max(max, s.max), 1)
  const overallGenreMax = genreStats.reduce((max, s) => Math.max(max, s.max), 1)

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="相場マップ" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            💰 相場マップ
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">依頼相場の目安</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">
            掲載中クリエイターの料金メニューをもとにした目安です。実際の料金は依頼内容により変動します。
          </p>
        </div>

        {/* メニュー別（アイコン制作・1枚絵など、実際の料金メニュー名で集計） */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-slate-700 drop-shadow-sm px-1">📋 料金目安・メニュー別</h2>
          {menuStats.length === 0 ? (
            <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-8 bg-white/70 backdrop-blur-md rounded-2xl">
              集計に十分なデータがまだありません。
            </p>
          ) : (
            <div className="space-y-3">
              {menuStats.map((s) => (
                <div key={s.title} className="bg-white rounded-2xl p-4 shadow-xs border border-sky-100/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-800">{s.title}</span>
                    <span className="text-[10px] font-bold text-slate-400">{s.count}件のデータ</span>
                  </div>
                  <PriceBar min={s.min} max={s.max} avg={s.avg} overallMax={overallMenuMax} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ジャンル別（タグごとの最低料金） */}
        <div className="space-y-3">
          <h2 className="text-sm font-black text-slate-700 drop-shadow-sm px-1">🏷 ジャンル別の最低料金</h2>
          {genreStats.length === 0 ? (
            <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-8 bg-white/70 backdrop-blur-md rounded-2xl">
              集計に十分なデータがまだありません。
            </p>
          ) : (
            <div className="space-y-3">
              {genreStats.map((s) => (
                <div key={s.taste} className="bg-white rounded-2xl p-4 shadow-xs border border-sky-100/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/tags/${encodeURIComponent(s.taste)}`} className="text-sm font-black text-slate-800 hover:text-sky-600">
                      {s.taste}
                    </Link>
                    <span className="text-[10px] font-bold text-slate-400">{s.count}人のデータ</span>
                  </div>
                  <PriceBar min={s.min} max={s.max} avg={s.avg} overallMax={overallGenreMax} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="text-center pt-2">
          <Link href="/match" className="text-xs font-bold text-sky-600 hover:underline">
            予算に合うクリエイターを診断で探す →
          </Link>
        </div>
      </div>
    </div>
  )
}
