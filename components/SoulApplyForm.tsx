'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SoulPrice, formatPrice } from '@/lib/soulListings'

// 魂募集への応募フォーム。応募は「リクエスト」として送られ、クリエイターの受信箱
// （/dashboard/requests）に届く。どの募集への応募かは soul_listing_id で記録する。
export default function SoulApplyForm({
  creatorId,
  listingId,
  listingTitle,
  prices,
  isOpen,
}: {
  creatorId: string
  listingId: string
  listingTitle: string
  prices: SoulPrice[]
  isOpen: boolean
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [plan, setPlan] = useState(prices[0]?.label || '')
  const [message, setMessage] = useState('')
  const [contactUrl, setContactUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
      setChecking(false)
    })
  }, [])

  if (checking) return null

  if (!isOpen) {
    return (
      <div className="bg-slate-100 rounded-2xl p-4 text-center text-xs font-bold text-slate-500">
        この魂募集は現在受け付けていません
      </div>
    )
  }

  if (userId === creatorId) {
    return (
      <Link
        href="/dashboard/souls"
        className="block text-center bg-sky-50 hover:bg-sky-100 rounded-2xl p-4 text-xs font-black text-sky-700"
      >
        あなたの魂募集です。編集する →
      </Link>
    )
  }

  if (!userId) {
    return (
      <div className="bg-violet-50 rounded-2xl p-5 text-center space-y-3">
        <p className="text-xs font-bold text-violet-800">応募するにはログインが必要です</p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white text-xs font-black shadow-sm"
        >
          ログインして応募する
        </Link>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="bg-emerald-50 rounded-2xl p-5 text-center space-y-1">
        <p className="text-sm font-black text-emerald-700">✅ 応募を送信しました</p>
        <p className="text-[11px] text-emerald-700/80">クリエイターからの返信は、マイページや通知でお知らせします。</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!message.trim()) return setError('メッセージを入力してください')
    if (!contactUrl.trim()) return setError('連絡先を入力してください')

    setSubmitting(true)
    const content = [`【魂募集「${listingTitle}」への応募】`, plan ? `希望プラン：${plan}` : '', '', message.trim()]
      .filter((line, i) => line !== '' || i === 2)
      .join('\n')
    const { error: insertError } = await supabase.from('requests').insert({
      creator_id: creatorId,
      client_id: userId,
      content,
      client_contact_url: contactUrl.trim(),
      budget: prices.find((p) => p.label === plan)?.price ?? null,
      soul_listing_id: listingId,
    })
    setSubmitting(false)

    if (insertError) {
      console.error('魂募集への応募エラー:', insertError)
      // P0001 は送信制限などDB側で意図して出しているエラーなので、内容をそのまま案内する
      setError(
        insertError.code === 'P0001' && insertError.message
          ? insertError.message
          : '送信に失敗しました。時間をおいて再度お試しください。'
      )
      return
    }
    setSubmitted(true)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-violet-50/70 rounded-2xl p-5 space-y-4 border border-violet-100">
      <h2 className="text-sm font-black text-violet-900">🎭 この子の魂に応募する</h2>

      {prices.length > 0 && (
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">希望するプラン</span>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-violet-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          >
            {prices.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}（{formatPrice(p.price)}）
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-black text-slate-700">メッセージ *</span>
        <textarea
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="自己紹介、活動予定（配信内容・頻度など）、この子を選んだ理由など"
          className="w-full px-3.5 py-2.5 rounded-xl border border-violet-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-black text-slate-700">連絡先 *</span>
        <input
          value={contactUrl}
          onChange={(e) => setContactUrl(e.target.value)}
          placeholder="XのプロフィールURL、メールアドレスなど"
          className="w-full px-3.5 py-2.5 rounded-xl border border-violet-100 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <span className="text-[10px] text-slate-400">クリエイターだけが見られます。</span>
      </label>

      {error && <p className="text-xs font-bold text-rose-500">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-full bg-violet-500 hover:bg-violet-600 text-white text-sm font-black shadow-sm disabled:opacity-50 cursor-pointer"
      >
        {submitting ? '送信中...' : '応募する'}
      </button>
      <p className="text-[10px] text-slate-500 text-center leading-relaxed">
        応募前に
        <Link href="/client-guidelines" className="underline font-bold">
          依頼者向けの注意事項
        </Link>
        をご確認ください。応募しただけでは契約は成立しません。
      </p>
    </form>
  )
}
