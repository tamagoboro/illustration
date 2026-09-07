'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'

// メニュー項目の型定義
type MenuItem = {
  title: string
  price: number | ''
}

// 拡張型定義（追加された制作条件フィールドを反映）
type ProfileWithImage = Profile & {
  thumbnail_url?: string | null
  likes_count?: number
  menu_items?: MenuItem[] | null
  ai_usage?: string | null
  free_revision_count?: number | null
  express_option_available?: boolean | null
  copyright_transfer_available?: boolean | null
  ai_learning_allowed?: boolean | null
  r18_allowed?: boolean | null
}

// 指定の背景画像URL
const BACKGROUND_IMAGE_URL =
  'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

// 24時間以内に作成・更新されたか判定する関数
const isRecentlyUpdated = (updatedAt?: string | null) => {
  if (!updatedAt) return false
  const updatedTime = new Date(updatedAt).getTime()
  const currentTime = new Date().getTime()
  
  const diffHours = (currentTime - updatedTime) / (1000 * 60 * 60)
  return diffHours >= 0 && diffHours <= 24
}

export default function Home() {
  const [profiles, setProfiles] = useState<ProfileWithImage[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // 検索・フィルター・ソート用ステート
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTastes, setSelectedTastes] = useState<string[]>([])
  const [tasteSearch, setTasteSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [maxLeadTime, setMaxLeadTime] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [commercialOnly, setCommercialOnly] = useState(false)
  const [sortOption, setSortOption] = useState<'random' | 'price_asc' | 'price_desc' | 'likes_desc' | 'likes_asc'>('random')

  // お気に入り・比較ステート
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [compareList, setCompareList] = useState<ProfileWithImage[]>([])
  const [isCompareOpen, setIsCompareOpen] = useState(false)

  // 初回描画時に localStorage から復元
  useEffect(() => {
    const storedFavs = localStorage.getItem('favorite_creators')
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs))
      } catch (e) {
        console.error('Failed to load favorites from localStorage', e)
      }
    }

    const storedCompare = localStorage.getItem('compare_creators')
    if (storedCompare) {
      try {
        setCompareList(JSON.parse(storedCompare))
      } catch (e) {
        console.error('Failed to load compare list from localStorage', e)
      }
    }
  }, [])

  // データ取得＆認証状態の確認
  useEffect(() => {
    let isMounted = true

    supabase.auth.getUser().then(({ data }) => {
      if (isMounted && data?.user) setIsLoggedIn(true)
    })

    const fetchProfilesWithImages = async () => {
      setLoading(true)

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('is_public', true)

        if (profileError) throw profileError

        if (profileData && isMounted) {
          const { data: portfolioData } = await supabase
            .from('portfolio_items')
            .select('user_id, image_url, sort_order')
            .order('sort_order', { ascending: true })

          const imageMap: Record<string, string> = {}
          if (portfolioData) {
            portfolioData.forEach((item) => {
              if (!imageMap[item.user_id] && item.image_url) {
                imageMap[item.user_id] = item.image_url
              }
            })
          }

          const combined: ProfileWithImage[] = profileData.map((p) => ({
            ...p,
            thumbnail_url: imageMap[p.user_id] || p.avatar_url || null,
            likes_count: p.likes_count ?? 0,
            menu_items: Array.isArray(p.menu_items) ? p.menu_items : null
          }))

          const randomized = [...combined]
          for (let i = randomized.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomized[i], randomized[j]] = [randomized[j], randomized[i]]
          }

          setProfiles(randomized)
        }
      } catch (error) {
        console.error('データの取得に失敗しました:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchProfilesWithImages()

    return () => {
      isMounted = false
    }
  }, [])

  // モーダル表示時の背景スクロールを防止
  useEffect(() => {
    if (isCompareOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isCompareOpen])

  // お気に入りの追加 / 解除
  const toggleFavorite = async (userId: string) => {
    const isFav = favorites.includes(userId)
    const targetProfile = profiles.find((p) => p.user_id === userId)
    if (!targetProfile) return

    const currentLikes = targetProfile.likes_count ?? 0
    const newLikes = isFav ? Math.max(0, currentLikes - 1) : currentLikes + 1

    setFavorites((prev) => {
      const nextFavorites = isFav
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]

      localStorage.setItem('favorite_creators', JSON.stringify(nextFavorites))
      return nextFavorites
    })

    setProfiles((prevProfiles) =>
      prevProfiles.map((p) =>
        p.user_id === userId ? { ...p, likes_count: newLikes } : p
      )
    )

    setCompareList((prevCompare) => {
      const nextCompare = prevCompare.map((p) =>
        p.user_id === userId ? { ...p, likes_count: newLikes } : p
      )
      localStorage.setItem('compare_creators', JSON.stringify(nextCompare))
      return nextCompare
    })

    const { error } = await supabase.rpc('increment_likes', {
      target_user_id: userId,
      increment_val: isFav ? -1 : 1,
    })

    if (error) {
      console.error('いいね数の更新に失敗しました:', error)
    }
  }

  const toggleTaste = (taste: string) => {
    setSelectedTastes((prev) =>
      prev.includes(taste)
        ? prev.filter((t) => t !== taste)
        : [...prev, taste]
    )
  }

  const toggleCompare = (profile: ProfileWithImage) => {
    setCompareList((prev) => {
      const exists = prev.some((p) => p.user_id === profile.user_id)
      let nextList: ProfileWithImage[]

      if (exists) {
        nextList = prev.filter((p) => p.user_id !== profile.user_id)
      } else {
        if (prev.length >= 3) {
          alert('比較できるのは最大3名までです')
          return prev
        }
        nextList = [...prev, profile]
      }

      localStorage.setItem('compare_creators', JSON.stringify(nextList))
      return nextList
    })
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedTastes([])
    setTasteSearch('')
    setStatusFilter('ALL')
    setMaxLeadTime('')
    setMaxPrice('')
    setCommercialOnly(false)
    setShowFavoritesOnly(false)
    setSortOption('random')
  }

  const filteredProfiles = useMemo(() => {
    const list = profiles.filter((profile) => {
      const matchesSearch =
        (profile.display_name && profile.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (profile.status_comment && profile.status_comment.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (profile.menu_items && profile.menu_items.some((item) => item.title && item.title.toLowerCase().includes(searchTerm.toLowerCase())))

      const matchesTaste =
        selectedTastes.length === 0 ||
        selectedTastes.every((taste) => profile.tastes && profile.tastes.includes(taste))

      const matchesStatus =
        statusFilter === 'ALL' || profile.status === statusFilter

      const matchesLeadTime =
        maxLeadTime === '' || (profile.lead_time_days !== null && profile.lead_time_days !== undefined && profile.lead_time_days <= Number(maxLeadTime))

      const matchesPrice =
        maxPrice === '' || (profile.price_min !== null && profile.price_min !== undefined && profile.price_min <= Number(maxPrice))

      const matchesCommercial =
        !commercialOnly || profile.commercial_use_allowed === true

      const matchesFavorite =
        !showFavoritesOnly || favorites.includes(profile.user_id)

      return (
        matchesSearch &&
        matchesTaste &&
        matchesStatus &&
        matchesLeadTime &&
        matchesPrice &&
        matchesCommercial &&
        matchesFavorite
      )
    })

    return list.sort((a, b) => {
      if (sortOption === 'price_asc') {
        return (a.price_min ?? Infinity) - (b.price_min ?? Infinity)
      }
      if (sortOption === 'price_desc') {
        return (b.price_min ?? 0) - (a.price_min ?? 0)
      }
      if (sortOption === 'likes_desc') {
        return (b.likes_count ?? 0) - (a.likes_count ?? 0)
      }
      if (sortOption === 'likes_asc') {
        return (a.likes_count ?? 0) - (b.likes_count ?? 0)
      }
      return 0
    })
  }, [profiles, searchTerm, selectedTastes, statusFilter, maxLeadTime, maxPrice, commercialOnly, showFavoritesOnly, favorites, sortOption])

  const displayedTastes = useMemo(() => {
    return Array.from(new Set(profiles.flatMap((p) => p.tastes || [])))
      .filter((taste) =>
        taste.toLowerCase().includes(tasteSearch.toLowerCase())
      )
      .slice(0, 20)
  }, [profiles, tasteSearch])

  return (
    <div
      className="min-h-screen text-slate-800 pb-32 font-sans antialiased relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      {/* 雲・青空の透明感を出す軽やかなオーバーレイ */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />

      {/* ヘッダー */}
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-3 bg-white/80 backdrop-blur-md border-b border-sky-100/60 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* ロゴ / ブランドエリア */}
          <Link 
            href="/" 
            className="flex items-center gap-2.5 group cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-400 via-sky-300 to-cyan-300 flex items-center justify-center text-white font-black text-base shadow-sm group-hover:scale-105 transition-transform">
              ☁
            </div>
            <div className="flex flex-col">
              <span className="text-base font-black tracking-tight text-slate-800 group-hover:text-sky-600 transition-colors">
                Drawker
              </span>
              <span className="text-[9px] font-extrabold text-sky-500/80 tracking-wider uppercase -mt-1">
                Portfolio Search
              </span>
            </div>
          </Link>

          {/* アクションボタンエリア */}
          <div className="flex items-center gap-2.5">
            
            {/* お気に入りフィルターボタン */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`group px-3.5 py-2 text-xs font-bold rounded-2xl border transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                  : 'bg-white/90 hover:bg-white text-slate-600 hover:text-rose-500 border-sky-100 shadow-2xs'
              }`}
            >
              <span 
                className={`text-sm transition-transform group-hover:scale-110 ${
                  showFavoritesOnly ? 'text-white' : 'text-rose-400'
                }`}
              >
                ♥
              </span>
              <span className="hidden sm:inline">お気に入り</span>
              
              {favorites.length > 0 && (
                <span 
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider transition-colors ${
                    showFavoritesOnly 
                      ? 'bg-white text-rose-500' 
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {favorites.length}
                </span>
              )}
            </button>

            {/* ログイン / ダッシュボードボタン */}
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className={`px-4 py-2 text-xs font-bold rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                isLoggedIn
                  ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                  : 'bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white border border-sky-200'
              }`}
            >
              {isLoggedIn ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ダッシュボード</span>
                </>
              ) : (
                <>
                  <span className="text-white">✦</span>
                  <span>クリエイター無料登録</span>
                </>
              )}
            </Link>

          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="text-center py-12 px-4 max-w-4xl mx-auto space-y-3">
        <span className="inline-block px-3 py-1 bg-white/70 backdrop-blur-md rounded-full text-sky-700 font-bold text-xs tracking-wide shadow-2xs border border-sky-100">
          理想のイラスト・クリエイターに出会える
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight drop-shadow-sm font-serif">
          『誰に頼むか迷っているなら』
        </h2>
        <p className="text-xl sm:text-2xl font-bold text-sky-900 drop-shadow-xs tracking-wider pt-1">
          条件から作品まで、すぐ見つかるクリエイター検索
        </p>
      </section>

      {!isLoggedIn && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
          <div className="bg-gradient-to-r from-sky-500/90 via-sky-400/90 to-cyan-400/90 backdrop-blur-md rounded-3xl p-6 text-white border border-white/40 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1.5 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="text-[10px] font-black bg-white text-sky-700 px-2.5 py-0.5 rounded-full shadow-2xs">
                  掲載手数料 0円
                </span>
                <span className="text-[10px] font-bold bg-sky-600/40 text-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/30">
                  ポートフォリオ1分作成
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-wide">
                イラストレーター・クリエイターの方へ：作品を掲載しませんか？
              </h3>
              <p className="text-xs text-sky-50 font-medium">
                料金表やポートフォリオを登録するだけで、直接ご相談を受け付けられます。
              </p>
            </div>
            <Link
              href="/login"
              className="px-6 py-3 bg-white text-sky-700 hover:bg-sky-50 font-black text-xs rounded-2xl shadow flex items-center gap-1 transition-all transform hover:-translate-y-0.5 shrink-0"
            >
              無料で作品を登録・掲載する <span>→</span>
            </Link>
          </div>
        </section>
      )}

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* サイドバー */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-1">
                <div className="flex items-center gap-1.5 text-sky-700">
                  <span className="text-xs">⚙</span>
                  <h2 className="font-extrabold text-xs tracking-wider">
                    FILTER & SEARCH
                  </h2>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline cursor-pointer"
                >
                  リセット
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">キーワード</label>
                <input
                  type="text"
                  placeholder="名前、アイコン、立ち絵など..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">予算上限</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1000"
                    placeholder="指定なし"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <span className="text-xs text-slate-600 font-medium whitespace-nowrap">以下</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">希望納期</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="指定なし"
                    value={maxLeadTime}
                    onChange={(e) => setMaxLeadTime(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  />
                  <span className="text-xs text-slate-600 font-medium whitespace-nowrap">日以内</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">受付状況</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-sky-100 bg-white/90 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                >
                  <option value="ALL">すべて表示</option>
                  <option value="available">即対応可のみ</option>
                  <option value="busy">相談受付中</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-700">商用利用可能のみ</span>
                  <input
                    type="checkbox"
                    checked={commercialOnly}
                    onChange={(e) => setCommercialOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-500 accent-sky-500 cursor-pointer"
                  />
                </label>
              </div>

              <div className="space-y-2 pt-2 border-t border-sky-100">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    テイスト（最大20個）
                  </label>
                  {selectedTastes.length > 0 && (
                    <button
                      onClick={() => setSelectedTastes([])}
                      className="text-[10px] text-sky-600 hover:underline font-bold cursor-pointer"
                    >
                      選択解除
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  placeholder="テイストを検索..."
                  value={tasteSearch}
                  onChange={(e) => setTasteSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-[10px] rounded-lg border border-sky-100 bg-white/90 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />

                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pt-1">
                  {displayedTastes.length === 0 ? (
                    <p className="text-[10px] text-slate-400 py-1 font-bold">
                      一致するテイストが見つかりません
                    </p>
                  ) : (
                    displayedTastes.map((taste) => {
                      const isSelected = selectedTastes.includes(taste)
                      return (
                        <button
                          key={taste}
                          onClick={() => toggleTaste(taste)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500 text-white shadow-2xs'
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                        >
                          #{taste}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* メインリスト */}
          <section className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center px-4 py-2 rounded-2xl bg-white/80 backdrop-blur-md border border-sky-100 shadow-2xs">
              <p className="text-xs font-bold text-slate-700">
                該当クリエイター <span className="text-sm font-black text-sky-600 mx-1">{filteredProfiles.length}</span> 名
              </p>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">並び替え:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="px-3 py-1 bg-white border border-sky-100 rounded-xl text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                >
                  <option value="random">おすすめ順（標準）</option>
                  <option value="price_asc">価格が安い順</option>
                  <option value="price_desc">価格が高い順</option>
                  <option value="likes_desc">いいねが多い順</option>
                  <option value="likes_asc">いいねが少ない順</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="bg-white/80 backdrop-blur-md rounded-3xl p-4 animate-pulse space-y-3 border border-sky-50">
                    <div className="aspect-square bg-sky-100/60 rounded-2xl" />
                    <div className="h-4 bg-sky-100/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 bg-white/80 backdrop-blur-md rounded-3xl border border-sky-100 p-6 shadow-sm space-y-4">
                <p className="text-xs font-bold text-slate-600">条件に合うクリエイターが見つかりませんでした</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-xs font-bold text-sky-700 bg-sky-50 rounded-xl hover:bg-sky-100 cursor-pointer"
                  >
                    条件をリセット
                  </button>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-xs font-bold text-white bg-sky-500 rounded-xl hover:bg-sky-600 shadow-xs"
                  >
                    あなたが最初のクリエイターとして登録する
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {filteredProfiles.map((profile) => {
                  const isFav = favorites.includes(profile.user_id)
                  const isCompared = compareList.some((p) => p.user_id === profile.user_id)
                  const isNew = isRecentlyUpdated(profile.updated_at)
                  
                  // 条件判定（完全手描き＆R-18対応）
                  const isPureHandDrawn = profile.ai_usage === 'none'
                  const isR18Allowed = profile.r18_allowed === true

                  return (
                    <div
                      key={profile.user_id}
                      className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-100/80 shadow-xs hover:shadow-md hover:border-sky-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                    >
                      {/* イラスト画像エリア */}
                      <div className="relative w-full aspect-square bg-sky-50/50 overflow-hidden">
                        {profile.thumbnail_url ? (
                          <img
                            src={profile.thumbnail_url}
                            alt={profile.display_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50/80 text-sky-300">
                            <span className="text-[10px] font-black tracking-widest">NO PORTFOLIO</span>
                          </div>
                        )}

                        {/* 左上：ステータス & NEW & 追加バッジ */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1 max-w-[70%]">
                          {isNew && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-pink-500 text-white shadow-xs">
                              NEW
                            </span>
                          )}

                          <span
                            className={`text-[9px] px-2.5 py-0.5 rounded-full font-black text-white shadow-xs ${
                              profile.status === 'available' ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          >
                            {profile.status === 'available' ? '即対応可' : '相談受付中'}
                          </span>

                          {/* 完全手描きバッジ */}
                          {isPureHandDrawn && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-sky-600 text-white shadow-xs">
                              ✦ 完全手描き
                            </span>
                          )}

                          {/* R-18対応バッジ */}
                          {isR18Allowed && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white shadow-xs">
                              R-18 OK
                            </span>
                          )}
                        </div>

                        {/* 右上：お気に入りボタン */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(profile.user_id)}
                          className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-white/90 backdrop-blur-md shadow-xs flex items-center gap-1 text-[11px] font-black cursor-pointer active:scale-95 transition-transform ${
                            isFav ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
                          }`}
                        >
                          <span>♥</span>
                          <span>{profile.likes_count ?? 0}</span>
                        </button>

                        {/* オーバーレイグラデーション & 最低価格 */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent p-3 pt-6 flex justify-between items-end">
                          <div>
                            <span className="text-[9px] text-sky-100 font-extrabold block">最安目安</span>
                            <span className="text-white font-black text-sm tracking-tight drop-shadow-xs">
                              {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                            </span>
                          </div>
                          {profile.commercial_use_allowed && (
                            <span className="text-[9px] font-black bg-cyan-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                              商用利用OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 情報本文エリア */}
                      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="space-y-0.5">
                            <h3 className="font-bold text-xs text-slate-800 line-clamp-1">
                              {profile.display_name}
                            </h3>
                            <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                              {profile.status_comment || 'プロフィール文は設定されていません。'}
                            </p>
                          </div>

                          {/* メニュー料金表 */}
                          <div className="space-y-1 border-t border-sky-100 pt-1.5">
                            <span className="text-[9px] font-bold text-slate-600 block">料金メニュー</span>
                            {profile.menu_items && profile.menu_items.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {profile.menu_items.slice(0, 3).map((menu, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between items-center text-[10px] bg-sky-50/50 px-2 py-0.5 rounded-md border border-sky-100/50"
                                  >
                                    <span className="font-bold text-slate-700 line-clamp-1">{menu.title}</span>
                                    <span className="font-black text-sky-700 whitespace-nowrap">
                                      {typeof menu.price === 'number' ? `¥${menu.price.toLocaleString()}〜` : '応相談'}
                                    </span>
                                  </div>
                                ))}
                                {profile.menu_items.length > 3 && (
                                  <span className="text-[8px] text-slate-400 text-right font-bold block">
                                    他 {profile.menu_items.length - 3} 件のメニュー
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400 font-bold bg-sky-50/30 p-1 rounded-lg text-center">
                                詳細料金はプロフィール参照
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {/* 仕様目安 */}
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                            <span>納期目安</span>
                            <span className="font-extrabold text-slate-700">{profile.lead_time_days || 14}日以内</span>
                          </div>

                          {/* タグ一覧 */}
                          <div className="flex flex-wrap gap-1">
                            {profile.tastes?.map((taste) => (
                              <span key={taste} className="text-[9px] font-bold bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded border border-sky-100">
                                #{taste}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={() => toggleCompare(profile)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              isCompared
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : 'bg-white text-slate-600 border-sky-100 hover:bg-sky-50'
                            }`}
                          >
                            + 比較
                          </button>
                          <Link
                            href={`/${profile.user_id}`}
                            className="flex-1 py-1.5 text-xs font-bold text-center text-white bg-sky-500 hover:bg-sky-600 rounded-xl shadow-xs transition-all flex items-center justify-center"
                          >
                            詳細を見る &gt;
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* 比較固定バー */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white backdrop-blur-md px-6 py-3 rounded-2xl shadow-lg flex items-center gap-6 z-40 border border-slate-700">
          <div className="text-xs font-bold">
            比較リスト: <span className="font-black text-sky-400 text-sm mx-1">{compareList.length}</span> / 3 名
          </div>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            比較表を開く
          </button>
        </div>
      )}

      {/* 比較モーダル（詳細画面） */}
      {isCompareOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-xl relative space-y-4 max-h-[90vh] overflow-y-auto border border-sky-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-800">クリエイター詳細比較</h3>
                <p className="text-[11px] text-slate-500 font-bold">選択したクリエイターのメニュー・条件を一覧で比較できます</p>
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {compareList.map((item) => (
                <div key={item.user_id} className="bg-sky-50/30 p-4 rounded-2xl border border-sky-100 flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="relative w-full aspect-video bg-sky-100/50 rounded-xl overflow-hidden">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-sky-300 font-bold">
                          NO IMAGE
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 text-xs">{item.display_name}</h4>
                      <button
                        onClick={() => toggleCompare(item)}
                        className="text-[10px] text-rose-500 font-bold hover:underline cursor-pointer"
                      >
                        削除
                      </button>
                    </div>

                    <div className="text-xs space-y-2 bg-white p-3 rounded-xl border border-sky-100/60">
                      {/* メニュー一覧 */}
                      <div className="space-y-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700 block">主な料金</span>
                        {item.menu_items && item.menu_items.length > 0 ? (
                          item.menu_items.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-[10px]">
                              <span className="text-slate-500 font-medium">{m.title}</span>
                              <span className="font-bold text-sky-600">
                                {typeof m.price === 'number' ? `¥${m.price.toLocaleString()}〜` : '応相談'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-500 font-medium">最安価格</span>
                            <span className="font-bold text-sky-600">¥{item.price_min?.toLocaleString() || '応相談'}〜</span>
                          </div>
                        )}
                      </div>

                      {/* 制作条件・各種対応項目の比較 */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">AI使用方針</span>
                          <span className="font-bold text-sky-800">
                            {item.ai_usage === 'none' ? '完全手描き' : item.ai_usage === 'partial' ? '一部AI使用' : item.ai_usage === 'main' ? 'AIメイン' : '未設定'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">R-18対応</span>
                          <span className={`font-bold ${item.r18_allowed ? 'text-rose-500' : 'text-slate-400'}`}>
                            {item.r18_allowed ? '可能 (R-18 OK)' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">無料リテイク</span>
                          <span className="font-bold text-slate-700">
                            {typeof item.free_revision_count === 'number' ? `${item.free_revision_count}回まで` : '要相談'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">納期目安</span>
                          <span className="font-bold text-slate-700">{item.lead_time_days || 14}日以内</span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">特急対応</span>
                          <span className={`font-bold ${item.express_option_available ? 'text-amber-500' : 'text-slate-400'}`}>
                            {item.express_option_available ? '相談可' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">商用利用</span>
                          <span className={`font-bold ${item.commercial_use_allowed ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {item.commercial_use_allowed ? '可能' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">著作権譲渡</span>
                          <span className={`font-bold ${item.copyright_transfer_available ? 'text-sky-700' : 'text-slate-400'}`}>
                            {item.copyright_transfer_available ? '相談可' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">いいね数</span>
                          <span className="font-bold text-rose-500">♥ {item.likes_count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/${item.user_id}`}
                    className="block w-full py-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold text-center rounded-xl shadow-xs transition-all"
                  >
                    詳細ページへ
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}