'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'

type ProfileWithImage = Profile & {
  thumbnail_url?: string | null
  likes_count?: number
}

// 指定の背景画像URL
const BACKGROUND_IMAGE_URL =
  'https://cdn.discordapp.com/attachments/1325516564941897890/1542094317131403344/note_.png?ex=6a8ffabf&is=6a8ea93f&hm=e371a8d85e1cc59fc3d1b31d4f3ce16104e6d53abe04fadcb5ce1cf2fdb0c15e&'

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

          // DBの実データをそのまま使用（likes_countがnullの場合は0）
          const combined: ProfileWithImage[] = profileData.map((p) => ({
            ...p,
            thumbnail_url: p.avatar_url || imageMap[p.user_id] || null,
            likes_count: p.likes_count ?? 0
          }))

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

  // お気に入りの追加 / 解除（RPC経由で他人のいいね数も反映＆比較リストも同期）
  const toggleFavorite = async (userId: string) => {
    const isFav = favorites.includes(userId)
    const targetProfile = profiles.find((p) => p.user_id === userId)
    if (!targetProfile) return

    const currentLikes = targetProfile.likes_count ?? 0
    const newLikes = isFav ? Math.max(0, currentLikes - 1) : currentLikes + 1

    // 1. ローカルState（お気に入りIDリスト）の即時反映
    setFavorites((prev) => {
      const nextFavorites = isFav
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]

      localStorage.setItem('favorite_creators', JSON.stringify(nextFavorites))
      return nextFavorites
    })

    // 2. メインリスト（profiles）のいいね数を更新
    setProfiles((prevProfiles) =>
      prevProfiles.map((p) =>
        p.user_id === userId ? { ...p, likes_count: newLikes } : p
      )
    )

    // 3. 比較リスト（compareList）内のいいね数も同期更新
    setCompareList((prevCompare) => {
      const nextCompare = prevCompare.map((p) =>
        p.user_id === userId ? { ...p, likes_count: newLikes } : p
      )
      localStorage.setItem('compare_creators', JSON.stringify(nextCompare))
      return nextCompare
    })

    // 4. Supabase RPCを呼び出して安全に他人のいいね数をDB更新
    const { error } = await supabase.rpc('increment_likes', {
      target_user_id: userId,
      increment_val: isFav ? -1 : 1,
    })

    if (error) {
      console.error('いいね数の更新に失敗しました:', error)
    }
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
    <div
      className="min-h-screen text-slate-900 pb-32 font-sans antialiased relative bg-fixed bg-cover bg-center"
      style={{ backgroundImage: `url(${BACKGROUND_IMAGE_URL})` }}
    >
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] pointer-events-none -z-10" />

      {/* ヘッダー */}
      <header className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-700 flex items-center justify-center text-white font-black text-xs shadow-md">
            ✦
          </div>
          <div>
            <h1 className="text-xs font-black text-slate-950 tracking-wider">
              CREATOR SEARCH
            </h1>
            <p className="text-[10px] text-slate-800 font-extrabold">
              理想のイラストレーターを探す
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3.5 py-2 text-xs font-bold rounded-2xl border transition-all flex items-center gap-1.5 backdrop-blur-md cursor-pointer ${
              showFavoritesOnly
                ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                : 'bg-white/90 text-purple-900 hover:bg-white border-white/90 shadow-sm'
            }`}
          >
            <span className="text-rose-600">♥</span>
            <span>お気に入り</span>
            {favorites.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-800 text-white font-black">
                {favorites.length}
              </span>
            )}
          </button>
          <Link
            href={isLoggedIn ? '/dashboard' : '/login'}
            className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-2xl shadow-md transition-all"
          >
            {isLoggedIn ? 'ダッシュボード' : 'ログイン / 登録'}
          </Link>
        </div>
      </header>

      {/* ヒーローヘッダー */}
      <section className="text-center py-10 px-4 max-w-4xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide font-serif drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
          『誰に頼むか決まらない…』<br />
          そんな時間もったいない。
        </h2>
        <p className="text-2xl sm:text-3xl font-black text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] tracking-widest font-serif pt-1">
          自分にぴったりのクリエイター検索
        </p>
      </section>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

          {/* 検索・絞り込みサイドバー */}
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

              {/* キーワード検索 */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-900 block">キーワード</label>
                <input
                  type="text"
                  placeholder="名前、説明文など..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* 予算上限 */}
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

              {/* 納期目安 */}
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

              {/* 受付ステータス */}
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

              {/* 商用利用トグル */}
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

              {/* テイストフィルター */}
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

              {/* ソートセレクター */}
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
              <div className="text-center py-20 bg-white/90 backdrop-blur-md rounded-3xl border border-white p-6 shadow-md">
                <p className="text-xs font-extrabold text-slate-800">条件に合うクリエイターが見つかりませんでした</p>
                <button
                  onClick={resetFilters}
                  className="mt-3 px-4 py-2 text-xs font-extrabold text-purple-800 bg-purple-100 rounded-xl hover:bg-purple-200 cursor-pointer"
                >
                  条件をリセット
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {filteredProfiles.map((profile) => {
                  const isFav = favorites.includes(profile.user_id)
                  const isCompared = compareList.some((p) => p.user_id === profile.user_id)
                  
                  // updated_at から24時間以内かをチェック
                  const isNew = isRecentlyUpdated(profile.updated_at)

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

                        {/* ステータスバッジ & NEWバッジ */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1">
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
                        </div>

                        {/* お気に入りボタン＆いいね数バッジ */}
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
                            <span className="text-[9px] text-slate-300 font-extrabold block">参考価格</span>
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
                        <div className="space-y-1">
                          <h3 className="font-black text-xs text-slate-950 line-clamp-1">
                            {profile.display_name}
                          </h3>
                          <p className="text-[10px] text-slate-700 font-medium line-clamp-2 leading-relaxed">
                            {profile.status_comment || 'プロフィール文は設定されていません。'}
                          </p>
                        </div>

                        <div className="space-y-1.5">
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
                            href={`/creator/${profile.user_id}`}
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

      {/* 比較モーダル（画像表示付き） */}
      {isCompareOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">クリエイター詳細比較</h3>
                <p className="text-[11px] text-slate-600 font-bold">選択したクリエイターの条件を一覧で比較できます</p>
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
                    {/* 比較表内のサムネイル画像 */}
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
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-bold">最安参考価格</span>
                        <span className="font-black text-purple-800">¥{item.price_min?.toLocaleString() || '応相談'}〜</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-bold">納期目安</span>
                        <span className="font-black text-slate-900">{item.lead_time_days || 14}日以内</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-bold">商用利用</span>
                        <span className={`font-black ${item.commercial_use_allowed ? 'text-emerald-700' : 'text-slate-500'}`}>
                          {item.commercial_use_allowed ? '可能' : '不可'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-bold">いいね数</span>
                        <span className="font-black text-rose-600">♥ {item.likes_count ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/creator/${item.user_id}`}
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