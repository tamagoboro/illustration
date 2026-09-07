'use client'

import { useState, useEffect, ChangeEvent, FormEvent, KeyboardEvent } from 'react'
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

const SNS_PLATFORMS = [
  { id: 'twitter', label: '𝕏 (Twitter)' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'pixiv', label: 'Pixiv' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'skeb', label: 'Skeb' },
  { id: 'coconala', label: 'ココナラ' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'website', label: '公式Webサイト' },
  { id: 'other', label: 'その他' },
]

const THEME_COLORS = [
  { id: 'indigo', name: 'インディゴ', bg: 'bg-indigo-600', text: 'text-indigo-600', ring: 'ring-indigo-500', lightBg: 'bg-indigo-50', border: 'border-indigo-200' },
  { id: 'rose', name: 'ローズピンク', bg: 'bg-rose-500', text: 'text-rose-500', ring: 'ring-rose-500', lightBg: 'bg-rose-50', border: 'border-rose-200' },
  { id: 'emerald', name: 'エメラルド', bg: 'bg-emerald-600', text: 'text-emerald-600', ring: 'ring-emerald-500', lightBg: 'bg-emerald-50', border: 'border-emerald-200' },
  { id: 'amber', name: 'アンバー', bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500', lightBg: 'bg-amber-50', border: 'border-amber-200' },
  { id: 'dark', name: 'ダーク', bg: 'bg-slate-900', text: 'text-slate-900', ring: 'ring-slate-800', lightBg: 'bg-slate-100', border: 'border-slate-300' },
]

type SnsLinkItem = {
  id: string
  platform: string
  url: string
}

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

  const [isPublic, setIsPublic] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [status, setStatus] = useState<'available' | 'busy' | 'stopped'>('available')
  const [statusComment, setStatusComment] = useState('')
  const [tastes, setTastes] = useState<string[]>([])
  const [customTasteInput, setCustomTasteInput] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState<string>('14')
  const [commercialUseAllowed, setCommercialUseAllowed] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [priceMin, setPriceMin] = useState<string>('5000')

  const [themeColor, setThemeColor] = useState<string>('indigo')

  const [availableFromText, setAvailableFromText] = useState('10月上旬〜')
  const [activeProjectsCount, setActiveProjectsCount] = useState<number>(1)
  const [maxProjectsCapacity, setMaxProjectsCapacity] = useState<number>(3)

  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [copiedType, setCopiedType] = useState<'portfolio' | 'form' | null>(null)

  const [aiUsage, setAiUsage] = useState<'none' | 'partial' | 'full'>('none')
  const [aiLearningAllowed, setAiLearningAllowed] = useState(false)
  const [expressOptionAvailable, setExpressOptionAvailable] = useState(false)
  const [copyrightTransferAvailable, setCopyrightTransferAvailable] = useState(false)
  const [freeRevisionCount, setFreeRevisionCount] = useState<string>('2')
  const [r18Allowed, setR18Allowed] = useState(false)

  const [externalEstimationUrl, setExternalEstimationUrl] = useState('')

  const [snsLinks, setSnsLinks] = useState<SnsLinkItem[]>([
    { id: '1', platform: 'twitter', url: '' },
    { id: '2', platform: 'instagram', url: '' }
  ])

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
        setThemeColor(profileData.theme_color || 'indigo')
        
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

        if (Array.isArray(profileData.sns_links) && profileData.sns_links.length > 0) {
          setSnsLinks(profileData.sns_links)
        } else {
          const initialLinks: SnsLinkItem[] = []
          if (profileData.twitter_url) initialLinks.push({ id: 'tw', platform: 'twitter', url: profileData.twitter_url })
          if (profileData.instagram_url) initialLinks.push({ id: 'ig', platform: 'instagram', url: profileData.instagram_url })
          if (profileData.pixiv_url) initialLinks.push({ id: 'px', platform: 'pixiv', url: profileData.pixiv_url })
          if (profileData.website_url) initialLinks.push({ id: 'web', platform: 'website', url: profileData.website_url })
          
          if (initialLinks.length > 0) {
            setSnsLinks(initialLinks)
          }
        }

        const parsedLeadTime = safeParseInt(profileData.lead_time_days)
        setLeadTimeDays(parsedLeadTime !== null ? String(parsedLeadTime) : '')

        const parsedPriceMin = safeParseInt(profileData.price_min)
        setPriceMin(parsedPriceMin !== null ? String(parsedPriceMin) : '')

        setCommercialUseAllowed(profileData.commercial_use_allowed ?? true)
        setAvatarUrl(normalizeStorageUrl(profileData.avatar_url || ''))
        setExternalEstimationUrl(profileData.external_estimation_url || '')

        setAiUsage(profileData.ai_usage || 'none')
        setAiLearningAllowed(profileData.ai_learning_allowed ?? false)
        setExpressOptionAvailable(profileData.express_option_available ?? false)
        setCopyrightTransferAvailable(profileData.copyright_transfer_available ?? false)
        const parsedFreeRevision = safeParseInt(profileData.free_revision_count)
        setFreeRevisionCount(parsedFreeRevision !== null ? String(parsedFreeRevision) : '2')
        setR18Allowed(profileData.r18_allowed ?? false)

        if (profileData.available_from_text) setAvailableFromText(profileData.available_from_text)
        if (typeof profileData.active_projects_count === 'number') setActiveProjectsCount(profileData.active_projects_count)
        if (typeof profileData.max_projects_capacity === 'number') setMaxProjectsCapacity(profileData.max_projects_capacity)
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

  const handleAddSnsLink = () => {
    const newLink: SnsLinkItem = {
      id: Date.now().toString(),
      platform: 'twitter',
      url: ''
    }
    setSnsLinks((prev) => [...prev, newLink])
  }

  const handleRemoveSnsLink = (id: string) => {
    setSnsLinks((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSnsLinkChange = (id: string, key: 'platform' | 'url', value: string) => {
    setSnsLinks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [key]: value } : item))
    )
  }

  const handleCopy = (text: string, type: 'portfolio' | 'form') => {
    navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 2000)
  }

  const handleQuickStatusChange = async (newStatus: 'available' | 'busy' | 'stopped') => {
    setStatus(newStatus)
    if (!user) return
    await supabase
      .from('profiles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    showSuccessToast('ステータスを更新しました！')
  }

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

  const compressImage = (
    file: File, 
    index: number | 'avatar', 
    maxWidth = 1200, 
    quality = 0.8
  ): Promise<{ blob: Blob; mimeType: string; extension: string }> => {
    return new Promise((resolve, reject) => {
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
        if (!ctx) return reject(new Error('Canvas context error'))

        const isFirstImage = index === 0
        const mimeType = isFirstImage ? 'image/jpeg' : 'image/webp'
        const extension = isFirstImage ? 'jpg' : 'webp'

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
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl)
        reject(err)
      }
      img.src = objectUrl
    })
  }

  const handleAvatarFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingAvatar(true)
      const { blob, mimeType, extension } = await compressImage(file, 'avatar', 600, 0.85)
      const fileName = `${user.id}/avatar_${Date.now()}.${extension}`

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

      setAvatarUrl(normalizeStorageUrl(publicUrlData.publicUrl))
    } catch (error: any) {
      alert('アイコンのアップロードに失敗しました: ' + error.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    try {
      setUploadingIndex(index)
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
      nextUrls[index] = normalizeStorageUrl(publicUrlData.publicUrl)
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

  const handleSaveProfile = async (e: FormEvent) => {
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
    const finalFreeRevisionCount = cleanInteger(freeRevisionCount)

    const cleanTastes = Array.isArray(tastes) 
      ? tastes.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : []

    const cleanMenuItems = menuItems
      .filter((item) => item.title.trim().length > 0)
      .map((item) => ({
        title: item.title.trim(),
        price: typeof item.price === 'number' ? item.price : ''
      }))

    const cleanSnsLinks = snsLinks
      .filter((item) => item.url.trim().length > 0)
      .map((item) => ({
        id: item.id,
        platform: item.platform,
        url: item.url.trim()
      }))

    const twitterLink = cleanSnsLinks.find((l) => l.platform === 'twitter')?.url || null
    const instagramLink = cleanSnsLinks.find((l) => l.platform === 'instagram')?.url || null
    const pixivLink = cleanSnsLinks.find((l) => l.platform === 'pixiv')?.url || null
    const websiteLink = cleanSnsLinks.find((l) => l.platform === 'website')?.url || null

    const profilePayload = {
      user_id: user.id,
      is_public: Boolean(isPublic),
      display_name: displayName ? displayName.trim() : '',
      status: status,
      status_comment: statusComment ? statusComment.trim() : null,
      theme_color: themeColor,
      tastes: cleanTastes,
      menu_items: cleanMenuItems,
      sns_links: cleanSnsLinks,
      lead_time_days: finalLeadTimeDays,
      price_min: finalPriceMin,
      commercial_use_allowed: Boolean(commercialUseAllowed),
      avatar_url: avatarUrl ? normalizeStorageUrl(avatarUrl.trim()) : null,
      external_estimation_url: externalEstimationUrl ? externalEstimationUrl.trim() : null,
      twitter_url: twitterLink,
      instagram_url: instagramLink,
      pixiv_url: pixivLink,
      website_url: websiteLink,
      ai_usage: aiUsage,
      ai_learning_allowed: Boolean(aiLearningAllowed),
      express_option_available: Boolean(expressOptionAvailable),
      copyright_transfer_available: Boolean(copyrightTransferAvailable),
      free_revision_count: finalFreeRevisionCount,
      r18_allowed: Boolean(r18Allowed),
      available_from_text: availableFromText,
      active_projects_count: activeProjectsCount,
      max_projects_capacity: maxProjectsCapacity,
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

  const handleSavePortfolio = async (e: FormEvent) => {
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

  const currentPortfolioUrl = typeof window !== 'undefined' && user ? `${window.location.origin}/${user.id}` : ''
  const currentThemeObj = THEME_COLORS.find((t) => t.id === themeColor) || THEME_COLORS[0]

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
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-white font-bold">✓</div>
          <p className="text-xs font-semibold">{saveSuccess}</p>
        </div>
      )}

      {/* ヘッダー */}
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-2xl ${currentThemeObj.bg} flex items-center justify-center text-white font-black text-base shadow-md transition-colors duration-300`}>
                D
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">ダッシュボード</h1>
                <p className="text-[11px] text-slate-400 font-medium mt-1">ポートフォリオ ＆ 見積もりフォーム管理</p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <Link
                href="/"
                className="px-2.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                TOP
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between md:justify-end gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* クイックステータス切替 */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => handleQuickStatusChange('available')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  status === 'available' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🟢 即対応可
              </button>
              <button
                type="button"
                onClick={() => handleQuickStatusChange('busy')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  status === 'busy' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🟡 相談受付中
              </button>
              <button
                type="button"
                onClick={() => handleQuickStatusChange('stopped')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  status === 'stopped' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🔴 受注停止
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {user && (
                <Link
                  href={`/${user.id}`}
                  target="_blank"
                  className={`px-3 py-1.5 text-xs font-bold ${currentThemeObj.text} ${currentThemeObj.lightBg} hover:opacity-80 rounded-xl transition-all flex items-center gap-1 border ${currentThemeObj.border}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  サイトを見る
                </Link>
              )}

              <Link
                href="/"
                className="hidden md:flex px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all items-center gap-1"
              >
                サービスTOPへ
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* クイックアクションバー */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className={`w-10 h-10 rounded-2xl ${currentThemeObj.lightBg} ${currentThemeObj.text} flex items-center justify-center font-bold text-lg shrink-0`}>
              🔗
            </div>
            <div>
              <h2 className="text-xs font-extrabold text-slate-900">ポートフォリオ / 見積もりリンクの共有</h2>
              <p className="text-[11px] text-slate-400">SNS投稿や名刺・イベント等に記載するリンクをワンタップで取得</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => handleCopy(currentPortfolioUrl, 'portfolio')}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
            >
              {copiedType === 'portfolio' ? '✓ コピーしました' : 'ポートフォリオURLをコピー'}
            </button>
            <button
              type="button"
              onClick={() => setQrModalOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QRコード出力
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex p-1 bg-slate-200/60 rounded-2xl max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
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

        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 space-y-8 shadow-xs">
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

            {/* テーマカラー設定 */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>🎨 テーマカラー・デザイン設定</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">公開ページのメインアクセントカラーを選択します</p>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {THEME_COLORS.map((theme) => {
                  const isSelected = themeColor === theme.id
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeColor(theme.id)}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? `bg-white border-slate-400 ${theme.text} ring-2 ${theme.ring} shadow-xs`
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${theme.bg}`} />
                      {theme.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* スケジューラー設定 */}
            <div className="p-5 rounded-2xl bg-indigo-50/40 border border-indigo-100/80 space-y-4">
              <div>
                <h3 className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                  <span>📅 制作スケジューラー ＆ 稼働状況設定</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">着手可能時期や現在抱えている案件の枠数を公開できます</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">着手可能時期の表示テキスト</label>
                  <input
                    type="text"
                    placeholder="例: 10月上旬〜 / 即日着手可能"
                    value={availableFromText}
                    onChange={(e) => setAvailableFromText(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700">キャパシティゲージ（受任状況）</label>
                    <span className="text-xs font-extrabold text-indigo-600">
                      現在 {activeProjectsCount} / {maxProjectsCapacity} 件
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">進行中:</span>
                      <input
                        type="number"
                        min="0"
                        value={activeProjectsCount}
                        onChange={(e) => setActiveProjectsCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold shrink-0">最大枠:</span>
                      <input
                        type="number"
                        min="1"
                        value={maxProjectsCapacity}
                        onChange={(e) => setMaxProjectsCapacity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full text-xs font-bold text-slate-800 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
                    isPublic ? currentThemeObj.bg : 'bg-slate-300'
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
                  onChange={(e) => setStatus(e.target.value as 'available' | 'busy' | 'stopped')}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="available">🟢 即対応可</option>
                  <option value="busy">🟡 相談受付中</option>
                  <option value="stopped">🔴 受注停止</option>
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
                    className={`w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold ${currentThemeObj.text}`}
                  />
                </div>
              </div>

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
                          className={`w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold ${currentThemeObj.text}`}
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

              <div className="space-y-4 sm:col-span-2 border-t border-slate-100 pt-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">制作条件・受託範囲の設定</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">依頼者とのミスマッチを防ぐための詳細条件です</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5 sm:col-span-2 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80">
                    <label className="text-xs font-bold text-slate-700 block">生成AIの使用方針</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        aiUsage === 'none' ? `${currentThemeObj.lightBg} ${currentThemeObj.border} ${currentThemeObj.text}` : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="aiUsage"
                          value="none"
                          checked={aiUsage === 'none'}
                          onChange={() => setAiUsage('none')}
                          className="sr-only"
                        />
                        <span>完全手描き (AI不使用)</span>
                      </label>
                      
                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        aiUsage === 'partial' ? `${currentThemeObj.lightBg} ${currentThemeObj.border} ${currentThemeObj.text}` : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="aiUsage"
                          value="partial"
                          checked={aiUsage === 'partial'}
                          onChange={() => setAiUsage('partial')}
                          className="sr-only"
                        />
                        <span>一部AI補助あり (背景等)</span>
                      </label>

                      <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        aiUsage === 'full' ? `${currentThemeObj.lightBg} ${currentThemeObj.border} ${currentThemeObj.text}` : 'bg-white border-slate-200 text-slate-600'
                      }`}>
                        <input
                          type="radio"
                          name="aiUsage"
                          value="full"
                          checked={aiUsage === 'full'}
                          onChange={() => setAiUsage('full')}
                          className="sr-only"
                        />
                        <span>AI生成・加筆メイン</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
                    <label className="text-xs font-bold text-slate-700">無料リテイク（修正）回数</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        placeholder="2"
                        value={freeRevisionCount}
                        onChange={(e) => setFreeRevisionCount(e.target.value)}
                        className="w-24 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <span className="text-xs font-bold text-slate-500">回まで無料対応</span>
                    </div>
                  </div>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">急ぎ・特急対応</span>
                      <span className="text-[10px] text-slate-400">短納期での相談（要相談/追加料金）</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={expressOptionAvailable}
                      onChange={(e) => setExpressOptionAvailable(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">著作権譲渡</span>
                      <span className="text-[10px] text-slate-400">相談または条件付きで対応可能</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={copyrightTransferAvailable}
                      onChange={(e) => setCopyrightTransferAvailable(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">自身の作品のAI学習</span>
                      <span className="text-[10px] text-slate-400">無断学習・追加学習を許可するか</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={aiLearningAllowed}
                      onChange={(e) => setAiLearningAllowed(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 cursor-pointer hover:bg-slate-100/50 transition-colors">
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">R-18（成人向け）対応</span>
                      <span className="text-[10px] text-slate-400">センシティブコンテンツの受託</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={r18Allowed}
                      onChange={(e) => setR18Allowed(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>
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
                              ? `${currentThemeObj.bg} border-transparent text-white shadow-xs`
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
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
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
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${currentThemeObj.lightBg} ${currentThemeObj.border} ${currentThemeObj.text} border text-xs font-bold`}
                        >
                          #{tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTaste(tag)}
                            className="hover:text-rose-600 opacity-60 hover:opacity-100 text-xs font-bold px-0.5 cursor-pointer"
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

            {/* Links & SNS Section */}
            <div className="border-t border-slate-100 pt-6 space-y-4">
              <div>
                <h3 className="font-bold text-slate-900 text-xs">連絡先・SNS / 外部リンク設定</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">プロフィールに掲載するSNSや各種サービスへのリンクを自由に追加できます</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <span>オリジナル見積書フォーム</span>
                      {externalEstimationUrl ? (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-700 rounded-md font-extrabold">
                          作成済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] bg-slate-200 text-slate-600 rounded-md font-extrabold">
                          未作成
                        </span>
                      )}
                    </label>
                    <Link
                      href="/form-builder"
                      className={`text-xs font-bold ${currentThemeObj.text} hover:underline flex items-center gap-1`}
                    >
                      <span>見積書を作成・編集する</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>

                  <input
                    type="url"
                    placeholder="https://...（見積書作成ページで自動生成されたURLまたは外部フォームURL）"
                    value={externalEstimationUrl}
                    onChange={(e) => setExternalEstimationUrl(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-slate-400">
                    ※ 自分で制作していない場合は「未作成」と表示されます。「見積書を作成・編集する」ボタンからフォームを作成してください。
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 block">SNS / 外部サービスリンク ({snsLinks.length}件)</label>
                    <button
                      type="button"
                      onClick={handleAddSnsLink}
                      className={`px-3 py-1.5 ${currentThemeObj.lightBg} ${currentThemeObj.text} font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1`}
                    >
                      ＋ リンクを追加
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {snsLinks.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <select
                          value={item.platform}
                          onChange={(e) => handleSnsLinkChange(item.id, 'platform', e.target.value)}
                          className="w-36 px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                          {SNS_PLATFORMS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>

                        <input
                          type="url"
                          placeholder="https://..."
                          value={item.url}
                          onChange={(e) => handleSnsLinkChange(item.id, 'url', e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono text-[11px]"
                        />

                        <button
                          type="button"
                          onClick={() => handleRemoveSnsLink(item.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer text-xs font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {snsLinks.length === 0 && (
                      <p className="text-xs text-slate-300 italic py-1">SNSリンクが追加されていません</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || uploadingAvatar}
              className={`w-full py-3.5 ${currentThemeObj.bg} hover:opacity-90 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50`}
            >
              {saving ? '保存中...' : 'プロフィール情報を保存'}
            </button>
          </form>
        )}

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
                        <span className={`text-[10px] ${currentThemeObj.lightBg} ${currentThemeObj.text} px-2 py-0.5 rounded-md font-extrabold`}>
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
                      <div className={`flex flex-col items-center gap-2 text-xs font-bold ${currentThemeObj.text}`}>
                        <div className={`w-6 h-6 border-2 ${currentThemeObj.text} border-t-transparent rounded-full animate-spin`}></div>
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
              className={`w-full py-3.5 ${currentThemeObj.bg} hover:opacity-90 active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs transition-all duration-200 shadow-md cursor-pointer disabled:opacity-50`}
            >
              {saving ? '保存中...' : '作品ポートフォリオを保存'}
            </button>
          </form>
        )}
      </main>

      {/* QRコード出力 モーダル */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl text-center border border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">埋め込み用 QRコード</h3>
              <p className="text-xs text-slate-400 mt-1">イベント名刺やチラシ等にご使用いただけます</p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentPortfolioUrl)}`}
                alt="QR Code"
                className="w-48 h-48 rounded-lg shadow-xs"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-3 truncate max-w-full px-2">
                {currentPortfolioUrl}
              </span>
            </div>

            <div className="flex gap-2">
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(currentPortfolioUrl)}`}
                download="portfolio_qr.png"
                target="_blank"
                rel="noreferrer"
                className={`flex-1 py-2.5 ${currentThemeObj.bg} hover:opacity-90 text-white font-extrabold rounded-xl text-xs transition-all shadow-xs`}
              >
                画像をダウンロード
              </a>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}