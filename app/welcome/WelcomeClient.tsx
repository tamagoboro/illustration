'use client'

import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { AVATAR_PRESETS, buildAvatarDataUrl, uploadCustomAvatar } from '@/lib/avatar'
import { AccountType, completeProfileSetup } from '@/lib/ensureProfile'
import { isSafeInternalPath, isReturnablePath, readReturnPath, readSignupType, saveSignupType } from '@/lib/returnPath'
import { markProfileReady } from '@/components/SessionGuard'

// アイコンの選び方：Googleアカウントの画像 / プリセット / 自分でアップロード
type AvatarChoice = { kind: 'google' } | { kind: 'preset'; id: string } | { kind: 'upload' }

// Googleで初めて入った人の初期設定。表示名・アイコン・利用方法（依頼者/クリエイター）を入力してもらう。
// Googleから受け取れるのは名前と画像だけで、利用方法と利用規約への同意は聞かないと分からないため、
// メールでの新規登録（app/login）と同じ項目をここで埋める。
export default function WelcomeClient() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [nextPath, setNextPath] = useState('/')

  const [displayName, setDisplayName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('client')
  const [googleAvatarUrl, setGoogleAvatarUrl] = useState<string | null>(null)
  const [avatarChoice, setAvatarChoice] = useState<AvatarChoice>({ kind: 'preset', id: AVATAR_PRESETS[0].id })
  const [customAvatarFile, setCustomAvatarFile] = useState<File | null>(null)
  const [customAvatarPreview, setCustomAvatarPreview] = useState('')
  const [agreedTerms, setAgreedTerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        router.replace('/login')
        return
      }

      // 戻り先：Googleログインから渡された next を優先し、無ければ記録しておいたページ
      const requestedNext = new URLSearchParams(window.location.search).get('next')
      const next =
        isSafeInternalPath(requestedNext) && isReturnablePath(requestedNext) ? requestedNext : readReturnPath()
      setNextPath(next)

      // すでに表示名がある人（設定済み）は、この画面を出さずに先へ進める
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle()
      if (profile?.display_name?.trim()) {
        markProfileReady(user.id)
        router.replace(next)
        return
      }

      const meta = user.user_metadata || {}
      const googleName =
        (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta.name === 'string' && meta.name.trim()) ||
        ''
      const googlePicture =
        (typeof meta.avatar_url === 'string' && meta.avatar_url) ||
        (typeof meta.picture === 'string' && meta.picture) ||
        null

      setUserId(user.id)
      setDisplayName(googleName.slice(0, 30))
      if (googlePicture) {
        setGoogleAvatarUrl(googlePicture)
        setAvatarChoice({ kind: 'google' })
      }
      // 新規登録の画面で「クリエイターとして利用する」を選んでからGoogleで登録した場合は、その選択を引き継ぐ
      const signupType = readSignupType()
      if (signupType) setAccountType(signupType)
      setChecking(false)
    }
    init()
  }, [router])

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
    setAvatarChoice({ kind: 'upload' })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!userId) return
    if (!agreedTerms) {
      setErrorMsg('利用規約への同意が必要です。')
      return
    }
    if (!displayName.trim()) {
      setErrorMsg('表示名を入力してください。')
      return
    }

    setSaving(true)
    setErrorMsg('')

    // 選んだアイコンを決める。アップロードに失敗したら、プリセットの1つ目を使う
    const fallbackPreset = AVATAR_PRESETS[0]
    let avatarUrl = buildAvatarDataUrl(fallbackPreset.colors, fallbackPreset.emoji)
    if (avatarChoice.kind === 'google' && googleAvatarUrl) {
      avatarUrl = googleAvatarUrl
    } else if (avatarChoice.kind === 'preset') {
      const preset = AVATAR_PRESETS.find((a) => a.id === avatarChoice.id) || fallbackPreset
      avatarUrl = buildAvatarDataUrl(preset.colors, preset.emoji)
    } else if (avatarChoice.kind === 'upload' && customAvatarFile) {
      try {
        avatarUrl = await uploadCustomAvatar(userId, customAvatarFile)
      } catch (uploadError) {
        console.error('アイコンアップロードエラー:', uploadError)
      }
    }

    const saved = await completeProfileSetup(userId, { displayName, avatarUrl, accountType })
    if (!saved) {
      setErrorMsg('保存に失敗しました。時間をおいて、もう一度お試しください。')
      setSaving(false)
      return
    }

    // メールで登録した人と同じ情報を、アカウント側（user_metadata）にも持たせておく
    const { error: metaError } = await supabase.auth.updateUser({
      data: { display_name: displayName.trim(), account_type: accountType },
    })
    if (metaError) console.error('アカウント情報の更新エラー:', metaError)

    markProfileReady(userId)
    saveSignupType(null)
    // クリエイターはダッシュボードへ（先頭に「かんたん登録」が出る）。依頼者は登録前に見ていたページへ戻る
    router.replace(accountType === 'creator' ? '/dashboard' : nextPath)
  }

  // 設定せずにやめる場合。ログアウトしないと、どのページを開いてもこの画面に戻ってくるため
  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/')
  }

  if (checking) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  const ringClass = (selected: boolean) =>
    selected ? 'ring-2 ring-offset-2 ring-sky-400 scale-105' : 'opacity-70 hover:opacity-100'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />

      <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-lg border border-white/70 max-w-md w-full space-y-5">
        <div className="text-center space-y-1.5">
          <p className="text-[10px] font-black text-sky-600 tracking-[0.2em]">WELCOME</p>
          <h1 className="text-xl font-black text-slate-800">はじめの設定</h1>
          <p className="text-xs text-slate-500 font-medium">あと少しで登録が完了します。あとからいつでも変更できます。</p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">{errorMsg}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">利用方法</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'client' as const, label: '🙋 依頼者として利用する' },
                { value: 'creator' as const, label: '🎨 クリエイターとして利用する' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAccountType(option.value)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    accountType === option.value
                      ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                      : 'bg-white/90 border-sky-100 text-slate-600 hover:border-sky-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {accountType === 'creator' && (
              <p className="text-[10px] text-slate-400 mt-1.5">クリエイターアカウントの場合でも依頼をすることが可能です。</p>
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
            <p className="text-[10px] text-slate-400 mt-1">
              Googleアカウントの名前が入っています。本名を出したくない場合は、活動名に書き換えてください。
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">アイコンを選ぶ</label>
            <div className="flex flex-wrap gap-2">
              {googleAvatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarChoice({ kind: 'google' })}
                  title="Googleアカウントの画像を使う"
                  className={`w-11 h-11 rounded-full overflow-hidden cursor-pointer transition-all bg-slate-100 ${ringClass(avatarChoice.kind === 'google')}`}
                >
                  <img src={googleAvatarUrl} alt="Googleアカウントの画像" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </button>
              )}

              {AVATAR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarChoice({ kind: 'preset', id: preset.id })}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-lg cursor-pointer transition-all ${ringClass(
                    avatarChoice.kind === 'preset' && avatarChoice.id === preset.id
                  )}`}
                  style={{ background: `linear-gradient(135deg, ${preset.colors[0]}, ${preset.colors[1]})` }}
                >
                  {preset.emoji}
                </button>
              ))}

              {/* 自分の画像をアップロードして使う */}
              <label
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm cursor-pointer transition-all overflow-hidden bg-slate-100 ${
                  avatarChoice.kind === 'upload'
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

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 rounded border-sky-200 text-sky-500 accent-sky-500 focus:ring-sky-400 w-4 h-4 cursor-pointer"
            />
            <span className="text-xs text-slate-600 leading-normal font-medium">
              <Link href="/terms" target="_blank" rel="noopener noreferrer" className="font-bold text-sky-600 hover:underline">
                利用規約
              </Link>
              ・
              <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="font-bold text-sky-600 hover:underline">
                プライバシーポリシー
              </Link>
              に同意する
            </span>
          </label>

          <button
            type="submit"
            disabled={saving || !agreedTerms}
            className="w-full py-3 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white font-black rounded-2xl transition text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
          >
            {saving ? '保存中...' : 'この内容で登録を完了する'}
          </button>
        </form>

        <div className="text-center pt-3 border-t border-sky-100">
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs text-slate-400 hover:text-sky-600 font-medium cursor-pointer"
          >
            登録をやめてログアウトする
          </button>
        </div>
      </div>
    </div>
  )
}
