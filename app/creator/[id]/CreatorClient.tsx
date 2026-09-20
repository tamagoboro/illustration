'use client'

import { useState, useEffect, useMemo, CSSProperties, ChangeEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'
import { loadFavorites, toggleFavoriteRecord } from '@/lib/favorites'
import { convertToWebp } from '@/lib/imageUtils'
import AvatarRing from '@/components/AvatarRing'
import { ItemDiscountConfig, Campaign, isCampaignActive, resolveDiscount, applyDiscount, formatDiscountBadge, formatSavingsBadge } from '@/lib/discount'

type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
  discount?: ItemDiscountConfig
}

type Field = {
  id: string
  label: string
  type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'note' | 'faq' | 'color'
  required?: boolean
  price?: number
  noteText?: string
  faqAnswer?: string
  options?: Option[]
  discount?: ItemDiscountConfig
}

type FormConfig = {
  title?: string
  description?: string
  theme_color?: string
  fields: Field[]
}

// 見積もりフォームは複数持てる（estimate_forms テーブル）。
// 旧形式で1件だけ profiles.form_config に保存されている場合は、
// ここに合わせた形に変換して同じ扱いにする（後方互換）。
type EstimateFormRow = {
  id: string
  title: string
  description: string
  theme_color: string
  is_accepting: boolean
  fields: Field[]
  sort_order: number
}

type MenuItem = {
  title: string
  price: number | ''
  discount?: ItemDiscountConfig
}

type SnsLinkItem = {
  id: string
  platform: string
  url: string
}

// reviewer_id は auth.users のみを参照しており profiles を持たない一般ユーザーも
// 投稿できるため、表示名・アイコンはサーバー側で別途合成して渡してもらう
type ReviewRow = {
  id: string
  creator_id: string
  reviewer_id: string
  rating: number
  comment: string | null
  image_urls: string[] | null
  created_at: string
  reviewer_display_name: string | null
  reviewer_avatar_url: string | null
  reviewer_ring_id: string | null
}

const SNS_PLATFORM_LABELS: Record<string, string> = {
  twitter: '𝕏 (Twitter) DM',
  instagram: 'Instagram DM',
  pixiv: 'Pixiv メッセージ',
  youtube: 'YouTube',
  bluesky: 'Bluesky',
  skeb: 'Skeb',
  coconala: 'ココナラ',
  twitch: 'Twitch',
  website: '公式Webサイト',
  other: 'その他リンク',
}

type ExtendedProfile = Profile & {
  display_name?: string | null
  status?: 'available' | 'busy' | 'stopped' | string | null
  status_comment?: string | null
  tastes?: (string | { id?: string; name?: string })[] | null
  lead_time_days?: number | null
  price_min?: number | null
  commercial_use_allowed?: boolean | null
  avatar_url?: string | null
  external_estimation_url?: string | null
  twitter_url?: string | null
  instagram_url?: string | null
  pixiv_url?: string | null
  website_url?: string | null
  updated_at?: string | null
  is_public?: boolean | null
  likes_count?: number | null
  menu_items?: MenuItem[] | null
  ai_usage?: 'none' | 'partial' | 'full' | string | null
  ai_learning_allowed?: boolean | null
  express_option_available?: boolean | null
  copyright_transfer_available?: boolean | null
  free_revision_count?: number | null
  r18_allowed?: boolean | null
  form_config?: FormConfig | null
  active_projects_count?: number | null
  max_projects_capacity?: number | null
  available_from_text?: string | null
  theme_color?: string | null
  sns_links?: SnsLinkItem[] | null
  campaign_enabled?: boolean | null
  campaign_label?: string | null
  campaign_discount_type?: 'percent' | 'fixed' | null
  campaign_discount_value?: number | null
  campaign_start_at?: string | null
  campaign_end_at?: string | null
}

