import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { headingId, parseEmbed } from '@/lib/articles'

// 記事の本文（Markdown）を表示する。公開ページと、記入ページのプレビューで共通。
// 生のHTMLは描画しない（react-markdown の初期設定）ので、本文にスクリプト等を書かれても実行されない。
//
// Markdown に加えて使える書き方：
//   ・1行にURLだけ   … YouTube・ニコニコ・Vimeo・動画ファイルは動画として埋め込み、それ以外はリンクカード
//   ・> [!POINT] / > [!NOTE] / > [!TIP] / > [!WARNING] で始まる引用 … 色付きの囲み（ポイント・メモ・ヒント・注意）
//   ・![説明](画像URL) … 画像。説明は画像の下に小さく表示する

const CALLOUTS = {
  POINT: { label: 'ポイント', emoji: '✅', className: 'bg-sky-50 border-sky-200 text-sky-950' },
  NOTE: { label: 'メモ', emoji: '📝', className: 'bg-slate-50 border-slate-200 text-slate-800' },
  TIP: { label: 'ヒント', emoji: '💡', className: 'bg-emerald-50 border-emerald-200 text-emerald-950' },
  WARNING: { label: '注意', emoji: '⚠️', className: 'bg-amber-50 border-amber-200 text-amber-950' },
} as const
type CalloutType = keyof typeof CALLOUTS

// 「> [!POINT]」で始まる引用に印を付け、[!POINT] の文字は消す（mdast を直接たどる小さなプラグイン）
function remarkCallouts() {
  const walk = (node: any) => {
    if (node.type === 'blockquote') {
      const first = node.children?.[0]
      const text = first?.type === 'paragraph' ? first.children?.[0] : null
      const match = text?.type === 'text' ? String(text.value).match(/^\[!(POINT|NOTE|TIP|WARNING)\][ \t]*\n?/i) : null
      if (match) {
        text.value = String(text.value).slice(match[0].length)
        if (!text.value) first.children.shift()
        if (first.children.length === 0) node.children.shift()
        node.data = { ...(node.data || {}), hProperties: { 'data-callout': match[1].toUpperCase() } }
      }
    }
    node.children?.forEach(walk)
  }
  return (tree: any) => walk(tree)
}

// Enter で改行したところを、そのまま改行として表示する
// （Markdown は本来、空行をあけないと改行にならない。書いたとおりに表示されるほうが分かりやすいので変えている）
function remarkLineBreaks() {
  const walk = (node: any) => {
    if (!Array.isArray(node.children)) return
    node.children = node.children.flatMap((child: any) => {
      if (child.type !== 'text' || !String(child.value).includes('\n')) return [child]
      return String(child.value)
        .split('\n')
        .flatMap((line: string, i: number) => [...(i > 0 ? [{ type: 'break' }] : []), ...(line ? [{ type: 'text', value: line }] : [])])
    })
    node.children.forEach(walk)
  }
  return (tree: any) => walk(tree)
}

// 見出しの中身（太字やリンクが混ざっていても）を文字だけにして、目次と同じidを作る
function textOf(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(textOf).join('')
  if (children && typeof children === 'object' && 'props' in children) return textOf((children as any).props.children)
  return ''
}

