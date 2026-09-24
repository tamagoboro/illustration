'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'

// メール内の再設定リンクを踏むと、Supabaseクライアントが自動的にURL内のトークンを検出し
// 一時的な「パスワード再設定用セッション」を発行する（PASSWORD_RECOVERYイベント）。
// このセッションが有効な間だけ新しいパスワードを設定でき、実際にupdateUser()が
// 成功した瞬間に初めて古いパスワードが新しいものに置き換わる。
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(true)
        setReady(true)
      }
    })

    // リンクを踏んだ直後は上のイベントが飛んでくるが、リロード等で既にセッション処理済みの
    // 場合に備えて、現在のセッション有無も一応チェックしておく
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecoverySession(true)
      setReady(true)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 6) {
      setErrorMsg('パスワードは6文字以上で入力してください。')
      return
    }
    if (password !== passwordConfirm) {
      setErrorMsg('パスワードが一致しません。')
      return
    }

    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (error) {
      setErrorMsg('パスワードの変更に失敗しました: ' + error.message)
      return
    }
    setDone(true)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-sans antialiased relative bg-cover bg-center"
      style={backgroundImageStyle}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />

      <div className="bg-white/85 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-sky-100 w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">新しいパスワードを設定</h1>
        </div>

        {!ready ? (
          <p className="text-center text-sm text-slate-500 font-bold py-8">確認中...</p>
        ) : done ? (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold">
              パスワードを変更しました！新しいパスワードでログインできます。
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm cursor-pointer active:scale-95"
            >
              トップページへ
            </button>
          </div>
        ) : !hasRecoverySession ? (
          <div className="space-y-4 text-center">
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
              このリンクは無効か、有効期限が切れています。もう一度パスワード再設定をお試しください。
            </div>
            <Link
              href="/login"
              className="inline-block text-xs text-sky-600 hover:underline font-bold"
            >
              ← ログイン画面へ戻る
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">新しいパスワード</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上のパスワード"
                className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">新しいパスワード（確認）</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="もう一度入力してください"
                className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
            >
              {saving ? '変更中...' : 'パスワードを変更する'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
