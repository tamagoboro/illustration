import Link from 'next/link'
import InfoPage, { InfoSection } from '@/components/InfoPage'
import { buildPageMetadata } from '@/lib/pageMetadata'

export const metadata = buildPageMetadata({
  title: 'ドローカーを応援する',
  description: 'Drawkerは個人で運営しています。シェア・フォロー・友達紹介など、お金をかけずにできる応援の方法をまとめました。',
  path: '/support',
})

const WAYS: { emoji: string; title: string; body: string; href: string; label: string; external?: boolean }[] = [
  {
    emoji: '𝕏',
    title: '公式Xをフォローする',
    body: '新機能のお知らせやクリエイターの紹介を発信しています。リポストしてもらえると、とても励みになります。',
    href: 'https://x.com/Drawker06',
    label: '@Drawker06 を見る',
    external: true,
  },
  {
    emoji: '🔗',
    title: '気に入ったページをシェアする',
    body: 'クリエイターのページや記事をXでシェアしてもらえると、Drawkerを知ってもらうきっかけになります。記事をXでシェアすると、ログイン中なら50ptもらえます。',
    href: '/articles',
    label: '記事を読む',
  },
  {
    emoji: '🎁',
    title: '友達に紹介する',
    body: 'マイページの紹介リンクから友達が登録すると、あなたと友達の両方にポイントが付きます。',
    href: '/rewards',
    label: 'マイページへ',
  },
  {
    emoji: '🎨',
    title: '作品を載せる・投稿する',
    body: 'クリエイターのみなさんがページを作ったりフィードに投稿したりしてくれることが、いちばんの応援です。',
    href: '/dashboard',
    label: 'ダッシュボードへ',
  },
  {
    emoji: '⭐',
    title: 'レビューを書く',
    body: '依頼したクリエイターのページにレビューを書くと、ほかの依頼者の参考になり、クリエイターの励みにもなります。',
    href: '/',
    label: 'クリエイターを探す',
  },
  {
    emoji: '💌',
    title: 'ご意見・ご要望を送る',
    body: '「こんな機能がほしい」「ここが使いにくい」など、お気軽にお送りください。いただいた声をもとに改善しています。',
    href: '/contact',
    label: 'お問い合わせフォームへ',
  },
]

export default function SupportPage() {
  return (
    <InfoPage
      headerLabel="応援する"
      badge="SUPPORT"
      title="ドローカーを応援する"
      lead={
        <>
          Drawkerは個人で開発・運営しています。
          <br className="sm:hidden" />
          お金をかけずにできる応援の方法をまとめました。
        </>
      }
      related={[
        { href: '/about', label: '運営者情報' },
        { href: '/updates', label: 'お知らせ' },
        { href: '/contact', label: 'お問い合わせ' },
      ]}
    >
      <InfoSection emoji="💙" title="応援の方法">
        <div className="grid gap-3 sm:grid-cols-2">
          {WAYS.map((way) => (
            <div key={way.title} className="rounded-2xl bg-slate-50 p-4 flex flex-col gap-2">
              <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                <span className="text-lg">{way.emoji}</span>
                {way.title}
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed flex-1">{way.body}</p>
              {way.external ? (
                <a href={way.href} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black text-sky-600 hover:underline">
                  {way.label} ↗
                </a>
              ) : (
                <Link href={way.href} className="text-[11px] font-black text-sky-600 hover:underline">
                  {way.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </InfoSection>

      <p className="text-center text-xs font-bold text-slate-600 drop-shadow-xs">いつもDrawkerを使っていただき、ありがとうございます！</p>
    </InfoPage>
  )
}