function EmbedBlock({ url }: { url: string }) {
  const embed = parseEmbed(url)
  if (!embed) return null
  if (embed.kind === 'iframe') {
    return (
      <div className={`my-6 mx-auto overflow-hidden rounded-2xl bg-slate-900 shadow-sm ${embed.vertical ? 'max-w-xs aspect-[9/16]' : 'aspect-video'}`}>
        <iframe
          src={embed.src}
          title={embed.title}
          className="w-full h-full"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    )
  }
  if (embed.kind === 'video') {
    return <video src={embed.src} controls preload="metadata" className="my-6 w-full rounded-2xl bg-slate-900 shadow-sm" />
  }
  const isX = embed.host === 'x.com' || embed.host === 'twitter.com'
  return (
    <a
      href={embed.url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs hover:border-sky-300 hover:shadow-sm transition no-underline"
    >
      <span className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center text-lg">{isX ? '𝕏' : '🔗'}</span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-slate-500">{embed.host}</span>
        <span className="block text-sm font-bold text-sky-700 truncate">{embed.url}</span>
      </span>
    </a>
  )
}

const components: Components = {
  h2: ({ children }) => (
    <h2 id={headingId(textOf(children))} className="scroll-mt-28 mt-12 mb-4 pb-2 border-b-2 border-sky-100 text-xl sm:text-2xl font-black text-slate-900">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={headingId(textOf(children))} className="scroll-mt-28 mt-8 mb-3 pl-3 border-l-4 border-sky-400 text-lg font-black text-slate-800">
      {children}
    </h3>
  ),
  h4: ({ children }) => <h4 className="mt-6 mb-2 text-base font-black text-slate-800">{children}</h4>,
  p: ({ node, children }) => {
    // 1行にURLだけ（自動リンクされたURL1つだけの段落）なら埋め込みにする
    const only = node?.children?.length === 1 ? (node.children[0] as any) : null
    if (only?.type === 'element' && only.tagName === 'a') {
      const href = String(only.properties?.href || '')
      const label = only.children?.length === 1 && only.children[0].type === 'text' ? only.children[0].value : ''
      if (href && label === href) return <EmbedBlock url={href} />
    }
    return <p className="my-4 leading-[1.9] text-slate-700">{children}</p>
  },
  a: ({ href, children }) => {
    const external = !!href && /^https?:\/\//.test(href)
    return (
      <a
        href={href}
        className="font-bold text-sky-600 underline underline-offset-2 hover:text-sky-800 break-words"
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  },
  img: ({ src, alt }) => (
    <span className="block my-6">
      <img src={typeof src === 'string' ? src : ''} alt={alt || ''} loading="lazy" decoding="async" className="mx-auto max-h-[640px] rounded-2xl shadow-sm" />
      {alt && <span className="block mt-2 text-center text-xs text-slate-400">{alt}</span>}
    </span>
  ),
  ul: ({ children }) => <ul className="my-4 pl-6 list-disc space-y-1.5 text-slate-700 marker:text-sky-400">{children}</ul>,
  ol: ({ children }) => <ol className="my-4 pl-6 list-decimal space-y-1.5 text-slate-700 marker:font-black marker:text-sky-500">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.8]">{children}</li>,
  strong: ({ children }) => <strong className="font-black text-slate-900 bg-gradient-to-t from-yellow-200/70 from-35% to-transparent to-35%">{children}</strong>,
  hr: () => <hr className="my-10 border-slate-200" />,
  blockquote: ({ node, children }) => {
    const props = (node?.properties || {}) as Record<string, unknown>
    const type = (props.dataCallout ?? props['data-callout']) as CalloutType | undefined
    const callout = type ? CALLOUTS[type] : null
    if (callout) {
      return (
        <div className={`my-6 rounded-2xl border-2 px-5 py-4 ${callout.className} [&>p:first-of-type]:mt-1 [&>p:last-child]:mb-0`}>
          <p className="text-sm font-black">
            {callout.emoji} {callout.label}
          </p>
          {children}
        </div>
      )
    }
    return <blockquote className="my-6 border-l-4 border-slate-200 pl-4 text-slate-500 italic">{children}</blockquote>
  },
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-sky-50 px-3 py-2 text-left font-black text-slate-800 border-b border-slate-200 whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 border-b border-slate-100 text-slate-700 align-top">{children}</td>,
  code: ({ className, children }) =>
    className ? (
      <code className={`${className} block`}>{children}</code>
    ) : (
      <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[0.9em] text-rose-600">{children}</code>
    ),
  pre: ({ children }) => <pre className="my-6 overflow-x-auto rounded-2xl bg-slate-900 p-4 text-sm text-slate-100">{children}</pre>,
}

export default function ArticleBody({ body }: { body: string }) {
  return (
    <div className="text-[15px] sm:text-base break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts, remarkLineBreaks]} components={components}>
        {body}
      </ReactMarkdown>
    </div>
  )
}
