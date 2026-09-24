import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

const STEPS = [
  {
    emoji: '🔍',
    title: '① クリエイターをさがす',
    body: 'タグ検索や条件フィルター、4つの質問に答えるだけの「かんたん診断」で、希望に合うクリエイターを見つけます。気になる人は比較機能でまとめて見比べることもできます。',
    links: [
      { href: '/', label: '一覧から探す' },
      { href: '/match', label: 'かんたん診断で探す' },
    ],
  },
  {
    emoji: '💬',
    title: '② 見積もり・相談する',
    body: '料金メニューがあるクリエイターには「見積もりシミュレーター」でその場で概算金額を確認できます。メニューにない内容は「リクエスト機能」で直接相談を送れます。どちらも送信は任意で、費用は発生しません。',
    links: [],
  },
  {
    emoji: '🤝',
    title: '③ クリエイターと直接やり取り',
    body: 'Drawkerは検索・マッチングの場を提供するプラットフォームで、料金の支払いや納品物のやり取りには一切関与しません。納期・料金・支払い方法・修正回数などは、クリエイターとご自身で直接すり合わせてください。',
    links: [],
  },
  {
    emoji: '⭐',
    title: '④ 納品後はレビューを投稿',
    body: '取引が完了したら、クリエイターのページからレビューを投稿できます。初回投稿には50ptのボーナスがあり、次の依頼で使えます。',
    links: [],
  },
]

export default function GuidePage() {
  return (
    <div className="min-h-screen relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="はじめての方へ" />
      <div className="max-w-3xl mx-auto space-y-8 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <div>
            <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
              はじめての方へ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 mt-3 drop-shadow-sm">Drawkerのご利用の流れ</h1>
            <p className="text-sm text-slate-600 font-medium drop-shadow-sm mt-2">
              Drawkerは、クリエイターとの取引に手数料が一切かからない「直接取引」型のマッチングサービスです。
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-2">
          <h2 className="text-sm font-black text-slate-700">💡 なぜ手数料が0円なの？</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            一般的なスキルマーケットは、決済を仲介する分だけ手数料（10〜20%程度）が発生します。Drawkerは決済そのものを仲介せず、クリエイターと依頼者が直接条件をすり合わせて取引する仕組みのため、掲載・利用ともに手数料は0円です。
            その分、料金や納期の交渉、支払い方法の合意はご自身で行っていただく必要があります。
          </p>
        </div>

        <div className="space-y-4">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-2">
              <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <span className="text-lg">{step.emoji}</span> {step.title}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">{step.body}</p>
              {step.links.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {step.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-amber-50 rounded-3xl p-6 border border-amber-200/60 space-y-2">
          <h2 className="text-sm font-black text-amber-700">⚠️ 安全にご利用いただくために</h2>
          <ul className="text-xs text-amber-700/90 leading-relaxed list-disc list-inside space-y-1">
            <li>Drawkerは取引の当事者にならないため、報酬の支払いや納品物に関するトラブルは当事者間での解決となります。</li>
            <li>高額な前払いを一方的に求められる、連絡先を教えた直後に不審な要求をされる、といった場合は取引を見送ることも検討してください。</li>
            <li>詳しい規約は<Link href="/terms" className="underline font-bold">利用規約</Link>をご確認ください。</li>
          </ul>
        </div>

        <div className="text-center">
          <Link href="/faq" className="text-xs font-bold text-sky-600 hover:underline">
            よくある質問を見る →
          </Link>
        </div>

        <div className="text-center bg-gradient-to-r from-sky-500/90 via-sky-400/90 to-cyan-400/90 rounded-3xl p-6 text-white space-y-2">
          <h2 className="text-base font-black">クリエイターとして活動しませんか？</h2>
          <p className="text-xs text-sky-50">ポートフォリオと料金メニューを登録するだけで、今日から依頼を受け付けられます。掲載手数料は0円です。</p>
          <Link
            href="/login"
            className="inline-block mt-1 px-5 py-2.5 rounded-xl bg-white text-sky-600 font-black text-xs shadow-sm hover:brightness-105 transition-all"
          >
            クリエイター無料登録
          </Link>
        </div>
      </div>
    </div>
  )
}
