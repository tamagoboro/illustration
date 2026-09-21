import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200/80 space-y-6">

        {/* ヘッダー */}
        <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-900">プライバシーポリシー</h1>
            <p className="text-xs text-slate-400 mt-1">制定日: 2026年9月21日</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/terms"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              利用規約
            </Link>
            <Link
              href="/"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              ← トップページへ戻る
            </Link>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-600">
          本サービス運営者（以下「当方」といいます。）は、ユーザーの個人情報を含む利用者情報（以下「個人情報等」といいます。）を適切に取り扱うため、本プライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
        </p>

        <div className="space-y-6 text-xs text-slate-700 leading-relaxed">

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第1条（収集する情報）</h2>
            <p>当方は、本サービスの提供にあたり、以下の情報を取得することがあります。</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>アカウント登録時に入力される情報（メールアドレス、パスワード等）</li>
              <li>プロフィール情報（表示名、プロフィールアイコン画像、紹介文、料金・対応条件の設定内容、SNSリンクやユーザーが任意で掲載する連絡先メールアドレス等）</li>
              <li>クリエイターが投稿する作品（ポートフォリオ）画像等のコンテンツ</li>
              <li>レビュー投稿、通報、リクエスト機能を通じて送信される依頼内容等のコミュニケーション情報</li>
              <li>本サービスの利用状況に関する情報（閲覧数、見積もりシミュレーターの利用状況、お気に入り登録等）。これらは主にクリエイターごとの統計・集計を目的として記録され、閲覧者個人を特定する情報とは紐付けずに扱います</li>
              <li>Cookie等の技術を通じて自動的に取得される情報（ログイン状態を維持するための情報、アクセスログ、IPアドレス等）</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第2条（利用目的）</h2>
            <p>当方は、取得した個人情報等を、以下の目的の範囲内で利用します。</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>本サービスの提供、維持、保護および改善のため</li>
              <li>ユーザーからのお問い合わせへの対応、本人確認のため</li>
              <li>利用規約に違反する行為への対応（通報内容の確認、アカウントの利用制限等）のため</li>
              <li>クリエイターへの実績表示（アクセス状況等に基づくバッジ表示を含む）や、ダッシュボード上での分析情報の提供のため</li>
              <li>新機能の検討および既存機能の改善のため</li>
              <li>新規クリエイター登録時に、当方の公式SNSアカウント等で本サービスを紹介する目的（第4条参照）</li>
              <li>法令に基づく対応のため</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第3条（Cookie等の利用）</h2>
            <p>
              本サービスは、ログイン状態の維持等を目的として、Cookieおよびこれに類する技術を利用しています。ブラウザの設定によりCookieの受け取りを拒否することも可能ですが、その場合、ログインを要する機能など、本サービスの一部がご利用いただけなくなることがあります。
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第4条（個人情報等の第三者提供）</h2>
            <p>当方は、以下の場合を除き、あらかじめユーザーの同意を得ることなく、個人情報等を第三者に提供しません。</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>新規クリエイター登録時、当方の公式SNSアカウント（X（旧Twitter）等）にて、登録されたプロフィールの表示名・紹介文・サムネイル画像を紹介目的で投稿する場合。掲載を希望されない場合は、第8条のお問い合わせ窓口までご連絡ください</li>
              <li>法令に基づき、裁判所、警察その他の公的機関から開示を求められた場合</li>
              <li>人の生命、身体または財産の保護のために必要があり、本人の同意を得ることが困難である場合</li>
            </ul>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第5条（外部サービスの利用）</h2>
            <p>
              当方は、本サービスの提供にあたり、データベース・認証・ファイル保管のためにSupabase Inc.が提供するサービスを、ホスティングのためにVercel Inc.が提供するサービスを、それぞれ利用しています。これらの外部サービスにおける情報の取扱いについては、各社が定めるプライバシーポリシーもあわせてご確認ください。
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第6条（安全管理措置）</h2>
            <p>
              当方は、取り扱う個人情報等の漏えい、滅失またはき損の防止その他の安全管理のため、アクセス制御を含む必要かつ適切な措置を講じます。
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第7条（開示・訂正・削除等の請求）</h2>
            <p>
              ユーザーは、ご自身のプロフィール情報等について、ダッシュボードからいつでも確認・変更することができます。これに加え、当方が保有するご自身の個人情報等について、法令の定めに基づき開示、訂正、追加、削除、利用停止（アカウントの削除を含みます。）等を請求することができます。ご希望の場合は、次条のお問い合わせ窓口までご連絡ください。当方は、本人確認のうえ、合理的な期間内に対応いたします。
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第8条（お問い合わせ窓口）</h2>
            <p>
              本ポリシーの内容、または個人情報等の開示等の請求に関するお問い合わせは、以下の窓口までご連絡ください。
            </p>
            <p className="font-mono text-slate-500">【X:@Drawker06】</p>
          </section>

          <section className="space-y-1.5">
            <h2 className="font-bold text-slate-900 text-sm">第9条（本ポリシーの変更）</h2>
            <p>
              当方は、必要と判断した場合には、ユーザーに通知することなくいつでも本ポリシーを変更することができるものとします。なお、変更後の本ポリシーは、本サービス上に掲示された時点から効力を生じるものとします。
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
