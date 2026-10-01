import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

// 非公開のポートフォリオ・見つからないページを開いた人への案内。トップページなどへ誘導する
export default function PrivatePortfolioNotice({
  variant = 'private',
}: {
  variant?: 'private' | 'notFound'
}) {
  const isPrivate = variant === 'private'
  return (
    <div className="min-h-screen relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label={isPrivate ? '非公開のポートフォリオ' : 'ページが見つかりません'} />

      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 text-center shadow-lg border border-white/80 space-y-4">
          <div className="text-5xl">{isPrivate ? '🔒' : '🔍'}</div>
          <h1 className="text-xl font-black text-slate-800">
            {isPrivate ? '現在非公開のポートフォリオです' : 'ページが見つかりませんでした'}
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isPrivate ? (
              <>
                このクリエイターは、ポートフォリオを一時的に非公開にしています。
                <br />
                公開されるまでお待ちいただくか、ほかのクリエイターを探してみてください。
              </>
            ) : (
              <>
                URLが間違っているか、ページが削除された可能性があります。
                <br />
                トップページから、ほかのクリエイターを探してみてください。
              </>
            )}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Link
              href="/"
              className="px-6 py-3 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-sm font-black shadow-sm transition-colors"
            >
              トップページでクリエイターを探す
            </Link>
            <Link
              href="/ranking"
              className="px-6 py-3 rounded-full bg-white hover:bg-sky-50 text-sky-700 text-sm font-black border border-sky-100 transition-colors"
            >
              注目クリエイターを見る
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
