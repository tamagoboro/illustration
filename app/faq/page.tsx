import Link from 'next/link'
import { buildPageMetadata } from '@/lib/pageMetadata'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

// title にサイト名は付けない（app/layout.tsx のテンプレートが付けるので、書くと二重になる）
export const metadata = buildPageMetadata({
  title: 'よくある質問',
  description: 'Drawkerの使い方・手数料・支払い・トラブル時の対応など、よくある質問をまとめました。',
  path: '/faq',
})

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: '手数料はかかりますか？',
    a: (
      <>
        取引の仲介手数料はかかりません。決済そのものを仲介しない「直接取引」型のサービスのため、この仕組みが成り立っています。掲載・利用も現在は無料です（将来、一部の掲載枠などに有料のオプションを設ける可能性があります）。詳しくは
        <Link href="/guide" className="text-sky-600 underline">
          使い方ガイド
        </Link>
        をご覧ください。
      </>
    ),
  },
  {
    q: '支払い方法はどうやって決めるのですか？',
    a: 'Drawkerは決済を仲介しないため、金額・支払い方法・タイミングはクリエイターとご自身で直接すり合わせてください。',
  },
  {
    q: '「見積もりシミュレーター」と「リクエスト機能」は何が違いますか？',
    a: '見積もりシミュレーターは、クリエイターが用意した料金メニューから概算金額をその場で計算するだけの機能で、送信はされません。リクエスト機能は、メニューにない内容も含めて直接クリエイターへ相談・依頼を送る機能です。',
  },
  {
    q: '送ったリクエストをキャンセルしたい',
    a: (
      <>
        クリエイターが未回答（「未回答」ステータス）の間であれば、
        <Link href="/rewards" className="text-sky-600 underline">
          マイページ
        </Link>
        の「送ったリクエスト」からキャンセルできます。すでに承諾されたリクエスト（取引自体）のキャンセルは、クリエイターに直接ご相談ください。
      </>
    ),
  },
  {
    q: '取引でトラブルが起きた場合はどうすればいいですか？',
    a: 'Drawkerは取引の当事者にならないため、報酬や納品物に関するトラブルは基本的に当事者間での解決となります。悪質な行為や規約違反が疑われる場合は、各クリエイターのページから通報機能で運営にご連絡ください。',
  },
  {
    q: 'R18対応と表示されているクリエイターがいますが、R18作品も見られますか？',
    a: '「R18 OK」の表示は、そのクリエイターがR18（成人向け）の依頼を受け付け可能であることを示すものです。実際の制作物のやり取りはクリエイターとの直接のやり取りで行われ、Drawker上にR18作品自体が掲載・表示されることはありません。',
  },
  {
    q: 'クリエイターとして登録するにはどうすればいいですか？',
    a: (
      <>
        <Link href="/login?signup=creator" className="text-sky-600 underline">
          新規登録
        </Link>
        画面で「クリエイターとして利用する」を選んで登録すると、そのままダッシュボードが開きます。作品を1枚・料金の目安・得意なジャンルの3つを入れるだけで掲載できます。無料で、いつでも依頼者としての利用と併用できます。
      </>
    ),
  },
  {
    q: '登録したあと、自分のページが見られているか分かりますか？',
    a: '分かります。クリエイターのダッシュボードに「アクセス解析」があり、今週ページが見られた回数（先週との比較・日ごとのグラフつき）、今月の見積もり問い合わせ数、今週新しく付いたお気に入りの数を確認できます。',
  },
  {
    q: '自分のプロフィールが一覧に表示されません',
    a: '作品（ポートフォリオ）を1枚も登録していないプロフィールは、内容が薄いページとしてトップページ・ジャンル一覧・検索結果から除外される仕様です。ダッシュボードから作品を1枚以上登録すると表示されるようになります。',
  },
  {
    q: 'ポイントは何に使えますか？',
    a: 'アイコンの周りに表示される「アイコンリング」の購入に使えます。初回レビュー投稿（50pt）や友達紹介などで貯まります。',
  },
]

export default function FaqPage() {
  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="よくある質問" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            ❓ よくある質問
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">FAQ</h1>
        </div>

        <div className="space-y-3">
          {FAQS.map((item) => (
            <details key={item.q} className="group bg-white rounded-2xl border border-sky-100/60 shadow-xs open:shadow-sm">
              <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none">
                <span className="text-sm font-bold text-slate-800">{item.q}</span>
                <span className="text-slate-400 text-lg shrink-0 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">{item.a}</div>
            </details>
          ))}
        </div>

        <div className="text-center pt-2">
          <Link href="/guide" className="text-xs font-bold text-sky-600 hover:underline">
            使い方の流れを最初から見る →
          </Link>
        </div>
      </div>
    </div>
  )
}
