import Link from 'next/link'
import InfoPage, { InfoItem, InfoSection } from '@/components/InfoPage'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: '合意内容の控えの使い方',
  description:
    '依頼者とクリエイターで決めた料金・納期・修正回数・使ってよい範囲を記録する「合意内容の控え」の使い方。作り方、同意のしかた、進み具合の記録、解約、トラブルの報告までまとめました。',
  path: '/guide/agreements',
})

const CREATOR_STEPS = [
  { title: '控えを作る', body: 'マイページ（ダッシュボード）の「合意内容の控え」、または「届いたリクエスト」の「控えを作る」から開きます。' },
  { title: '連絡先と内容を書く', body: 'あなたの連絡先（X・Bluesky・Discordなど）は必須です。料金・納期・支払い方法・修正回数などを書きます。よくある書き方はボタンで入れられます。' },
  { title: 'リンクを依頼者に送る', body: '保存すると専用のリンクが発行されます。「🔗 リンクをコピー」して、XのDMなどで依頼者に送りましょう。' },
  { title: '同意を待つ', body: '依頼者が同意すると通知が届きます。同意されるまでは、内容を直したり取り下げたりできます。' },
]

const CLIENT_STEPS = [
  { title: 'リンクを開いてログイン', body: 'クリエイターから届いたリンクを開きます。内容の確認と同意には、ログイン（無料の新規登録）が必要です。' },
  { title: '内容を確認する', body: '料金・納期・修正回数・使ってよい範囲・キャンセルの扱いなどを確認しましょう。' },
  { title: '連絡先を書いて同意する', body: 'あなたの連絡先（X・Bluesky・Discordなど）は必須です。納得できたら「この内容で同意する」を押します。違うところがあれば「見直しをお願いする」でクリエイターに伝えましょう。' },
]

const PROGRESS = [
  { who: '依頼者', what: '💴 支払いました', note: '着手金と残金など、分けて払うときは何回でも記録できます' },
  { who: 'クリエイター', what: '✅ 入金を確認しました', note: '支払いを受け取ったら記録します' },
  { who: 'クリエイター', what: '🎨 制作を始めました / ✏️ ラフを提出しました', note: 'ラフや途中経過は何回でも記録できます' },
  { who: 'クリエイター', what: '📦 納品しました', note: '依頼者に「受け取りの確認」をお願いする通知が届きます' },
  { who: '依頼者', what: '🎉 受け取りました（取引完了）', note: 'これで取引は完了です' },
]

const FAQS = [
  {
    q: 'Drawkerがお金を預かったり、支払いを保証したりしますか？',
    a: 'いいえ。Drawkerは決済を仲介しておらず、取引の当事者でもありません。控えは「何を約束したか」「いつ何があったか」を、消せない形で残すためのものです。',
  },
  {
    q: '同意したあとに内容を変えたいときは？',
    a: 'クリエイターが「変更版を作る」を押して新しい控えを作り、依頼者にもう一度同意してもらいます。前の版は「古い版」として残ります。同意済みの控えを書き換えることは、どちらにもできません。',
  },
  {
    q: '途中で取引をやめたいときは？',
    a: '同意した取引は、一方的にはやめられません。控えの画面の「取引をやめたい（解約の申し出）」から、理由と返金などの条件を書いて申し出てください。相手が承諾したときだけ解約になります。',
  },
  {
    q: '相手と連絡が取れなくなったときは？',
    a: '控えの画面の「🚨 トラブルを運営に報告」から知らせてください。控えと記録が運営に届き、内容を確認して対応します。お金をだまし取られた場合は、警察相談専用電話「#9110」や消費者ホットライン「188」にもご相談ください。',
  },
  {
    q: '相手が退会したら、控えは消えますか？',
    a: '消えません。控えと記録は、同意した時点の名前・連絡先と一緒に残ります。',
  },
  {
    q: '納期が近いことを知らせてもらえますか？',
    a: '同意済みの控えは、納期の3日前になると双方に通知が届きます。',
  },
  {
    q: '控えを手元にも保存できますか？',
    a: '控えの画面の「📋 文字でコピー」で文章として、「🖨 印刷・PDFで保存」でPDFとして保存できます。',
  },
]

function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="w-7 h-7 shrink-0 rounded-full bg-sky-500 text-white text-xs font-black flex items-center justify-center">{i + 1}</span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800">{step.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

