import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: 'イラスト依頼の相場マップ｜アイコン・立ち絵・一枚絵の料金目安',
  description:
    'アイコン・立ち絵・一枚絵など、イラスト依頼の料金相場の目安をメニュー別・ジャンル別にまとめました。掲載中クリエイターの実際の料金メニューをもとに集計しています。',
  path: '/market',
})

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

// 漢数字の表記ゆれ（「一枚絵」と「1枚絵」など）を吸収する。NFKC正規化は全角/半角の
// 変換はできても漢数字はアラビア数字にしてくれないため、ここだけは個別に変換する。
// 単純な1文字置換なので「十二」のような2桁の組み合わせは正しく変換できないが、
// メニュー名（一枚絵・二頭身など）で使われる範囲では十分。
const KANJI_DIGITS: Record<string, string> = {
  '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
  '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
}
function convertKanjiNumerals(s: string): string {
  return s.replace(/[〇零一二三四五六七八九十]/gu, (ch) => KANJI_DIGITS[ch] ?? ch)
}

// 「アイコン制作」→「アイコン」、「一枚絵制作」→「一枚絵」のように、装飾的な接尾辞の
// 有無だけの表記ゆれを吸収する。「一枚絵・胸上」のように部位まで指定されたものは
// 接尾辞が付いていないのでそのまま残り、価格帯の異なる項目として区別される。
const MENU_TITLE_SUFFIXES = /(制作|作成|描画|イラスト)$/u
// 「全身」は「立ち絵」等にとって省略可能な決まり文句（立ち絵は通常すでに全身を指すため）と考え、
// 先頭に付いているだけの場合は取り除く。「バストアップ」のように描画範囲そのものを表す接頭辞は
// 価格帯が変わるため、ここでは対象にしない。
const MENU_TITLE_PREFIXES = /^(全身)/u

// 呼び方が違うだけで実質同じ意味の言葉を1つの表記にまとめる（同義語 → 代表語）。
// \b（単語境界）は日本語の文字には効かない（アルファベット・数字・アンダースコアしか
// 「単語」とみなさないため）ので使わず、単純な部分一致で置換する。対象がどれも
// 短く特徴的な語のため、無関係な語に誤って混ざる可能性は低いと判断している。
// 「デフォルメ」はこのサイトの見積もりフォームのテンプレートで、ミニキャラより高い別料金帯の
// 選択肢として使われているため、ここには含めない（まとめると価格帯の異なる項目が混ざってしまう）。
// 気づいたものはこの配列に追記していく。
const MENU_TITLE_SYNONYMS: { pattern: RegExp; canonical: string }[] = [
  { pattern: /SD|ちびキャラ/gi, canonical: 'ミニキャラ' },
]
function applySynonyms(s: string): string {
  return MENU_TITLE_SYNONYMS.reduce((acc, { pattern, canonical }) => acc.replace(pattern, canonical), s)
}

function normalizeMenuTitle(raw: string): string {
  const unified = convertKanjiNumerals(raw.normalize('NFKC').trim().replace(/\s+/g, ''))
  // 接尾辞・接頭辞は別々に「取れなければ直前の結果に戻す」ようにする。まとめて置換すると、
  // 例えば「全身イラスト」で接尾辞「イラスト」を取った「全身」から、さらに接頭辞「全身」も
  // 取れてしまい空文字列になり、最後の `|| unified` で未加工の「全身イラスト」に丸ごと戻って
  // しまう（＝せっかくの接尾辞除去が無かったことになる）ため。
  const afterSuffix = unified.replace(MENU_TITLE_SUFFIXES, '') || unified
  const afterPrefix = afterSuffix.replace(MENU_TITLE_PREFIXES, '') || afterSuffix
  return applySynonyms(afterPrefix)
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
                    <span className="text-sm font-black text-slate-800">{s.taste}</span>
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
