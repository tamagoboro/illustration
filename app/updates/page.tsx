import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'
import { UPDATES } from '@/lib/updates'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: 'お知らせ・アップデート履歴',
  description:
    'Drawkerの新機能や変更点のお知らせです。',
  path: '/updates',
})

const HIGHLIGHT_FEATURES = [
  '直接リクエスト機能（見積もりフォームにない内容もクリエイターへ直接相談できます）',
  'クリエイター同士の比較機能・お気に入り機能',
  'クリエイター専用のSNS風フィード',
  'ポイント・アイコンリングが貯まるマイページ',
  'レビュー・評価機能',
  '友達紹介プログラム',
  '通知ベル（新着リクエストやレビューなどをお知らせ）',
]

export default function UpdatesPage() {
  return (
    <div className="min-h-screen relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="お知らせ" />
      <div className="max-w-2xl mx-auto space-y-8 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <div>
            <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
              お知らせ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-3 drop-shadow-sm">アップデート履歴</h1>
            <p className="text-sm text-slate-600 font-medium drop-shadow-sm mt-2">Drawkerに追加された新機能や変更点をお知らせします。</p>
          </div>
        </div>

        <div className="space-y-6">
          {UPDATES.map((entry) => (
            <div key={entry.date} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60">
              <p className="text-[11px] font-black text-sky-500 tracking-wide mb-3">{entry.date}</p>
              <ul className="space-y-2">
                {entry.items.map((item) => (
                  <li key={item} className="text-xs text-slate-600 leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-3">
          <h2 className="text-sm font-black text-slate-700">これまでに追加した主な機能</h2>
          <ul className="space-y-1.5">
            {HIGHLIGHT_FEATURES.map((item) => (
              <li key={item} className="text-xs text-slate-500 flex items-start gap-1.5">
                <span className="text-sky-400 mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