export default function AgreementsGuidePage() {
  return (
    <InfoPage
      headerLabel="控えの使い方"
      badge="HOW TO USE"
      title="合意内容の控えの使い方"
      lead={
        <>
          料金・納期・修正回数・使ってよい範囲など、
          <br className="sm:hidden" />
          決めたことを記録に残して、安心して取引しましょう。
        </>
      }
      related={[
        { href: '/agreements', label: '自分の控えの一覧' },
        { href: '/safety', label: '不審な連絡・詐欺への対処' },
        { href: '/creator-guide', label: 'クリエイター向けガイド' },
        { href: '/client-guidelines', label: '依頼者向けの注意事項' },
      ]}
    >
      <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-6 text-white shadow-sm space-y-2">
        <h2 className="text-sm font-black">📝 合意内容の控えとは</h2>
        <ul className="space-y-1.5 text-xs font-bold leading-relaxed list-disc list-inside">
          <li>相談で決まった内容を、クリエイターが「控え」にまとめます。</li>
          <li>依頼者が「同意する」を押すと、双方のマイページに残り、どちらも書き換えられなくなります。</li>
          <li>支払い・制作・納品の進み具合も記録でき、トラブルのときに「何を約束したか」を示せます。</li>
          <li>使うのは無料です。</li>
        </ul>
      </div>

      <InfoSection emoji="🎨" title="クリエイターの使い方">
        <StepList steps={CREATOR_STEPS} />
        <div className="space-y-3 pt-2">
          <InfoItem heading="💾 いつもの内容を保存する">
            <p>支払い方法・修正回数・キャンセルの扱いなど、毎回同じ部分を「いつもの内容」にしておくと、次から最初から入った状態で作れます。</p>
          </InfoItem>
        </div>
      </InfoSection>

      <InfoSection emoji="🙋" title="依頼者の使い方">
        <StepList steps={CLIENT_STEPS} />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          届いた控えは、マイページの「合意内容の控え」からも開けます。あなたの同意を待っている控えがあると、一覧の上にお知らせが出ます。
        </p>
      </InfoSection>

      <InfoSection emoji="📈" title="同意したあと：進み具合と支払いの記録">
        <p className="text-xs text-slate-500 leading-relaxed">
          同意した控えの画面で、それぞれが進み具合を記録します。記録すると相手に通知が届き、あとから消したり直したりはできません。メモを添えることもできます。
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sky-50 text-left">
                <th className="px-3 py-2 font-black text-slate-700 whitespace-nowrap">記録する人</th>
                <th className="px-3 py-2 font-black text-slate-700">ボタン</th>
                <th className="px-3 py-2 font-black text-slate-700">メモ</th>
              </tr>
            </thead>
            <tbody>
              {PROGRESS.map((row) => (
                <tr key={row.what} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">{row.who}</td>
                  <td className="px-3 py-2 font-bold text-slate-800">{row.what}</td>
                  <td className="px-3 py-2 text-slate-500">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </InfoSection>

      <InfoSection emoji="🛡" title="困ったとき">
        <div className="space-y-3">
          <InfoItem heading="取引をやめたい（解約の申し出）">
            <p>同意した取引は一方的にはやめられません。理由と返金などの条件を書いて申し出て、相手が承諾したときだけ解約になります。</p>
          </InfoItem>
          <InfoItem heading="🚨 トラブルを運営に報告">
            <p>納期を過ぎても届かない、支払ったのに連絡がない、納品したのに支払われない…などは、控えの画面から運営に報告できます。</p>
          </InfoItem>
          <InfoItem heading="クリエイターのページに出る実績">
            <p>クリエイターのページには、「取引完了 ○件」と「納期を過ぎた未納品 ○件」が表示されます（取引の内容や相手は表示されません）。</p>
          </InfoItem>
        </div>
      </InfoSection>

      <InfoSection emoji="❓" title="よくある質問">
        <div className="space-y-4">
          {FAQS.map((faq) => (
            <InfoItem key={faq.q} heading={`Q. ${faq.q}`}>
              <p>{faq.a}</p>
            </InfoItem>
          ))}
        </div>
      </InfoSection>

      <div className="text-center">
        <Link
          href="/agreements"
          className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-sm font-black shadow-sm hover:brightness-105"
        >
          自分の控えの一覧へ →
        </Link>
      </div>
    </InfoPage>
  )
}
