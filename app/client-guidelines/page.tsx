import type { Metadata } from 'next'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

export const metadata: Metadata = {
  title: '依頼者向けの注意事項（権利・契約・マナー）',
  description:
    'イラストを依頼する前に知っておきたい著作権・利用範囲・契約・支払い・やり取りのマナーをまとめました。Drawkerでクリエイターに依頼する方は必ずご確認ください。',
}

// 依頼前にさっと確認してもらうためのチェックリスト
const CHECKLIST = [
  'クリエイターの依頼要項（受付状況・NG事項・利用規約）を読んだ',
  '用途（個人利用／商用利用／配信・グッズなど）を伝え、その範囲で使ってよいか確認した',
  '料金・納期・支払い方法と時期・修正回数・キャンセル時の扱いを、文字で残る形で合意した',
  '二次創作や実在の人物を描いてもらう場合、権利者のガイドラインや本人の同意を確認した',
  '未成年の場合は、保護者の同意を得ている',
]

type Section = {
  emoji: string
  title: string
  items: { heading: string; body: string }[]
}

const SECTIONS: Section[] = [
  {
    emoji: '©️',
    title: '著作権と利用範囲',
    items: [
      {
        heading: '著作権は原則としてクリエイターにあります',
        body: '料金を支払って描いてもらったイラストでも、著作権は描いたクリエイターに残るのが原則です（著作権法）。依頼者が使えるのは、事前に合意した利用範囲の中だけです。',
      },
      {
        heading: '使う目的は最初に伝える',
        body: '個人のSNSアイコン、配信・動画での使用、グッズ販売、広告など、用途によって料金や可否が変わります。合意した範囲の外で使いたくなった場合は、あらためて許可を取ってください。',
      },
      {
        heading: '著作権の譲渡は事前の合意が必要です',
        body: '著作権そのものを譲り受けたい場合は、依頼前に相談し、契約内容を文字で残してください。改変や二次利用までしたい場合は、そのことも契約に明記しておく必要があります。また、著作者人格権（名前を表示するかどうか、作品を勝手に変えられない権利など）は、譲渡を受けてもクリエイターに残ります。',
      },
      {
        heading: '無断で加工・トリミングしない',
        body: '色の変更、切り抜き、他の画像との合成、文字入れなどの加工は、事前にクリエイターの許可を取ってください。',
      },
    ],
  },
  {
    emoji: '🚫',
    title: 'してはいけないこと',
    items: [
      {
        heading: '無断転載・再配布・販売',
        body: '納品物を第三者に配布したり、許可なく販売したりしないでください。自分で描いたかのように見せる「自作発言」も禁止です。SNSに載せるときは、クリエイターが指定するクレジット表記に従ってください。',
      },
      {
        heading: 'AIの学習や生成への利用',
        body: '納品物を生成AIの学習データにしたり、AIで加工・生成する元画像（i2i）として使ったりしないでください。クリエイターが許可している場合を除き、トラブルの原因になります。',
      },
      {
        heading: 'ほかの作家の絵柄やトレースを求める依頼',
        body: '特定の作家の絵柄を真似するよう求めたり、既存の作品をなぞって描くよう求めたりする依頼は、権利侵害やトラブルにつながります。参考資料は「雰囲気を伝えるため」にとどめてください。',
      },
      {
        heading: '権利関係が未確認の依頼',
        body: '版権キャラクター（二次創作）の依頼は、原作の権利者が公開しているガイドラインを確認してください。商用利用は禁止されていることがほとんどです。実在の人物を描いてもらう場合は、ご本人の同意を得てください（肖像権・パブリシティ権）。',
      },
      {
        heading: '法令や公序良俗に反する内容',
        body: 'R-18の依頼は、対応可能と明記しているクリエイターに、18歳以上の方だけが行えます。法令に違反する内容（児童を性的に描写するもの等）や、他人を誹謗中傷する目的の依頼はできません。',
      },
    ],
  },
  {
    emoji: '📝',
    title: '契約とお金',
    items: [
      {
        heading: '条件は文字で残す',
        body: '料金、納期、支払い方法と支払日、修正（リテイク）の回数、納品形式・サイズ、利用範囲、キャンセル時の扱いは、メッセージなど記録が残る形で合意しておきましょう。「言った・言わない」のトラブルを防げます。',
      },
      {
        heading: '支払いは約束どおりに',
        body: '合意した期日までに支払ってください。提示された料金を大幅に値切ったり、納品後に一方的に減額を求めたりするのはマナー違反です。',
      },
      {
        heading: '途中の変更・キャンセル',
        body: '着手後のキャンセルや大きな仕様変更は、作業済みの分の費用や追加料金がかかるのが一般的です。取り決めがあればそれに従ってください。',
      },
      {
        heading: '事業者として依頼する場合',
        body: '企業や個人事業主が、業務としてフリーランスのクリエイターに依頼する場合は「フリーランス・事業者間取引適正化等法」（2024年11月施行）の対象になります。依頼内容・報酬額・支払期日などを書面やメールで明示する義務があり、条件によっては「納品から60日以内の支払い」や、不当な減額・受け取り拒否・やり直しの強要の禁止なども求められます。資本金などの条件によっては、中小受託取引適正化法（旧・下請法）が適用されることもあります。',
      },
      {
        heading: '未成年の方の依頼',
        body: '18歳未満の方が依頼する場合は、保護者の同意を得てください。同意の無い契約は、後から取り消されることがあります（民法）。',
      },
    ],
  },
  {
    emoji: '💬',
    title: 'やり取りのマナー',
    items: [
      {
        heading: '最初の連絡は具体的に',
        body: '用途、希望する内容、サイズ、締め切り、予算、参考資料をまとめて伝えると、見積もりや受付の判断がスムーズです。',
      },
      {
        heading: '相手の都合を尊重する',
        body: 'クリエイターの多くは個人で活動しています。返信を急かしすぎたり、深夜・早朝に何度も連絡したりするのは控えましょう。辞退された場合も、理由の説明を強く求めないでください。',
      },
      {
        heading: '個人情報を大切に',
        body: 'やり取りの中で知った本名・住所・連絡先などを、第三者に伝えたりSNSに載せたりしないでください。',
      },
      {
        heading: 'レビューは事実にもとづいて',
        body: 'レビューは、ほかの依頼者の参考になる大切な情報です。実際の取引の内容にもとづいて書いてください。誹謗中傷や、取引内容の「晒し」行為は禁止です。',
      },
    ],
  },
]

