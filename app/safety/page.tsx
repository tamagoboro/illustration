import Link from 'next/link'
import InfoPage, { InfoItem, InfoSection } from '@/components/InfoPage'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: '不審な連絡・詐欺への対処',
  description:
    'イラスト依頼で気をつけたい、前払い後の持ち逃げ・なりすまし・外部サイトへの誘導などの手口と、気づいたときの対処（通報・ブロック・相談窓口）をまとめました。',
  path: '/safety',
})

const WARNING_SIGNS = [
  'Drawkerの運営を名乗って、パスワード・ログイン情報・支払いを求めてくる',
  'プロフィールや作品と違う名前・SNSアカウントからの連絡で、急いで支払いを求めてくる',
  '相場より極端に高い報酬や、条件の良すぎる依頼を持ちかけてくる',
  '見慣れないサイトやアプリへの登録、ファイルのダウンロードを求めてくる',
  'ギフトカード・電子マネーのコードでの支払いを求めてくる',
  '「今日中に」「すぐに」と、確認する時間を与えないように急かしてくる',
]

export default function SafetyPage() {
  return (
    <InfoPage
      headerLabel="安全ガイド"
      badge="SAFETY"
      title="不審な連絡・詐欺への対処"
      lead={
        <>
          安心して依頼・取引をするために、
          <br className="sm:hidden" />
          よくある手口と対処方法をまとめました。
        </>
      }
      related={[
        { href: '/client-guidelines', label: '依頼者向けの注意事項' },
        { href: '/creator-guide', label: 'クリエイター向けガイド' },
        { href: '/contact', label: 'お問い合わせ' },
        { href: '/terms', label: '利用規約' },
      ]}
    >
      <div className="bg-gradient-to-br from-rose-500 to-orange-400 rounded-3xl p-6 text-white shadow-sm space-y-2">
        <h2 className="text-sm font-black">🛡 まず知っておいてほしいこと</h2>
        <ul className="space-y-1.5 text-xs font-bold leading-relaxed list-disc list-inside">
          <li>Drawkerの運営が、DMやメールでパスワード・ログイン情報・お金を求めることはありません。</li>
          <li>Drawkerは決済を仲介していません。支払いは、依頼者とクリエイターが直接やり取りします。</li>
          <li>運営の公式アカウントは X（旧Twitter）の @Drawker06 だけです。</li>
        </ul>
      </div>

      <InfoSection emoji="🚩" title="こんな連絡には注意してください">
        <ul className="space-y-2">
          {WARNING_SIGNS.map((sign) => (
            <li key={sign} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
              <span className="text-rose-400 shrink-0">⚠</span>
              <span>{sign}</span>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection emoji="🔍" title="よくある手口">
        <div className="space-y-4">
          <InfoItem heading="前払いのあとに連絡が取れなくなる">
            <p>
              依頼者が前払いしたあと、作品が届かないまま連絡が途絶えるケースです。はじめての相手には、着手金と完成後の残金に分けるなど、支払いの時期を相談しましょう。
            </p>
          </InfoItem>
          <InfoItem heading="なりすまし">
            <p>
              有名なクリエイターや依頼者になりすまして連絡してくるケースです。連絡が来たら、相手のDrawkerのページに載っているSNSのリンクと同じアカウントかどうかを確かめてください。
            </p>
          </InfoItem>
          <InfoItem heading="作品の持ち逃げ・無断転載">
            <p>
              完成した作品を受け取ったあと支払わない、ラフや作品を無断で使われるケースです。クリエイターは、完成データを渡すタイミングや、透かし入りの確認用画像を使うことを決めておくと安心です。
            </p>
          </InfoItem>
          <InfoItem heading="外部サイトへの誘導">
            <p>
              「こちらで手続きを」と、ログイン画面に似せたサイトやアプリへ誘導して、パスワードやカード情報を入力させるケースです。知らないサイトでは情報を入力しないでください。
            </p>
          </InfoItem>
        </div>
      </InfoSection>

      <InfoSection emoji="🧯" title="おかしいと思ったら">
        <div className="space-y-4">
          <InfoItem heading="1. やり取りを止めて、記録を残す">
            <p>支払いや個人情報の送信は、いったん止めましょう。メッセージ・振込の記録・相手のアカウント名は消さずにスクリーンショットで残してください。</p>
          </InfoItem>
          <InfoItem heading="2. Drawkerで通報する">
            <p>
              クリエイターのページの「通報する」、フィードの投稿の「⋯」メニュー、コメントの「通報」から運営に知らせられます。通報したことは相手には伝わりません。
            </p>
          </InfoItem>
          <InfoItem heading="3. ブロックする">
            <p>
              相手をブロックすると、お互いの投稿が見えなくなり、コメント・いいね・フォローなどができなくなります。解除は
              <Link href="/blocks" className="text-sky-600 underline">
                ブロック・ミュートの管理
              </Link>
              からできます。
            </p>
          </InfoItem>
          <InfoItem heading="4. 運営に相談する">
            <p>
              <Link href="/contact" className="text-sky-600 underline">
                お問い合わせフォーム
              </Link>
              の「規約違反・トラブルのご報告」から、状況を送ってください。内容を確認し、必要に応じてアカウントの非表示などの対応をします。
            </p>
          </InfoItem>
        </div>
      </InfoSection>

      <section className="bg-amber-50 rounded-3xl p-6 border border-amber-200/60 space-y-2">
        <h2 className="text-sm font-black text-amber-700">📞 公的な相談窓口</h2>
        <ul className="text-xs text-amber-800/90 leading-relaxed list-disc list-inside space-y-1">
          <li>お金のトラブル・契約の相談：消費者ホットライン「188」（最寄りの消費生活センターにつながります）</li>
          <li>詐欺の被害にあったかもしれないとき：警察相談専用電話「#9110」</li>
          <li>すでにお金をだまし取られた・脅されているなど緊急のときは、迷わず「110」へ</li>
        </ul>
        <p className="text-[11px] text-amber-700/80">
          Drawkerは取引の当事者ではないため、お金の返金などを代わりに行うことはできません。早めに公的な窓口へご相談ください。
        </p>
      </section>
    </InfoPage>
  )
}
