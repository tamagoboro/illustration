import type { TocItem } from '@/lib/articles'

// 記事の目次（本文の ## と ### から自動で作る）。見出しが2つ未満なら出さない。
export default function ArticleToc({ items, className = '' }: { items: TocItem[]; className?: string }) {
  if (items.length < 2) return null
  return (
    <nav aria-label="目次" className={`rounded-2xl border border-sky-100 bg-sky-50/60 px-5 py-4 ${className}`}>
      <p className="text-xs font-black text-sky-700 tracking-widest mb-2">目次</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((item, i) => (
          <li key={`${item.id}-${i}`} className={item.level === 3 ? 'pl-4' : ''}>
            <a
              href={`#${item.id}`}
              className={`block leading-snug hover:text-sky-600 hover:underline ${item.level === 2 ? 'font-bold text-slate-700' : 'text-slate-500'}`}
            >
              {item.level === 3 && <span className="text-sky-300 mr-1">└</span>}
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
