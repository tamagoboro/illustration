'use client'

import { useState, useEffect, useMemo, useRef, ChangeEvent, FormEvent, KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { ItemDiscountConfig, toDateInputValue, fromDateInputValue } from '@/lib/discount'
import NotificationBell from '@/components/NotificationBell'
import { backgroundImageStyle } from '@/lib/background'

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
  { id: 'email', label: '📧 メール (Gmail等)' },
  { id: 'goods', label: '🛒 グッズ販売ページ (BOOTH等)' },
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
  discount?: ItemDiscountConfig
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

// 公開URLから「portfolios」バケット内のパスだけを取り出す（storage.remove()に渡すため）。
// アバター/作品画像を差し替えるたびに古いファイルがストレージに残り続けるのを防ぐのに使う。
const extractStoragePath = (url: string): string | null => {
  if (!url) return null
  const marker = '/storage/v1/object/public/portfolios/'
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const path = url.slice(idx + marker.length).split('?')[0]
  return path || null
}

export default function Dashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'pricing' | 'contact' | 'portfolio'>('basic')
  const [user, setUser] = useState<User | null>(null)

  // アクセス解析（PV・見積もり問い合わせ・お気に入り）
  const [analytics, setAnalytics] = useState<{
    pvThisWeek: number
    pvPrevWeek: number
    pvDaily: { date: string; count: number }[]
    inquiryThisMonth: number
    newFavoritesThisWeek: number
  } | null>(null)

  // 未保存変更の管理フラグ
  const [isDirty, setIsDirty] = useState(false)

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

  // キャンペーン割引（期間限定・一律）
  const [campaignEnabled, setCampaignEnabled] = useState(false)
  const [campaignLabel, setCampaignLabel] = useState('')
  const [campaignDiscountType, setCampaignDiscountType] = useState<'percent' | 'fixed'>('percent')
  const [campaignDiscountValue, setCampaignDiscountValue] = useState('10')
  const [campaignStartDate, setCampaignStartDate] = useState('')
  const [campaignEndDate, setCampaignEndDate] = useState('')

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
  const [acceptsDirectRequests, setAcceptsDirectRequests] = useState(true)

  const [externalEstimationUrl, setExternalEstimationUrl] = useState('')
  const [hasEstimateForm, setHasEstimateForm] = useState(false)
  const [equippedRingId, setEquippedRingId] = useState<string | null>(null)

  const [snsLinks, setSnsLinks] = useState<SnsLinkItem[]>([
    { id: '1', platform: 'twitter', url: '' },
    { id: '2', platform: 'instagram', url: '' }
  ])

  const [portfolioUrls, setPortfolioUrls] = useState<string[]>(['', '', '', ''])
  const [portfolioTitles, setPortfolioTitles] = useState<string[]>(['', '', '', ''])

  // DBに実際に保存されている（＝公開中の）URLを覚えておき、保存が成功した後にだけ
  // 「もう使われなくなった古いファイル」をストレージから削除するために使う。
  // 保存前（isDirtyな状態）に削除してしまうと、保存せずに離脱した場合に
  // 公開中の画像を消してしまう事故になるため、必ず保存成功後にのみ比較・削除する。
  const savedAvatarUrlRef = useRef('')
  const savedPortfolioUrlsRef = useRef<string[]>(['', '', '', ''])

  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { title: 'アイコン制作', price: 5000 },
    { title: 'ヘッダー制作', price: 8000 }
  ])
  const [expandedDiscountRows, setExpandedDiscountRows] = useState<Set<number>>(new Set())

  // 離脱防止アラート
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // タブ切り替え時の確認ダイアログ
  const handleTabChange = (targetTab: 'basic' | 'pricing' | 'contact' | 'portfolio') => {
    if (activeTab === targetTab) return

    if (isDirty) {
      const confirmLeave = window.confirm(
        '保存されていない変更があります。保存せずに別のタブへ移動しますか？\n（※移動しても入力内容は保持されますが、保存はされません）'
      )
      if (!confirmLeave) return
    }

    setActiveTab(targetTab)
  }

  useEffect(() => {
    const checkUserAndFetchData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) {
          console.error('認証情報取得エラー:', authError)
        }
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
                price: typeof item.price === 'number' ? item.price : (item.price === '' ? '' : safeParseInt(item.price) ?? ''),
                discount: item.discount && item.discount.mode ? item.discount : { mode: 'inherit' },
              }))
            )
          }

          setCampaignEnabled(profileData.campaign_enabled ?? false)
          setCampaignLabel(profileData.campaign_label || '')
          setCampaignDiscountType(profileData.campaign_discount_type || 'percent')
          setCampaignDiscountValue(
            profileData.campaign_discount_value !== null && profileData.campaign_discount_value !== undefined
              ? String(profileData.campaign_discount_value)
              : '10'
          )
          setCampaignStartDate(toDateInputValue(profileData.campaign_start_at))
          setCampaignEndDate(toDateInputValue(profileData.campaign_end_at))

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
          savedAvatarUrlRef.current = normalizeStorageUrl(profileData.avatar_url || '')
          setExternalEstimationUrl(profileData.external_estimation_url || '')

          setAiUsage(profileData.ai_usage || 'none')
          setAiLearningAllowed(profileData.ai_learning_allowed ?? false)
          setExpressOptionAvailable(profileData.express_option_available ?? false)
          setAcceptsDirectRequests(profileData.accepts_direct_requests ?? true)
          setCopyrightTransferAvailable(profileData.copyright_transfer_available ?? false)
          const parsedFreeRevision = safeParseInt(profileData.free_revision_count)
          setFreeRevisionCount(parsedFreeRevision !== null ? String(parsedFreeRevision) : '2')
          setR18Allowed(profileData.r18_allowed ?? false)

          if (profileData.available_from_text) setAvailableFromText(profileData.available_from_text)
          if (typeof profileData.active_projects_count === 'number') setActiveProjectsCount(profileData.active_projects_count)
          if (typeof profileData.max_projects_capacity === 'number') setMaxProjectsCapacity(profileData.max_projects_capacity)
        }

        // 「オリジナル見積書フォーム」の作成済み判定はform-builderで作った実際のフォーム(estimate_forms)を見る。
        // 以前はprofiles.external_estimation_url(外部リンク用の別項目)だけを見ていたため、
        // form-builderでフォームを作成済みでも「未作成」と表示される不具合があった。
        // アイコンリングの装着状況とは互いに独立しているので並行取得する。
        const [estimateFormRes, ringRes] = await Promise.all([
          supabase.from('estimate_forms').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('user_points').select('equipped_ring_id').eq('user_id', user.id).maybeSingle(),
        ])

        if (estimateFormRes.error) {
          console.error('見積もりフォーム件数取得エラー:', estimateFormRes.error)
        } else {
          setHasEstimateForm((estimateFormRes.count || 0) > 0)
        }

        if (ringRes.error) {
          console.error('アイコンリング装着状況取得エラー:', ringRes.error)
        } else {
          setEquippedRingId(ringRes.data?.equipped_ring_id || null)
        }

        const { data: portfolioData, error: portfolioError } = await supabase
          .from('portfolio_items')
          .select('image_url, sort_order, title')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true })

        if (portfolioError) {
          console.error('ポートフォリオ取得エラー:', portfolioError)
        }

        if (portfolioData && portfolioData.length > 0) {
          const urls = ['', '', '', '']
          const titles = ['', '', '', '']
          portfolioData.forEach((item) => {
            if (item.sort_order < 4) {
              urls[item.sort_order] = normalizeStorageUrl(item.image_url || '')
              titles[item.sort_order] = item.title || ''
            }
          })
          setPortfolioUrls(urls)
          setPortfolioTitles(titles)
          savedPortfolioUrlsRef.current = urls
        }

        setIsDirty(false)
      } catch (error: any) {
        console.error('データ読み込みエラー:', error)
        alert('データの読み込みに失敗しました。通信環境をご確認の上、ページを再読み込みしてください。')
      } finally {
        setLoading(false)
      }
    }

    checkUserAndFetchData()
  }, [router])

  // アクセス解析の集計（analytics_logsには元々PV・見積もり利用・お気に入りの
  // イベントが記録されているが、これまでダッシュボードのどこにも表示していなかった）
  useEffect(() => {
    if (!user) return

    const loadAnalytics = async () => {
      const DAY = 24 * 60 * 60 * 1000
      const since = new Date(Date.now() - 30 * DAY)

      const { data, error } = await supabase
        .from('analytics_logs')
        .select('event_type, created_at')
        .eq('creator_id', user.id)
        .gte('created_at', since.toISOString())

      if (error || !data) {
        console.error('アクセス解析の取得エラー:', error)
        return
      }

      const now = Date.now()
      const dailyPvMap: Record<string, number> = {}
      let pvThisWeek = 0
      let pvPrevWeek = 0
      let inquiryThisMonth = 0
      let newFavoritesThisWeek = 0

      data.forEach((row: { event_type: string; created_at: string }) => {
        const daysAgo = (now - new Date(row.created_at).getTime()) / DAY

        if (row.event_type === 'pv') {
          const dateKey = row.created_at.slice(0, 10)
          dailyPvMap[dateKey] = (dailyPvMap[dateKey] || 0) + 1
          if (daysAgo <= 7) pvThisWeek++
          else if (daysAgo <= 14) pvPrevWeek++
        } else if (row.event_type === 'estimate_calc') {
          if (daysAgo <= 30) inquiryThisMonth++
        } else if (row.event_type === 'favorite') {
          if (daysAgo <= 7) newFavoritesThisWeek++
        }
      })

      const pvDaily: { date: string; count: number }[] = []
      for (let i = 13; i >= 0; i--) {
        const key = new Date(now - i * DAY).toISOString().slice(0, 10)
        pvDaily.push({ date: key, count: dailyPvMap[key] || 0 })
      }

      setAnalytics({ pvThisWeek, pvPrevWeek, pvDaily, inquiryThisMonth, newFavoritesThisWeek })
    }

    loadAnalytics()
  }, [user])

  const handleAddSnsLink = () => {
    setIsDirty(true)
    const newLink: SnsLinkItem = {
      id: Date.now().toString(),
      platform: 'twitter',
      url: ''
    }
    setSnsLinks((prev) => [...prev, newLink])
  }

  const handleRemoveSnsLink = (id: string) => {
    setIsDirty(true)
    setSnsLinks((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSnsLinkChange = (id: string, key: 'platform' | 'url', value: string) => {
    setIsDirty(true)
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
    const previousStatus = status
    setStatus(newStatus)
    if (!user) return

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)

      if (error) throw error

      showSuccessToast('ステータスを更新しました！')
    } catch (error: any) {
      console.error('ステータス更新エラー:', error)
      setStatus(previousStatus)
      alert('ステータスの更新に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
    }
  }

  const handleAddMenuItem = () => {
    setIsDirty(true)
    setMenuItems((prev) => [...prev, { title: '', price: '', discount: { mode: 'inherit' } }])
  }

  const handleRemoveMenuItem = (index: number) => {
    setIsDirty(true)
    setMenuItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleMenuItemDiscountChange = (index: number, discount: ItemDiscountConfig) => {
    setIsDirty(true)
    setMenuItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, discount } : item)))
  }

  const toggleMenuItemDiscountRow = (index: number) => {
    setExpandedDiscountRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleMenuItemChange = (index: number, key: keyof MenuItem, value: any) => {
    setIsDirty(true)
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
    setIsDirty(true)
    setTastes((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleAddCustomTaste = () => {
    const trimmed = customTasteInput.trim()
    if (!trimmed) return
    setIsDirty(true)
    if (!tastes.includes(trimmed)) {
      setTastes((prev) => [...prev, trimmed])
    }
    setCustomTasteInput('')
  }

  const handleRemoveTaste = (tagToRemove: string) => {
    setIsDirty(true)
    setTastes((prev) => prev.filter((t) => t !== tagToRemove))
  }

  // 作品画像の順序変更（前後の入れ替え）機能
  const handleMovePortfolioUrl = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= portfolioUrls.length) return

    const newUrls = [...portfolioUrls]
    const temp = newUrls[index]
    newUrls[index] = newUrls[targetIndex]
    newUrls[targetIndex] = temp

    const newTitles = [...portfolioTitles]
    const tempTitle = newTitles[index]
    newTitles[index] = newTitles[targetIndex]
    newTitles[targetIndex] = tempTitle

    setPortfolioUrls(newUrls)
    setPortfolioTitles(newTitles)
    setIsDirty(true)
  }

  // ファイル検証付き画像圧縮関数
  const validateAndCompressImage = (
    file: File, 
    index: number | 'avatar', 
    maxWidth = 1200, 
    quality = 0.8
  ): Promise<{ blob: Blob; mimeType: string; extension: string }> => {
    return new Promise((resolve, reject) => {
      // ファイルサイズの事前検証 (最大10MB)
      if (file.size > 10 * 1024 * 1024) {
        return reject(new Error('ファイルサイズが大きすぎます (10MB以下の画像を選択してください)'))
      }

      // ファイル形式の検証
      if (!file.type.startsWith('image/')) {
        return reject(new Error('画像ファイルを選択してください'))
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
            else reject(new Error('画像圧縮に失敗しました'))
          },
          mimeType,
          quality
        )
      }
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl)
        reject(new Error('画像の読み込みに失敗しました。正しい画像形式かご確認ください。'))
      }
      img.src = objectUrl
    })
  }

  const handleAvatarFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    let compressed
    try {
      compressed = await validateAndCompressImage(file, 'avatar', 600, 0.85)
    } catch (error: any) {
      // ここでのエラーは事前のファイル検証によるもので、原因と対処法がすでに文章になっている
      alert(error.message || '画像の読み込みに失敗しました。別の画像でもう一度お試しください。')
      return
    }

    try {
      setUploadingAvatar(true)
      const fileName = `${user.id}/avatar_${Date.now()}.${compressed.extension}`

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, compressed.blob, {
          contentType: compressed.mimeType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('portfolios')
        .getPublicUrl(fileName)

      setAvatarUrl(normalizeStorageUrl(publicUrlData.publicUrl))
      setIsDirty(true)
    } catch (error: any) {
      console.error('アイコンアップロードエラー:', error)
      alert(
        'アイコンのアップロードに失敗しました。時間をおいて再度お試しください。改善しない場合は、ブラウザの開発者ツール（F12）のConsoleタブに表示されるエラー内容を運営にお知らせください。'
      )
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    let compressed
    try {
      compressed = await validateAndCompressImage(file, index, 1200, 0.8)
    } catch (error: any) {
      // ここでのエラーは事前のファイル検証によるもので、原因と対処法がすでに文章になっている
      alert(error.message || '画像の読み込みに失敗しました。別の画像でもう一度お試しください。')
      return
    }

    try {
      setUploadingIndex(index)
      const fileName = `${user.id}/${Date.now()}_${index}.${compressed.extension}`

      const { error: uploadError } = await supabase.storage
        .from('portfolios')
        .upload(fileName, compressed.blob, {
          contentType: compressed.mimeType,
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('portfolios')
        .getPublicUrl(fileName)

      const nextUrls = [...portfolioUrls]
      nextUrls[index] = normalizeStorageUrl(publicUrlData.publicUrl)
      setPortfolioUrls(nextUrls)
      setIsDirty(true)
    } catch (error: any) {
      console.error('作品画像アップロードエラー:', error)
      alert(
        '画像のアップロードに失敗しました。時間をおいて再度お試しください。改善しない場合は、ブラウザの開発者ツール（F12）のConsoleタブに表示されるエラー内容を運営にお知らせください。'
      )
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

    try {
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
          price: typeof item.price === 'number' ? item.price : '',
          discount: item.discount || { mode: 'inherit' },
        }))

      const finalCampaignDiscountValue = cleanInteger(campaignDiscountValue)

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
        accepts_direct_requests: Boolean(acceptsDirectRequests),
        copyright_transfer_available: Boolean(copyrightTransferAvailable),
        free_revision_count: finalFreeRevisionCount,
        r18_allowed: Boolean(r18Allowed),
        available_from_text: availableFromText,
        active_projects_count: activeProjectsCount,
        max_projects_capacity: maxProjectsCapacity,
        campaign_enabled: Boolean(campaignEnabled),
        campaign_label: campaignLabel.trim() || null,
        campaign_discount_type: campaignDiscountType,
        campaign_discount_value: finalCampaignDiscountValue,
        campaign_start_at: fromDateInputValue(campaignStartDate, false),
        campaign_end_at: fromDateInputValue(campaignEndDate, true),
        // ダッシュボードで一度でも保存したら「クリエイター」として扱う
        // （is_publicとは別軸。一覧非公開のままでもクリエイター向け導線は出す）
        has_dashboard_setup: true,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'user_id' })

      if (error) {
        console.error('保存エラー詳細:', JSON.stringify(error, null, 2))
        alert('保存に失敗しました。通信環境をご確認のうえ、もう一度お試しください。入力内容は消えていませんので、そのまま再度保存ボタンを押してみてください。')
      } else {
        // 保存が成功し、アイコン画像が差し替えられた場合だけ、もう使われなくなった
        // 古い画像ファイルをストレージから削除する（保存前に消すと事故になるためここで行う）
        const newAvatarUrl = profilePayload.avatar_url || ''
        const oldAvatarUrl = savedAvatarUrlRef.current
        if (oldAvatarUrl && oldAvatarUrl !== newAvatarUrl) {
          const oldPath = extractStoragePath(oldAvatarUrl)
          if (oldPath) {
            supabase.storage
              .from('portfolios')
              .remove([oldPath])
              .catch((e) => console.error('古いアイコン画像の削除エラー:', e))
          }
        }
        savedAvatarUrlRef.current = newAvatarUrl

        showSuccessToast('プロフィール情報を更新しました！')
        setIsDirty(false)
      }
    } catch (error: any) {
      console.error('プロフィール保存中に予期しないエラーが発生しました:', error)
      alert('保存に失敗しました。通信環境をご確認の上、もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const handleSavePortfolio = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)

    try {
      // 保存前の登録件数を見ておき、「0件→1件以上」に変わった瞬間だけ
      // 「一覧に表示されるようになりました」の通知を送る
      const { count: previousCount } = await supabase
        .from('portfolio_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { error: deleteError } = await supabase
        .from('portfolio_items')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        throw deleteError
      }

      const itemsToInsert = portfolioUrls
        .map((url, idx) => ({
          user_id: user.id,
          image_url: normalizeStorageUrl(url),
          sort_order: idx,
          title: portfolioTitles[idx]?.trim() || null,
        }))
        .filter((item) => item.image_url.length > 0)

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('portfolio_items')
          .insert(itemsToInsert)

        if (insertError) {
          throw insertError
        }
      }

      if ((previousCount || 0) === 0 && itemsToInsert.length > 0) {
        try {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'portfolio_first_upload',
            title: '🎉 プロフィールが一覧に表示されるようになりました！',
            body: '作品が登録されたので、トップページや検索結果にプロフィールが表示されるようになります。',
            link_url: `/creator/${user.id}`,
          })
        } catch (notifyError) {
          console.error('通知作成エラー:', notifyError)
        }
      }

      // 保存が成功した枠だけ、差し替えで使われなくなった古い画像ファイルを削除する
      // （保存前に消すと、保存せず離脱した場合に公開中の画像を消してしまうためここで行う）
      const newNormalizedUrls = portfolioUrls.map((url) => normalizeStorageUrl(url))
      const oldUrls = savedPortfolioUrlsRef.current
      const pathsToRemove = oldUrls
        .map((oldUrl, idx) => (oldUrl && oldUrl !== newNormalizedUrls[idx] ? extractStoragePath(oldUrl) : null))
        .filter((path): path is string => !!path)
      if (pathsToRemove.length > 0) {
        supabase.storage
          .from('portfolios')
          .remove(pathsToRemove)
          .catch((e) => console.error('古い作品画像の削除エラー:', e))
      }
      savedPortfolioUrlsRef.current = newNormalizedUrls

      showSuccessToast('作品ポートフォリオを更新しました！')
      setIsDirty(false)
    } catch (error: any) {
      console.error('ポートフォリオ保存エラー:', error)
      alert(
        '作品情報の更新に失敗しました。時間をおいて再度お試しください。改善しない場合は、ブラウザの開発者ツール（F12）のConsoleタブに表示されるエラー内容を運営にお知らせください。'
      )
    } finally {
      setSaving(false)
    }
  }

  // プロフィール完成度チェックリスト。既存項目を見るだけで計算できるので新規テーブルは不要。
  const profileChecklist = useMemo(() => {
    const items: { label: string; done: boolean; tab: 'basic' | 'pricing' | 'contact' | 'portfolio' }[] = [
      { label: 'アイコン画像を設定する', done: avatarUrl.trim() !== '', tab: 'basic' },
      { label: '自己紹介コメントを書く', done: statusComment.trim() !== '', tab: 'basic' },
      { label: '得意なタグを1つ以上設定する', done: tastes.length > 0, tab: 'contact' },
      {
        label: '料金メニューを1つ以上設定する',
        done: menuItems.some((item) => item.title.trim() !== '' && item.price !== ''),
        tab: 'pricing',
      },
      { label: '参考最低価格を設定する', done: priceMin.trim() !== '' && Number(priceMin) > 0, tab: 'pricing' },
      { label: '目安納期を設定する', done: leadTimeDays.trim() !== '' && Number(leadTimeDays) > 0, tab: 'pricing' },
      { label: 'SNS・連絡先リンクを1つ以上設定する', done: snsLinks.some((link) => link.url.trim() !== ''), tab: 'contact' },
      { label: '作品を1つ以上掲載する', done: portfolioUrls.some((url) => url.trim() !== ''), tab: 'portfolio' },
      { label: '見積もりフォームを作成する', done: hasEstimateForm, tab: 'contact' },
    ]
    const doneCount = items.filter((i) => i.done).length
    const percent = Math.round((doneCount / items.length) * 100)
    return { items, percent }
  }, [avatarUrl, statusComment, tastes, menuItems, priceMin, leadTimeDays, snsLinks, portfolioUrls, hasEstimateForm])

  const handleLogout = async () => {
    if (isDirty) {
      const confirmLogout = window.confirm(
        'まだ保存されていない変更があります。このままログアウトすると変更内容は失われてしまいます。破棄してログアウトしてもよろしいですか？'
      )
      if (!confirmLogout) return
    }

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      router.push('/')
    } catch (error: any) {
      console.error('ログアウトエラー:', error)
      alert('ログアウトに失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
    }
  }

  const currentPortfolioUrl = typeof window !== 'undefined' && user ? `${window.location.origin}/creator/${user.id}` : ''
  const currentThemeObj = THEME_COLORS.find((t) => t.id === themeColor) || THEME_COLORS[0]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-cover bg-center" style={backgroundImageStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
        <div className="flex flex-col items-center gap-3 bg-white/80 backdrop-blur-md rounded-3xl px-8 py-6 shadow-lg">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-600 tracking-wider">設定データを読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-slate-800 pb-24 font-sans antialiased selection:bg-indigo-500 selection:text-white relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
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
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-slate-900 leading-none">ダッシュボード</h1>
                  {isDirty && (
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-md text-[10px] font-extrabold animate-pulse">
                      ⚠️ 未保存の変更あり
                    </span>
                  )}
                </div>
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
              <NotificationBell />
              {user && (
                <Link
                  href={`/creator/${user.id}`}
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

        {/* 作品未登録の警告：ポートフォリオが1枚も無いと検索・一覧に表示されない */}
        {portfolioUrls.every((url) => !url.trim()) && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-xs font-extrabold text-amber-800">作品が1枚も登録されていません</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  作品を1枚も登録していないクリエイターは、トップページや検索結果に表示されません。「作品」タブから1枚以上アップロードしてください。
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleTabChange('portfolio')}
              className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              作品を登録する
            </button>
          </div>
        )}

        {/* プロフィール完成度 */}
        {profileChecklist.percent < 100 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                📋 プロフィール完成度
              </h2>
              <span className={`text-sm font-black ${currentThemeObj.text}`}>
                {profileChecklist.percent}%
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${currentThemeObj.bg} transition-all duration-500`}
                style={{ width: `${profileChecklist.percent}%` }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {profileChecklist.items
                .filter((item) => !item.done)
                .map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleTabChange(item.tab)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                  >
                    ○ {item.label}
                  </button>
                ))}
            </div>
            <p className="text-[10px] text-slate-400">
              項目をクリックすると該当のタブに移動します。埋まっているほど依頼者の目に留まりやすくなります。
            </p>
          </div>
        )}

        {/* アイコンリング未装着の案内 */}
        {!equippedRingId && (
          <div className="bg-gradient-to-r from-fuchsia-50 to-sky-50 rounded-3xl border border-fuchsia-100 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎀</span>
              <div>
                <p className="text-xs font-extrabold text-slate-900">アイコンリングを設定してみませんか？</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  まだリングを装着していません。ポイントで手に入れたリングをアイコンの周りに飾って、プロフィールを目立たせましょう。
                </p>
              </div>
            </div>
            <Link
              href="/rewards"
              className="shrink-0 px-4 py-2 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              リングショップを見る
            </Link>
          </div>
        )}

        {/* アクセス解析（PV・問い合わせ・お気に入り） */}
        {analytics && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                📊 アクセス解析
              </h2>
              <p className="text-[11px] text-slate-400">直近のプロフィール閲覧・見積もり問い合わせ・お気に入りの動きです</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block">今週の閲覧数（PV）</span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-xl font-black text-slate-900">{analytics.pvThisWeek}</span>
                  {analytics.pvPrevWeek > 0 && (
                    <span
                      className={`text-[10px] font-bold ${
                        analytics.pvThisWeek >= analytics.pvPrevWeek ? 'text-emerald-600' : 'text-rose-500'
                      }`}
                    >
                      {analytics.pvThisWeek >= analytics.pvPrevWeek ? '▲' : '▼'}
                      {Math.abs(Math.round(((analytics.pvThisWeek - analytics.pvPrevWeek) / analytics.pvPrevWeek) * 100))}
                      %（先週比）
                    </span>
                  )}
                </div>
                <div className="flex items-end gap-0.5 h-8 mt-2">
                  {analytics.pvDaily.map((d) => {
                    const max = Math.max(1, ...analytics.pvDaily.map((x) => x.count))
                    return (
                      <div
                        key={d.date}
                        title={`${d.date}: ${d.count}件`}
                        className="flex-1 bg-indigo-200 rounded-sm"
                        style={{ height: `${Math.max(6, (d.count / max) * 100)}%` }}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block">今月の見積もり問い合わせ数</span>
                <span className="text-xl font-black text-slate-900 block mt-0.5">{analytics.inquiryThisMonth}</span>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  見積もりフォームで金額を確認し、依頼内容をコピーして送った回数です
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 block">今週の新規お気に入り</span>
                <span className="text-xl font-black text-slate-900 block mt-0.5">+{analytics.newFavoritesThisWeek}</span>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  累計のお気に入り数はプロフィールカードのハートマークをご確認ください
                </p>
              </div>
            </div>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="flex p-1 bg-slate-200/60 rounded-2xl max-w-2xl mx-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('basic')}
            className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'basic'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            基本情報
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('pricing')}
            className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
            料金・条件
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('contact')}
            className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'contact'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
            タグ・SNS
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('portfolio')}
            className={`flex-1 py-2.5 px-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'portfolio'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            作品ギャラリー
          </button>
        </div>

        {activeTab !== 'portfolio' && (
          <form
            onSubmit={handleSaveProfile}
            onChange={() => setIsDirty(true)}
            className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 space-y-8 shadow-xs"
          >
            {activeTab === 'basic' && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-extrabold text-slate-900 text-base">基本情報の設定</h2>
                    <p className="text-xs text-slate-400 mt-1">公開プロフィールに反映される基本情報です</p>
                  </div>
                  {avatarUrl && (
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shadow-xs shrink-0">
                      <img src={avatarUrl} alt="アバタープレビュー" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* テーマカラー選択UI */}
                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 space-y-3">
                  <label className="text-xs font-bold text-slate-700 block">テーマカラー設定</label>
                  <div className="flex flex-wrap gap-2.5">
                    {THEME_COLORS.map((t) => {
                      const isSelected = themeColor === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setThemeColor(t.id)
                            setIsDirty(true)
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? `${t.lightBg} ${t.border} ${t.text} ring-2 ${t.ring}`
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${t.bg}`} />
                          {t.name}
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
                      onClick={() => {
                        setIsPublic(!isPublic)
                        setIsDirty(true)
                      }}
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

                <div className="space-y-1.5">
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

                <div className="space-y-3 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/40">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 block">プロフィールアイコン画像</label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarUrl('')
                          setIsDirty(true)
                        }}
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
                        onChange={(e) => {
                          setAvatarUrl(e.target.value)
                          setIsDirty(true)
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">現在の受付ステータス</span>
                    <span className="text-[11px] text-slate-400">ページ上部のクイック切替ボタンで変更できます（押すとすぐ公開に反映されます）</span>
                  </div>
                  <span className={`text-xs font-extrabold px-3 py-1.5 rounded-xl border shrink-0 ${
                    status === 'available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : status === 'stopped'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {status === 'available' ? '🟢 即対応可' : status === 'stopped' ? '🔴 受注停止' : '🟡 相談受付中'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">自己紹介・PRコメント</label>
                  <textarea
                    rows={4}
                    placeholder="作風や得意なジャンル、実績などのアピール文を入力してください"
                    value={statusComment}
                    onChange={(e) => setStatusComment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all leading-relaxed font-medium"
                  />
                </div>
              </div>
            )}

            {activeTab === 'pricing' && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="font-extrabold text-slate-900 text-base">料金・受託条件の設定</h2>
                  <p className="text-xs text-slate-400 mt-1">依頼を検討する人が特に気にする金額・制作条件です</p>
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

                <div className="space-y-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/40">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={campaignEnabled}
                      onChange={(e) => {
                        setCampaignEnabled(e.target.checked)
                        setIsDirty(true)
                      }}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">🎉 期間限定キャンペーン割引を設定する</span>
                  </label>
                  <p className="text-[11px] text-slate-400 pl-7 -mt-2">
                    最低価格・料金メニュー・見積もりフォームに一律で適用されます（メニュー側で個別に上書き・対象外にすることも可能）
                  </p>

                  {campaignEnabled && (
                    <div className="pl-7 space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600">キャンペーン名（任意・表示用）</label>
                        <input
                          type="text"
                          placeholder="例: 秋の感謝祭"
                          value={campaignLabel}
                          onChange={(e) => { setCampaignLabel(e.target.value); setIsDirty(true) }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                        />
                      </div>

                      <div className="flex gap-2">
                        <select
                          value={campaignDiscountType}
                          onChange={(e) => { setCampaignDiscountType(e.target.value as 'percent' | 'fixed'); setIsDirty(true) }}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                        >
                          <option value="percent">％OFF</option>
                          <option value="fixed">円引き</option>
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={campaignDiscountValue}
                          onChange={(e) => { setCampaignDiscountValue(e.target.value); setIsDirty(true) }}
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">開始日</label>
                          <input
                            type="date"
                            value={campaignStartDate}
                            onChange={(e) => { setCampaignStartDate(e.target.value); setIsDirty(true) }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-600">終了日（空欄=無期限）</label>
                          <input
                            type="date"
                            value={campaignEndDate}
                            onChange={(e) => { setCampaignEndDate(e.target.value); setIsDirty(true) }}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}
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

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={commercialUseAllowed}
                    onChange={(e) => {
                      setCommercialUseAllowed(e.target.checked)
                      setIsDirty(true)
                    }}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">商用利用を可能として掲載する</span>
                </label>

                <div className="space-y-3 border-t border-slate-100 pt-6">
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

                  <div className="space-y-3">
                    {menuItems.map((item, idx) => {
                      const discount = item.discount || { mode: 'inherit' }
                      return (
                        <div key={idx} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/40 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="例: アイコン制作"
                              value={item.title}
                              onChange={(e) => handleMenuItemChange(idx, 'title', e.target.value)}
                              className="flex-2 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium bg-white"
                            />
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">¥</span>
                              <input
                                type="number"
                                step="500"
                                placeholder="5000"
                                value={item.price}
                                onChange={(e) => handleMenuItemChange(idx, 'price', e.target.value)}
                                className={`w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-bold bg-white ${currentThemeObj.text}`}
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

                          {discount.mode === 'inherit' && !expandedDiscountRows.has(idx) ? (
                            <button
                              type="button"
                              onClick={() => toggleMenuItemDiscountRow(idx)}
                              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-600 pl-1 cursor-pointer"
                            >
                              この項目だけ割引を変える
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 pl-1 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 shrink-0">このメニューの割引:</span>
                              <select
                                value={discount.mode}
                                onChange={(e) =>
                                  handleMenuItemDiscountChange(idx, { ...discount, mode: e.target.value as ItemDiscountConfig['mode'] })
                                }
                                className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] bg-white"
                              >
                                <option value="inherit">自動（キャンペーンに従う）</option>
                                <option value="custom">個別に指定</option>
                                <option value="exempt">割引対象外にする</option>
                              </select>

                              {discount.mode === 'custom' && (
                                <>
                                  <select
                                    value={discount.type || 'percent'}
                                    onChange={(e) =>
                                      handleMenuItemDiscountChange(idx, { ...discount, type: e.target.value as 'percent' | 'fixed' })
                                    }
                                    className="px-2 py-1 rounded-lg border border-slate-200 text-[11px] bg-white"
                                  >
                                    <option value="percent">％OFF</option>
                                    <option value="fixed">円引き</option>
                                  </select>
                                  <input
                                    type="number"
                                    min={0}
                                    value={discount.value ?? ''}
                                    onChange={(e) =>
                                      handleMenuItemDiscountChange(idx, { ...discount, value: Number(e.target.value) || 0 })
                                    }
                                    className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-[11px] font-bold"
                                  />
                                </>
                              )}

                              {discount.mode === 'inherit' && (
                                <button
                                  type="button"
                                  onClick={() => toggleMenuItemDiscountRow(idx)}
                                  className="text-[10px] font-bold text-slate-300 hover:text-slate-500 cursor-pointer"
                                >
                                  閉じる
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {menuItems.length === 0 && (
                      <p className="text-xs text-slate-300 italic py-1">メニューが設定されていません</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-100 pt-6">
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
                            onChange={() => {
                              setAiUsage('none')
                              setIsDirty(true)
                            }}
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
                            onChange={() => {
                              setAiUsage('partial')
                              setIsDirty(true)
                            }}
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
                            onChange={() => {
                              setAiUsage('full')
                              setIsDirty(true)
                            }}
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
                        onChange={(e) => {
                          setExpressOptionAvailable(e.target.checked)
                          setIsDirty(true)
                        }}
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
                        onChange={(e) => {
                          setCopyrightTransferAvailable(e.target.checked)
                          setIsDirty(true)
                        }}
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
                        onChange={(e) => {
                          setAiLearningAllowed(e.target.checked)
                          setIsDirty(true)
                        }}
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
                        onChange={(e) => {
                          setR18Allowed(e.target.checked)
                          setIsDirty(true)
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'contact' && (
              <div className="space-y-8">
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="font-extrabold text-slate-900 text-base">タグ・SNS・連絡先の設定</h2>
                  <p className="text-xs text-slate-400 mt-1">検索でのマッチ度と、依頼者からの連絡経路に関わる設定です</p>
                </div>

                <div className="space-y-4">
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
                          {hasEstimateForm ? (
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
                          href="/dashboard/form-builder"
                          className={`text-xs font-bold ${currentThemeObj.text} hover:underline flex items-center gap-1`}
                        >
                          <span>見積書を作成・編集する</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>

                      <p className="text-[10px] text-slate-400">
                        下の欄は任意です。Googleフォーム等、Drawker以外で作った見積もりフォームを使いたい場合だけ入力してください。
                      </p>
                      <input
                        type="url"
                        placeholder="https://...（Drawker以外の外部フォームを使う場合のみ入力）"
                        value={externalEstimationUrl}
                        onChange={(e) => {
                          setExternalEstimationUrl(e.target.value)
                          setIsDirty(true)
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-[11px]"
                      />
                    </div>

                    <div className="space-y-2 p-4 rounded-2xl bg-pink-50/40 border border-pink-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <span>📩 直接リクエストの受付</span>
                        </label>
                        <Link
                          href="/dashboard/requests"
                          className={`text-xs font-bold ${currentThemeObj.text} hover:underline flex items-center gap-1`}
                        >
                          <span>受け取ったリクエストを見る</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        オンにすると、プロフィールに「メニューに無い依頼をリクエストする」ボタンが表示され、依頼者から直接オファーを受け取れるようになります。
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={acceptsDirectRequests}
                          onChange={(e) => {
                            setAcceptsDirectRequests(e.target.checked)
                            setIsDirty(true)
                          }}
                          className="rounded border-slate-300 text-pink-500 accent-pink-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">
                          {acceptsDirectRequests ? '受付中' : '受け付けない'}
                        </span>
                      </label>
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
                              type={item.platform === 'email' ? 'email' : 'url'}
                              placeholder={item.platform === 'email' ? 'example@gmail.com' : 'https://...'}
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
              </div>
            )}

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
          <form 
            onSubmit={handleSavePortfolio} 
            onChange={() => setIsDirty(true)}
            className="bg-white rounded-3xl border border-slate-200/70 p-6 sm:p-8 space-y-8 shadow-xs"
          >
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

                    {/* 画像の順序移動および削除ボタン (新機能) */}
                    <div className="flex items-center gap-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMovePortfolioUrl(idx, 'up')}
                          className="text-[11px] text-slate-500 hover:text-slate-900 font-bold px-1.5 py-0.5 bg-slate-200/60 rounded cursor-pointer"
                          title="前に移動"
                        >
                          ← 前へ
                        </button>
                      )}
                      {idx < portfolioUrls.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMovePortfolioUrl(idx, 'down')}
                          className="text-[11px] text-slate-500 hover:text-slate-900 font-bold px-1.5 py-0.5 bg-slate-200/60 rounded cursor-pointer"
                          title="後に移動"
                        >
                          次へ →
                        </button>
                      )}
                      {url && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...portfolioUrls]
                            next[idx] = ''
                            setPortfolioUrls(next)
                            const nextTitles = [...portfolioTitles]
                            nextTitles[idx] = ''
                            setPortfolioTitles(nextTitles)
                            setIsDirty(true)
                          }}
                          className="text-[11px] text-rose-500 font-bold hover:underline cursor-pointer ml-1"
                        >
                          削除
                        </button>
                      )}
                    </div>
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
                        setIsDirty(true)
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-mono text-[11px]"
                    />

                    <input
                      type="text"
                      placeholder="作品タイトル（任意）"
                      value={portfolioTitles[idx] || ''}
                      onChange={(e) => {
                        const next = [...portfolioTitles]
                        next[idx] = e.target.value
                        setPortfolioTitles(next)
                        setIsDirty(true)
                      }}
                      maxLength={50}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 font-medium"
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