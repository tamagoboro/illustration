import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

export const metadata: Metadata = {
  title: 'DiscordのWebhook URLの取得方法',
  description: 'Drawkerの通知をDiscordで受け取るための、Webhook URLの作り方をはじめての方向けに説明します。',
}

// Discordの画面を簡略化した見本（実際の画面とは細部が異なる）
function DiscordMock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[#313338] text-[#dbdee1] p-4 text-xs font-medium space-y-2 shadow-inner select-none" aria-hidden>
      {children}
    </div>
  )
}

const MenuRow = ({ children, active = false }: { children: ReactNode; active?: boolean }) => (
  <div
    className={`px-3 py-2 rounded-md ${
      active ? 'bg-[#5865f2] text-white font-bold ring-2 ring-amber-300' : 'bg-[#2b2d31] text-[#b5bac1]'
    }`}
  >
    {children}
  </div>
)

type Step = { title: string; body: ReactNode; mock: ReactNode }

const PC_STEPS: Step[] = [
  {
    title: '通知を受け取るサーバーを用意する',
    body: (
      <>
        自分だけが入っているサーバーを使うのがおすすめです。無い場合は、Discordの左側の「＋」から
        「オリジナルの作成」→「自分と友達のため」で作れます。通知専用のチャンネル（例：#drawker通知）を作っておくと便利です。
      </>
    ),
    mock: (
      <DiscordMock>
        <MenuRow>＃ 雑談</MenuRow>
        <MenuRow active>＃ drawker通知</MenuRow>
      </DiscordMock>
    ),
  },
  {
    title: 'チャンネルの「⚙ 設定」を開く',
    body: <>通知を受け取りたいチャンネル名にマウスを乗せると出る、歯車アイコン「チャンネルの編集」をクリックします。</>,
    mock: (
      <DiscordMock>
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-[#404249] text-white">
          <span>＃ drawker通知</span>
          <span className="px-1.5 rounded bg-amber-300 text-slate-900 font-black">⚙</span>
        </div>
      </DiscordMock>
    ),
  },
  {
    title: '「連携サービス」→「ウェブフックを作成」',
    body: <>左のメニューから「連携サービス」を選び、「ウェブフックを作成」（または「新しいウェブフック」）を押します。</>,
    mock: (
      <DiscordMock>
        <MenuRow>概要</MenuRow>
        <MenuRow>権限</MenuRow>
        <MenuRow active>連携サービス</MenuRow>
        <div className="pt-1">
          <span className="inline-block px-3 py-1.5 rounded-md bg-[#5865f2] text-white font-bold ring-2 ring-amber-300">
            ウェブフックを作成
          </span>
        </div>
      </DiscordMock>
    ),
  },
  {
    title: '「ウェブフックURLをコピー」',
    body: (
      <>
        作られたウェブフック（「Captain Hook」などの名前）を開き、「ウェブフックURLをコピー」を押します。
        名前は「Drawker」などに変えておくと分かりやすいです。
      </>
    ),
    mock: (
      <DiscordMock>
        <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[#2b2d31]">
          <span className="w-8 h-8 rounded-full bg-[#5865f2] flex items-center justify-center text-white">🤖</span>
          <span className="flex-1 text-white font-bold">Drawker</span>
          <span className="px-2.5 py-1 rounded-md bg-[#4e5058] text-white ring-2 ring-amber-300">ウェブフックURLをコピー</span>
        </div>
      </DiscordMock>
    ),
  },
  {
    title: 'Drawkerに貼り付けて「連携する」',
    body: (
      <>
        Drawkerの
        <Link href="/dashboard/notifications" className="font-bold text-sky-600 underline">
          通知設定
        </Link>
        を開き、コピーしたURLを貼り付けて「連携する」を押します。Discordに「✅ Drawkerとの連携が完了しました」と届けば完了です。
      </>
    ),
    mock: (
      <DiscordMock>
        <div className="flex gap-3">
          <span className="w-8 h-8 rounded-full bg-sky-400 shrink-0 flex items-center justify-center text-white">☁</span>
          <div>
            <p className="text-white font-bold">
              Drawker <span className="text-[9px] px-1 rounded bg-[#5865f2]">アプリ</span>
            </p>
            <div className="mt-1 border-l-4 border-sky-400 bg-[#2b2d31] rounded px-3 py-2">
              <p className="text-white font-bold">✅ Drawkerとの連携が完了しました</p>
              <p className="text-[11px]">これから、選んだ種類の通知がこのチャンネルに届きます。</p>
            </div>
          </div>
        </div>
      </DiscordMock>
    ),
  },
]

export default function DiscordWebhookGuidePage() {
  return (
    <div className="min-h-screen pb-20 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="Discord通知の設定方法" />

      <div className="max-w-3xl mx-auto space-y-6 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            はじめての方向け・約3分
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">DiscordのWebhook URLの取得方法</h1>
          <p className="text-sm text-slate-600 font-medium drop-shadow-sm leading-relaxed">
            Webhook（ウェブフック）は、外部のサービスがDiscordのチャンネルにメッセージを送るための「専用の投稿口」です。
            <br className="hidden sm:inline" />
            URLを1つコピーしてDrawkerに貼るだけで、リクエストや応募の通知がDiscordに届くようになります。
          </p>
        </div>

        <div className="bg-amber-50 rounded-3xl p-5 border border-amber-200/60 space-y-1.5">
          <h2 className="text-sm font-black text-amber-700">⚠️ Webhook URLは人に教えないでください</h2>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            URLを知っている人は誰でも、そのチャンネルにメッセージを送れてしまいます。SNSやスクリーンショットに写さないよう注意してください。
            Drawkerでは暗号化して保存しているので、ほかのユーザーに見られることはありません。
            もし漏れてしまった場合は、Discordでそのウェブフックを削除して作り直してください。
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-black text-slate-800 drop-shadow-xs px-1">💻 パソコンの場合</h2>
          <p className="text-[11px] text-slate-600 px-1 drop-shadow-xs">
            ウェブフックを作るには、そのサーバーの「ウェブフックの管理」権限が必要です（自分で作ったサーバーなら持っています）。
          </p>
        </div>

        <ol className="space-y-4">
          {PC_STEPS.map((step, i) => (
            <li key={step.title} className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-sky-100/60 grid sm:grid-cols-2 gap-5 items-center">
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs shrink-0">
                    {i + 1}
                  </span>
                  {step.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">{step.body}</p>
              </div>
              {step.mock}
            </li>
          ))}
        </ol>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-3">
          <h2 className="text-base font-black text-slate-800">📱 スマホの場合</h2>
          <ol className="list-decimal list-inside text-xs text-slate-600 leading-relaxed space-y-1.5">
            <li>Discordアプリで、通知を受け取りたいチャンネル名を長押しする</li>
            <li>「チャンネルの編集」→「連携サービス」→「ウェブフック」を開く</li>
            <li>「ウェブフックを作成」を押し、作られたウェブフックを開く</li>
            <li>「ウェブフックURLをコピー」を押す</li>
            <li>
              Drawkerの
              <Link href="/dashboard/notifications" className="font-bold text-sky-600 underline">
                通知設定
              </Link>
              に貼り付けて「連携する」
            </li>
          </ol>
          <p className="text-[11px] text-slate-400">アプリのバージョンによって、メニューの名前や場所が少し異なる場合があります。</p>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60 space-y-3">
          <h2 className="text-base font-black text-slate-800">❓ うまくいかないとき</h2>
          <dl className="space-y-3 text-xs">
            <div>
              <dt className="font-black text-slate-700">「Webhook URLの形式ではありません」と出る</dt>
              <dd className="text-slate-500 leading-relaxed">
                「https://discord.com/api/webhooks/」で始まるURLをそのまま貼り付けてください。チャンネルのリンクや招待リンクとは別のものです。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-700">「メッセージを送れませんでした」と出る</dt>
              <dd className="text-slate-500 leading-relaxed">
                Discord側でウェブフックが削除されている可能性があります。新しく作り直して、もう一度貼り付けてください。
              </dd>
            </div>
            <div>
              <dt className="font-black text-slate-700">通知が多すぎる・少なすぎる</dt>
              <dd className="text-slate-500 leading-relaxed">
                <Link href="/dashboard/notifications" className="font-bold text-sky-600 underline">
                  通知設定
                </Link>
                で、リクエスト・応募・フォロー・いいねなど、Discordに送る通知の種類を個別にオン・オフできます。
              </dd>
            </div>
          </dl>
        </section>

        <div className="text-center">
          <Link
            href="/dashboard/notifications"
            className="inline-block px-6 py-3 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-black shadow-sm transition-colors"
          >
            通知設定を開く →
          </Link>
        </div>
      </div>
    </div>
  )
}
