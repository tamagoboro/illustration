import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

// 新機能・変更点を時系列でまとめた簡易お知らせページ。
// 専用のCMS/テーブルは持たず、リリースのたびにこの配列を追記していくだけの軽量運用にしている。
type UpdateEntry = {
  date: string
  items: string[]
}

const UPDATES: UpdateEntry[] = [
  {
    date: '2026-09-24',
    items: [
      '🔮 4つの質問でおすすめのクリエイターが分かる「かんたん診断」ページを追加しました。',
      '📩 リクエストを送信・回答すると、相手に通知が届くようになりました（新着リクエスト・承諾/辞退の通知）。',
      '⭐ レビューを投稿すると、クリエイター本人に通知が届くようになりました。',
      '🎁 紹介リンク経由で新規登録があると、紹介した方に通知が届くようになりました。',
      '📝 クリエイターページに「見積もりシミュレーター」と「リクエスト機能」の違いを説明する案内を追加しました。',
      '📋 マイページ（/rewards）の表示順を、依頼者アカウントでは「送ったリクエスト」「最近見たクリエイター」が上に来るよう調整しました。',
      '🖼 全クリエイターの新着作品を一覧できる「新着作品ギャラリー」を追加しました。',
      '💰 ジャンル別の依頼相場が分かる「相場マップ」を追加しました。',
      '❤️ フィード投稿への「いいね」「コメント」でも、投稿者に通知が届くようになりました。',
      '📖 「はじめての方へ」ガイド、お知らせページ（このページ）を追加しました。',
      '📊 閲覧数急上昇中・問い合わせ多数のクリエイターが分かる「今週の注目クリエイター」ページを追加しました。',
      '♥ お気に入り登録したクリエイターだけをまとめて見られる専用ページを追加しました。',
      '🚨 通報が送信されると、管理者に通知が届くようになりました。',
      '❓ よくある質問（FAQ）ページを追加しました。',
    ],
  },
]

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
