'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { INQUIRY_CATEGORIES, INQUIRY_LIMITS, type InquiryCategory } from '@/lib/inquiries'

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400'

// お問い合わせフォーム。送信は /api/contact（サーバー側で保存し、運営者へ通知する）。
// ログイン中なら、名前とメールアドレスを最初から入れておく。
export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [category, setCategory] = useState<InquiryCategory>('general')
  const [message, setMessage] = useState('')
  // 機械的な大量送信よけ（人には見えない入力欄。入っていたら送らない）
  const [website, setWebsite] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user
      if (!active || !user) return
      if (user.email) setEmail((prev) => prev || user.email || '')
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle()
      if (active && profile?.display_name) setName((prev) => prev || profile.display_name)
    })
    return () => {
      active = false
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agreed) {
      setErrorMsg('プライバシーポリシーへの同意が必要です。')
      return
    }
    setSending(true)
    setErrorMsg('')
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, email, category, message, website }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMsg(json.error || '送信に失敗しました。時間をおいてもう一度お試しください。')
        return
      }
      setSent(true)
    } catch {
      setErrorMsg('通信に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-sky-100/60 text-center space-y-3">
        <p className="text-4xl">📮</p>
        <h2 className="text-lg font-black text-slate-800">送信しました</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          お問い合わせありがとうございます。内容を確認のうえ、
          <br className="hidden sm:block" />
          必要に応じて入力いただいたメールアドレスへご連絡します。
        </p>
        <Link href="/" className="inline-block pt-2 text-xs font-bold text-sky-600 hover:underline">
          トップページへ戻る
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-sky-100/60 space-y-5">
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">{errorMsg}</div>
      )}

      <div>
        <label className="block text-xs font-black text-slate-700 mb-1.5">お問い合わせの種類</label>
        <select value={category} onChange={(e) => setCategory(e.target.value as InquiryCategory)} className={inputClass}>
          {INQUIRY_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1.5">お名前（ニックネーム可）</label>
          <input
            type="text"
            required
            maxLength={INQUIRY_LIMITS.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-700 mb-1.5">返信先のメールアドレス</label>
          <input
            type="email"
            required
            maxLength={INQUIRY_LIMITS.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@mail.com"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-black text-slate-700 mb-1.5">お問い合わせ内容</label>
        <textarea
          required
          rows={8}
          maxLength={INQUIRY_LIMITS.message}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="不具合の場合は、起きたページ・操作・お使いの端末（iPhone / Windows など）を書いていただけると助かります。"
          className={`${inputClass} resize-y leading-relaxed`}
        />
        <p className="text-right text-[10px] font-bold text-slate-400 mt-1 tabular-nums">
          {message.length} / {INQUIRY_LIMITS.message}
        </p>
      </div>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        aria-hidden="true"
      />

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-sky-500 cursor-pointer"
        />
        <span className="text-xs text-slate-600 font-medium leading-normal">
          <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-sky-600 hover:underline">
            プライバシーポリシー
          </Link>
          に同意のうえ送信する
        </span>
      </label>

      <button
        type="submit"
        disabled={sending || !agreed}
        className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
      >
        {sending ? '送信中...' : '送信する'}
      </button>
    </form>
  )
}
