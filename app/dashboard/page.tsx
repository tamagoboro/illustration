'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const PRESET_TASTES = [
  'アイコン',
  'ヘッダー',
  'デザイン',
  '背景',
  'ペット',
  'SD・ちびキャラ',
  'ゲーム用イラスト',
  '一枚絵',
  'ロゴ',
  'VTuber向け',
  'IRIAMライバー向け',
  'パーツ分け可',
  'モデリング',
  '3D背景',
  '著作権譲渡可',
]

// メニュー項目の型定義
type MenuItem = {
  title: string
  price: number | ''
}

const safeParseInt = (val: any): number | null => {
  if (val === null || val === undefined || typeof val === 'object') return null
  const str = String(val).trim()
  if (
    str === '' || 
    str === '{}' || 
    str === '[]' || 
    str === 'null' || 
    str === 'undefined' || 
    str === '[object Object]'
  ) {
    return null
  }
  const parsed = parseInt(str, 10)
  return isNaN(parsed) ? null : parsed
}

// 古いURL形式（/object/portfolios/）を正しいPublic URL形式（/object/public/portfolios/）に補正するヘルパー
const normalizeStorageUrl = (url: string): string => {
  if (!url) return ''
  const trimmed = url.trim()
  if (trimmed.includes('/storage/v1/object/portfolios/')) {
    return trimmed.replace('/storage/v1/object/portfolios/', '/storage/v1/object/public/portfolios/')
  }
  return trimmed
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'portfolio'>('profile')
  const [user, setUser] = useState<User | null>(null)

  // プロフィール公開/非公開フラグ
  const [isPublic, setIsPublic] = useState(true)

  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'available' | 'busy'>('available')
  const [statusComment, setStatusComment] = useState('')
  const [tastes, setTastes] = useState<string[]>([])
  const [customTasteInput, setCustomTasteInput] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState<string>('14')
  const [commercialUseAllowed, setCommercialUseAllowed] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [priceMin, setPriceMin] = useState<string>('5000')

  const [externalEstimationUrl, setExternalEstimationUrl] = useState('')
  const [twitterUrl, setTwitterUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [pixivUrl, setPixivUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(['', '', '', ''])
  
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { title: 'アイコン制作', price: 5000 },
    { title: 'ヘッダー制作', price: 8000 }
  ])

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileError) {
        console.error('Profile fetch error:', profileError)
      }

      if (profileData) {
        setIsPublic(profileData.is_public ?? true)

        setDisplayName(profileData.display_name || '')
        setStatus(profileData.status || 'available')
        setStatusComment(profileData.status_comment || '')
        
        if (Array.isArray(profileData.tastes)) {
          setTastes(profileData.tastes.map((t: any) => String(t)))
        } else {
          setTastes([])
        }

        if (Array.isArray(profileData.menu_items) && profileData.menu_items.length > 0) {
          setMenuItems(
            profileData.menu_items.map((item: any) => ({
              title: item.title || '',
              price: typeof item.price === 'number' ? item.price : (item.price === '' ? '' : safeParseInt(item.price) ?? '')
            }))
          )
        }

        const parsedLeadTime = safeParseInt(profileData.lead_time_days)
        setLeadTimeDays(parsedLeadTime !== null ? String(parsedLeadTime) : '')

        const parsedPriceMin = safeParseInt(profileData.price_min)
        setPriceMin(parsedPriceMin !== null ? String(parsedPriceMin) : '')

        setCommercialUseAllowed(profileData.commercial_use_allowed ?? true)
        setAvatarUrl(profileData.avatar_url || '')
        setExternalEstimationUrl(profileData.external_estimation_url || '')
        setTwitterUrl(profileData.twitter_url || '')
        setInstagramUrl(profileData.instagram_url || '')
        setPixivUrl(profileData.pixiv_url || '')
        setWebsiteUrl(profileData.website_url || '')
      }

      const { data: portfolioData } = await supabase
        .from('portfolio_items')
        .select('image_url, sort_order')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (portfolioData && portfolioData.length > 0) {
        const urls = ['', '', '', '']
        portfolioData.forEach((item) => {
          if (item.sort_order < 4) {
            urls[item.sort_order] = normalizeStorageUrl(item.image_url || '')
          }
        })
        setPortfolioUrls(urls)
      }

      setLoading(false)
    }

    checkUserAndFetchData()
  }, [router])

  // メニュー操作ハンドラー
  const handleAddMenuItem = () => {
    setMenuItems((prev) => [...prev, { title: '', price: '' }])
  }

  const handleRemoveMenuItem = (index: number) => {
    setMenuItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleMenuItemChange = (index: number, key: keyof MenuItem, value: any) => {
    setMenuItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        if (key === 'price') {
          const numValue = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0)
          return { ...item, price: numValue }
        }
        return { ...item, [key]: value }
      })
    )
  }

  const togglePresetTaste = (tag: string) => {
    setTastes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleAddCustomTaste = () => {
    const trimmed = customTasteInput.trim()
    if (!trimmed) return
    if (!tastes.includes(trimmed)) {
      setTastes((prev) => [...prev, trimmed])
    }
    setCustomTasteInput('')
  }

  const handleRemoveTaste = (tagToRemove: string) => {
    setTastes((prev) => prev.filter((t) => t !== tagToRemove))
  }

  // 画像軽量化＆フォーマット自動切替処理
  // 1枚目(index === 0)は Twitter OGP 互換重視で JPEG、それ以外は容量重視で WebP に圧縮
  const compressImage = (
    file: File, 
    index: number | 'avatar', 
    maxWidth = 1200, 
    quality = 0.8
  ): Promise<{ blob: Blob; mimeType: string; extension: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas context error'))

        // 1枚目(index === 0)のみ JPEG、アバターや2枚目以降は WebP
        const isFirstImage = index === 0
        const mimeType = isFirstImage ? 'image/jpeg' : 'image/webp'
        const extension = isFirstImage ? 'jpg' : 'webp'

        // JPEGの場合は透過背景が黒くならないように背景を白で塗る
        if (isFirstImage) {
          ctx.fillStyle = '#FFFFFF'
          ctx.fillRect(0, 0, width, height)
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve({ blob, mimeType, extension })
            else reject(new Error('Blob convert error'))
          },
          mimeType,
          quality
        )
      }
      img.onerror = (err) => reject(err)
      img.src = URL.createObjectURL(file)
    })
  }

  // アバターアイコンアップロード関数
  const handleAvatarFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingAvatar(true)

      // アバターは WebP 形式で軽量化（最大幅600px）
      const { blob, mimeType, extension } = await compressImage(file, 'avatar', 600, 0.85)
      const fileName = `avatars/${user.id}_${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, blob, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('portfolios')
        .getPublicUrl(fileName)

      setAvatarUrl(publicUrlData.publicUrl)
    } catch (error: any) {
      alert('アイコンのアップロードに失敗しました: ' + error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  // ポートフォリオ作品アップロード関数（1枚目: JPEG / 2〜4枚目: WebP）
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingIndex(index)

      // index === 0 の場合は JPEG、それ以外は WebP に自動圧縮
      const { blob, mimeType, extension } = await compressImage(file, index, 1200, 0.8)
      const fileName = `${user.id}/${Date.now()}_${index}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, blob, {
          contentType: mimeType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('portfolios')
        .getPublicUrl(fileName)

      const nextUrls = [...portfolioUrls]
      nextUrls[index] = publicUrlData.publicUrl
      setPortfolioUrls(nextUrls)
    } catch (error: any) {
      alert('画像のアップロードに失敗しました: ' + error.message)
    } finally {
      setUploadingIndex(null)
    }
  }

  const showSuccessToast = (msg: string) => {
    setSaveSuccess(msg)
    setTimeout(() => setSaveSuccess(null), 3000)
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const cleanInteger = (val: any): number | null => {
      if (val === null || val === undefined || typeof val === 'object') return null
      const str = String(val).replace(/[{}]/g, '').trim()
      if (str === '' || str === 'null' || str === 'undefined') return null
      const parsed = parseInt(str, 10)
      return isNaN(parsed) ? null : parsed
    }

    const finalPriceMin = cleanInteger(priceMin)
    const finalLeadTimeDays = cleanInteger(leadTimeDays)

    const cleanTastes = Array.isArray(tastes) 
      ? tastes.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : []

    const cleanMenuItems = menuItems
      .filter((item) => item.title.trim().length > 0)
      .map((item) => ({
        title: item.title.trim(),
        price: typeof item.price === 'number' ? item.price : ''
      }))

    const profilePayload = {
      user_id: user.id,
      is_public: Boolean(isPublic),
      display_name: displayName ? displayName.trim() : '',
      status: status,
      status_comment: statusComment ? statusComment.trim() : null,
      tastes: cleanTastes,
      menu_items: cleanMenuItems,
      lead_time_days: finalLeadTimeDays,
      price_min: finalPriceMin,
      commercial_use_allowed: Boolean(commercialUseAllowed),
      avatar_url: avatarUrl ? avatarUrl.trim() : null,
      external_estimation_url: externalEstimationUrl ? externalEstimationUrl.trim() : null,
      twitter_url: twitterUrl ? twitterUrl.trim() : null,
      instagram_url: instagramUrl ? instagramUrl.trim() : null,
      pixiv_url: pixivUrl ? pixivUrl.trim() : null,
      website_url: websiteUrl ? websiteUrl.trim() : null,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })

    setSaving(false)

    if (error) {
      console.error('保存エラー詳細:', JSON.stringify(error, null, 2))
      alert('保存に失敗しました: ' + error.message)
    } else {
      showSuccessToast('プロフィール情報を更新しました！')
    }
  }

  const handleSavePortfolio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    const { error: deleteError } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('既存ポートフォリオ削除エラー:', deleteError)
    }

    const itemsToInsert = portfolioUrls
      .map((url, idx) => ({
        user_id: user.id,
        image_url: normalizeStorageUrl(url),
        sort_order: idx,
      }))
      .filter((item) => item.image_url.length > 0)

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('portfolio_items')
        .insert(itemsToInsert)

      if (insertError) {
        alert('作品情報の更新に失敗しました: ' + insertError.message)
        setSaving(false)
        return
      }
    }

    setSaving(false)
    showSuccessToast('作品ポートフォリオを更新しました！')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 tracking-wider">設定データを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-800 pb-24 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-white font-bold">✓</div>
          <p className="text-xs font-semibold">{saveSuccess}</p>
        </div>
      )}

      {/* Header */}
      <header className="px-6 py-3.5 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-indigo-200">
              D
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">ダッシュボード</h1>
              <p className="text-[11px] text-slate-400 font-medium mt-1">プロフィール・作品の掲載管理</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              トップへ戻る
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Tab Selector */}
        <div className="flex p-1 bg-slate-200/60 rounded-2xl max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            基本プロフィール
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('portfolio')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'portfolio'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            作品ギャラリー
          </button>
        </div>

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 space-y-8 shadow-xs">
            {/* Header */}
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-slate-900 text-base">基本情報の設定</h2>
                <p className="text-xs text-slate-400 mt-1">公開プロフィールに反映される基本情報です</p>
              </div>
              {avatarUrl && (
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs shrink-0">
                  <img src={avatarUrl} alt="アバタープレビュー" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* 公開 / 非公開 切り替え */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isPublic 
                ? 'bg-emerald-50/50 border-emerald-200/80' 
                : 'bg-amber-50/50 border-amber-200/80'
            }`}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPublic ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-xs font-extrabold text-slate-800">
                      {isPublic ? '現在：公開中' : '現在：非公開（下書き）'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {isPublic 
                      ? '検索一覧や外部URLからプロフィールを閲覧できる状態です。' 
                      : '検索一覧から除外され、外部からプロフィールを見ることができなくなります。'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                    isPublic ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isPublic ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">表示名 (クリエイター名) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="例: イラスト屋 たろう"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              {/* アイコン画像設定 */}
              <div className="space-y-3 sm:col-span-2 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 block">プロフィールアイコン画像</label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => setAvatarUrl('')}
                      className="text-[11px] text-rose-500 font-bold hover:underline cursor-pointer"
                    >
                      アイコンを解除
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border border-slate-200 bg-white overflow-hidden flex items-center justify-center relative shadow-xs shrink-0">
                    {uploadingAvatar ? (
                      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="アバター" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <label className="block">
                      <span className="sr-only">ファイルから選択</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingAvatar}
                        onChange={handleAvatarFileUpload}
                        className="block w-full text-xs text-slate-500
                          file:mr-3 file:py-2 file:px-4
                          file:rounded-xl file:border-0
                          file:text-xs file:font-bold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          file:cursor-pointer cursor-pointer transition-all"
                      />
                    </label>

                    <input
                      type="url"
                      placeholder="または画像URLを直接入力 (https://...)"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">現在の受付ステータス</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'available' | 'busy')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="available">🟢 即対応可</option>
                  <option value="busy">🟡 相談受付中</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">参考最低価格 (円)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="5000"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-indigo-600"
                  />
                </div>
              </div>

              {/* メニュー料金項目 */}
              <div className="space-y-3 sm:col-span-2 border-t border-slate-100 pt-6">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block">料金メニュー設定</label>
                    <p className="text-[11px] text-slate-400 mt-0.5">一覧カードや比較画面で表示される主な料金ラインナップです</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMenuItem}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    ＋ メニューを追加
                  </button>
                </div>

                <div className="space-y-2">
                  {menuItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="例: アイコン制作"
                        value={item.title}
                        onChange={(e) => handleMenuItemChange(idx, 'title', e.target.value)}
                        className="flex-2 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                      />
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                        <input
                          type="number"
                          step="500"
                          placeholder="5000"
                          value={item.price}
                          onChange={(e) => handleMenuItemChange(idx, 'price', e.target.value)}
                          className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold text-indigo-600"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMenuItem(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {menuItems.length === 0 && (
                    <p className="text-xs text-slate-300 italic py-1">メニューが設定されていません</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">目安納期 (日数)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="14"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={commercialUseAllowed}
                    onChange={(e) => setCommercialUseAllowed(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">商用利用を可能として掲載する</span>
                </label>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-700">自己紹介・PRコメント</label>
                <textarea
                  rows={4}
                  placeholder="作風や得意なジャンル、実績などのアピール文を入力してください"
                  value={statusComment}
                  onChange={(e) => setStatusComment(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed font-medium"
                />
              </div>

              {/* タグ設定 */}
              <div className="space-y-4 sm:col-span-2 border-t border-slate-100 pt-6">
                <label className="text-xs font-bold text-slate-700 block">得意なテイスト・タグ設定</label>
                
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-400">よく使われるタグ（タップでオン/オフ）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_TASTES.map((tag) => {
                      const isSelected = tastes.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => togglePresetTaste(tag)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-400">オリジナルのタグを追加</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例: ドット絵, 和風イラスト..."
                      value={customTasteInput}
                      onChange={(e) => setCustomTasteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomTaste()
                        }
                      }}
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomTaste}
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                    >
                      追加
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-bold text-slate-400">現在設定中のタグ ({tastes.length}件)</p>
                  {tastes.length === 0 ? (
                    <p className="text-xs text-slate-300 italic">タグが選択されていません</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tastes.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold"
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTaste(tag)}
                            className="hover:text-rose-600 text-indigo-400 text-xs font-bold px-0.5 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Links Section */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-xs">連絡先・SNSリンクの設定</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">詳細画面の「見積もり・相談をする」モーダル等に表示されます</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700">外部見積もりフォームURL</label>
                  <input
                    type="url"
                    placeholder="https://google.form/..."
                    value={externalEstimationUrl}
                    onChange={(e) => setExternalEstimationUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">𝕏 (Twitter) URL</label>
                  <input
                    type="url"
                    placeholder="https://x.com/username"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Instagram URL</label>
                  <input
                    type="url"
                    placeholder="https://instagram.com/username"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pixiv URL</label>
                  <input
                    type="url"
                    placeholder="https://pixiv.net/users/..."
                    value={pixivUrl}
                    onChange={(e) => setPixivUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">公式Webサイト URL</label>
                  <input
                    type="url"
                    placeholder="https://yourportfolio.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || uploadingAvatar}
              className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs transition-all duration-200 shadow-md hover:shadow-indigo-200 cursor-pointer disabled:opacity-50"
            >
              {saving ? '保存中...' : 'プロフィール情報を保存'}
            </button>
          </form>
        )}

        {/* PORTFOLIO TAB */}
        {activeTab === 'portfolio' && (
          <form onSubmit={handleSavePortfolio} className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 space-y-8 shadow-xs">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="font-extrabold text-slate-900 text-base">作品ギャラリーの設定</h2>
              <p className="text-xs text-slate-400 mt-1">最大4枚まで登録可能です。1枚目の画像がTwitter OGP・カード一覧の代表画像になります。</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {portfolioUrls.map((url, idx) => (
                <div key={idx} className="space-y-3 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50 transition-all">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      作品 {idx + 1}
                      {idx === 0 && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-extrabold">
                          OGP代表 (JPEG)
                        </span>
                      )}
                    </label>
                    {url && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...portfolioUrls]
                          next[idx] = ''
                          setPortfolioUrls(next)
                        }}
                        className="text-[11px] text-rose-500 font-bold hover:underline cursor-pointer"
                      >
                        画像を削除
                      </button>
                    )}
                  </div>

                  <div className="w-full aspect-[4/3] rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center relative shadow-xs">
                    {uploadingIndex === idx ? (
                      <div className="flex flex-col items-center gap-2 text-xs font-bold text-indigo-600">
                        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        圧縮＆アップロード中...
                      </div>
                    ) : url ? (
                      <img
                        src={url}
                        alt={`プレビュー ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-slate-300">
                        <svg className="w-8 h-8 stroke-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[11px] font-semibold">未登録</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-1">
                    {/* ファイル選択ボタン */}
                    <label className="block">
                      <span className="sr-only">画像を選択</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingIndex !== null}
                        onChange={(e) => handleFileUpload(e, idx)}
                        className="block w-full text-xs text-slate-500
                          file:mr-3 file:py-2 file:px-4
                          file:rounded-xl file:border-0
                          file:text-xs file:font-bold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          file:cursor-pointer cursor-pointer transition-all"
                      />
                    </label>

                    <div className="flex items-center gap-2 my-1">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span className="text-[10px] font-bold text-slate-300">または</span>
                      <div className="h-px bg-slate-200 flex-1"></div>
                    </div>

                    {/* URL直接入力フォーム */}
                    <input
                      type="url"
                      placeholder="画像URLを直接入力"
                      value={url}
                      onChange={(e) => {
                        const next = [...portfolioUrls]
                        next[idx] = e.target.value
                        setPortfolioUrls(next)
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-mono text-[11px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving || uploadingIndex !== null}
              className="w-full py-3.5 bg-slate-900 hover:bg-indigo-600 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs transition-all duration-200 shadow-md hover:shadow-indigo-200 cursor-pointer disabled:opacity-50"
            >
              {saving ? '保存中...' : '作品ポートフォリオを保存'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}