const formatExternalUrl = (url?: string | null) => {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// カラーコード (Hex / キーワード) を RGBA に変換する補助関数
const hexToRgba = (hex: string, alpha: number) => {
  if (!hex) return `rgba(31, 41, 55, ${alpha})`
  const h = hex.toLowerCase()
  if (h === 'indigo' || h === '#4f46e5') return `rgba(79, 70, 229, ${alpha})`
  if (h === 'rose' || h === '#f43f5e') return `rgba(244, 63, 94, ${alpha})`
  if (h === 'emerald' || h === '#10b981') return `rgba(16, 185, 129, ${alpha})`
  if (h === 'amber' || h === '#f59e0b') return `rgba(245, 158, 11, ${alpha})`
  if (h === 'dark' || h === '#0f172a') return `rgba(15, 23, 42, ${alpha})`

  let c = hex.replace('#', '')
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('')
  }
  const num = parseInt(c, 16)
  if (isNaN(num)) return `rgba(31, 41, 55, ${alpha})`
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`
}

export default function CreatorClient({
  id,
  initialProfile,
  initialWorks = [],
  initialForms = [],
  initialReviews = [],
  creatorRingId = null,
}: {
  id: string
  initialProfile?: ExtendedProfile | null
  initialWorks?: PortfolioItem[]
  initialForms?: EstimateFormRow[]
  initialReviews?: ReviewRow[]
  creatorRingId?: string | null
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<ExtendedProfile | null>(initialProfile || null)
  const [works, setWorks] = useState<PortfolioItem[]>(initialWorks)
  const [forms, setForms] = useState<EstimateFormRow[]>(initialForms)
  const [reviews, setReviews] = useState<ReviewRow[]>(initialReviews)
  const [loading, setLoading] = useState(!initialProfile)
  const [isFavorite, setIsFavorite] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // モーダル管理
  const [isEstimateOpen, setIsEstimateOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [isFormPickerOpen, setIsFormPickerOpen] = useState(false)
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [selectedWork, setSelectedWork] = useState<PortfolioItem | null>(null)

  // レビュー投稿フォーム
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewExistingImageUrls, setReviewExistingImageUrls] = useState<string[]>([])
  const [reviewNewFiles, setReviewNewFiles] = useState<File[]>([])
  const [reviewNewPreviews, setReviewNewPreviews] = useState<string[]>([])
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null)

  const REVIEW_MAX_IMAGES = 3

  // フォーム選択状態管理
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [clientName, setClientName] = useState('')
  const [referenceWorkTitle, setReferenceWorkTitle] = useState<string | null>(null)
  const [generatedSpec, setGeneratedSpec] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  const BACKGROUND_IMAGE_URL =
    'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

  // モーダル表示時の背景スクロール抑制
  useEffect(() => {
    if (isEstimateOpen || isContactOpen || isFormPickerOpen || isReviewModalOpen || lightboxImageUrl || selectedWork) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isEstimateOpen, isContactOpen, isFormPickerOpen, isReviewModalOpen, lightboxImageUrl, selectedWork])

  // 開いているフォームが切り替わったら、前のフォームの回答・生成済み仕様書を引き継がない
  useEffect(() => {
    setFormAnswers({})
    setGeneratedSpec(null)
  }, [selectedFormId])

  // ログイン状態を確認しつつ、このクリエイターがお気に入り済みか判定する
  // （ログイン中はアカウントに保存された一覧、未ログインはブラウザ保存分を使う）
  useEffect(() => {
    let isMounted = true
    const initFavorite = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      if (!isMounted) return
      setCurrentUserId(uid)

      const favs = await loadFavorites(uid)
      if (isMounted) setIsFavorite(favs.includes(id))
    }
    initFavorite()
    return () => {
      isMounted = false
    }
  }, [id])

  // レビュー一覧の取得。reviewer_id は profiles を持たない場合があるため、
  // 表示名・アイコンは別クエリで取得してから手動で合成する
  const refreshReviews = async () => {
    const { data: reviewRows } = await supabase
      .from('reviews')
      .select('*')
      .eq('creator_id', id)
      .order('created_at', { ascending: false })

    if (!reviewRows) return

    const reviewerIds = Array.from(new Set(reviewRows.map((r) => r.reviewer_id)))
    let profileMap: Record<string, { display_name: string | null; avatar_url: string | null }> = {}
    let ringMap: Record<string, string> = {}
    if (reviewerIds.length > 0) {
      const { data: reviewerProfiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', reviewerIds)
      profileMap = Object.fromEntries(
        (reviewerProfiles || []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }])
      )

      const { data: reviewerRings } = await supabase
        .from('public_equipped_rings')
        .select('user_id, equipped_ring_id')
        .in('user_id', reviewerIds)
      ringMap = Object.fromEntries(
        (reviewerRings || []).map((r) => [r.user_id, r.equipped_ring_id as string])
      )
    }

    setReviews(
      reviewRows.map((r) => ({
        ...r,
        reviewer_display_name: profileMap[r.reviewer_id]?.display_name || null,
        reviewer_avatar_url: profileMap[r.reviewer_id]?.avatar_url || null,
        reviewer_ring_id: ringMap[r.reviewer_id] || null,
      }))
    )
  }

useEffect(() => {
  const fetchCreatorData = async () => {
    if (!initialProfile) {
      setLoading(true)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', id)
        .single()

      if (profileData) {
        setProfile(profileData as ExtendedProfile)
      }
    }

    if (works.length === 0) {
      const { data: worksData } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('user_id', id)
        .order('sort_order', { ascending: true })

      if (worksData) setWorks(worksData)
    }

    if (forms.length === 0) {
      const { data: formsData } = await supabase
        .from('estimate_forms')
        .select('*')
        .eq('user_id', id)
        .order('sort_order', { ascending: true })

      if (formsData) setForms(formsData as EstimateFormRow[])
    }

    if (reviews.length === 0) {
      await refreshReviews()
    }

    try {
      const { data: { user: viewer } } = await supabase.auth.getUser()
      if (viewer?.id !== id) {
        await supabase.from('analytics_logs').insert({
          creator_id: id,
          event_type: 'pv',
        })
      }
    } catch (e) {
      console.error('PV tracking error:', e)
    }

    setLoading(false)
  }

  fetchCreatorData()
}, [id])

// テーマカラーの解決（profile.theme_color を最優先に評価）
// テーマカラーの解決（profile.theme_color を絶対的な最優先に評価）
const themeColor = useMemo(() => {
  // 1. まず DB の profiles.theme_color を最優先。次に form_config 側を見る
  const rawColor = profile?.theme_color || profile?.form_config?.theme_color || ''
  const normalized = rawColor.toString().trim().toLowerCase()

  // 2. キーワード判定（DBのデータ形式に完全一致させる）
  if (normalized === 'emerald' || normalized === '#10b981') return '#10B981'
  if (normalized === 'indigo' || normalized === '#4f46e5') return '#4F46E5'
  if (normalized === 'rose' || normalized === '#f43f5e') return '#F43F5E'
  if (normalized === 'amber' || normalized === '#f59e0b') return '#F59E0B'
  if (normalized === 'dark' || normalized === '#0f172a') return '#0F172A'

  // 3. 直接カラーコード（#xxxxxx）が保存されている場合
  if (normalized.startsWith('#')) return normalized

  // 4. どれにもヒットしない場合のデフォルト値（必要に応じて変更）
  return '#10B981'
}, [profile?.theme_color, profile?.form_config?.theme_color])
  // タグリストの規格化 (文字列配列・オブジェクト配列の両方に対応)
  const normalizedTastes = useMemo(() => {
    if (!profile?.tastes || !Array.isArray(profile.tastes)) return []
    return profile.tastes
      .map((item) => {
        if (typeof item === 'string') return item
        
        // item がオブジェクトで 'name' を含む場合に型をキャストして参照
        if (typeof item === 'object' && item !== null && 'name' in item) {
          return (item as { name?: string }).name || ''
        }
        return ''
      })
      .filter((item) => item.length > 0)
  }, [profile?.tastes])

  // 選択可能な見積もりフォーム一覧。新形式（estimate_forms）が1件でもあればそちらを使い、
  // 無ければ旧形式（profiles.form_config、1人1フォーム）を1件だけのリストとして扱う（後方互換）
  const availableForms = useMemo<EstimateFormRow[]>(() => {
    if (forms.length > 0) {
      return forms.filter((f) => f.is_accepting !== false)
    }

    const legacy = profile?.form_config
    if (legacy && Array.isArray(legacy.fields) && legacy.fields.length > 0) {
      return [
        {
          id: 'legacy',
          title: legacy.title || '簡単見積もり・仕様書作成',
          description: legacy.description || '',
          theme_color: legacy.theme_color || '',
          is_accepting: true,
          fields: legacy.fields,
          sort_order: 0,
        },
      ]
    }

    return []
  }, [forms, profile])

  const activeFormConfig = useMemo<EstimateFormRow | null>(() => {
    return availableForms.find((f) => f.id === selectedFormId) || null
  }, [availableForms, selectedFormId])

  const modalThemeColor = activeFormConfig?.theme_color || themeColor

  const campaign: Campaign = useMemo(
    () => ({
      enabled: profile?.campaign_enabled,
      discountType: profile?.campaign_discount_type,
      discountValue: profile?.campaign_discount_value,
      startAt: profile?.campaign_start_at,
      endAt: profile?.campaign_end_at,
    }),
    [profile]
  )

  // 見積もりボタン押下時の共通処理（フォームが1つならそのまま開き、複数なら選択させる）
  const openEstimateFlow = () => {
    if (availableForms.length === 1) {
      setSelectedFormId(availableForms[0].id)
      setIsEstimateOpen(true)
    } else if (availableForms.length > 1) {
      setIsFormPickerOpen(true)
    }
  }

  const handleSelectOption = (fieldId: string, optionLabel: string, isCheckbox: boolean) => {
    setFormAnswers((prev) => {
      if (isCheckbox) {
        const currentList: string[] = prev[fieldId] || []
        const exists = currentList.includes(optionLabel)
        const updated = exists
          ? currentList.filter((v) => v !== optionLabel)
          : [...currentList, optionLabel]
        return { ...prev, [fieldId]: updated }
      }
      return { ...prev, [fieldId]: optionLabel }
    })
  }

  const { totalPrice, originalTotalPrice } = useMemo(() => {
    if (!activeFormConfig) return { basePriceTotal: 0, totalPrice: 0, originalTotalPrice: 0 }

    let baseSum = 0
    let baseSumOriginal = 0
    let extraFixedPrice = 0
    let extraFixedPriceOriginal = 0
    let percentSum = 0
    let percentSumOriginal = 0

    activeFormConfig.fields.forEach((field) => {
      if (field.price && field.type !== 'note' && field.type !== 'faq') {
        const discount = resolveDiscount(campaign, field.discount)
        baseSum += applyDiscount(field.price, discount)
        baseSumOriginal += field.price
      }
    })

    activeFormConfig.fields.forEach((field) => {
      const answer = formAnswers[field.id]
      if (!answer || !field.options) return

      const addOption = (selectedOpt: Option) => {
        const discount = resolveDiscount(campaign, selectedOpt.discount)
        const effectivePrice = applyDiscount(selectedOpt.price, discount)
        if (selectedOpt.priceType === 'percent') {
          percentSum += effectivePrice
          percentSumOriginal += selectedOpt.price
        } else {
          extraFixedPrice += effectivePrice
          extraFixedPriceOriginal += selectedOpt.price
        }
      }

      if (field.type === 'radio') {
        const selectedOpt = field.options.find((opt) => opt.label === answer)
        if (selectedOpt) addOption(selectedOpt)
      } else if (field.type === 'checkbox' && Array.isArray(answer)) {
        answer.forEach((selectedLabel) => {
          const selectedOpt = field.options?.find((opt) => opt.label === selectedLabel)
          if (selectedOpt) addOption(selectedOpt)
        })
      }
    })

    const calculatedTotal =
      baseSum + extraFixedPrice + Math.round(baseSum * (percentSum / 100))
    const calculatedOriginalTotal =
      baseSumOriginal + extraFixedPriceOriginal + Math.round(baseSumOriginal * (percentSumOriginal / 100))

    return { basePriceTotal: baseSum, totalPrice: calculatedTotal, originalTotalPrice: calculatedOriginalTotal }
  }, [formAnswers, activeFormConfig, campaign])

  const handleOpenEstimateWithWork = (work: PortfolioItem) => {
    setSelectedWork(null)
    setReferenceWorkTitle(work.title || 'ポートフォリオ掲載作品')
    openEstimateFlow()
  }

  const handleGenerateSpec = () => {
    if (!activeFormConfig) return

    let specLines: string[] = []
    specLines.push(`【ご依頼・見積もり仕様書】`)
    specLines.push(`依頼先: ${profile?.display_name || 'クリエイター'} 様`)
    if (clientName.trim()) specLines.push(`依頼者名: ${clientName}`)
    if (referenceWorkTitle) specLines.push(`参考希望作品: ${referenceWorkTitle}`)
    specLines.push(`-----------------------------------`)

    activeFormConfig.fields.forEach((field) => {
      const answer = formAnswers[field.id]
      if (field.type === 'note' || field.type === 'faq') return
      if (!answer || (Array.isArray(answer) && answer.length === 0)) return

      const fieldName = field.label || '無題'
      if (field.type === 'text' || field.type === 'textarea' || field.type === 'color') {
        specLines.push(`■ ${fieldName}:`)
        specLines.push(`   ${answer}`)
      } else if (Array.isArray(answer)) {
        specLines.push(`■ ${fieldName}: ${answer.join(', ')}`)
      } else {
        specLines.push(`■ ${fieldName}: ${answer}`)
      }
    })

    specLines.push(`-----------------------------------`)
    if (originalTotalPrice > totalPrice) {
      const badge = formatSavingsBadge(originalTotalPrice, totalPrice)
      specLines.push(`■ 通常価格: ¥${originalTotalPrice.toLocaleString()}`)
      specLines.push(`■ 割引後合計: ¥${totalPrice.toLocaleString()} (税込)${badge ? ` [${badge}]` : ''}`)
    } else {
      specLines.push(`■ 概算見積もり合計: ¥${totalPrice.toLocaleString()} (税込)`)
    }
    specLines.push(`※上記はシミュレーションによる概算です。内容により変動する場合があります。`)

    setGeneratedSpec(specLines.join('\n'))
  }

  const trackEstimateCalc = async () => {
    if (!activeFormConfig) return
    const selectedOptions: string[] = []
    activeFormConfig.fields.forEach((field) => {
      const answer = formAnswers[field.id]
      if (!answer) return
      if (Array.isArray(answer)) {
        selectedOptions.push(...answer)
      } else if (field.type === 'radio' || field.type === 'checkbox') {
        selectedOptions.push(String(answer))
      }
    })

    try {
      await supabase.from('analytics_logs').insert({
        creator_id: id,
        event_type: 'estimate_calc',
        metadata: { options: selectedOptions },
      })
    } catch (e) {
      console.error('Estimate tracking error:', e)
    }
  }

  const handleCopySpec = async () => {
    if (!generatedSpec) return
    if (currentUserId !== id) {
      await trackEstimateCalc()
    }
    navigator.clipboard.writeText(generatedSpec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleFavorite = async () => {
    const wasFavorite = isFavorite
    const currentLikes = profile?.likes_count ?? 0
    const newLikes = wasFavorite ? Math.max(0, currentLikes - 1) : currentLikes + 1

    const nowFavorite = await toggleFavoriteRecord(currentUserId, id, wasFavorite)
    setIsFavorite(nowFavorite)

    if (nowFavorite && !wasFavorite && currentUserId !== id) {
      try {
        await supabase.from('analytics_logs').insert({
          creator_id: id,
          event_type: 'favorite',
        })
      } catch (e) {
        console.error('Favorite tracking error:', e)
      }
    }

    // ホームページのいいねボタンと同じくDB側のカウントも更新する
    // （今まではここが抜けていて、このページの「いいね数」表示が実際には更新されなかった）
    setProfile((prev) => (prev ? { ...prev, likes_count: newLikes } : prev))

    const { error } = await supabase.rpc('increment_likes', {
      target_user_id: id,
      is_liking: !wasFavorite,
    })

    if (error) {
      console.error('いいね数の更新に失敗しました:', error)
    }
  }

  const handleTagClick = (tag: string) => {
    router.push(`/?tag=${encodeURIComponent(tag)}`)
  }

  // レビュー・評価
  const myReview = useMemo(
    () => (currentUserId ? reviews.find((r) => r.reviewer_id === currentUserId) || null : null),
    [reviews, currentUserId]
  )

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return 0
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  }, [reviews])

  const openNewReview = () => {
    setReviewRating(0)
    setReviewComment('')
    setReviewExistingImageUrls([])
    setReviewNewFiles([])
    setReviewNewPreviews([])
    setIsReviewModalOpen(true)
  }

  const openEditReview = () => {
    if (!myReview) return
    setReviewRating(myReview.rating)
    setReviewComment(myReview.comment || '')
    setReviewExistingImageUrls(myReview.image_urls || [])
    setReviewNewFiles([])
    setReviewNewPreviews([])
    setIsReviewModalOpen(true)
  }

  const reviewImageCount = reviewExistingImageUrls.length + reviewNewFiles.length

  const handleReviewFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    const room = REVIEW_MAX_IMAGES - reviewImageCount
    if (room <= 0) {
      alert(`画像は最大${REVIEW_MAX_IMAGES}枚までです`)
      return
    }
    const accepted = files.slice(0, room)
    setReviewNewFiles((prev) => [...prev, ...accepted])
    setReviewNewPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))])
  }

  const removeExistingReviewImage = (url: string) => {
    setReviewExistingImageUrls((prev) => prev.filter((u) => u !== url))
  }

  const removeNewReviewImage = (index: number) => {
    setReviewNewFiles((prev) => prev.filter((_, i) => i !== index))
    setReviewNewPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmitReview = async () => {
    if (!currentUserId || reviewRating < 1) return
    const isFirstReview = !myReview
    setSubmittingReview(true)

    try {
      const uploadedUrls: string[] = []
      for (const file of reviewNewFiles) {
        const webpBlob = await convertToWebp(file, 0.85, 1600)
        const fileName = `reviews/${currentUserId}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(fileName, webpBlob, { contentType: 'image/webp' })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('portfolios')
          .getPublicUrl(uploadData.path)

        uploadedUrls.push(publicUrlData.publicUrl)
      }

      const finalImageUrls = [...reviewExistingImageUrls, ...uploadedUrls]

      const { error } = await supabase.from('reviews').upsert(
        {
          creator_id: id,
          reviewer_id: currentUserId,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          image_urls: finalImageUrls,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'creator_id,reviewer_id' }
      )

      if (error) throw error

      setIsReviewModalOpen(false)
      await refreshReviews()
      if (isFirstReview) {
        alert('レビューを投稿しました！50ptを獲得しました🎉')
      }
    } catch (error: any) {
      console.error('レビュー投稿エラー:', error)
      alert('レビューの投稿に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleDeleteReview = async () => {
    if (!currentUserId || !myReview) return
    if (!confirm('投稿したレビューを削除します。よろしいですか？')) return

    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('creator_id', id)
      .eq('reviewer_id', currentUserId)

    if (error) {
      console.error('レビュー削除エラー:', error)
      alert('レビューの削除に失敗しました。通信環境をご確認のうえ、もう一度お試しください。')
      return
    }

    await refreshReviews()
  }

  const sharePageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = `${profile?.display_name || 'クリエイター'}さんのポートフォリオ・見積もりページ`

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(sharePageUrl)
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-cover bg-center flex flex-col items-center justify-center space-y-3"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(56,189,248,0.35) 0%, rgba(224,242,254,0.25) 45%, rgba(255,255,255,0.1) 100%), url(${BACKGROUND_IMAGE_URL})` }}
      >
        <div className="p-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-sky-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-sky-600 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div
        className="min-h-screen bg-cover bg-center flex flex-col items-center justify-center p-4"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(56,189,248,0.35) 0%, rgba(224,242,254,0.25) 45%, rgba(255,255,255,0.1) 100%), url(${BACKGROUND_IMAGE_URL})` }}
      >
        <div className="p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 text-center space-y-3 max-w-sm w-full">
          <p className="text-sky-700 font-bold text-sm">
            クリエイターが見つかりませんでした
          </p>
          <Link
            href="/"
            className="text-sky-900 hover:underline font-semibold text-xs inline-flex items-center gap-1"
          >
            ← 検索結果に戻る
          </Link>
        </div>
      </div>
    )
  }

  const hasContactLinks =
    profile.external_estimation_url ||
    profile.twitter_url ||
    profile.instagram_url ||
    profile.pixiv_url ||
    profile.website_url

  // ステータス表示のラベル生成
  const getStatusLabel = () => {
    if (profile.status === 'stopped') return '受注停止'
    if (profile.status === 'busy') return '相談受付中'
    return '即対応可'
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center text-sky-800 pb-28 relative font-sans"
      style={{ backgroundImage: `linear-gradient(180deg, rgba(56,189,248,0.35) 0%, rgba(224,242,254,0.25) 45%, rgba(255,255,255,0.1) 100%), url(${BACKGROUND_IMAGE_URL})` }}
    >
      <div className="absolute inset-0 bg-sky-900/10 backdrop-brightness-95 pointer-events-none" />

      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-xs font-bold text-sky-600 hover:text-sky-900 transition-colors flex items-center gap-1.5"
          >
            <span>←</span> 検索結果へ戻る
          </Link>
          <span className="text-[11px] font-black tracking-widest text-sky-400 uppercase">
            Creator Portfolio
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative z-10">
        {/* メインプロフィール */}
        <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-white/80 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-4 sm:gap-5">
                {profile.avatar_url && (
                  <div className="relative shrink-0 ring-4 ring-white/80 shadow-md rounded-full">
                    <AvatarRing
                      src={profile.avatar_url}
                      alt={profile.display_name || 'アバター画像'}
                      size={88}
                      ringId={creatorRingId}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-sky-900 tracking-tight">
                      {profile.display_name}
                    </h1>

                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1 rounded-full border shadow-2xs ${
                        profile.status === 'stopped'
                          ? 'bg-rose-500/10 text-rose-800 border-rose-500/30'
                          : profile.status === 'busy'
                          ? 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          profile.status === 'stopped'
                            ? 'bg-rose-500'
                            : profile.status === 'busy'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500 animate-pulse'
                        }`}
                      />
                      {getStatusLabel()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {profile.ai_usage === 'none' && (
                      <span className="text-[11px] bg-sky-900/10 text-sky-900 font-extrabold px-3 py-0.5 rounded-full border border-sky-300 shadow-2xs">
                        ✦ 完全手描き
                      </span>
                    )}
                    {profile.ai_usage === 'partial' && (
                      <span className="text-[11px] bg-sky-900/10 text-sky-800 font-extrabold px-3 py-0.5 rounded-full border border-sky-300 shadow-2xs">
                        🎨 一部AI補助あり
                      </span>
                    )}
                    {profile.ai_usage === 'full' && (
                      <span className="text-[11px] bg-sky-900/10 text-sky-800 font-extrabold px-3 py-0.5 rounded-full border border-sky-300 shadow-2xs">
                        🤖 AI生成・加筆メイン
                      </span>
                    )}
                    {!profile.ai_learning_allowed && (
                      <span className="text-[11px] bg-sky-500/10 text-sky-800 font-extrabold px-3 py-0.5 rounded-full border border-sky-200/60 shadow-2xs">
                        🛡️ AI学習禁止
                      </span>
                    )}
                    {profile.r18_allowed && (
                      <span className="text-[11px] bg-rose-500/10 text-rose-800 font-extrabold px-3 py-0.5 rounded-full border border-rose-200/60">
                        R-18 OK
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-sky-700 text-sm leading-relaxed whitespace-pre-wrap bg-white/60 p-4 sm:p-5 rounded-2xl border border-white/80 shadow-2xs">
                {profile.status_comment || 'プロフィールコメントはありません。'}
              </p>

              {/* SNS・外部リンク */}
              {hasContactLinks && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-sky-500 mr-1">SNS / Links:</span>
                  {profile.twitter_url && (
                    <a
                      href={formatExternalUrl(profile.twitter_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-sky-900 text-white hover:bg-sky-800 transition shadow-2xs flex items-center gap-1"
                    >
                      <span>X (Twitter)</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  )}
                  {profile.instagram_url && (
                    <a
                      href={formatExternalUrl(profile.instagram_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white hover:opacity-90 transition shadow-2xs flex items-center gap-1"
                    >
                      <span>Instagram</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  )}
                  {profile.pixiv_url && (
                    <a
                      href={formatExternalUrl(profile.pixiv_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition shadow-2xs flex items-center gap-1"
                    >
                      <span>Pixiv</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  )}
                  {profile.website_url && (
                    <a
                      href={formatExternalUrl(profile.website_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-white text-sky-800 border border-sky-200 hover:bg-sky-50 transition shadow-2xs flex items-center gap-1"
                    >
                      <span>Web Site</span>
                      <span className="text-[10px]">↗</span>
                    </a>
                  )}
                </div>
              )}

              {/* タグ・スタイル */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {normalizedTastes.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTagClick(t)}
                    className="text-xs bg-sky-900/5 hover:bg-sky-900/10 text-sky-700 px-3 py-1 rounded-xl font-semibold transition cursor-pointer"
                  >
                    #{t}
                  </button>
                ))}
              </div>

              {/* SNSシェア機能 */}
              <div className="pt-3 border-t border-sky-200/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-sky-400 mr-1">このページを共有:</span>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePageUrl)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 transition flex items-center gap-1"
                >
                  <span>𝕏 シェア</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(sharePageUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition flex items-center gap-1"
                >
                  <span>Facebook</span>
                </a>
                <a
                  href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(sharePageUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition flex items-center gap-1"
                >
                  <span>LINE</span>
                </a>
                <button
                  onClick={handleCopyShareUrl}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 transition cursor-pointer"
                >
                  {shareCopied ? 'URLをコピーしました！' : '🔗 URLコピー'}
                </button>
              </div>
            </div>

            {/* サイド操作枠 */}
            <div className="w-full lg:w-80 bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white shadow-sm space-y-4 shrink-0">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-2.5 text-center">
                <span className="text-[11px] font-black text-emerald-800 flex items-center justify-center gap-1">
                  <span>💡</span> 仲介手数料0円・直取引価格でご案内
                </span>
              </div>

              {(profile.max_projects_capacity != null || profile.available_from_text) && (
                <div className="bg-sky-50 p-3 rounded-xl border border-sky-200/80 space-y-1.5 text-xs">
                  {profile.max_projects_capacity != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-sky-500 font-bold">現在の稼働枠</span>
                      <span className="font-extrabold text-sky-800">
                        {profile.active_projects_count ?? 0} / {profile.max_projects_capacity} 件
                      </span>
                    </div>
                  )}
                  {profile.available_from_text && (
                    <div className="flex justify-between items-center">
                      <span className="text-sky-500 font-bold">着手可能時期</span>
                      <span className="font-extrabold text-sky-800">
                        {profile.available_from_text}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2.5 text-xs text-sky-600 pb-1">
                {profile.price_min != null && (() => {
                  const priceMinCampaignActive = isCampaignActive(campaign)
                  const discountedPriceMin = priceMinCampaignActive
                    ? applyDiscount(profile.price_min as number, {
                        type: campaign.discountType as 'percent' | 'fixed',
                        value: campaign.discountValue as number,
                      })
                    : null
                  const priceMinBadge = priceMinCampaignActive
                    ? formatDiscountBadge({
                        type: campaign.discountType as 'percent' | 'fixed',
                        value: campaign.discountValue as number,
                      })
                    : null
                  return (
                    <div
                      className="flex justify-between items-baseline p-3 rounded-xl border"
                      style={{
                        backgroundColor: hexToRgba(themeColor, 0.05),
                        borderColor: hexToRgba(themeColor, 0.2),
                      }}
                    >
                      <span className="font-bold text-sky-500">最低参考価格</span>
                      {priceMinCampaignActive && discountedPriceMin !== null ? (
                        <span className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span className="text-slate-400 text-xs line-through decoration-rose-400">
                            ¥{(profile.price_min as number).toLocaleString()}
                          </span>
                          <span className="font-black text-lg" style={{ color: themeColor }}>
                            ¥{discountedPriceMin.toLocaleString()}〜
                          </span>
                          <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                            {priceMinBadge}
                          </span>
                        </span>
                      ) : (
                        <span
                          className="font-black text-lg"
                          style={{ color: themeColor }}
                        >
                          ¥{profile.price_min.toLocaleString()}〜
                        </span>
                      )}
                    </div>
                  )
                })()}
                <div className="flex justify-between items-center px-1">
                  <span>目安納期</span>
                  <span className="font-extrabold text-sky-900">
                    {profile.lead_time_days ? `${profile.lead_time_days} 日以内` : '要相談'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span>商用利用</span>
                  <span className="font-extrabold text-sky-900">
                    {profile.commercial_use_allowed ? '可能' : '不可'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {availableForms.length > 0 ? (
                  <button
                    onClick={() => {
                      setReferenceWorkTitle(null)
                      openEstimateFlow()
                    }}
                    style={{ backgroundColor: themeColor }}
                    className="w-full py-3.5 hover:opacity-90 active:scale-[0.98] text-white font-extrabold rounded-xl transition-all shadow-lg text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🧮</span> {availableForms.length > 1 ? '見積もりフォームを選んで作成' : '簡単見積もり・仕様書作成'}
                  </button>
                ) : (
                  <div className="w-full py-3 px-3 bg-sky-100/80 text-sky-500 font-bold rounded-xl text-xs text-center border border-sky-200/60 leading-relaxed">
                    見積もりシミュレーターは準備中です。<br />下の「直接相談・お問い合わせ」から気軽にご相談ください。
                  </div>
                )}

                <button
                  onClick={() => setIsContactOpen(true)}
                  className="w-full py-3 bg-white hover:bg-sky-50 text-sky-800 font-extrabold rounded-xl border border-sky-200 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                >
                  <span>✉️</span> 直接相談・お問い合わせ
                </button>

                <button
                  onClick={handleToggleFavorite}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      : 'bg-white border-sky-200 text-sky-700 hover:bg-sky-50'
                  }`}
                >
                  <span>{isFavorite ? '❤️' : '🤍'}</span>
                  <span>
                    {isFavorite ? 'お気に入り登録済み' : 'お気に入りに追加'}
                    {profile.likes_count != null && profile.likes_count > 0 && ` (${profile.likes_count})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 受付条件 */}
        <section className="bg-white/75 backdrop-blur-xl p-6 sm:p-7 rounded-3xl shadow-xl border border-white/80 space-y-5">
          <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest flex items-center gap-2">
            <span className="p-1.5 bg-white rounded-lg text-xs shadow-2xs">⚙️</span> 制作・受付条件
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              {
                label: '生成AIの使用',
                value:
                  profile.ai_usage === 'none'
                    ? '完全手描き（未使用）'
                    : profile.ai_usage === 'partial'
                    ? '一部AI補助あり'
                    : profile.ai_usage === 'full'
                    ? 'AI生成・加筆メイン'
                    : '未指定',
                highlight: profile.ai_usage === 'none',
              },
              {
                label: 'R-18（成人向け）',
                value: profile.r18_allowed ? '対応可能' : '不可',
                highlight: !!profile.r18_allowed,
              },
              {
                label: '無料リテイク',
                value:
                  typeof profile.free_revision_count === 'number'
                    ? `${profile.free_revision_count} 回まで無料`
                    : '要相談',
                highlight: false,
              },
              {
                label: '急ぎ・特急対応',
                value: profile.express_option_available ? '対応可能' : '不可',
                highlight: !!profile.express_option_available,
              },
              {
                label: '著作権譲渡',
                value: profile.copyright_transfer_available ? '相談・譲渡可能' : '不可',
                highlight: !!profile.copyright_transfer_available,
              },
              {
                label: 'AI学習の許可',
                value: profile.ai_learning_allowed ? '許可' : '禁止（不可）',
                highlight: !profile.ai_learning_allowed,
              },
            ].map((spec, i) => (
              <div
                key={i}
                className="p-3.5 bg-white/60 rounded-2xl border border-white/80 space-y-1 shadow-2xs"
              >
                <span className="text-[11px] font-bold text-sky-400 block">
                  {spec.label}
                </span>
                <span
                  className={`text-xs font-extrabold block ${
                    spec.highlight ? 'text-sky-900' : 'text-sky-800'
                  }`}
                  style={spec.highlight ? { color: themeColor } : undefined}
                >
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 料金メニュー */}
        {profile.menu_items && profile.menu_items.length > 0 && (
          <section className="bg-white/75 backdrop-blur-xl p-6 sm:p-7 rounded-3xl shadow-xl border border-white/80 space-y-5">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest flex items-center gap-2">
              <span className="p-1.5 bg-white rounded-lg text-xs shadow-2xs">🏷️</span> 料金目安・メニュー
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {profile.menu_items.map((item, index) => {
                const itemDiscount = resolveDiscount(campaign, item.discount)
                const hasDiscount = typeof item.price === 'number' && itemDiscount
                const discountedPrice = hasDiscount ? applyDiscount(item.price as number, itemDiscount) : null

                return (
                  <div
                    key={index}
                    className="p-4 bg-white/60 border border-white/80 rounded-2xl flex justify-between items-center hover:bg-white transition shadow-2xs"
                  >
                    <span className="text-xs font-bold text-sky-700">{item.title}</span>
                    {hasDiscount ? (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-[10px] text-sky-300 line-through decoration-rose-400">
                          ¥{(item.price as number).toLocaleString()}
                        </span>
                        <span
                          className="text-xs font-black px-2.5 py-1 rounded-lg border"
                          style={{
                            color: themeColor,
                            backgroundColor: hexToRgba(themeColor, 0.08),
                            borderColor: hexToRgba(themeColor, 0.2),
                          }}
                        >
                          ¥{discountedPrice?.toLocaleString()}〜
                        </span>
                        <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded">
                          {formatDiscountBadge(itemDiscount)}
                        </span>
                      </div>
                    ) : (
                      <span
                        className="text-xs font-black px-2.5 py-1 rounded-lg border"
                        style={{
                          color: themeColor,
                          backgroundColor: hexToRgba(themeColor, 0.08),
                          borderColor: hexToRgba(themeColor, 0.2),
                        }}
                      >
                        {typeof item.price === 'number'
                          ? `¥${item.price.toLocaleString()}〜`
                          : '要相談'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ポートフォリオ一覧 */}
        <section className="space-y-4">
          <div className="flex justify-between items-baseline px-1">
            <h2 className="text-base font-black text-sky-900 tracking-tight drop-shadow-xs">
              ポートフォリオ作品
            </h2>
            <span className="text-xs font-extrabold text-sky-500 bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white">
              {works.length} 作品
            </span>
          </div>

          {works.length === 0 ? (
            <div className="bg-white/75 backdrop-blur-xl p-12 rounded-3xl border border-white/80 text-center text-xs font-bold text-sky-400">
              まだ作品が登録されていません
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {works.map((work) => (
                <div
                  key={work.id}
                  onClick={() => setSelectedWork(work)}
                  className="group relative aspect-square bg-white/40 rounded-2xl overflow-hidden shadow-lg border border-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl cursor-pointer"
                >
                  <img
                    src={work.image_url}
                    alt={work.title || `${profile.display_name}の作品`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-sky-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="text-xs font-bold text-white truncate">{work.title || '無題'}</p>
                    <span className="text-[10px] text-white/80 font-medium">クリックで拡大</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* レビュー・評価 */}
        <section className="bg-white/75 backdrop-blur-xl p-6 sm:p-7 rounded-3xl shadow-xl border border-white/80 space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-xs font-black text-sky-900 uppercase tracking-widest flex items-center gap-2">
              <span className="p-1.5 bg-white rounded-lg text-xs shadow-2xs">⭐</span> クリエイター評価・レビュー
            </h2>
            {reviews.length > 0 && (
              <span className="text-xs font-extrabold text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                ★ {avgRating.toFixed(1)}（{reviews.length}件）
              </span>
            )}
          </div>

          {currentUserId && currentUserId !== id ? (
            myReview ? (
              <div className="p-4 rounded-2xl border border-sky-200 bg-sky-50/60 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-bold text-sky-600">あなたはこのクリエイターにレビューを投稿済みです</span>
                <div className="flex gap-2">
                  <button
                    onClick={openEditReview}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 transition cursor-pointer"
                  >
                    編集する
                  </button>
                  <button
                    onClick={handleDeleteReview}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 transition cursor-pointer"
                  >
                    削除する
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={openNewReview}
                style={{ backgroundColor: themeColor }}
                className="w-full sm:w-auto py-3 px-6 text-white font-extrabold rounded-xl text-xs transition shadow-md hover:opacity-90 active:scale-[0.98] cursor-pointer"
              >
                ✍️ レビューを投稿する
              </button>
            )
          ) : !currentUserId ? (
            <div className="p-4 rounded-2xl border border-dashed border-sky-200 text-center text-xs font-bold text-sky-400">
              <Link href="/login" className="underline text-sky-600">ログイン</Link>するとレビューを投稿できます
            </div>
          ) : null}

          {reviews.length === 0 ? (
            <p className="text-xs font-bold text-sky-300 text-center py-6">まだレビューがありません</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="p-4 bg-white/60 rounded-2xl border border-white/80 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="shrink-0">
                        <AvatarRing
                          src={r.reviewer_avatar_url}
                          alt=""
                          size={24}
                          ringId={r.reviewer_ring_id}
                          fallback={<div className="w-full h-full rounded-full bg-sky-100 flex items-center justify-center text-[10px]">👤</div>}
                        />
                      </div>
                      <span className="text-xs font-bold text-sky-800 truncate">{r.reviewer_display_name || '依頼者'}</span>
                    </div>
                    <span className="text-amber-500 text-xs shrink-0">
                      {'★'.repeat(r.rating)}
                      <span className="text-slate-200">{'★'.repeat(5 - r.rating)}</span>
                    </span>
                  </div>
                  {r.comment && (
                    <p className="text-xs text-sky-600 leading-relaxed whitespace-pre-wrap">{r.comment}</p>
                  )}
                  {r.image_urls && r.image_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.image_urls.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setLightboxImageUrl(url)}
                          className="w-16 h-16 rounded-xl overflow-hidden border border-white/80 cursor-pointer"
                        >
                          <img src={url} alt="レビュー画像" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-sky-300 block">
                    {new Date(r.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 作品詳細 モーダル */}
      {selectedWork && (
        <div className="fixed inset-0 bg-sky-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/40 relative">
            <button
              onClick={() => setSelectedWork(null)}
              aria-label="閉じる"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-sky-900/60 hover:bg-sky-900/80 text-white flex items-center justify-center text-xs font-black transition cursor-pointer shadow-md"
            >
              ✕
            </button>

            <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
              <div className="rounded-2xl overflow-hidden bg-sky-950 flex items-center justify-center max-h-[60vh]">
                <img
                  src={selectedWork.image_url}
                  alt={selectedWork.title || '作品詳細'}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-black text-sky-900">
                  {selectedWork.title || '作品タイトルなし'}
                </h3>

                {selectedWork.description && (
                  <p className="text-xs text-sky-600 leading-relaxed whitespace-pre-wrap bg-sky-50 p-4 rounded-xl border border-sky-100">
                    {selectedWork.description}
                  </p>
                )}
              </div>
            </div>

            {/* 作品詳細からの見積もり連動 */}
            <div className="p-4 sm:p-5 bg-sky-50 border-t border-sky-200/80 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-sky-500">
                この作品のようなテイストで依頼したい場合:
              </span>
              {availableForms.length > 0 ? (
                <button
                  onClick={() => handleOpenEstimateWithWork(selectedWork)}
                  style={{ backgroundColor: themeColor }}
                  className="w-full sm:w-auto py-3 px-6 text-white font-extrabold rounded-xl text-xs transition shadow-md hover:opacity-95 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>✨</span>
                  <span>この作品のイメージで見積もり作成</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSelectedWork(null)
                    setIsContactOpen(true)
                  }}
                  className="w-full sm:w-auto py-3 px-6 bg-sky-900 text-white font-extrabold rounded-xl text-xs transition hover:bg-sky-800 cursor-pointer"
                >
                  ✉️ この作品についてお問い合わせ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* フォーム入力 & プレビューモーダル */}
      {isEstimateOpen && activeFormConfig && (
        <div className="fixed inset-0 bg-sky-950/70 backdrop-blur-lg flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-sky-50/95 backdrop-blur-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/60 overflow-hidden relative">
            
            {/* モーダルヘッダー */}
            <div 
              className="p-5 sm:p-6 border-b border-sky-200/60 shrink-0 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(modalThemeColor, 0.12)} 0%, #ffffff00 100%)`
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white shadow-xs text-sm">
                      {generatedSpec ? '📄' : '✨'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-sky-900">
                      {generatedSpec
                        ? '完成仕様書プレビュー'
                        : activeFormConfig.title || '簡単見積もり・仕様書作成'}
                    </h3>
                  </div>
                  {referenceWorkTitle && !generatedSpec && (
                    <div className="pl-7 pt-1">
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-200 inline-flex items-center gap-1">
                        🎨 参考指定作品: {referenceWorkTitle}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsEstimateOpen(false)}
                  aria-label="閉じる"
                  className="w-8 h-8 rounded-full bg-sky-200/60 hover:bg-sky-300/80 text-sky-600 flex items-center justify-center text-xs font-black transition cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* モーダルメイン */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
              {!generatedSpec ? (
                <>
                  <p className="text-xs font-medium text-sky-500 whitespace-pre-wrap leading-relaxed bg-white/60 p-4 rounded-2xl border border-sky-100">
                    {activeFormConfig.description ||
                      'ご希望の内容を選んでいただくだけで、その場で概算金額と依頼内容のまとめが作成されます。まずは気軽に選んでみてください。'}
                  </p>

                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-xs space-y-2">
                    <label className="text-xs font-black text-sky-800 flex items-center gap-1.5">
                      <span>👤</span>
                      <span>お名前（またはアカウント名）</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例: 山田太郎"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-sky-200 bg-sky-50/50 font-bold focus:outline-none focus:ring-2 transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    {activeFormConfig.fields.map((field) => (
                      <div
                        key={field.id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-xs space-y-3"
                      >
                        <div className="flex justify-between items-baseline">
                          <label className="text-xs font-black text-sky-900 flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.required && (
                              <span className="text-rose-500 font-bold text-[10px]">*</span>
                            )}
                          </label>
                          {field.price ? (
                            <span className="text-[11px] font-bold text-sky-400">
                              基本: +¥{field.price.toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        {field.type === 'note' && field.noteText && (
                          <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-xs text-sky-600 leading-relaxed">
                            {field.noteText}
                          </div>
                        )}

                        {field.type === 'faq' && (
                          <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 space-y-1">
                            <span className="text-[11px] font-bold text-sky-700 block">A. 解答:</span>
                            <p className="text-xs text-sky-600 leading-relaxed">
                              {field.faqAnswer}
                            </p>
                          </div>
                        )}

                        {(field.type === 'radio' || field.type === 'checkbox') && field.options && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {field.options.map((opt, i) => {
                              const isChecked = field.type === 'radio'
                                ? formAnswers[field.id] === opt.label
                                : Array.isArray(formAnswers[field.id]) &&
                                  formAnswers[field.id].includes(opt.label)

                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() =>
                                    handleSelectOption(
                                      field.id,
                                      opt.label,
                                      field.type === 'checkbox'
                                    )
                                  }
                                  className={`p-3 rounded-xl border text-left text-xs font-bold transition-all flex justify-between items-center cursor-pointer ${
                                    isChecked
                                      ? 'bg-sky-900 text-white border-sky-900 shadow-xs'
                                      : 'bg-sky-50/50 border-sky-200 text-sky-700 hover:bg-sky-100/80'
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {opt.price !== 0 && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        isChecked ? 'bg-white/20 text-white' : 'text-sky-400'
                                      }`}
                                    >
                                      {opt.price > 0 ? '+' : ''}
                                      {opt.priceType === 'percent'
                                        ? `${opt.price}%`
                                        : `¥${opt.price.toLocaleString()}`}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            placeholder="自由入力してください"
                            value={formAnswers[field.id] || ''}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            className="w-full text-xs p-3 rounded-xl border border-sky-200 bg-sky-50/50 font-medium focus:outline-none focus:ring-2 transition-all"
                          />
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            rows={3}
                            placeholder="詳細をご記入ください"
                            value={formAnswers[field.id] || ''}
                            onChange={(e) =>
                              setFormAnswers((prev) => ({
                                ...prev,
                                [field.id]: e.target.value,
                              }))
                            }
                            className="w-full text-xs p-3 rounded-xl border border-sky-200 bg-sky-50/50 font-medium focus:outline-none focus:ring-2 transition-all leading-relaxed"
                          />
                        )}

                        {field.type === 'color' && (
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={formAnswers[field.id] || '#000000'}
                              onChange={(e) =>
                                setFormAnswers((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.value,
                                }))
                              }
                              className="w-10 h-10 rounded-xl border border-sky-200 cursor-pointer"
                            />
                            <input
                              type="text"
                              placeholder="#000000"
                              value={formAnswers[field.id] || ''}
                              onChange={(e) =>
                                setFormAnswers((prev) => ({
                                  ...prev,
                                  [field.id]: e.target.value,
                                }))
                              }
                              className="flex-1 text-xs p-2.5 rounded-xl border border-sky-200 bg-sky-50/50 font-mono"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-sky-900 rounded-2xl text-white font-mono text-xs leading-relaxed whitespace-pre-wrap select-all shadow-inner">
                    {generatedSpec}
                  </div>
                  <p className="text-[11px] text-sky-500 text-center font-medium leading-relaxed">
                    お疲れさまでした！上記のテキストをコピーして、ダイレクトメッセージやお問合せフォームに貼り付けてお送りください。<br />
                    ※あくまで概算のシミュレーションです。実際の金額や納期は、クリエイターとのやり取りの中で相談しながら決めていただけますので、気軽にご連絡ください。
                  </p>
                </div>
              )}
            </div>

            {/* モーダル フッター */}
            <div className="p-4 sm:p-5 bg-white border-t border-sky-200/80 flex items-center justify-between gap-3 shrink-0">
              {!generatedSpec ? (
                <>
                  <div>
                    <span className="text-[10px] font-bold text-sky-400 block">概算合計金額</span>
                    {originalTotalPrice > totalPrice ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-sky-300 line-through decoration-rose-400">
                          ¥{originalTotalPrice.toLocaleString()}
                        </span>
                        <span className="text-lg font-black text-sky-900">
                          ¥{totalPrice.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-sky-500">(税込)</span>
                        </span>
                        <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded">
                          {formatSavingsBadge(originalTotalPrice, totalPrice)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-black text-sky-900">
                        ¥{totalPrice.toLocaleString()}{' '}
                        <span className="text-xs font-normal text-sky-500">(税込)</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEstimateOpen(false)}
                      className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleGenerateSpec}
                      style={{ backgroundColor: modalThemeColor }}
                      className="px-5 py-2.5 text-white font-extrabold text-xs rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition cursor-pointer"
                    >
                      仕様書を生成する →
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center w-full gap-3">
                  <button
                    onClick={() => setGeneratedSpec(null)}
                    className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    ← 編集に戻る
                  </button>
                  <button
                    onClick={handleCopySpec}
                    style={{ backgroundColor: modalThemeColor }}
                    className="flex-1 py-2.5 text-white font-extrabold text-xs rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition cursor-pointer text-center"
                  >
                    {copied ? '✓ コピー完了！' : '📋 仕様書テキストをコピー'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 見積もりフォーム選択 モーダル（複数フォームがある場合のみ表示） */}
      {isFormPickerOpen && (
        <div className="fixed inset-0 bg-sky-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-sky-100 relative">
            <button
              onClick={() => setIsFormPickerOpen(false)}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-600 flex items-center justify-center text-xs font-black transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-black text-sky-900">どのご依頼内容ですか？</h3>
              <p className="text-xs text-sky-400">内容に合った見積もりフォームを選んでください</p>
            </div>

            <div className="space-y-2 pt-1 max-h-[60vh] overflow-y-auto">
              {availableForms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setSelectedFormId(f.id)
                    setIsFormPickerOpen(false)
                    setIsEstimateOpen(true)
                  }}
                  className="w-full text-left p-3.5 rounded-xl border border-sky-200 hover:bg-sky-50 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-black text-sky-900 block truncate">{f.title}</span>
                    {f.description && (
                      <span className="text-[11px] text-sky-400 line-clamp-1">{f.description}</span>
                    )}
                  </div>
                  <span className="text-sky-300 shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* レビュー投稿・編集 モーダル */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-sky-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-sky-100 relative">
            <button
              onClick={() => setIsReviewModalOpen(false)}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-600 flex items-center justify-center text-xs font-black transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-black text-sky-900">
                {myReview ? 'レビューを編集' : 'レビューを投稿'}
              </h3>
              <p className="text-xs text-sky-400">
                実際にやり取りした感想や満足度を、他の依頼者の参考のために教えてください
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-3xl">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setReviewRating(n)}
                  className={`transition cursor-pointer ${n <= reviewRating ? 'text-amber-500' : 'text-slate-200 hover:text-slate-300'}`}
                  aria-label={`${n}点`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={4}
              placeholder="やり取りの丁寧さ、仕上がりの満足度など（任意）"
              className="w-full text-xs p-3 rounded-xl border border-sky-200 bg-sky-50/50 font-medium focus:outline-none focus:ring-2 transition-all leading-relaxed"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-sky-500">
                  画像を添付（任意・{REVIEW_MAX_IMAGES}枚まで）
                </label>
                <span className="text-[10px] text-sky-300">{reviewImageCount} / {REVIEW_MAX_IMAGES}</span>
              </div>

              {(reviewExistingImageUrls.length > 0 || reviewNewPreviews.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {reviewExistingImageUrls.map((url) => (
                    <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden border border-sky-200 group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingReviewImage(url)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-sky-950/70 text-white text-[10px] flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {reviewNewPreviews.map((url, i) => (
                    <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden border border-sky-200">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewReviewImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-sky-950/70 text-white text-[10px] flex items-center justify-center cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {reviewImageCount < REVIEW_MAX_IMAGES && (
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-xl cursor-pointer transition">
                  <span>🖼️ 画像を選択</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleReviewFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2.5 bg-sky-100 hover:bg-sky-200 text-sky-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={reviewRating < 1 || submittingReview}
                style={{ backgroundColor: themeColor }}
                className="flex-1 py-2.5 text-white font-extrabold text-xs rounded-xl shadow-md hover:opacity-90 active:scale-[0.98] transition cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? '送信中...' : myReview ? '更新する' : '投稿する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* レビュー画像 拡大表示 */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 bg-sky-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            onClick={() => setLightboxImageUrl(null)}
            aria-label="閉じる"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm font-black transition cursor-pointer"
          >
            ✕
          </button>
          <img
            src={lightboxImageUrl}
            alt="レビュー画像拡大"
            className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* お問い合わせ方法 モーダル */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-sky-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-sky-100 relative">
            <button
              onClick={() => setIsContactOpen(false)}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-600 flex items-center justify-center text-xs font-black transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-black text-sky-900">直接相談・お問い合わせ</h3>
              <p className="text-xs text-sky-400">ご希望の外部連絡先からメッセージをお送りください</p>
            </div>

            <div className="space-y-2 pt-1">
              {profile.external_estimation_url && (
                <a
                  href={formatExternalUrl(profile.external_estimation_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ backgroundColor: themeColor }}
                  className="w-full py-3 px-4 text-white font-extrabold rounded-xl text-xs transition shadow-md flex items-center justify-between"
                >
                  <span>📋 外部見積もりフォーム</span>
                  <span>↗</span>
                </a>
              )}
              {profile.sns_links && profile.sns_links.length > 0 ? (
                profile.sns_links.map((link) => (
                  <a
                    key={link.id}
                    href={formatExternalUrl(link.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 bg-sky-100 text-sky-800 font-bold rounded-xl text-xs transition hover:bg-sky-200 flex items-center justify-between"
                  >
                    <span>{SNS_PLATFORM_LABELS[link.platform] || link.platform}</span>
                    <span>↗</span>
                  </a>
                ))
              ) : (
                <>
                  {profile.twitter_url && (
                    <a
                      href={formatExternalUrl(profile.twitter_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-sky-900 text-white font-bold rounded-xl text-xs transition hover:bg-sky-800 flex items-center justify-between"
                    >
                      <span>𝕏 (Twitter) DM</span>
                      <span>↗</span>
                    </a>
                  )}
                  {profile.instagram_url && (
                    <a
                      href={formatExternalUrl(profile.instagram_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-xl text-xs transition hover:opacity-90 flex items-center justify-between"
                    >
                      <span>Instagram DM</span>
                      <span>↗</span>
                    </a>
                  )}
                  {profile.pixiv_url && (
                    <a
                      href={formatExternalUrl(profile.pixiv_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-blue-500 text-white font-bold rounded-xl text-xs transition hover:bg-blue-600 flex items-center justify-between"
                    >
                      <span>Pixiv メッセージ</span>
                      <span>↗</span>
                    </a>
                  )}
                  {profile.website_url && (
                    <a
                      href={formatExternalUrl(profile.website_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 bg-sky-100 text-sky-800 font-bold rounded-xl text-xs transition hover:bg-sky-200 flex items-center justify-between"
                    >
                      <span>公式Webサイト</span>
                      <span>↗</span>
                    </a>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setIsContactOpen(false)}
              className="w-full py-2.5 bg-sky-100 text-sky-600 font-bold rounded-xl text-xs transition hover:bg-sky-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
    
  )
}