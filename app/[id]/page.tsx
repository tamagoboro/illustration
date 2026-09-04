'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase, Profile, PortfolioItem } from '@/lib/supabase'

type Option = {
  label: string
  price: number
  priceType?: 'fixed' | 'percent'
  calcType?: 'add' | 'percent'
}

type Field = {
  id: string
  label?: string
  title?: string
  type: 'radio' | 'checkbox' | 'text' | 'textarea' | 'color' | 'note' | 'faq'
  price?: number
  noteText?: string
  faqAnswer?: string
  required?: boolean
  options?: Option[]
}

type FormConfig = {
  title?: string
  description?: string
  theme_color?: string
  themeColor?: string
  is_accepting?: boolean
  fields: Field[]
}

type MenuItem = {
  title: string
  price: number | ''
}

type ExtendedProfile = Profile & {
  menu_items?: MenuItem[]
  price_min?: number | null
  ai_usage?: string | null
  free_revision_count?: number | null
  express_option_available?: boolean | null
  copyright_transfer_available?: boolean | null
  ai_learning_allowed?: boolean | null
  r18_allowed?: boolean | null
  tastes?: string[] | null
  status_comment?: string | null
  lead_time_days?: number | null
  commercial_use_allowed?: boolean | null
  external_estimation_url?: string | null
  twitter_url?: string | null
  instagram_url?: string | null
  pixiv_url?: string | null
  website_url?: string | null
  form_config?: FormConfig | null
}

