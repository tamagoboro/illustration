import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">
        
        {/* ヘッダー */}
        <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">利用規約</h1>
            <p className="text-xs text-slate-400 mt-1">制定日: 2026年8月31日</p>
          </div>
          <Link
            href="/"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            ← トップページへ戻る
          </Link>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          本利用規約（以下「本規約」といいます。）は、本サービスの利用条件を定めるものです。ユーザーの皆様（以下「ユーザー」といいます。）には、本規約に従って本サービスをご利用いただきます。
        </p>

        {/* 各条文 */}
        <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
          
          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第1条（適用）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>本規約は、ユーザーと本サービス運営者（以下「当方」といいます。）との間の本サービスの利用に関わる一切の関係に適用されます。</li>
              <li>当方は本サービスに関し、本規約のほか、各種の定め（以下「個別規定」といいます。）をすることがあります。これら個別規定はその名称のいかんに関わらず、本規約の一部を構成するものとします。</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第2条（ユーザー登録およびアカウント管理）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>登録希望者が当方の定める方法によってユーザー登録を申請し、当方がこれを承認することによって、ユーザー登録が完了するものとします。</li>
              <li>ユーザーは、自己の責任においてアカウントおよびパスワードを厳重に管理するものとします。</li>
              <li>ユーザーは、いかなる場合にもアカウントを第三者に譲渡または貸与することはできません。</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第3条（クリエイターと発注者の直接取引に関する注意）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>本サービスは、クリエイターと作品発注者（クライアント）をマッチング・検索するためのプラットフォームです。</li>
              <li>当方は、ユーザー間で成立する契約、作業内容、報酬の支払、成果物の納品等について直接の当事者とはならず、一切の責任を負いません。</li>
              <li>万が一ユーザー間でトラブル・損害が発生した場合は、当事者同士で解決するものとします。</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第4条（禁止事項）</h2>
            <p>ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>法令または公序良俗に違反する行為</li>
              <li>犯罪行為に関連する行為</li>
              <li>他のユーザー、第三者または当方の著作権、商標権、プライバシー権等の知的財産権・権利を侵害する行為</li>
              <li>他のユーザーまたは第三者に対する中傷、脅迫、ハラスメント行為</li>
              <li>自作発言、無断転載、その他権利関係を偽る行為</li>
              <li>サーバーやネットワークに過度の負担をかける行為、またはシステムの不正操作</li>
              <li>本サービスの運営を妨害するおそれのある行為</li>
              <li>その他、当方が不適切と判断する行為</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第5条（本サービスの提供の停止等）</h2>
            <p>当方は、以下のいずれかの事由があると判断した場合、ユーザーに事前通知することなく本サービスの全部または一部の提供を停止または中断することができるものとします。</p>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>本サービスにかかるコンピュータシステムの保守点検または更新を行う場合</li>
              <li>地震、落雷、火災、停電または天災などの不可抗力により、本サービスの提供が困難となった場合</li>
              <li>コンピュータまたは通信回線等が事故により停止した場合</li>
              <li>その他、当方が本サービスの提供が困難と判断した場合</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第6条（権利帰属）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>本サービス上のテキスト、画像、プログラム等に関する知的財産権は、当方または正当な権利を有する第三者に帰属します。</li>
              <li>クリエイターが登録・投稿したポートフォリオ画像等の著作権は、各クリエイター本人に帰属します。ただし、クリエイターは、当方が本サービスのPRやプロモーションを目的として、該当画像をサービス内やSNS等で無償で使用することを許諾するものとします。</li>
            </ol>
          </section>

          {/* 新設：イラストの真正性と検証に関する規定 */}
          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第7条（掲載コンテンツの真正性と証明）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>ユーザーが本サービス上に手書き・手作業による制作物として登録または掲載するイラスト等のコンテンツについて、生成AI等による自動生成の疑義が生じた場合、当方は当該ユーザーに対し、制作過程を示すタイムラプス動画、PSDデータ（レイヤー構造が保持されたもの）、タイムライン情報、その他制作の真正性を証明する資料（以下「証明資料」といいます。）の提出を求めることができるものとします。</li>
              <li>ユーザーは、前項に基づき当方から証明資料の提出を求められた場合、当方が指定する期限までにこれに応じる義務を負うものとします。</li>
              <li>ユーザーが合理的な理由なく証明資料の提出に応じない場合、または提出された資料では手作業による制作の真正性が不十分であると当方が判断した場合、当方は事前通知なく以下の措置を講じることができるものとします。
                <ul className="list-disc list-inside space-y-0.5 pl-4 mt-1 text-slate-600">
                  <li>該当コンテンツの掲載取り消しおよび削除</li>
                  <li>アカウントの利用停止または削除（アカウント消失）</li>
                  <li>本サービスおよび関連サイトの閲覧・利用権限の剥奪・ブロック</li>
                  <li>その他当方が必要と認める法的措置</li>
                </ul>
              </li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第8条（免責事項）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>当方は、本サービスに事実上または法律上の欠陥（安全性、信頼性、正確性、完全性、有効性、特定の目的への適合性、セキュリティ等に関する欠陥、エラーやバグ、権利侵害等を含みます。）がないことを明示的にも黙示的にも保証しておりません。</li>
              <li>当方は、本サービスに起因してユーザーに生じたあらゆる損害について、当方の故意または重過失による場合を除き、一切の責任を負いません。</li>
            </ol>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第9条（利用規約の変更）</h2>
            <p>当方は、必要と判断した場合には、ユーザーに通知することなくいつでも本規約を変更することができるものとします。なお、変更後の本規約は、本サービス上に掲示された時点から効力を生じるものとします。</p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第10条（準拠法・裁判管轄）</h2>
            <ol className="list-decimal list-inside space-y-1 pl-1">
              <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
              <li>本サービスに関して紛争が生じた場合、当方の所在地を管轄する裁判所を専属的合意管轄とします。</li>
            </ol>
          </section>

        </div>
      </div>
    </div>
  )
}
