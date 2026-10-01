import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/guide', label: '使い方ガイド' },
  { href: '/client-guidelines', label: '依頼者向けの注意事項' },
  { href: '/faq', label: 'よくある質問' },
  { href: '/updates', label: 'お知らせ' },
  { href: '/ranking', label: '注目クリエイター' },
  { href: '/wanted', label: '募集ボード' },
  { href: '/favorites', label: 'お気に入り一覧' },
  { href: '/about', label: '運営者情報・お問い合わせ' },
  { href: '/terms', label: '利用規約' },
  { href: '/privacy', label: 'プライバシーポリシー' },
]

// 全ページ共通のフッター（app/layout.tsx で全ページの末尾に置いている）。
// 利用規約・プライバシーポリシーがトップページとログイン画面からしか辿れず、クリエイターページやフィードに
// 直接来た人には見えなかったため、どのページからでも確認できるようにしている。
// 下の余白を大きめに取っているのは、画面下に固定で出るボタン（スマホの依頼ボタンなど）にリンクが隠れないようにするため。
export default function SiteFooter() {
  return (
    <footer className="border-t border-sky-100 bg-white pt-6 pb-24 px-4">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[11px] font-bold text-slate-500">
        <a
          href="https://x.com/Drawker06"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-sky-600 transition-colors"
        >
          𝕏 (X) 公式アカウント
        </a>
        {FOOTER_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-sky-600 transition-colors">
            {link.label}
          </Link>
        ))}
        <span className="text-slate-300">© Drawker</span>
      </div>
    </footer>
  )
}
