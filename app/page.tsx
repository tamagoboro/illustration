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
      className="min-h-screen text-slate-900 pb-32 font-sans antialiased relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      <div className="absolute inset-0 bg-slate-900/10 backdrop-brightness-95 pointer-events-none -z-10" />

      {/* ヘッダー */}
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-3 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* ロゴ / ブランドエリア */}
          <Link 
            href="/" 
            className="flex items-center gap-2.5 group cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-500 to-rose-400 flex items-center justify-center text-white font-black text-base shadow-md group-hover:scale-105 transition-transform">
              ✦
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-tight text-slate-800 group-hover:text-purple-700 transition-colors">
                Drawker
              </span>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase -mt-0.5">
                Portfolio Search
              </span>
            </div>
          </Link>

          {/* アクションボタンエリア */}
          <div className="flex items-center gap-2.5">
            
            {/* お気に入りフィルターボタン */}
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`group px-3.5 py-2 text-xs font-extrabold rounded-2xl border transition-all flex items-center gap-2 cursor-pointer active:scale-95 ${
                showFavoritesOnly
                  ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200'
                  : 'bg-white/80 hover:bg-white text-slate-700 hover:text-rose-600 border-slate-200/80 shadow-2xs'
              }`}
            >
              <span 
                className={`text-sm transition-transform group-hover:scale-125 ${
                  showFavoritesOnly ? 'text-white' : 'text-rose-500'
                }`}
              >
                ♥
              </span>
              <span className="hidden sm:inline">お気に入り</span>
              
              {favorites.length > 0 && (
                <span 
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider transition-colors ${
                    showFavoritesOnly 
                      ? 'bg-white text-rose-600' 
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
              className={`px-4 py-2 text-xs font-black rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                isLoggedIn
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border border-slate-700'
                  : 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 hover:opacity-95 text-white ring-2 ring-purple-500/20 shadow-purple-200'
              }`}
            >
              {isLoggedIn ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ダッシュボード</span>
                </>
              ) : (
                <>
                  <span className="text-amber-300">✦</span>
                  <span>クリエイター無料登録</span>
                </>
              )}
            </Link>

          </div>
        </div>
      </header>
      {/* ヒーロー */}
      <section className="text-center py-10 px-4 max-w-4xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide font-serif drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
          『誰に頼むか決まらない…』<br />
          そんな時間もったいない。
        </h2>
        <p className="text-2xl sm:text-3xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] tracking-widest font-serif pt-1">
          自分にぴったりのクリエイター検索
        </p>
      </section>

      {!isLoggedIn && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
          <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-6 text-white border border-purple-400/30 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="text-[10px] font-extrabold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
                  掲載手数料 0円
                </span>
                <span className="text-[10px] font-extrabold bg-purple-400/30 text-purple-100 px-2 py-0.5 rounded-full border border-purple-300/30">
                  ポートフォリオ1分作成
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-wide">
                イラストレーター・クリエイターの方へ：作品を掲載しませんか？
              </h3>
              <p className="text-xs text-purple-200 font-medium">
                料金表やポートフォリオを登録するだけで、直接ご相談を受け付けられます。
              </p>
            </div>
            <Link
              href="/login"
              className="px-6 py-3 bg-white text-purple-950 hover:bg-purple-50 font-black text-xs rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 shrink-0"
            >
              無料で作品を登録・掲載する →
            </Link>
          </div>
        </section>
      )}

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* サイドバー */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-3xl border border-white/80 shadow-lg shadow-purple-900/10 space-y-4">
              <div className="flex justify-between items-center pb-1">
                <div className="flex items-center gap-1.5 text-purple-900">
                  <span className="text-xs">⚙</span>
                  <h2 className="font-black text-xs tracking-wider">
                    FILTER & SEARCH
                  </h2>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-[11px] text-purple-700 font-extrabold hover:underline cursor-pointer"
                >
                  リセット
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 block">キーワード</label>
                <input
                  type="text"
                  placeholder="名前、アイコン、立ち絵など..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 block">予算上限</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="1000"
                    placeholder="指定なし"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-800 font-bold whitespace-nowrap">以下</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 block">希望納期</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="指定なし"
                    value={maxLeadTime}
                    onChange={(e) => setMaxLeadTime(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-800 font-bold whitespace-nowrap">日以内</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 block">受付状況</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                >
                  <option value="ALL">すべて表示</option>
                  <option value="available">即対応可のみ</option>
                  <option value="busy">相談受付中</option>
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-[11px] font-extrabold text-slate-900">商用利用可能のみ</span>
                  <input
                    type="checkbox"
                    checked={commercialOnly}
                    onChange={(e) => setCommercialOnly(e.target.checked)}
                    className="w-4 h-4 rounded accent-purple-700 cursor-pointer"
                  />
                </label>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-extrabold text-slate-900 block">
                    テイスト（最大20個）
                  </label>
                  {selectedTastes.length > 0 && (
                    <button
                      onClick={() => setSelectedTastes([])}
                      className="text-[10px] text-purple-700 hover:underline font-extrabold cursor-pointer"
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
                  className="w-full px-3 py-1.5 text-[10px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />

                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto pt-1">
                  {displayedTastes.length === 0 ? (
                    <p className="text-[10px] text-slate-500 py-1 font-bold">
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
                              ? 'bg-purple-700 text-white'
                              : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
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
            <div className="flex justify-between items-center px-2 py-1 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm">
              <p className="text-xs font-extrabold text-slate-900">
                該当クリエイター <span className="text-sm font-black text-purple-800 mx-1">{filteredProfiles.length}</span> 名
              </p>

              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-slate-900">並び替え:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-extrabold text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
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
                  <div key={n} className="bg-white/90 backdrop-blur-md rounded-3xl p-4 animate-pulse space-y-3 border border-white">
                    <div className="aspect-square bg-slate-200/80 rounded-2xl" />
                    <div className="h-4 bg-slate-200/80 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 bg-white/90 backdrop-blur-md rounded-3xl border border-white p-6 shadow-md space-y-4">
                <p className="text-xs font-extrabold text-slate-800">条件に合うクリエイターが見つかりませんでした</p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={resetFilters}
                    className="px-4 py-2 text-xs font-extrabold text-purple-800 bg-purple-100 rounded-xl hover:bg-purple-200 cursor-pointer"
                  >
                    条件をリセット
                  </button>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-xs font-extrabold text-white bg-purple-700 rounded-xl hover:bg-purple-800 shadow-md"
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
                      className="bg-white/90 backdrop-blur-md rounded-3xl border border-white shadow-lg shadow-purple-900/10 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                    >
                      {/* イラスト画像エリア */}
                      <div className="relative w-full aspect-square bg-slate-100 overflow-hidden">
                        {profile.thumbnail_url ? (
                          <img
                            src={profile.thumbnail_url}
                            alt={profile.display_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                            <span className="text-[10px] font-black tracking-widest">NO PORTFOLIO</span>
                          </div>
                        )}

                        {/* 左上：ステータス & NEW & 追加バッジ */}
                        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1 max-w-[70%]">
                          {isNew && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-pink-600 text-white shadow-md">
                              NEW
                            </span>
                          )}

                          <span
                            className={`text-[9px] px-2.5 py-0.5 rounded-full font-black text-white shadow-md ${
                              profile.status === 'available' ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                          >
                            {profile.status === 'available' ? '即対応可' : '相談受付中'}
                          </span>

                          {/* 完全手描きバッジ */}
                          {isPureHandDrawn && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-indigo-600 text-white shadow-md">
                              ✦ 完全手描き
                            </span>
                          )}

                          {/* R-18対応バッジ */}
                          {isR18Allowed && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-rose-600 text-white shadow-md">
                              R-18 OK
                            </span>
                          )}
                        </div>

                        {/* 右上：お気に入りボタン */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(profile.user_id)}
                          className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-white/95 backdrop-blur-md shadow-md flex items-center gap-1 text-[11px] font-black cursor-pointer active:scale-95 transition-transform ${
                            isFav ? 'text-rose-600' : 'text-purple-800 hover:text-rose-600'
                          }`}
                        >
                          <span>♥</span>
                          <span>{profile.likes_count ?? 0}</span>
                        </button>

                        {/* オーバーレイグラデーション & 最低価格 */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/90 via-slate-900/50 to-transparent p-3 pt-6 flex justify-between items-end">
                          <div>
                            <span className="text-[9px] text-slate-300 font-extrabold block">最安目安</span>
                            <span className="text-white font-black text-sm tracking-tight drop-shadow">
                              {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                            </span>
                          </div>
                          {profile.commercial_use_allowed && (
                            <span className="text-[9px] font-black bg-purple-700 text-white px-1.5 py-0.5 rounded shadow">
                              商用利用OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 情報本文エリア */}
                      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <div className="space-y-0.5">
                            <h3 className="font-black text-xs text-slate-950 line-clamp-1">
                              {profile.display_name}
                            </h3>
                            <p className="text-[10px] text-slate-700 font-medium line-clamp-2 leading-relaxed">
                              {profile.status_comment || 'プロフィール文は設定されていません。'}
                            </p>
                          </div>

                          {/* メニュー料金表 */}
                          <div className="space-y-1 border-t border-slate-100 pt-1.5">
                            <span className="text-[9px] font-black text-slate-800 block">料金メニュー</span>
                            {profile.menu_items && profile.menu_items.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {profile.menu_items.slice(0, 3).map((menu, index) => (
                                  <div
                                    key={index}
                                    className="flex justify-between items-center text-[10px] bg-slate-100/70 px-2 py-0.5 rounded-md"
                                  >
                                    <span className="font-extrabold text-slate-800 line-clamp-1">{menu.title}</span>
                                    <span className="font-black text-purple-900 whitespace-nowrap">
                                      {typeof menu.price === 'number' ? `¥${menu.price.toLocaleString()}〜` : '応相談'}
                                    </span>
                                  </div>
                                ))}
                                {profile.menu_items.length > 3 && (
                                  <span className="text-[8px] text-slate-500 text-right font-extrabold block">
                                    他 {profile.menu_items.length - 3} 件のメニュー
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-500 font-bold bg-slate-50 p-1.5 rounded-lg text-center">
                                詳細料金はプロフィール参照
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {/* 仕様目安 */}
                          <div className="flex justify-between items-center text-[10px] text-slate-700 font-bold">
                            <span>納期目安</span>
                            <span className="font-extrabold text-slate-900">{profile.lead_time_days || 14}日以内</span>
                          </div>

                          {/* タグ一覧 */}
                          <div className="flex flex-wrap gap-1">
                            {profile.tastes?.map((taste) => (
                              <span key={taste} className="text-[9px] font-extrabold bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded">
                                #{taste}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* アクションボタン */}
                        <div className="flex gap-1.5 pt-1">
                          <button
                            onClick={() => toggleCompare(profile)}
                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                              isCompared
                                ? 'bg-purple-200 text-purple-900 border-purple-400'
                                : 'bg-slate-100 text-purple-900 border-slate-300 hover:bg-purple-100'
                            }`}
                          >
                            + 比較
                          </button>
                          <Link
                            href={`/${profile.user_id}`}
                            className="flex-1 py-1.5 text-xs font-black text-center text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-md transition-all flex items-center justify-center"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-950/95 text-white backdrop-blur-xl px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-slate-800">
          <div className="text-xs font-bold">
            比較リスト: <span className="font-black text-purple-400 text-sm mx-1">{compareList.length}</span> / 3 名
          </div>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
          >
            比較表を開く
          </button>
        </div>
      )}

      {/* 比較モーダル（詳細画面） */}
      {isCompareOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">クリエイター詳細比較</h3>
                <p className="text-[11px] text-slate-600 font-bold">選択したクリエイターのメニュー・条件を一覧で比較できます</p>
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-extrabold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {compareList.map((item) => (
                <div key={item.user_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="relative w-full aspect-video bg-slate-200 rounded-xl overflow-hidden">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-extrabold">
                          NO IMAGE
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-slate-950 text-xs">{item.display_name}</h4>
                      <button
                        onClick={() => toggleCompare(item)}
                        className="text-[10px] text-rose-600 font-extrabold hover:underline cursor-pointer"
                      >
                        削除
                      </button>
                    </div>

                    <div className="text-xs space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                      {/* メニュー一覧 */}
                      <div className="space-y-1 pb-1 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-800 block">主な料金</span>
                        {item.menu_items && item.menu_items.length > 0 ? (
                          item.menu_items.map((m, idx) => (
                            <div key={idx} className="flex justify-between text-[10px]">
                              <span className="text-slate-600 font-bold">{m.title}</span>
                              <span className="font-black text-purple-800">
                                {typeof m.price === 'number' ? `¥${m.price.toLocaleString()}〜` : '応相談'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between text-[10px]">
                            <span className="text-slate-600 font-bold">最安価格</span>
                            <span className="font-black text-purple-800">¥{item.price_min?.toLocaleString() || '応相談'}〜</span>
                          </div>
                        )}
                      </div>

                      {/* 制作条件・各種対応項目の比較 */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">AI使用方針</span>
                          <span className="font-black text-indigo-900">
                            {item.ai_usage === 'none' ? '完全手描き' : item.ai_usage === 'partial' ? '一部AI使用' : item.ai_usage === 'main' ? 'AIメイン' : '未設定'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">R-18対応</span>
                          <span className={`font-black ${item.r18_allowed ? 'text-rose-600' : 'text-slate-500'}`}>
                            {item.r18_allowed ? '可能 (R-18 OK)' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">無料リテイク</span>
                          <span className="font-black text-slate-900">
                            {typeof item.free_revision_count === 'number' ? `${item.free_revision_count}回まで` : '要相談'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">納期目安</span>
                          <span className="font-black text-slate-900">{item.lead_time_days || 14}日以内</span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">特急対応</span>
                          <span className={`font-black ${item.express_option_available ? 'text-amber-600' : 'text-slate-500'}`}>
                            {item.express_option_available ? '相談可' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">商用利用</span>
                          <span className={`font-black ${item.commercial_use_allowed ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {item.commercial_use_allowed ? '可能' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">著作権譲渡</span>
                          <span className={`font-black ${item.copyright_transfer_available ? 'text-indigo-700' : 'text-slate-500'}`}>
                            {item.copyright_transfer_available ? '相談可' : '不可'}
                          </span>
                        </div>

                        <div className="flex justify-between text-[10px]">
                          <span className="text-slate-600 font-bold">いいね数</span>
                          <span className="font-black text-rose-600">♥ {item.likes_count ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 修正箇所：hrefのルートパスを統一 */}
                  <Link
                    href={`/${item.user_id}`}
                    className="block w-full py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-black text-center rounded-xl shadow-md transition-all"
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