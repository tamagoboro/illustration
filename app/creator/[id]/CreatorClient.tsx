'use client'

import { useState, useEffect, useMemo, CSSProperties } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
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
}

type FormConfig = {
  title?: string
  description?: string
  themeColor?: string
  fields: Field[]
}

type MenuItem = {
  title: string
  price: number | ''
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
}: {
  id: string
  initialProfile?: ExtendedProfile | null
  initialWorks?: PortfolioItem[]
}) {
  const router = useRouter()
  const [profile, setProfile] = useState<ExtendedProfile | null>(initialProfile || null)
  const [works, setWorks] = useState<PortfolioItem[]>(initialWorks)
  const [loading, setLoading] = useState(!initialProfile)
  const [isFavorite, setIsFavorite] = useState(false)

  // モーダル管理
  const [isEstimateOpen, setIsEstimateOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [selectedWork, setSelectedWork] = useState<PortfolioItem | null>(null)

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
    if (isEstimateOpen || isContactOpen || selectedWork) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isEstimateOpen, isContactOpen, selectedWork])

  useEffect(() => {
    const storedFavs = localStorage.getItem('favorite_creators')
    if (storedFavs) {
      try {
        const favArray: string[] = JSON.parse(storedFavs)
        setIsFavorite(favArray.includes(id))
      } catch (e) {
        console.error('Failed to parse favorites', e)
      }
    }
  }, [id])

  useEffect(() => {
    if (initialProfile && initialWorks.length > 0) {
      setLoading(false)
      return
    }

    const fetchCreatorData = async () => {
      if (!profile) setLoading(true)

      if (!profile) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', id)
          .single()

        if (profileData) setProfile(profileData as ExtendedProfile)
      }

      if (works.length === 0) {
        const { data: worksData } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('user_id', id)
          .order('sort_order', { ascending: true })

        if (worksData) setWorks(worksData)
      }

      setLoading(false)
    }

    fetchCreatorData()
  }, [id, initialProfile, initialWorks, profile, works.length])

  // テーマカラーの解決（ダッシュボードの16進数・プリセットIDのどちらにも対応）
