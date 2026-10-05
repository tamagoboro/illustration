'use client'

import { useEffect } from 'react'
import Link from 'next/link'

// ページの表示中に想定外のエラーが起きたときの画面。
// これが無いと、英語の素っ気ない標準の画面（Application error）になってしまう。
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('ページの表示エラー:', error)
  }, [error])

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center space-y-3 max-w-sm w-full">
        <p className="text-4xl">☁</p>
        <h1 className="text-base font-black text-slate-800">ページを表示できませんでした</h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          一時的な不具合の可能性があります。もう一度お試しください。
          <br />
          何度も起きる場合は、お問い合わせからお知らせください。
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-slate-700 transition-colors cursor-pointer"
          >
            もう一度試す
          </button>
          <Link href="/" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-bold hover:bg-slate-50 transition-colors">
            ホームへ戻る
          </Link>
          <Link href="/contact" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-bold hover:bg-slate-50 transition-colors">
            お問い合わせ
          </Link>
        </div>
      </div>
    </div>
  )
}
