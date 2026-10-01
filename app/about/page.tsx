import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: '運営者情報・お問い合わせ',
  description:
    'Drawker（ドローカー）の運営について、サービスの仕組み、お預かりする情報の扱い、お問い合わせ窓口をまとめています。',
  path: '/about',
})

// 公式Xアカウント（プライバシーポリシー第8条のお問い合わせ窓口と同じ）
const OFFICIAL_X_URL = 'https://x.com/Drawker06'
const OFFICIAL_X_HANDLE = '@Drawker06'

// 「このサイトに自分の情報を入れて大丈夫か」を登録前に確かめられるようにするページ。
// 運営の考え方・お金の流れ・情報の扱い・問い合わせ先を1か所にまとめ、全ページのフッターからリンクしている。
// 書いてある内容は、利用規約・プライバシーポリシー・使い方ガイドに書かれていることの要約にとどめること
// （ここだけに新しい約束を書かない）。
const SECTIONS: { emoji: string; title: string; body: React.ReactNode }[] = [
  {
    emoji: '☁',
    title: 'Drawkerについて',
    body: (
      <>
        Drawker（ドローカー）は、イラストレーター・クリエイターのポートフォリオと料金・納期・利用条件を一覧で比較し、
        そのまま依頼の相談ができる検索サイトです。クリエイターは無料でポートフォリオを作成・掲載できます。
      </>
    ),
  },
  {
    emoji: '💸',
    title: '掲載・利用の料金',
    body: (
      <>
        現在、掲載・利用は無料です。Drawkerは決済そのものを仲介せず、クリエイターと依頼者が直接条件をすり合わせて取引する仕組みのため、
        取引金額から手数料を差し引くことはありません。詳しくは
        <Link href="/guide" className="text-sky-600 underline font-bold">使い方ガイド</Link>
        をご覧ください。なお、将来、一部の掲載枠などに有料のオプションを設ける可能性があります。
      </>
    ),
  },
  {
    emoji: '🤝',
    title: '取引について',
    body: (
      <>
        Drawkerは取引の当事者にはなりません。報酬の支払いや納品物については、クリエイターと依頼者の間で直接取り決めていただきます。
        依頼の前に確認しておきたい著作権・利用範囲・支払い・やり取りのマナーは
        <Link href="/client-guidelines" className="text-sky-600 underline font-bold">依頼者向けの注意事項</Link>
        にまとめています。
      </>
    ),
  },
  {
    emoji: '🔒',
    title: 'お預かりする情報',
    body: (
      <>
        登録時にお預かりするのは、メールアドレス（またはGoogleアカウントでのログイン情報）と、ご自身で入力した表示名・アイコン・プロフィールの内容です。
        取得する情報の範囲と利用目的は
        <Link href="/privacy" className="text-sky-600 underline font-bold">プライバシーポリシー</Link>
        に、サービスの利用条件は
        <Link href="/terms" className="text-sky-600 underline font-bold">利用規約</Link>
        に記載しています。プロフィールの内容は、ダッシュボードからいつでも確認・変更できます。
      </>
    ),
  },
  {
    emoji: '🛡️',
    title: '作品を守るための取り組み',
    body: (
      <>
        掲載された作品には、クリエイター名の透かしを重ねて表示しています。また、作品やアイコンの画像が検索エンジンの画像検索に載らないよう設定しています。
        無断転載やなりすましが疑われるページ・投稿は、各ページの通報機能から運営に知らせることができます。
      </>
    ),
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="運営者情報" />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            ABOUT
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">運営者情報・お問い合わせ</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">
            安心してご利用いただけるよう、サービスの仕組みと問い合わせ先をまとめました。
          </p>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <section key={section.title} className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-2">
              <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
                <span className="text-lg">{section.emoji}</span> {section.title}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-3">
          <h2 className="text-sm font-black text-slate-700 flex items-center gap-2">
            <span className="text-lg">📮</span> 運営・お問い合わせ
          </h2>
          <dl className="text-xs text-slate-600 space-y-2">
            <div className="flex gap-3">
              <dt className="shrink-0 w-24 font-bold text-slate-400">運営</dt>
              <dd>Drawker運営</dd>
            </div>
            <div className="flex gap-3">
              <dt className="shrink-0 w-24 font-bold text-slate-400">お問い合わせ</dt>
              <dd>
                公式X（旧Twitter）アカウント{' '}
                <a
                  href={OFFICIAL_X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-600 underline font-bold"
                >
                  {OFFICIAL_X_HANDLE}
                </a>{' '}
                までご連絡ください。
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            ご質問の前に、<Link href="/faq" className="text-sky-600 underline">よくある質問</Link>
            もあわせてご確認ください。
          </p>
        </section>
      </div>
    </div>
  )
}
