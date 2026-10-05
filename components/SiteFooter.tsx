import Link from 'next/link'

// 全ページ共通のフッター（app/layout.tsx で全ページの末尾に置いている）。
// どのページからでも、規約・ヘルプ・お問い合わせにたどり着けるようにしている。
// ページが増えて1列に並べると探しにくくなったため、「サイト」「ヘルプ・規約」「サポート」に分けている。
// 下の余白を大きめに取っているのは、画面下に固定で出るボタン（スマホの依頼ボタンなど）にリンクが隠れないようにするため。
const FOOTER_GROUPS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'サイト',
    links: [
      { href: '/', label: 'クリエイターを探す' },
      { href: '/articles', label: '記事（はじめての依頼ガイド）' },
      { href: '/wanted', label: '募集ボード' },
      { href: '/feed', label: 'みんなの制作日記（フィード）' },
      { href: '/ranking', label: '注目クリエイター' },
      { href: '/gallery', label: '新着作品' },
      { href: '/market', label: '相場マップ' },
      { href: '/match', label: 'ぴったりクリエイター診断' },
      { href: '/favorites', label: 'お気に入り一覧' },
      { href: '/updates', label: 'お知らせ' },
    ],
  },
  {
    title: 'ヘルプ・規約',
    links: [
      { href: '/guide', label: '使い方ガイド' },
      { href: '/faq', label: 'よくある質問' },
      { href: '/creator-guide', label: 'クリエイター向けガイド' },
      { href: '/guide/agreements', label: '合意内容の控えの使い方' },
      { href: '/client-guidelines', label: '依頼者向けの注意事項' },
      { href: '/safety', label: '不審な連絡・詐欺への対処' },
      { href: '/terms', label: '利用規約' },
      { href: '/privacy', label: 'プライバシーポリシー' },
    ],
  },
  {
    title: 'サポート',
    links: [
      { href: '/support', label: 'ドローカーを応援する' },
      { href: '/contact', label: 'お問い合わせ' },
      { href: '/about', label: '運営者情報' },
      { href: 'https://x.com/Drawker06', label: '𝕏 公式アカウント', external: true },
    ],
  },
]

export default function SiteFooter() {
  return (
    <footer className="border-t border-sky-100 bg-white pt-10 pb-24 px-6 print:hidden">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title} className="space-y-3">
              <h2 className="text-[11px] font-black tracking-[0.2em] text-slate-400">{group.title}</h2>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors"
                      >
                        {link.label} ↗
                      </a>
                    ) : (
                      <Link href={link.href} className="text-xs font-bold text-slate-600 hover:text-sky-600 transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="pt-6 border-t border-slate-100 text-[11px] font-bold text-slate-300">© {new Date().getFullYear()} Drawker</p>
      </div>
    </footer>
  )
}