const themeColor = useMemo(() => {
  const rawColor = (profile?.theme_color || profile?.form_config?.themeColor || '#1F2937').toLowerCase()

  // ID文字列の判定
  if (rawColor === 'indigo' || rawColor === '#4f46e5') return '#4F46E5'
  if (rawColor === 'rose' || rawColor === '#f43f5e') return '#F43F5E'
  if (rawColor === 'emerald' || rawColor === '#10b981') return '#10B981'
  if (rawColor === 'amber' || rawColor === '#f59e0b') return '#F59E0B'
  if (rawColor === 'dark' || rawColor === '#0f172a') return '#0F172A'

  // それ以外のカラーコード（#1F2937 など）はそのまま返す
  return profile?.theme_color || profile?.form_config?.themeColor || '#1F2937'
}, [profile])

  // タグリストの規格化 (文字列配列・オブジェクト配列の両方に対応)
  // オブジェクトかつ name を持つか判定する型ガード関数
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

  // フォーム設定の安全な取得
  const activeFormConfig = useMemo<FormConfig | null>(() => {
    if (!profile?.form_config) return null
    if (!profile.form_config.fields || !Array.isArray(profile.form_config.fields) || profile.form_config.fields.length === 0) {
      return null
    }
    return profile.form_config
  }, [profile])

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

  const { totalPrice } = useMemo(() => {
    if (!activeFormConfig) return { basePriceTotal: 0, totalPrice: 0 }

    let baseSum = 0
    let extraFixedPrice = 0
    let percentSum = 0

    activeFormConfig.fields.forEach((field) => {
      if (field.price && field.type !== 'note' && field.type !== 'faq') {
        baseSum += field.price
      }
    })

    activeFormConfig.fields.forEach((field) => {
      const answer = formAnswers[field.id]
      if (!answer || !field.options) return

      if (field.type === 'radio') {
        const selectedOpt = field.options.find((opt) => opt.label === answer)
        if (selectedOpt) {
          if (selectedOpt.priceType === 'percent') {
            percentSum += selectedOpt.price
          } else {
            extraFixedPrice += selectedOpt.price
          }
        }
      } else if (field.type === 'checkbox' && Array.isArray(answer)) {
        answer.forEach((selectedLabel) => {
          const selectedOpt = field.options?.find((opt) => opt.label === selectedLabel)
          if (selectedOpt) {
            if (selectedOpt.priceType === 'percent') {
              percentSum += selectedOpt.price
            } else {
              extraFixedPrice += selectedOpt.price
            }
          }
        })
      }
    })

    const calculatedTotal =
      baseSum + extraFixedPrice + Math.round(baseSum * (percentSum / 100))

    return { basePriceTotal: baseSum, totalPrice: calculatedTotal }
  }, [formAnswers, activeFormConfig])

  const handleOpenEstimateWithWork = (work: PortfolioItem) => {
    setSelectedWork(null)
    setReferenceWorkTitle(work.title || 'ポートフォリオ掲載作品')
    setGeneratedSpec(null)
    setIsEstimateOpen(true)
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
    specLines.push(`■ 概算見積もり合計: ¥${totalPrice.toLocaleString()} (税込)`)
    specLines.push(`※上記はシミュレーションによる概算です。内容により変動する場合があります。`)

    setGeneratedSpec(specLines.join('\n'))
  }

  const handleCopySpec = () => {
    if (!generatedSpec) return
    navigator.clipboard.writeText(generatedSpec)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleFavorite = () => {
    const storedFavs = localStorage.getItem('favorite_creators')
    let favArray: string[] = storedFavs ? JSON.parse(storedFavs) : []

    if (favArray.includes(id)) {
      favArray = favArray.filter((favId) => favId !== id)
      setIsFavorite(false)
    } else {
      favArray.push(id)
      setIsFavorite(true)
    }

    localStorage.setItem('favorite_creators', JSON.stringify(favArray))
  }

  const handleTagClick = (tag: string) => {
    router.push(`/?tag=${encodeURIComponent(tag)}`)
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
        className="min-h-screen bg-cover bg-center bg-fixed flex flex-col items-center justify-center space-y-3"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
      >
        <div className="p-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-600 tracking-widest uppercase">
            Loading...
          </p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed flex flex-col items-center justify-center p-4"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
      >
        <div className="p-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 text-center space-y-3 max-w-sm w-full">
          <p className="text-slate-700 font-bold text-sm">
            クリエイターが見つかりませんでした
          </p>
          <Link
            href="/"
            className="text-slate-900 hover:underline font-semibold text-xs inline-flex items-center gap-1"
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
      className="min-h-screen bg-cover bg-center bg-fixed text-slate-800 pb-28 relative font-sans"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      <div className="absolute inset-0 bg-slate-900/10 backdrop-brightness-95 pointer-events-none" />

      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
          >
            <span>←</span> 検索結果へ戻る
          </Link>
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
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
                  <div className="relative shrink-0">
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || 'アバター画像'}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover ring-4 ring-white/80 shadow-md"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
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
                      <span className="text-[11px] bg-slate-900/10 text-slate-900 font-extrabold px-3 py-0.5 rounded-full border border-slate-300 shadow-2xs">
                        ✦ 完全手描き
                      </span>
                    )}
                    {profile.ai_usage === 'partial' && (
                      <span className="text-[11px] bg-slate-900/10 text-slate-800 font-extrabold px-3 py-0.5 rounded-full border border-slate-300 shadow-2xs">
                        🎨 一部AI補助あり
                      </span>
                    )}
                    {profile.ai_usage === 'full' && (
                      <span className="text-[11px] bg-slate-900/10 text-slate-800 font-extrabold px-3 py-0.5 rounded-full border border-slate-300 shadow-2xs">
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

              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap bg-white/60 p-4 sm:p-5 rounded-2xl border border-white/80 shadow-2xs">
                {profile.status_comment || 'プロフィールコメントはありません。'}
              </p>

              {/* SNS・外部リンク */}
              {hasContactLinks && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-500 mr-1">SNS / Links:</span>
                  {profile.twitter_url && (
                    <a
                      href={formatExternalUrl(profile.twitter_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition shadow-2xs flex items-center gap-1"
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
                      className="text-xs font-bold px-3 py-1 rounded-xl bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1"
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
                    className="text-xs bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 px-3 py-1 rounded-xl font-semibold transition cursor-pointer"
                  >
                    #{t}
                  </button>
                ))}
              </div>

              {/* SNSシェア機能 */}
              <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400 mr-1">このページを共有:</span>
                <a
                  href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(sharePageUrl)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
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
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
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
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  {profile.max_projects_capacity != null && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">現在の稼働枠</span>
                      <span className="font-extrabold text-slate-800">
                        {profile.active_projects_count ?? 0} / {profile.max_projects_capacity} 件
                      </span>
                    </div>
                  )}
                  {profile.available_from_text && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">着手可能時期</span>
                      <span className="font-extrabold text-slate-800">
                        {profile.available_from_text}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2.5 text-xs text-slate-600 pb-1">
                {profile.price_min != null && (
                  <div
                    className="flex justify-between items-baseline p-3 rounded-xl border"
                    style={{
                      backgroundColor: hexToRgba(themeColor, 0.05),
                      borderColor: hexToRgba(themeColor, 0.2),
                    }}
                  >
                    <span className="font-bold text-slate-500">最低参考価格</span>
                    <span
                      className="font-black text-lg"
                      style={{ color: themeColor }}
                    >
                      ¥{profile.price_min.toLocaleString()}〜
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center px-1">
                  <span>目安納期</span>
                  <span className="font-extrabold text-slate-900">
                    {profile.lead_time_days ? `${profile.lead_time_days} 日以内` : '要相談'}
                  </span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span>商用利用</span>
                  <span className="font-extrabold text-slate-900">
                    {profile.commercial_use_allowed ? '可能' : '不可'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {activeFormConfig ? (
                  <button
                    onClick={() => {
                      setReferenceWorkTitle(null)
                      setGeneratedSpec(null)
                      setIsEstimateOpen(true)
                    }}
                    style={{ backgroundColor: themeColor }}
                    className="w-full py-3.5 hover:opacity-90 active:scale-[0.98] text-white font-extrabold rounded-xl transition-all shadow-lg text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🧮</span> 簡単見積もり・仕様書作成
                  </button>
                ) : (
                  <div className="w-full py-3 px-3 bg-slate-100/80 text-slate-400 font-bold rounded-xl text-xs text-center border border-slate-200/60">
                    見積もりフォーム未設定
                  </div>
                )}

                <button
                  onClick={() => setIsContactOpen(true)}
                  className="w-full py-3 bg-white hover:bg-slate-50 text-slate-800 font-extrabold rounded-xl border border-slate-200 transition-all text-xs cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                >
                  <span>✉️</span> 直接相談・お問い合わせ
                </button>

                <button
                  onClick={handleToggleFavorite}
                  className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isFavorite
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
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
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
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
                <span className="text-[11px] font-bold text-slate-400 block">
                  {spec.label}
                </span>
                <span
                  className={`text-xs font-extrabold block ${
                    spec.highlight ? 'text-slate-900' : 'text-slate-800'
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
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="p-1.5 bg-white rounded-lg text-xs shadow-2xs">🏷️</span> 料金目安・メニュー
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {profile.menu_items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-white/60 border border-white/80 rounded-2xl flex justify-between items-center hover:bg-white transition shadow-2xs"
                >
                  <span className="text-xs font-bold text-slate-700">{item.title}</span>
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
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ポートフォリオ一覧 */}
        <section className="space-y-4">
          <div className="flex justify-between items-baseline px-1">
            <h2 className="text-base font-black text-slate-900 tracking-tight drop-shadow-xs">
              ポートフォリオ作品
            </h2>
            <span className="text-xs font-extrabold text-slate-500 bg-white/60 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white">
              {works.length} 作品
            </span>
          </div>

          {works.length === 0 ? (
            <div className="bg-white/75 backdrop-blur-xl p-12 rounded-3xl border border-white/80 text-center text-xs font-bold text-slate-400">
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
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                    <p className="text-xs font-bold text-white truncate">{work.title || '無題'}</p>
                    <span className="text-[10px] text-white/80 font-medium">クリックで拡大</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 作品詳細 モーダル */}
      {selectedWork && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-white/40 relative">
            <button
              onClick={() => setSelectedWork(null)}
              aria-label="閉じる"
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center text-xs font-black transition cursor-pointer shadow-md"
            >
              ✕
            </button>

            <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-5">
              <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center max-h-[60vh]">
                <img
                  src={selectedWork.image_url}
                  alt={selectedWork.title || '作品詳細'}
                  className="max-h-[60vh] w-auto object-contain"
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-black text-slate-900">
                  {selectedWork.title || '作品タイトルなし'}
                </h3>

                {selectedWork.description && (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedWork.description}
                  </p>
                )}
              </div>
            </div>

            {/* 作品詳細からの見積もり連動 */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-500">
                この作品のようなテイストで依頼したい場合:
              </span>
              {activeFormConfig ? (
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
                  className="w-full sm:w-auto py-3 px-6 bg-slate-900 text-white font-extrabold rounded-xl text-xs transition hover:bg-slate-800 cursor-pointer"
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
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-lg flex items-center justify-center p-3 sm:p-5 z-50 animate-in fade-in duration-200">
          <div className="bg-slate-50/95 backdrop-blur-2xl rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white/60 overflow-hidden relative">
            
            {/* モーダルヘッダー */}
            <div 
              className="p-5 sm:p-6 border-b border-slate-200/60 shrink-0 relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(themeColor, 0.12)} 0%, #ffffff00 100%)`
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white shadow-xs text-sm">
                      {generatedSpec ? '📄' : '✨'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900">
                      {generatedSpec
                        ? '完成仕様書プレビュー'
                        : activeFormConfig.title || '簡単見積もり・仕様書作成'}
                    </h3>
                  </div>
                  {activeFormConfig.description && !generatedSpec && (
                    <p className="text-xs font-medium text-slate-500 whitespace-pre-wrap pl-7">
                      {activeFormConfig.description}
                    </p>
                  )}
                  {referenceWorkTitle && !generatedSpec && (
                    <div className="pl-7 pt-1">
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
                        🎨 参考指定作品: {referenceWorkTitle}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsEstimateOpen(false)}
                  aria-label="閉じる"
                  className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-300/80 text-slate-600 flex items-center justify-center text-xs font-black transition cursor-pointer shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* モーダルメイン */}
            <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1">
              {!generatedSpec ? (
                <>
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span>👤</span>
                      <span>お名前（またはアカウント名）</span>
                    </label>
                    <input
                      type="text"
                      placeholder="例: 山田太郎"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 font-bold focus:outline-none focus:ring-2 transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    {activeFormConfig.fields.map((field) => (
                      <div
                        key={field.id}
                        className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3"
                      >
                        <div className="flex justify-between items-baseline">
                          <label className="text-xs font-black text-slate-900 flex items-center gap-1">
                            <span>{field.label}</span>
                            {field.required && (
                              <span className="text-rose-500 font-bold text-[10px]">*</span>
                            )}
                          </label>
                          {field.price ? (
                            <span className="text-[11px] font-bold text-slate-400">
                              基本: +¥{field.price.toLocaleString()}
                            </span>
                          ) : null}
                        </div>

                        {field.type === 'note' && field.noteText && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                            {field.noteText}
                          </div>
                        )}

                        {field.type === 'faq' && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                            <span className="text-[11px] font-bold text-slate-700 block">A. 解答:</span>
                            <p className="text-xs text-slate-600 leading-relaxed">
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
                                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                                      : 'bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100/80'
                                  }`}
                                >
                                  <span>{opt.label}</span>
                                  {opt.price !== 0 && (
                                    <span
                                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                                        isChecked ? 'bg-white/20 text-white' : 'text-slate-400'
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
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 font-medium focus:outline-none focus:ring-2 transition-all"
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
                            className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-slate-50/50 font-medium focus:outline-none focus:ring-2 transition-all leading-relaxed"
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
                              className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer"
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
                              className="flex-1 text-xs p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 font-mono"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-900 rounded-2xl text-white font-mono text-xs leading-relaxed whitespace-pre-wrap select-all shadow-inner">
                    {generatedSpec}
                  </div>
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    上記のテキストをコピーして、ダイレクトメッセージやお問合せフォームに貼り付けて送信してください。
                  </p>
                </div>
              )}
            </div>

            {/* モーダル フッター */}
            <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 flex items-center justify-between gap-3 shrink-0">
              {!generatedSpec ? (
                <>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">概算合計金額</span>
                    <span className="text-lg font-black text-slate-900">
                      ¥{totalPrice.toLocaleString()}{' '}
                      <span className="text-xs font-normal text-slate-500">(税込)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEstimateOpen(false)}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleGenerateSpec}
                      style={{ backgroundColor: themeColor }}
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
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    ← 編集に戻る
                  </button>
                  <button
                    onClick={handleCopySpec}
                    style={{ backgroundColor: themeColor }}
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

      {/* お問い合わせ方法 モーダル */}
      {isContactOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-5 shadow-2xl border border-slate-100 relative">
            <button
              onClick={() => setIsContactOpen(false)}
              aria-label="閉じる"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-black transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1 text-center">
              <h3 className="text-base font-black text-slate-900">直接相談・お問い合わせ</h3>
              <p className="text-xs text-slate-400">ご希望の外部連絡先からメッセージをお送りください</p>
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
              {profile.twitter_url && (
                <a
                  href={formatExternalUrl(profile.twitter_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-slate-900 text-white font-bold rounded-xl text-xs transition hover:bg-slate-800 flex items-center justify-between"
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
              {profile.website_url && (
                <a
                  href={formatExternalUrl(profile.website_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-slate-100 text-slate-800 font-bold rounded-xl text-xs transition hover:bg-slate-200 flex items-center justify-between"
                >
                  <span>公式Webサイト</span>
                  <span>↗</span>
                </a>
              )}
            </div>

            <button
              onClick={() => setIsContactOpen(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs transition hover:bg-slate-200"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  )
}