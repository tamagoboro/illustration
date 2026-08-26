'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'

type ProfileWithImage = Profile & {
  thumbnail_url?: string | null
  likes_count?: number
}

// 24時間以内に作成・更新されたか判定する関数 (24時間 = 86,400,000ミリ秒)
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

  // 初回描画時に localStorage からお気に入り・比較リストを復元
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
            .select('user_id, image_url')
            .order('sort_order', { ascending: true })

          const imageMap: Record<string, string> = {}
          if (portfolioData) {
            portfolioData.forEach((item) => {
              if (!imageMap[item.user_id]) {
                imageMap[item.user_id] = item.image_url
              }
            })
          }

          // いいね数の擬似算出（IDハッシュ等の一定の数値 + 実装上の加算用ベース）
          const combined: ProfileWithImage[] = profileData.map((p) => {
            const hash = p.user_id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            const baseLikes = (hash % 45) + 5 // 5〜50の擬似的な初期いいね数
            return {
              ...p,
              thumbnail_url: p.avatar_url || imageMap[p.user_id] || null,
              likes_count: baseLikes
            }
          })

          // 初期ランダム配置 (Fisher-Yates)
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

  // お気に入りの追加 / 解除（いいね数にも反映）
  const toggleFavorite = (userId: string) => {
    setFavorites((prev) => {
      const isFav = prev.includes(userId)
      const nextFavorites = isFav
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]

      localStorage.setItem('favorite_creators', JSON.stringify(nextFavorites))

      // プロフィール内のいいね数をローカル更新
      setProfiles((prevProfiles) =>
        prevProfiles.map((p) => {
          if (p.user_id === userId) {
            const currentLikes = p.likes_count || 0
            return { ...p, likes_count: isFav ? Math.max(0, currentLikes - 1) : currentLikes + 1 }
          }
          return p
        })
      )

      return nextFavorites
    })
  }

  // テイスト選択のトグル処理
  const toggleTaste = (taste: string) => {
    setSelectedTastes((prev) =>
      prev.includes(taste)
        ? prev.filter((t) => t !== taste)
        : [...prev, taste]
    )
  }

  // 比較リストのトグル処理（localStorage保存付き）
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

  // フィルタリング＆並び替え処理（メモ化）
  const filteredProfiles = useMemo(() => {
    const list = profiles.filter((profile) => {
      const matchesSearch =
        profile.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (profile.status_comment && profile.status_comment.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesTaste =
        selectedTastes.length === 0 ||
        selectedTastes.every((taste) => profile.tastes && profile.tastes.includes(taste))

      const matchesStatus =
        statusFilter === 'ALL' || profile.status === statusFilter

      const matchesLeadTime =
        maxLeadTime === '' || (profile.lead_time_days && profile.lead_time_days <= Number(maxLeadTime))

      const matchesPrice =
        maxPrice === '' || (profile.price_min && profile.price_min <= Number(maxPrice))

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

    // ソート処理
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
      return 0 // randomの場合は初期ランダム順を維持
    })
  }, [profiles, searchTerm, selectedTastes, statusFilter, maxLeadTime, maxPrice, commercialOnly, showFavoritesOnly, favorites, sortOption])

  // テイストの抽出（メモ化）
  const displayedTastes = useMemo(() => {
    return Array.from(new Set(profiles.flatMap((p) => p.tastes || [])))
      .filter((taste) =>
        taste.toLowerCase().includes(tasteSearch.toLowerCase())
      )
      .slice(0, 20)
  }, [profiles, tasteSearch])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-32 font-sans antialiased selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* 背景装飾グラデーション */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed top-1/3 right-10 w-[500px] h-[500px] bg-pink-100/50 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-500/20">
              ✦
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 tracking-wide leading-none">
                CREATOR SEARCH
              </h1>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                理想のイラストレーターを探す
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 border cursor-pointer ${
                showFavoritesOnly
                  ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200 shadow-sm'
              }`}
            >
              <svg className={`w-4 h-4 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : 'fill-none stroke-slate-400'}`} viewBox="0 0 24 24" strokeWidth="2">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              <span>お気に入り</span>
              {favorites.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {favorites.length}
                </span>
              )}
            </button>
            <Link
              href={isLoggedIn ? '/dashboard' : '/login'}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20"
            >
              {isLoggedIn ? 'ダッシュボード' : 'ログイン / 登録'}
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">

          {/* 検索・絞り込みサイドバー */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6 sticky top-24">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h2 className="font-bold text-slate-800 text-xs tracking-wider">
                    FILTER & SEARCH
                  </h2>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors cursor-pointer"
                >
                  リセット
                </button>
              </div>

              {/* キーワード検索 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">キーワード</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="名前、説明文など..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold">
                      ×
                    </button>
                  )}
                </div>
              </div>

              {/* 予算上限 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">予算上限</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">¥</span>
                    <input
                      type="number"
                      step="1000"
                      placeholder="指定なし"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-medium">以下</span>
                </div>
              </div>

              {/* 納期目安 */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">希望納期</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="指定なし"
                    value={maxLeadTime}
                    onChange={(e) => setMaxLeadTime(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">日以内</span>
                </div>
              </div>

              {/* 受付ステータス */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">受付状況</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                >
                  <option value="ALL">すべて表示</option>
                  <option value="available">即対応可のみ</option>
                  <option value="busy">相談受付中</option>
                </select>
              </div>

              {/* 商用利用トグル */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center justify-between cursor-pointer group py-1">
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                    商用利用可能のみ
                  </span>
                  <input
                    type="checkbox"
                    checked={commercialOnly}
                    onChange={(e) => setCommercialOnly(e.target.checked)}
                    className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer accent-indigo-600"
                  />
                </label>
              </div>

              {/* テイストフィルター */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 block">
                    テイスト（最大20個）
                  </label>
                  {selectedTastes.length > 0 && (
                    <button
                      onClick={() => setSelectedTastes([])}
                      className="text-[10px] text-indigo-600 hover:underline font-medium cursor-pointer"
                    >
                      選択解除
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="テイストを検索..."
                    value={tasteSearch}
                    onChange={(e) => setTasteSearch(e.target.value)}
                    className="w-full px-3 py-1.5 text-[11px] rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  {tasteSearch && (
                    <button
                      onClick={() => setTasteSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {displayedTastes.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-1">
                      一致するテイストが見つかりません
                    </p>
                  ) : (
                    displayedTastes.map((taste) => {
                      const isSelected = selectedTastes.includes(taste)
                      return (
                        <button
                          key={taste}
                          onClick={() => toggleTaste(taste)}
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-transparent shadow-sm'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200/60'
                          }`}
                        >
                          <span>#{taste}</span>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* メインリスト */}
          <section className="lg:col-span-3 space-y-5">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 px-1">
              <p className="text-xs text-slate-500 font-medium">
                該当クリエイター <span className="font-bold text-slate-900 text-base mx-1">{filteredProfiles.length}</span> 名
              </p>

              {/* ソートセレクター */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">並び替え:</span>
                <select
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white rounded-3xl p-4 border border-slate-200/80 animate-pulse space-y-4">
                    <div className="aspect-[4/3] bg-slate-100 rounded-2xl"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-24 bg-white rounded-3xl border border-slate-200/80 space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  🔍
                </div>
                <p className="text-sm font-bold text-slate-700">条件に合うクリエイターが見つかりませんでした</p>
                <p className="text-xs text-slate-400">キーワードやテイストの条件を緩めて再検索してみてください。</p>
                <button
                  onClick={resetFilters}
                  className="mt-2 inline-block px-5 py-2.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer"
                >
                  条件を全リセット
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredProfiles.map((profile) => {
                  const isFav = favorites.includes(profile.user_id)
                  const isCompared = compareList.some((p) => p.user_id === profile.user_id)
                  
                  // updated_at から24時間以内かをチェック
                  const isNew = isRecentlyUpdated(profile.updated_at)

                  return (
                    <div
                      key={profile.user_id}
                      className="group bg-white rounded-3xl border border-slate-200/80 hover:border-indigo-300 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                    >
                      {/* イラスト画像エリア */}
                      <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                        {profile.thumbnail_url ? (
                          <img
                            src={profile.thumbnail_url}
                            alt={profile.display_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                            <svg className="w-10 h-10 opacity-30 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] tracking-widest font-semibold text-slate-400">NO PORTFOLIO</span>
                          </div>
                        )}

                        {/* ステータスバッジ & NEWバッジ */}
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                          {isNew && (
                            <span className="inline-flex items-center text-[10px] px-2.5 py-1 rounded-full font-black bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30 border border-white/20 animate-pulse">
                              NEW
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] px-3 py-1 rounded-full font-bold backdrop-blur-md shadow-sm ${
                              profile.status === 'available'
                                ? 'bg-emerald-500/90 text-white'
                                : 'bg-amber-500/90 text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            {profile.status === 'available' ? '即対応可' : '相談受付中'}
                          </span>
                        </div>

                        {/* お気に入りボタン＆いいね数バッジ */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(profile.user_id)}
                          className={`absolute top-3 right-3 z-10 px-3 py-1.5 rounded-2xl bg-white/80 hover:bg-white backdrop-blur-md transition-all duration-200 shadow-sm border border-slate-200/50 cursor-pointer flex items-center gap-1.5 ${
                            isFav ? 'text-rose-500 scale-105' : 'text-slate-500 hover:text-rose-500'
                          }`}
                        >
                          <svg className={`w-4 h-4 ${isFav ? 'fill-current' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                          <span className="text-xs font-bold">{profile.likes_count ?? 0}</span>
                        </button>

                        {/* オーバーレイグラデーション & 最低価格 */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent p-4 pt-10 flex justify-between items-end z-10">
                          <div>
                            <span className="text-[10px] text-slate-200 font-medium block">参考価格</span>
                            <span className="text-white font-black text-lg tracking-tight leading-none">
                              {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                            </span>
                          </div>
                          {profile.commercial_use_allowed && (
                            <span className="text-[10px] font-bold bg-white/90 backdrop-blur-md text-indigo-600 px-2.5 py-1 rounded-lg shadow-sm">
                              商用利用OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 情報本文エリア */}
                      <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-1.5">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {profile.display_name}
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                            {profile.status_comment || 'プロフィール文は設定されていません。'}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {/* 仕様目安 */}
                          <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-[11px]">納期目安</span>
                            </div>
                            <span className="font-semibold text-slate-700">{profile.lead_time_days || 14}日以内</span>
                          </div>

                          {/* タグ一覧 */}
                          <div className="flex flex-wrap gap-1">
                            {profile.tastes?.map((taste) => (
                              <span key={taste} className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-lg border border-slate-200/50">
                                #{taste}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* アクションボタン */}
                      <div className="px-5 pb-5 flex gap-2.5">
                        <button
                          onClick={() => toggleCompare(profile)}
                          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl border transition-all duration-200 flex items-center justify-center gap-1 cursor-pointer ${
                            isCompared
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {isCompared ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                              選択中
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                              比較
                            </>
                          )}
                        </button>
                        <Link
                          href={`/creator/${profile.user_id}`}
                          className="flex-1 py-2.5 text-xs font-semibold text-center text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-1"
                        >
                          詳細を見る
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </Link>
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-xs font-medium">
            比較リスト: <span className="font-bold text-indigo-400 text-sm ml-1">{compareList.length}</span> / 3 名
          </div>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white rounded-xl text-xs font-semibold transition-all shadow-md shadow-indigo-500/25 cursor-pointer"
          >
            比較表を開く
          </button>
        </div>
      )}

      {/* 比較モーダル（画像表示付き） */}
      {isCompareOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative space-y-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">クリエイター比較</h3>
                <p className="text-xs text-slate-500">選択したクリエイターの条件を並べて比較できます</p>
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {compareList.map((item) => (
                <div key={item.user_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    {/* 比較表内のサムネイル画像 */}
                    <div className="relative w-full aspect-video bg-slate-200 rounded-xl overflow-hidden">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.display_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 font-medium">
                          NO IMAGE
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 text-sm leading-tight">{item.display_name}</h4>
                      <button
                        onClick={() => toggleCompare(item)}
                        className="text-[11px] text-rose-500 font-semibold hover:underline cursor-pointer ml-2 shrink-0"
                      >
                        削除
                      </button>
                    </div>

                    <div className="text-xs space-y-3 bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">最安参考価格</span>
                        <span className="font-bold text-indigo-600">¥{item.price_min?.toLocaleString() || '応相談'}〜</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">納期目安</span>
                        <span className="font-semibold text-slate-700">{item.lead_time_days || 14}日以内</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">商用利用</span>
                        <span className={`font-semibold ${item.commercial_use_allowed ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {item.commercial_use_allowed ? '可能' : '不可'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">いいね数</span>
                        <span className="font-semibold text-rose-500">♥ {item.likes_count ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/creator/${item.user_id}`}
                    className="block w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold text-center rounded-xl transition-all shadow-md shadow-indigo-600/20"
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