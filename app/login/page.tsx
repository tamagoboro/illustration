'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// トップページ（app/page.tsx）と同じ背景画像・世界観に統一
const BACKGROUND_IMAGE_URL =
  'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false) // 利用規約同意ステート
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreedTerms) {
      setErrorMsg('利用規約への同意が必要です。')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setInfoMsg('')

    if (isSignUp) {
      // 新規会員登録
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        setErrorMsg('登録に失敗しました: ' + error.message)
      } else {
        setInfoMsg('アカウントを作成しました！ログインしてください。')
        setIsSignUp(false)
      }
    } else {
      // ログイン
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
      } else {
        router.push('/dashboard')
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-sans antialiased relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      {/* トップページと同じ、雲・青空の透明感を出す軽やかなオーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />

      <div className="bg-white/85 backdrop-blur-md p-8 rounded-3xl shadow-lg border border-sky-100 w-full max-w-md space-y-6">
        {/* ロゴ / ブランドエリア（トップページのヘッダーと統一） */}
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2.5 group cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-300 to-cyan-300 flex items-center justify-center text-white font-black text-lg shadow-sm group-hover:scale-105 transition-transform">
              ☁
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-black tracking-tight text-slate-800 group-hover:text-sky-600 transition-colors">
                Drawker
              </span>
              <span className="text-[9px] font-extrabold text-sky-500/80 tracking-wider uppercase -mt-1">
                Portfolio Search
              </span>
            </div>
          </Link>
        </div>

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            {isSignUp ? 'アカウント新規作成' : 'ログイン'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {isSignUp ? 'お気に入り保存やマイページ機能を利用できます' : 'マイページにアクセスします'}
          </p>
        </div>

        {infoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold">
            {infoMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">パスワード</label>
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

          {/* 利用規約同意チェックボックス ＆ リンク */}
          <div className="pt-1">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 rounded border-sky-200 text-sky-500 accent-sky-500 focus:ring-sky-400 w-4 h-4 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-normal font-medium">
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sky-600 hover:underline"
                >
                  利用規約
                </Link>
                に同意する
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agreedTerms}
            className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {loading ? '処理中...' : isSignUp ? 'アカウントを作成する' : 'ログインする'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setErrorMsg('')
              setInfoMsg('')
            }}
            className="text-xs text-sky-600 hover:underline font-bold cursor-pointer"
          >
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら（ログイン）' : '新規アカウント作成はこちら'}
          </button>
        </div>

        <div className="text-center pt-4 border-t border-sky-100">
          <Link href="/" className="text-xs text-slate-400 hover:text-sky-600 font-medium">
            ← サイトトップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}