import Link from 'next/link'
import InfoPage, { InfoItem, InfoSection } from '@/components/InfoPage'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: 'クリエイター向けガイド',
  description:
    'Drawkerにイラストレーターとして登録する流れ、依頼者に見つけてもらいやすいページの作り方、依頼の受け方と取引で気をつけたいことをまとめました。掲載は無料です。',
  path: '/creator-guide',
})

const SETUP_STEPS = [
  { title: '基本情報', body: '表示名・アイコン・テーマカラー' },
  { title: 'ジャンル', body: '得意なジャンル・タグ' },
  { title: '作品', body: '代表作を最大4枚' },
  { title: '料金', body: '最低価格・料金メニュー（料金表の画像でもOK）・納期' },
  { title: '制作条件', body: '商用利用・AI・修正回数・受付スケジュール' },
  { title: '自己紹介', body: 'どんな絵が得意か' },
  { title: 'SNS', body: '作品や連絡先のリンク' },
  { title: '受付方法', body: '見積もりフォーム・直接リクエスト' },
  { title: '公開', body: '確認して公開' },
]

export default function CreatorGuidePage() {
  return (
    <InfoPage
      headerLabel="クリエイター向けガイド"
      badge="FOR CREATORS"
      title="クリエイター向けガイド"
      lead={
        <>
          Drawkerに登録して、依頼を受けるまでの流れと
          <br className="sm:hidden" />
          見つけてもらうためのコツをまとめました。
        </>
      }
      related={[
        { href: '/articles', label: '記事（はじめての依頼ガイド）' },
        { href: '/safety', label: '不審な連絡・詐欺への対処' },
        { href: '/faq', label: 'よくある質問' },
        { href: '/terms', label: '利用規約' },
      ]}
    >
      <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-6 text-white shadow-sm space-y-3 text-center">
        <p className="text-sm font-black">掲載は無料。手数料もかかりません</p>
        <p className="text-xs font-bold opacity-90 leading-relaxed">お金のやり取りはサイトを通さず、依頼者と直接行います。</p>
        <Link href="/login" className="inline-block rounded-full bg-white px-6 py-2.5 text-sm font-black text-sky-600 shadow-sm hover:bg-sky-50">
          クリエイター登録する（無料）
        </Link>
      </div>

      <InfoSection emoji="🪜" title="登録の流れ">
        <p className="text-xs text-slate-500 leading-relaxed">
          アカウントを作ると、ダッシュボードで次の順番に設定できます。1ステップずつ保存されるので、途中でやめても続きから再開できます。
        </p>
        <ol className="grid gap-2 sm:grid-cols-3">
          {SETUP_STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-slate-50 px-3.5 py-3">
              <p className="text-[10px] font-black text-sky-600">STEP {i + 1}</p>
              <p className="text-xs font-black text-slate-800">{step.title}</p>
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{step.body}</p>
            </li>
          ))}
        </ol>
      </InfoSection>

      <InfoSection emoji="✨" title="見つけてもらいやすいページにするコツ">
        <div className="space-y-4">
          <InfoItem heading="1枚目の作品は「いちばん頼んでほしい絵」に">
            <p>1枚目の作品は、一覧のカードやXでシェアされたときの画像に使われます。受けたい依頼に近い絵を選びましょう。</p>
          </InfoItem>
          <InfoItem heading="料金は「最低価格」だけでも入れる">
            <p>金額での絞り込み・並び替えには参考最低価格が使われます。料金表（おしながき）の画像をそのまま載せる場合も、最低価格は入力しておきましょう。</p>
          </InfoItem>
          <InfoItem heading="タグと受付状況をこまめに">
            <p>依頼者はジャンルや「空き枠あり」で探します。受付を止めるときや再開するときは、ダッシュボード上部のボタンで切り替えるとすぐ反映され、フォローしている人に再開が知らされます。</p>
          </InfoItem>
          <InfoItem heading="見積もりフォームで、相談のハードルを下げる">
            <p>
              <Link href="/dashboard/form-builder" className="text-sky-600 underline">
                見積もりフォーム
              </Link>
              を作ると、依頼者がその場で金額を確かめられ、依頼内容をまとめた文章をコピーして送れます。
            </p>
          </InfoItem>
          <InfoItem heading="フィードで制作中の様子を発信する">
            <p>
              <Link href="/feed" className="text-sky-600 underline">
                フィード
              </Link>
              への投稿はクリエイターページにも「最近の投稿」として表示されます。フォローしている人には新しい投稿が通知されます。
            </p>
          </InfoItem>
        </div>
      </InfoSection>

      <InfoSection emoji="📩" title="依頼の受け方">
        <div className="space-y-4">
          <InfoItem heading="見積もりフォーム・SNSからの相談">
            <p>依頼者は見積もりフォームで作った依頼内容を、あなたのSNSやメールに送ります。プロフィールの連絡先リンクは必ず入れておきましょう。</p>
          </InfoItem>
          <InfoItem heading="直接リクエスト">
            <p>メニューに無い内容の相談が、Drawkerの中で届きます。届いたリクエストはダッシュボードの「届いたリクエスト」から確認・返信できます。</p>
          </InfoItem>
          <InfoItem heading="募集ボードに応募する">
            <p>
              <Link href="/wanted" className="text-sky-600 underline">
                募集ボード
              </Link>
              には「こんな絵を描いてくれる人を探しています」という依頼者の募集が並びます。条件に合うものに応募できます。
            </p>
          </InfoItem>
        </div>
      </InfoSection>

      <InfoSection emoji="🤝" title="取引で気をつけたいこと">
        <div className="space-y-4">
          <InfoItem heading="条件は文字で残す">
            <p>料金・納期・支払いの時期・修正回数・キャンセルの扱い・使ってよい範囲（商用利用・SNS掲載など）は、メッセージなど文字で残る形で合意しておきましょう。</p>
          </InfoItem>
          <InfoItem heading="支払いの時期を決めておく">
            <p>はじめての相手とは、着手金と完成後の残金に分ける、ラフ確認後に支払ってもらうなど、お互いが安心できる形を相談しましょう。</p>
          </InfoItem>
          <InfoItem heading="不審な連絡に注意">
            <p>
              運営を名乗る連絡や、外部サイトへの誘導には注意してください。詳しくは
              <Link href="/safety" className="text-sky-600 underline">
                不審な連絡・詐欺への対処
              </Link>
              をご覧ください。
            </p>
          </InfoItem>
        </div>
      </InfoSection>
    </InfoPage>
  )
}