function CreatorClient({
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
  const [loading, setLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)

  const [isEstimateOpen, setIsEstimateOpen] = useState(false)
  const [isContactOpen, setIsContactOpen] = useState(false)

  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({})
  const [clientName, setClientName] = useState('')
  const [copied, setCopied] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)

  const BACKGROUND_IMAGE_URL =
    'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

  useEffect(() => {
    // URLのIDが 'form-builder' だった場合はエラーを出さず編集ページへ移動させる
    if (id === 'form-builder') {
      router.push('/dashboard/form')
      return
    }

    if (!id) {
      setLoading(false)
      return
    }

    const fetchCreatorDataAndTrackPV = async () => {
      try {
        setLoading(true)

        const storedFavs = localStorage.getItem('favorite_creators')
        if (storedFavs) {
          try {
            const favArray: string[] = JSON.parse(storedFavs)
            setIsFavorite(favArray.includes(id))
          } catch (e) {
            console.error('Failed to parse favorites', e)
          }
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', id)
          .single()

        if (profileError) {
          console.error('Profile fetch error:', profileError)
        }
        if (profileData) {
          setProfile(profileData as ExtendedProfile)
        }

        const { data: worksData, error: worksError } = await supabase
          .from('portfolio_items')
          .select('*')
          .eq('user_id', id)
          .order('sort_order', { ascending: true })

        if (worksError) {
          console.error('Works fetch error:', worksError)
        }
        if (worksData) {
          setWorks(worksData)
        }

        await supabase.from('analytics_logs').insert({
          creator_id: id,
          event_type: 'pv',
        })
      } catch (err) {
        console.error('Unexpected error fetching creator data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchCreatorDataAndTrackPV()
  }, [id, router])

  const activeFormConfig = useMemo<FormConfig | null>(() => {
    if (!profile?.form_config) return null
    if (!profile.form_config.fields || profile.form_config.fields.length === 0) {
      return null
    }
    return profile.form_config
  }, [profile])

  const handleInputChange = (fieldId: string, value: any, isCheckbox = false) => {
    setFormAnswers((prev) => {
      if (isCheckbox) {
        const currentList: string[] = prev[fieldId] || []
        const exists = currentList.includes(value)
        const updated = exists
          ? currentList.filter((v) => v !== value)
          : [...currentList, value]
        return { ...prev, [fieldId]: updated }
      }
      return { ...prev, [fieldId]: value }
    })
  }

  const basePriceTotal = useMemo(() => {
    if (!activeFormConfig) return 0
    let total = 0
    activeFormConfig.fields.forEach((field) => {
      if (field.price && field.type !== 'note' && field.type !== 'faq') {
        total += field.price
      }
    })
    return total
  }, [activeFormConfig])

  const totalPrice = useMemo(() => {
    if (!activeFormConfig) return 0

    let fixedAdditions = 0
    let percentAdditions = 0

    activeFormConfig.fields.forEach((field) => {
      const answer = formAnswers[field.id]
      if (!answer || !field.options) return

      if (field.type === 'radio') {
        const selectedOpt = field.options.find((opt) => opt.label === answer)
        if (selectedOpt) {
          const isPercent =
            selectedOpt.priceType === 'percent' || selectedOpt.calcType === 'percent'
          if (isPercent) {
            percentAdditions += selectedOpt.price || 0
          } else {
            fixedAdditions += selectedOpt.price || 0
          }
        }
      } else if (field.type === 'checkbox' && Array.isArray(answer)) {
        answer.forEach((selectedLabel) => {
          const selectedOpt = field.options?.find((opt) => opt.label === selectedLabel)
          if (selectedOpt) {
            const isPercent =
              selectedOpt.priceType === 'percent' || selectedOpt.calcType === 'percent'
            if (isPercent) {
              percentAdditions += selectedOpt.price || 0
            } else {
              fixedAdditions += selectedOpt.price || 0
            }
          }
        })
      }
    })

    const percentAmount = Math.round(basePriceTotal * (percentAdditions / 100))
    return basePriceTotal + fixedAdditions + percentAmount
  }, [formAnswers, activeFormConfig, basePriceTotal])

  const generateSpecText = () => {
    if (!activeFormConfig) return ''

    let specLines: string[] = []
    specLines.push(`【ご依頼・見積もり仕様書】`)
    specLines.push(`依頼先: ${profile?.display_name || 'クリエイター'} 様`)
    if (clientName.trim()) specLines.push(`依頼者名: ${clientName}`)
    specLines.push(`-----------------------------------`)

    activeFormConfig.fields.forEach((field) => {
      if (field.type === 'note' || field.type === 'faq') return

      const title = field.label || field.title || '設問'
      const answer = formAnswers[field.id]
      if (!answer || (Array.isArray(answer) && answer.length === 0)) return

      if (field.type === 'text' || field.type === 'textarea') {
        specLines.push(`■ ${title}:`)
        specLines.push(`   ${answer}`)
      } else if (Array.isArray(answer)) {
        specLines.push(`■ ${title}: ${answer.join(', ')}`)
      } else {
        specLines.push(`■ ${title}: ${answer}`)
      }
    })

    specLines.push(`-----------------------------------`)
    specLines.push(`■ 概算見積もり合計: ¥${totalPrice.toLocaleString()} (税込)`)
    specLines.push(`※上記はシミュレーションによる概算です。内容により変動する場合があります。`)

    return specLines.join('\n')
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
    await trackEstimateCalc()
    const text = generateSpecText()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    if (!activeFormConfig) return
    await trackEstimateCalc()

    try {
      setIsDownloadingPdf(true)
      const formattedAnswers: { label: string; value: string }[] = []

      if (clientName.trim()) {
        formattedAnswers.push({ label: '依頼者名', value: clientName })
      }

      activeFormConfig.fields.forEach((field) => {
        if (field.type === 'note' || field.type === 'faq') return
        const title = field.label || field.title || '設問'
        const answer = formAnswers[field.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) return

        if (Array.isArray(answer)) {
          formattedAnswers.push({ label: title, value: answer.join(', ') })
        } else {
          formattedAnswers.push({ label: title, value: String(answer) })
        }
      })

      const response = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorName: profile?.display_name || 'クリエイター',
          formTitle: activeFormConfig.title || '概算見積もり・仕様書',
          answers: formattedAnswers,
          totalPrice,
        }),
      })

      if (!response.ok) throw new Error('PDFの生成に失敗しました')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `見積仕様書_${profile?.display_name || 'creator'}_${Date.now()}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      alert('PDFの生成中にエラーが発生しました。')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const handleToggleFavorite = async () => {
    const storedFavs = localStorage.getItem('favorite_creators')
    let favArray: string[] = storedFavs ? JSON.parse(storedFavs) : []

    if (favArray.includes(id)) {
      favArray = favArray.filter((favId) => favId !== id)
      setIsFavorite(false)
    } else {
      favArray.push(id)
      setIsFavorite(true)

      try {
        await supabase.from('analytics_logs').insert({
          creator_id: id,
          event_type: 'favorite',
        })
      } catch (e) {
        console.error('Favorite tracking error:', e)
      }
    }

    localStorage.setItem('favorite_creators', JSON.stringify(favArray))
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-cover bg-center bg-fixed flex flex-col items-center justify-center space-y-3"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
      >
        <div className="p-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-2xl flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-slate-600 tracking-widest uppercase">Loading...</p>
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
          <p className="text-slate-700 font-bold text-sm">クリエイターが見つかりませんでした</p>
          <p className="text-xs text-slate-400">ID: {id || '（未指定）'}</p>
          <Link href="/" className="text-pink-600 hover:text-pink-700 font-semibold text-xs inline-flex items-center gap-1 mt-2">
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

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed text-slate-800 pb-28 relative font-sans"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      <div className="absolute inset-0 bg-slate-900/10 backdrop-brightness-95 pointer-events-none" />

      <header className="px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 shadow-xs">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <Link
            href="/"
            className="text-xs font-bold text-slate-600 hover:text-pink-600 transition-colors flex items-center gap-1.5"
          >
            <span>←</span> 検索結果へ戻る
          </Link>
          <span className="text-[11px] font-black tracking-widest text-slate-400 uppercase">
            Creator Portfolio
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 relative z-10">
        <div className="bg-white/75 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-xl border border-white/80 space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-start gap-4 sm:gap-5">
                {profile.avatar_url && (
                  <div className="relative shrink-0">
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || ''}
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
                        profile.status === 'available'
                          ? 'bg-emerald-500/10 text-emerald-800 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-800 border-amber-500/30'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          profile.status === 'available'
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-amber-500'
                        }`}
                      />
                      {profile.status === 'available' ? '即対応可' : '相談受付中'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {profile.ai_usage === 'none' && (
                      <span className="text-[11px] bg-pink-500/10 text-pink-700 font-extrabold px-3 py-0.5 rounded-full border border-pink-200/60 shadow-2xs">
                        ✦ 完全手描き
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

              <div className="flex flex-wrap gap-1.5">
                {profile.tastes?.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-slate-900/5 hover:bg-slate-900/10 text-slate-700 px-3 py-1 rounded-xl font-semibold transition"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full lg:w-80 bg-white/80 backdrop-blur-md p-5 rounded-2xl border border-white shadow-sm space-y-4 shrink-0">
              <div className="space-y-2.5 text-xs text-slate-600 pb-1">
                {profile.price_min != null && (
                  <div className="flex justify-between items-baseline bg-pink-50/50 p-3 rounded-xl border border-pink-100/80">
                    <span className="font-bold text-slate-500">最低参考価格</span>
                    <span className="font-black text-pink-600 text-lg">
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
                      setIsEstimateOpen(true)
                    }}
                    className="w-full py-3.5 bg-pink-500 hover:bg-pink-600 active:scale-[0.98] text-white font-extrabold rounded-xl transition-all shadow-lg shadow-pink-200/50 text-sm cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>🎨</span> 簡単見積もり・仕様書作成
                  </button>
                ) : (
                  <div className="w-full py-3 px-3 bg-slate-100/80 text-slate-400 font-bold rounded-xl text-xs text-center border border-slate-200/60">
                    フォーム未設定
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
                  <span>{isFavorite ? 'お気に入り登録済み' : 'お気に入りに追加'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

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
                    : profile.ai_usage === 'main'
                    ? 'AIメイン制作'
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
              <div key={i} className="p-3.5 bg-white/60 rounded-2xl border border-white/80 space-y-1 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-400 block">{spec.label}</span>
                <span className={`text-xs font-extrabold block ${spec.highlight ? 'text-pink-600' : 'text-slate-800'}`}>
                  {spec.value}
                </span>
              </div>
            ))}
          </div>
        </section>

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
                  <span className="text-xs font-black text-pink-600 bg-pink-50/80 px-2.5 py-1 rounded-lg border border-pink-100">
                    {typeof item.price === 'number' ? `¥${item.price.toLocaleString()}〜` : '要相談'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex justify-between items-baseline px-1">
            <h2 className="text-base font-black text-slate-900 tracking-tight drop-shadow-xs">ポートフォリオ作品</h2>
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
                  className="group relative aspect-square bg-white/40 rounded-2xl overflow-hidden shadow-lg border border-white/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                >
                  <img
                    src={work.image_url}
                    alt={work.title || ''}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {work.title && (
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex items-end">
                      <p className="text-xs font-bold text-white truncate">{work.title}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {isEstimateOpen && activeFormConfig && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white/95 backdrop-blur-2xl rounded-3xl p-5 sm:p-7 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-white relative">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {activeFormConfig.title || '見積もり・仕様書作成'}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeFormConfig.description || '項目を選択して簡単見積もりを作成します'}
                </p>
              </div>
              <button
                onClick={() => setIsEstimateOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto py-5 space-y-6 flex-1 pr-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">お名前（またはアカウント名）</label>
                <input
                  type="text"
                  placeholder="例: 山田太郎"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {activeFormConfig.fields.map((field) => {
                const title = field.label || field.title || '無題の項目'

                if (field.type === 'note') {
                  return (
                    <div key={field.id} className="bg-amber-50/60 border-2 border-amber-200/60 p-4 rounded-2xl text-xs text-amber-900 font-bold whitespace-pre-wrap">
                      <div className="font-black mb-1 text-amber-800">📌 {title}</div>
                      {field.noteText || ''}
                    </div>
                  )
                }

                if (field.type === 'faq') {
                  return (
                    <div key={field.id} className="bg-sky-50/60 border-2 border-sky-100 p-4 rounded-2xl space-y-1">
                      <div className="text-xs font-black text-sky-900">❓ {title}</div>
                      <div className="text-xs font-bold text-slate-600 pl-4 border-l-2 border-sky-300 whitespace-pre-wrap">
                        {field.faqAnswer || ''}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={field.id} className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-extrabold text-slate-900 border-l-2 border-pink-500 pl-2">
                          {title}
                        </h4>
                        {field.required && (
                          <span className="text-[10px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded shadow-2xs">
                            必須
                          </span>
                        )}
                      </div>
                      {field.price ? (
                        <span className="text-[11px] font-black text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">
                          +¥{field.price.toLocaleString()}
                        </span>
                      ) : null}
                    </div>

                    {field.type === 'radio' && field.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {field.options.map((opt, i) => {
                          const isSelected = formAnswers[field.id] === opt.label
                          const isPercent = opt.priceType === 'percent' || opt.calcType === 'percent'
                          const calcVal = isPercent ? Math.round(basePriceTotal * (opt.price / 100)) : opt.price

                          return (
                            <div
                              key={i}
                              onClick={() => handleInputChange(field.id, opt.label)}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                                isSelected
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className={`text-[11px] ${isSelected ? 'text-pink-300' : 'text-pink-600'}`}>
                                {opt.price > 0
                                  ? isPercent
                                    ? `+${opt.price}% ${calcVal > 0 ? `(+¥${calcVal.toLocaleString()})` : ''}`
                                    : `+¥${opt.price.toLocaleString()}`
                                  : '標準'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {field.type === 'checkbox' && field.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {field.options.map((opt, i) => {
                          const currentList: string[] = formAnswers[field.id] || []
                          const isSelected = currentList.includes(opt.label)
                          const isPercent = opt.priceType === 'percent' || opt.calcType === 'percent'
                          const calcVal = isPercent ? Math.round(basePriceTotal * (opt.price / 100)) : opt.price

                          return (
                            <div
                              key={i}
                              onClick={() => handleInputChange(field.id, opt.label, true)}
                              className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                                isSelected
                                  ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <span>{opt.label}</span>
                              <span className={`text-[11px] ${isSelected ? 'text-pink-300' : 'text-pink-600'}`}>
                                {opt.price > 0
                                  ? isPercent
                                    ? `+${opt.price}% ${calcVal > 0 ? `(+¥${calcVal.toLocaleString()})` : ''}`
                                    : `+¥${opt.price.toLocaleString()}`
                                  : '+¥0'}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {field.type === 'text' && (
                      <input
                        type="text"
                        placeholder="内容を入力してください"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        placeholder="構図、キャラクターの特徴、納期のご希望などがあればご記入ください"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => handleInputChange(field.id, e.target.value)}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                      />
                    )}

                    {field.type === 'color' && (
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formAnswers[field.id] || '#3b82f6'}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="h-10 w-16 rounded-xl border-2 border-slate-200 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-500">
                          {formAnswers[field.id] || '#3b82f6'}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col space-y-3 shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                  概算合計金額
                </span>
                <span className="text-xl sm:text-2xl font-black text-pink-600">
                  ¥{totalPrice.toLocaleString()}
                  <span className="text-xs text-slate-500 font-normal ml-1">(税込)</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={handleCopySpec}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{copied ? '✅' : '📋'}</span>
                  <span>{copied ? 'コピー完了！' : '仕様書テキストをコピー'}</span>
                </button>

                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-extrabold rounded-xl transition text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>📄</span>
                  <span>{isDownloadingPdf ? 'PDF生成中...' : 'PDF形式でダウンロード'}</span>
                </button>
              </div>

              {(profile.twitter_url || profile.external_estimation_url) && (
                <div className="pt-1 flex flex-col gap-1.5">
                  {profile.twitter_url && (
                    <a
                      href={profile.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={trackEstimateCalc}
                      className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl transition flex items-center justify-between text-xs"
                    >
                      <span>X (Twitter) の DM で送る</span>
                      <span>↗</span>
                    </a>
                  )}

                  {profile.external_estimation_url && (
                    <a
                      href={profile.external_estimation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={trackEstimateCalc}
                      className="w-full py-2.5 px-4 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded-xl transition flex items-center justify-between text-xs"
                    >
                      <span>外部フォーム / Webサイトで送る</span>
                      <span>↗</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isContactOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl border border-white relative space-y-6">
            <button
              onClick={() => setIsContactOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition cursor-pointer"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">
                {profile.display_name} へ相談・お問い合わせ
              </h3>
              <p className="text-xs text-slate-500">連絡窓口を選択してください</p>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {profile.external_estimation_url && (
                <a
                  href={profile.external_estimation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded-2xl transition flex items-center justify-between text-xs shadow-md shadow-pink-200"
                >
                  <span>📋 外部見積もりフォーム</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.twitter_url && (
                <a
                  href={profile.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl transition flex items-center justify-between text-xs shadow-md"
                >
                  <span>X (Twitter) で相談・DM</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.instagram_url && (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-95 text-white font-extrabold rounded-2xl transition flex items-center justify-between text-xs shadow-md"
                >
                  <span>📸 Instagram で相談・DM</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.pixiv_url && (
                <a
                  href={profile.pixiv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-extrabold rounded-2xl transition flex items-center justify-between text-xs shadow-md"
                >
                  <span>🎨 Pixiv メッセージ</span>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 bg-white/80 text-slate-800 border border-slate-200 font-extrabold rounded-2xl hover:bg-white transition flex items-center justify-between text-xs shadow-xs"
                >
                  <span>🌐 公式Webサイト</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">開く ↗</span>
                </a>
              )}

              {!hasContactLinks && (
                <div className="text-center py-8 text-xs font-bold text-slate-400 bg-white/50 rounded-2xl border border-dashed border-slate-200">
                  連絡先・SNSリンクが登録されていません
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 text-center font-bold">
              ※ 新しいタブで外部ページが開きます
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function Page({ params }: PageProps) {
  const { id = '' } = await params

  return <CreatorClient id={id} />
}