export default function ClientGuidelinesPage() {
  return (
    <div className="min-h-screen pb-20 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="依頼者向けの注意事項" />

      <div className="max-w-3xl mx-auto space-y-6 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            依頼する前に
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">依頼者向けの注意事項</h1>
          <p className="text-sm text-slate-600 font-medium drop-shadow-sm leading-relaxed">
            クリエイターと気持ちよく取引するために、
            <br className="sm:hidden" />
            権利・契約・マナーの基本をまとめました。
          </p>
        </div>

        {/* チェックリスト */}
        <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-6 text-white shadow-sm space-y-3">
          <h2 className="text-sm font-black">✅ 依頼前チェックリスト</h2>
          <ul className="space-y-2">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-xs font-bold leading-relaxed">
                <span className="mt-0.5 w-4 h-4 rounded-md bg-white/90 text-sky-500 flex items-center justify-center text-[10px] shrink-0">
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 目次 */}
        <nav className="flex flex-wrap justify-center gap-2">
          {SECTIONS.map((section, i) => (
            <a
              key={section.title}
              href={`#section-${i}`}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full bg-white/90 text-sky-700 border border-sky-100 hover:bg-sky-50 transition-colors shadow-2xs"
            >
              {section.emoji} {section.title}
            </a>
          ))}
        </nav>

        {SECTIONS.map((section, i) => (
          <section
            key={section.title}
            id={`section-${i}`}
            className="scroll-mt-28 bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-4"
          >
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <span className="text-lg">{section.emoji}</span> {section.title}
            </h2>
            <div className="space-y-4">
              {section.items.map((item) => (
                <div key={item.heading} className="space-y-1 pl-3 border-l-2 border-sky-100">
                  <h3 className="text-xs font-black text-slate-700">{item.heading}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* トラブル時 */}
        <section className="bg-amber-50 rounded-3xl p-6 border border-amber-200/60 space-y-2">
          <h2 className="text-sm font-black text-amber-700">⚠️ トラブルになったときは</h2>
          <ul className="text-xs text-amber-800/90 leading-relaxed list-disc list-inside space-y-1">
            <li>Drawkerは取引の当事者ではないため、支払いや納品に関する問題は当事者同士での話し合いが基本です。やり取りの記録は消さずに残しておきましょう。</li>
            <li>話し合いで解決しない場合は、消費者ホットライン「188」（最寄りの消費生活センター）などの公的な相談窓口もご利用いただけます。</li>
            <li>
              規約違反や不審なアカウントを見つけた場合は、クリエイターページの「通報する」からお知らせください。詳しくは
              <Link href="/terms" className="underline font-bold">
                利用規約
              </Link>
              をご確認ください。
            </li>
          </ul>
        </section>

        <p className="text-[10px] text-slate-500 text-center leading-relaxed drop-shadow-xs">
          このページは一般的な情報をまとめたもので、法的な助言ではありません。
          <br />
          個別のケースについては、弁護士などの専門家にご相談ください。
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-sm transition-colors"
          >
            クリエイターを探す →
          </Link>
          <Link
            href="/guide"
            className="px-5 py-2.5 rounded-full bg-white hover:bg-sky-50 text-sky-700 text-xs font-black shadow-sm border border-sky-100 transition-colors"
          >
            使い方ガイド
          </Link>
        </div>
      </div>
    </div>
  )
}
