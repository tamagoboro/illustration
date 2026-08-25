'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            {isSignUp ? 'アカウント新規作成' : 'ログイン'}
          </h1>
          <p className="text-xs text-slate-500">
            {isSignUp ? 'お気に入り保存やマイページ機能を利用できます' : 'マイページにアクセスします'}
          </p>
        </div>

        {infoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs">
            {infoMsg}
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">メールアドレス</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@mail.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">パスワード</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上のパスワード"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition text-sm shadow-sm disabled:opacity-50"
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
            className="text-xs text-indigo-600 hover:underline font-medium"
          >
            {isSignUp ? 'すでにアカウントをお持ちの方はこちら（ログイン）' : '新規アカウント作成はこちら'}
          </button>
        </div>

        <div className="text-center pt-4 border-t border-slate-100">
          <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
            ← サイトトップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}