'use client'

import { useState, useEffect, ChangeEvent } from 'react'
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

// アップロードされた画像をアイコン用に軽量化（600px・webp）してからStorageへ保存する
const compressAvatarImage = (file: File, maxWidth = 600, quality = 0.85): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error('ファイルサイズが大きすぎます（10MB以下の画像を選択してください）'))
      return
    }
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを選択してください'))
      return
    }

    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('画像の処理に失敗しました'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('画像の圧縮に失敗しました'))),
        'image/webp',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('画像の読み込みに失敗しました。別の画像でお試しください。'))
    }
    img.src = objectUrl
  })
}

const uploadCustomAvatar = async (userId: string, file: File): Promise<string> => {
  const blob = await compressAvatarImage(file)
  const fileName = `${userId}/avatar_${Date.now()}.webp`
  const { error: uploadError } = await supabase.storage
    .from('portfolios')
    .upload(fileName, blob, { contentType: 'image/webp', upsert: true })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('portfolios').getPublicUrl(fileName)
  return data.publicUrl
}

export default function LoginPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState<'client' | 'creator'>('client')
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PRESETS[0].id)
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null)
  const [customAvatarPreview, setCustomAvatarPreview] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false) // 利用規約同意ステート
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [referrerId, setReferrerId] = useState<string | null>(null)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // 招待リンク（/login?ref=紹介者のuser_id）経由で来た場合、紹介者IDを覚えておく。
  // useSearchParams はSuspense境界が必要になるため、素朴にlocationから読む。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      setReferrerId(ref)
      setIsSignUp(true)
    }
    if (params.get('error') === 'oauth') {
      setErrorMsg('Googleログインに失敗しました。もう一度お試しください。')
    }
  }, [])

  const handleCustomAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setErrorMsg('画像ファイルを選択してください。')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('ファイルサイズが大きすぎます（10MB以下の画像を選択してください）。')
      return
    }
    setErrorMsg('')
    setCustomAvatarFile(file)
    setCustomAvatarPreview(URL.createObjectURL(file))
  }

  const handleSelectPreset = (id: string) => {
    setSelectedAvatarId(id)
    setCustomAvatarFile(null)
    setCustomAvatarPreview('')
  }

  const [googleLoading, setGoogleLoading] = useState(false)

  // Googleでログイン。新規登録フォームの項目（利用方法・表示名・アイコン）は入力させず、
  // 表示名とアイコンはGoogleアカウントの情報から埋める（app/auth/callback/route.ts）。
  // 利用方法（クリエイター/依頼者）は、ダッシュボードで保存した時点で決まる既存の仕様に合わせ、
  // ひとまず依頼者として作成し、あとからいつでもクリエイター化できるようにする。
  //
  // 制限事項: 招待リンク（?ref=...）経由の紹介ポイントは、現状メール登録のみ対応。
  // signInWithOAuthはsignUpと違いuser_metadataへの値の受け渡しができず、紹介者IDを
  // auth.users作成時点のDBトリガー（handle_new_user_referral）まで引き継げないため。
  const handleGoogleLogin = async () => {
    if (!agreedTerms) {
      setErrorMsg('利用規約への同意が必要です。')
      return
    }
    setErrorMsg('')
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setErrorMsg('Googleログインに失敗しました: ' + error.message)
      setGoogleLoading(false)
    }
    // 成功時はGoogleの認証画面へ遷移するため、ここでの後処理は不要
  }

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
      // アップロード画像を選んでいる場合、それをアップロードできるのはセッションが
      // 発行された後（＝auth.uid()が使えるようになった後）なので、signUp時点のmetadataには
      // プリセットの場合だけ入れておく。アップロード画像はsignUp成功後に処理する。
      const selectedAvatar = AVATAR_PRESETS.find((a) => a.id === selectedAvatarId) || AVATAR_PRESETS[0]
      const avatarDataUrl = customAvatarFile ? undefined : buildAvatarDataUrl(selectedAvatar.colors, selectedAvatar.emoji)

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
            account_type: accountType,
          },
        },
      })

      if (error) {
        setErrorMsg('登録に失敗しました: ' + error.message)
      } else {
        let avatarPending = false
        if (data.user && data.session) {
          if (customAvatarFile) {
            try {
              const uploadedUrl = await uploadCustomAvatar(data.user.id, customAvatarFile)
              const { data: updated } = await supabase.auth.updateUser({ data: { avatar_url: uploadedUrl } })
              await ensureProfileFromSignupMetadata(updated.user || data.user)
            } catch (uploadError) {
              console.error('アイコンアップロードエラー:', uploadError)
              await ensureProfileFromSignupMetadata(data.user)
            }
          } else {
            await ensureProfileFromSignupMetadata(data.user)
          }
        } else if (customAvatarFile) {
          // メール確認が必要な設定の場合、この場ではアップロードできない
          avatarPending = true
        }

        const baseMsg = referrerId
          ? 'アカウントを作成しました！紹介ポイントも付与されます。ログインしてください。'
          : 'アカウントを作成しました！ログインしてください。'
        setInfoMsg(avatarPending ? `${baseMsg}（画像アイコンはログイン後にダッシュボードから設定してください）` : baseMsg)
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

  // パスワード再設定メールを送るだけで、実際の変更は本人がメール内のリンクから
  // 新しいパスワードを設定した時点で初めて反映される（Supabase側の仕組みに準拠。
  // メール送信時点では古いパスワードは一切変更されない）。
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setErrorMsg('メールアドレスを入力してください。')
      return
    }
    setLoading(true)
    setErrorMsg('')
    setResetSending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetSending(false)
    setLoading(false)

    if (error) {
      setErrorMsg('送信に失敗しました: ' + error.message)
      return
    }
    setResetSent(true)
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
            {forgotMode ? 'パスワードの再設定' : isSignUp ? 'アカウント新規作成' : 'ログイン'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {forgotMode
              ? '登録済みのメールアドレスに再設定用のリンクをお送りします'
              : isSignUp
              ? 'お気に入り保存やマイページ機能を利用できます'
              : 'マイページにアクセスします'}
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

        {forgotMode ? (
          resetSent ? (
            <div className="space-y-4 text-center">
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl text-xs font-bold">
                再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください。
              </div>
              <button
                type="button"
                onClick={() => {
                  setForgotMode(false)
                  setResetSent(false)
                }}
                className="text-xs text-sky-600 hover:underline font-bold cursor-pointer"
              >
                ← ログイン画面に戻る
              </button>
            </div>
          ) : (
            <form onSubmit={handleSendResetEmail} className="space-y-4">
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
              <button
                type="submit"
                disabled={resetSending}
                className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
              >
                {resetSending ? '送信中...' : '再設定メールを送信する'}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setForgotMode(false)}
                  className="text-xs text-slate-400 hover:text-sky-600 font-bold cursor-pointer"
                >
                  ← ログイン画面に戻る
                </button>
              </div>
            </form>
          )
        ) : (
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
            {!isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setForgotMode(true)
                  setErrorMsg('')
                  setInfoMsg('')
                  setResetSent(false)
                }}
                className="mt-1.5 text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
              >
                パスワードをお忘れですか？
              </button>
            )}
          </div>

          {isSignUp && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">利用方法</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccountType('client')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      accountType === 'client'
                        ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                        : 'bg-white/90 border-sky-100 text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    🙋 依頼者として利用する
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccountType('creator')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      accountType === 'creator'
                        ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                        : 'bg-white/90 border-sky-100 text-slate-600 hover:border-sky-300'
                    }`}
                  >
                    🎨 クリエイターとして利用する
                  </button>
                </div>
                {accountType === 'creator' && (
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    クリエイターアカウントの場合でも依頼をすることが可能です。
                  </p>
                )}
              </div>

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
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`w-11 h-11 rounded-full flex items-center justify-center text-lg cursor-pointer transition-all ${
                        !customAvatarFile && selectedAvatarId === preset.id
                          ? 'ring-2 ring-offset-2 ring-sky-400 scale-105'
                          : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})`,
                      }}
                    >
                      {preset.emoji}
                    </button>
                  ))}

                  {/* 自分の画像をアップロードして使う */}
                  <label
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all overflow-hidden bg-slate-100 ${
                      customAvatarFile
                        ? 'ring-2 ring-offset-2 ring-sky-400 scale-105'
                        : 'border-2 border-dashed border-slate-300 opacity-70 hover:opacity-100'
                    }`}
                    title="画像をアップロード"
                  >
                    {customAvatarPreview ? (
                      <img src={customAvatarPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-slate-400 text-lg leading-none">＋</span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCustomAvatarChange} />
                  </label>
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
                ・
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-sky-600 hover:underline"
                >
                  プライバシーポリシー
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

          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-sky-100" />
            <span className="text-[10px] font-bold text-slate-400">または</span>
            <div className="flex-1 h-px bg-sky-100" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || !agreedTerms}
            className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95 flex items-center justify-center gap-2.5"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
              <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
            </svg>
            {googleLoading ? '処理中...' : 'Googleでログイン'}
          </button>
          {!agreedTerms && (
            <p className="text-[10px] text-slate-400 text-center">
              Googleでログインする場合も、上の利用規約への同意が必要です。
            </p>
          )}
        </form>
        )}

        {!forgotMode && (
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
        )}

        <div className="text-center pt-4 border-t border-sky-100">
          <Link href="/" className="text-xs text-slate-400 hover:text-sky-600 font-medium">
            ← サイトトップへ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}