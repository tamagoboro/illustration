'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ensureProfileFromSignupMetadata } from '@/lib/ensureProfile'

// トップページ（app/page.tsx）と同じ背景画像・世界観に統一
const BACKGROUND_IMAGE_URL =
  'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

// 新規登録時にアップロード不要で選べるプリセットアイコン（絵文字＋グラデーションのSVGをその場で生成）
const AVATAR_PRESETS: { id: string; emoji: string; colors: [string, string] }[] = [
  { id: 'cloud', emoji: '☁️', colors: ['#38bdf8', '#22d3ee'] },
  { id: 'palette', emoji: '🎨', colors: ['#fb923c', '#f59e0b'] },
  { id: 'pencil', emoji: '✏️', colors: ['#60a5fa', '#818cf8'] },
  { id: 'star', emoji: '⭐', colors: ['#f472b6', '#fb7185'] },
  { id: 'brush', emoji: '🖌️', colors: ['#34d399', '#10b981'] },
  { id: 'sparkle', emoji: '💫', colors: ['#a78bfa', '#8b5cf6'] },
]

const buildAvatarDataUrl = (colors: [string, string], emoji: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs><rect width="200" height="200" rx="100" fill="url(#g)"/><text x="50%" y="54%" font-size="96" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id)
  const [agreedTerms, setAgreedTerms] = useState(false) // 利用規約同意ステート
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [referrerId, setReferrerId] = useState<string | null>(null)

  // 招待リンク（/login?ref=紹介者のuser_id）経由で来た場合、紹介者IDを覚えておく。
  // useSearchParams はSuspense境界が必要になるため、素朴にlocationから読む。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      setReferrerId(ref)
      setIsSignUp(true)
    }
  }, [])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreedTerms) {
      setErrorMsg('利用規約への同意が必要です。')
      return
    }

    if (isSignUp && !displayName.trim()) {
      setErrorMsg('表示名を入力してください。')
      return
    }

    setLoading(true)
    setErrorMsg('')
    setInfoMsg('')

    if (isSignUp) {
      const selectedAvatar = AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) || AVATAR_PRESETS[0]
      const avatarDataUrl = buildAvatarDataUrl(selectedAvatar.colors, selectedAvatar.emoji)

      // 新規会員登録（招待リンク経由なら紹介者IDを引き継ぎ、両者へのポイント付与はDB側のトリガーで行う）。
      // 表示名・アイコンはuser_metadataに保存しておき、ensureProfileFromSignupMetadataで
      // profilesテーブルへ反映する（メール確認が不要な設定ならここで即反映、必要な設定なら初回ログイン時に反映）。
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            referred_by: referrerId || undefined,
            display_name: displayName.trim(),
            avatar_url: avatarDataUrl,
          },
        },
      })

      if (error) {
        setErrorMsg('登録に失敗しました: ' + error.message)
      } else {
        if (data.user && data.session) {
          await ensureProfileFromSignupMetadata(data.user)
        }
        setInfoMsg(
          referrerId
            ? 'アカウントを作成しました！紹介ポイントも付与されます。ログインしてください。'
            : 'アカウントを作成しました！ログインしてください。'
        )
        setIsSignUp(false)
      }
    } else {
      // ログイン
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setErrorMsg('ログインに失敗しました。メールアドレスとパスワードを確認してください。')
      } else {
        if (data.user) {
          await ensureProfileFromSignupMetadata(data.user)
        }
        router.push('/')
      }
    }

    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 font-sans antialiased relative bg-cover bg-center"
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

        {referrerId && isSignUp && (
          <div className="p-3 bg-sky-50 border border-sky-200 text-sky-700 rounded-2xl text-xs font-bold text-center">
            🎁 友達の招待リンクから登録すると、あなたも紹介した人もポイントがもらえます！
          </div>
        )}

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

          {isSignUp && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">表示名</label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="例: すずき（プロフィールに表示されます）"
                  className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  アイコンを選ぶ（あとから変更できます）
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_PRESETS.map((preset) => (
                    <div key={preset.id} className="relative">
                      <button
                        type="button"
                        onClick={() => setSelectedAvatarId(preset.id)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-lg cursor-pointer transition-all ${
                          selectedAvatarId === preset.id
                            ? 'ring-2 ring-offset-2 ring-sky-400 scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                        }}
                      >
                        {preset.emoji}
                      </button>
                      <a
                        href={buildAvatarDataUrl(preset.colors, preset.emoji)}
                        download={`drawker-icon-${preset.id}.svg`}
                        onClick={(e) => e.stopPropagation()}
                        title="このアイコンをダウンロード"
                        className="absolute -bottom-1 -right-1 w-[18px] h-[18px] rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-[9px] text-slate-500 hover:text-sky-600 hover:border-sky-300 transition-colors"
                      >
                        ⬇
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

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