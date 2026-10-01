'use client'

import { useEffect, useState } from 'react'

// ページ内メニュー（作品・料金・条件・レビューなど）。押すとその場所へスクロールし、
// 今見ている場所のタブを色付きにする。ヘッダーの下に貼り付いて付いてくる。
export default function PortfolioNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id)
  // 親の再描画のたびに配列が作り直されても監視をやり直さないよう、IDの並びで比較する
  const idsKey = items.map((i) => i.id).join('|')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      // 画面の上から3割あたりに来たセクションを「今見ている場所」とする
      { rootMargin: '-20% 0px -70% 0px' }
    )
    items.forEach((item) => {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  return (
    <nav className="sticky top-[60px] z-20 -mx-1">
      <div className="flex gap-1 overflow-x-auto p-1 rounded-2xl bg-white/85 backdrop-blur-md shadow-sm ring-1 ring-black/5 [scrollbar-width:none]">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-colors ${
              active === item.id ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-500 hover:text-sky-600 hover:bg-sky-50'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
