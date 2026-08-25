'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'

type ProfileWithImage = Profile & {
  thumbnail_url?: string | null
}

export default function Home() {
  const [profiles, setProfiles] = useState<ProfileWithImage[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // 検索・フィルター用ステート
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTaste, setSelectedTaste] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [maxLeadTime, setMaxLeadTime] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [commercialOnly, setCommercialOnly] = useState(false)

  // お気に入り・比較ステート
  const [favorites, setFavorites] = useState<string[]>([])
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [compareList, setCompareList] = useState<ProfileWithImage[]>([])
  const [isCompareOpen, setIsCompareOpen] = useState(false)

  // ★ 初回描画時に localStorage からお気に入りリストを復元
  useEffect(() => {
    const storedFavs = localStorage.getItem('favorite_creators')
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs))
      } catch (e) {
        console.error('Failed to load favorites from localStorage', e)
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setIsLoggedIn(true)
    })

    const fetchProfilesWithImages = async () => {
      setLoading(true)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false })

      if (profileError) {
        console.error('profilesの取得に失敗しました:', profileError)
        setLoading(false)
        return
      }

      if (profileData) {
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

        const combined = profileData.map((p) => ({
          ...p,
          thumbnail_url: p.avatar_url || imageMap[p.user_id] || null,
        }))

        setProfiles(combined)
      }
      setLoading(false)
    }

    fetchProfilesWithImages()
  }, [])

  // ★ お気に入りの追加 / 解除と同時に localStorage に保存
  const toggleFavorite = (userId: string) => {
    setFavorites((prev) => {
      const nextFavorites = prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
      
      localStorage.setItem('favorite_creators', JSON.stringify(nextFavorites))
      return nextFavorites
    })
  }

  const toggleCompare = (profile: ProfileWithImage) => {
    setCompareList((prev) => {
      const exists = prev.some((p) => p.user_id === profile.user_id)
      if (exists) {
        return prev.filter((p) => p.user_id !== profile.user_id)
      } else {
        if (prev.length >= 3) {
          alert('比較できるのは最大3名までです')
          return prev
        }
        return [...prev, profile]
      }
    })
  }

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedTaste('ALL')
    setStatusFilter('ALL')
    setMaxLeadTime('')
    setMaxPrice('')
    setCommercialOnly(false)
    setShowFavoritesOnly(false)
  }

  const filteredProfiles = profiles.filter((profile) => {
    const matchesSearch =
      profile.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (profile.status_comment && profile.status_comment.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesTaste =
      selectedTaste === 'ALL' || (profile.tastes && profile.tastes.includes(selectedTaste))

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

  const allTastes = Array.from(new Set(profiles.flatMap((p) => p.tastes || [])))

  return (
    <div className="min-h-screen bg-slate-50/80 text-slate-800 pb-28 font-sans antialiased selection:bg-indigo-600 selection:text-white">
      {/* ヘッダー */}
      <header className="px-6 py-4 bg-white/80 backdrop-blur-lg border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-sm shadow-indigo-200">
              I
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                イラストレーターサーチ
              </h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                理想のクリエイターと出会うプラットフォーム
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 border cursor-pointer ${
                showFavoritesOnly
                  ? 'bg-rose-50 text-rose-600 border-rose-200 shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <svg className={`w-4 h-4 ${showFavoritesOnly ? 'fill-rose-500 text-rose-500' : 'fill-none stroke-slate-500'}`} viewBox="0 0 24 24" strokeWidth="2">
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
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm hover:shadow-md"
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
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 sticky top-24">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <h2 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    条件で絞り込む
                  </h2>
                </div>
                <button
                  onClick={resetFilters}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors cursor-pointer"
                >
                  リセット
                </button>
              </div>

              {/* キーワード検索 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">キーワード</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="名前、説明、キーワード..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">予算上限</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">¥</span>
                    <input
                      type="number"
                      step="1000"
                      placeholder="上限なし"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : '')}
                      className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">以下</span>
                </div>
              </div>

              {/* 納期目安 */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">希望納期</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="指定なし"
                    value={maxLeadTime}
                    onChange={(e) => setMaxLeadTime(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <span className="text-xs text-slate-400 font-medium whitespace-nowrap">日以内</span>
                </div>
              </div>

              {/* 受付ステータス */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 block">受付状況</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium"
                >
                  <option value="ALL">すべて</option>
                  <option value="available">即対応可</option>
                  <option value="busy">相談受付中</option>
                </select>
              </div>

              {/* 商用利用トグル */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">
                    商用利用OKのみ
                  </span>
                  <input
                    type="checkbox"
                    checked={commercialOnly}
                    onChange={(e) => setCommercialOnly(e.target.checked)}
                    className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                </label>
              </div>

              {/* テイストフィルター */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <label className="text-xs font-semibold text-slate-600 block">テイスト・カテゴリ</label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                  <button
                    onClick={() => setSelectedTaste('ALL')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                      selectedTaste === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    すべて
                  </button>
                  {allTastes.map((taste) => (
                    <button
                      key={taste}
                      onClick={() => setSelectedTaste(taste)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        selectedTaste === taste
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      #{taste}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* メインリスト */}
          <section className="lg:col-span-3 space-y-4">
            <div className="flex justify-between items-center px-1">
              <p className="text-xs text-slate-500 font-medium">
                検索結果 <span className="font-bold text-slate-900 text-base mx-1">{filteredProfiles.length}</span> 件
              </p>
              {showFavoritesOnly && (
                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1 rounded-full border border-rose-100">
                  お気に入り中
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="bg-white rounded-2xl p-4 border border-slate-200/80 animate-pulse space-y-3">
                    <div className="aspect-[4/3] bg-slate-100 rounded-xl"></div>
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                  </div>
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <svg className="w-12 h-12 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-sm font-bold text-slate-700">該当するクリエイターが見つかりませんでした</p>
                <p className="text-xs text-slate-400">検索条件を変更して再度お試しください。</p>
                <button
                  onClick={resetFilters}
                  className="mt-2 inline-block px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-all cursor-pointer"
                >
                  条件を初期化する
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {filteredProfiles.map((profile) => {
                  const isFav = favorites.includes(profile.user_id)
                  const isCompared = compareList.some((p) => p.user_id === profile.user_id)

                  return (
                    <div
                      key={profile.user_id}
                      className="group bg-white rounded-2xl border border-slate-200/80 hover:border-indigo-300/80 shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden"
                    >
                      {/* イラスト画像エリア */}
                      <div className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden">
                        {profile.thumbnail_url ? (
                          <img
                            src={profile.thumbnail_url}
                            alt={profile.display_name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-100/80">
                            <svg className="w-10 h-10 opacity-30 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-[10px] font-semibold text-slate-400 tracking-wider">NO IMAGE</span>
                          </div>
                        )}

                        {/* 受付ステータスバッジ */}
                        <div className="absolute top-3 left-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-xs backdrop-blur-md ${
                              profile.status === 'available'
                                ? 'bg-emerald-500/90 text-white'
                                : 'bg-amber-500/90 text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            {profile.status === 'available' ? '即対応可' : '相談受付中'}
                          </span>
                        </div>

                        {/* お気に入りボタン */}
                        <button
                          type="button"
                          onClick={() => toggleFavorite(profile.user_id)}
                          className={`absolute top-3 right-3 p-2 rounded-full bg-white/80 hover:bg-white backdrop-blur-md transition-all duration-200 shadow-xs cursor-pointer ${
                            isFav ? 'text-rose-500 scale-105' : 'text-slate-400 hover:text-rose-500'
                          }`}
                        >
                          <svg className={`w-4 h-4 ${isFav ? 'fill-current' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth="2">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                          </svg>
                        </button>

                        {/* オーバーレイグラデーション & 最低価格 */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent p-3 pt-8 flex justify-between items-end">
                          <div>
                            <span className="text-[10px] text-slate-300 font-medium block">参考価格</span>
                            <span className="text-white font-black text-base tracking-tight leading-none">
                              {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                            </span>
                          </div>
                          {profile.commercial_use_allowed && (
                            <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-md border border-white/20">
                              商用利用OK
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 情報本文エリア */}
                      <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
                            {profile.display_name}
                          </h3>
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                            {profile.status_comment || 'プロフィール文は設定されていません。'}
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">
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
                              <span key={taste} className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
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
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-xs'
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
                          className="flex-1 py-2.5 text-xs font-semibold text-center text-white bg-slate-900 hover:bg-indigo-600 rounded-xl transition-all duration-200 shadow-xs hover:shadow-md flex items-center justify-center gap-1"
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white backdrop-blur-md px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-6 z-40 border border-slate-700/80 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-xs font-medium">
            比較リスト: <span className="font-bold text-indigo-400 text-sm ml-1">{compareList.length}</span> / 3 名
          </div>
          <button
            onClick={() => setIsCompareOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            比較表を開く
          </button>
        </div>
      )}

      {/* 比較モーダル */}
      {isCompareOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl relative space-y-5 border border-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">クリエイター比較表</h3>
                <p className="text-xs text-slate-400">選択した最大3名の仕様と条件を比較できます</p>
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {compareList.map((item) => (
                <div key={item.user_id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-900 text-sm">{item.display_name}</h4>
                      <button
                        onClick={() => toggleCompare(item)}
                        className="text-[11px] text-rose-500 font-semibold hover:underline cursor-pointer"
                      >
                        削除
                      </button>
                    </div>

                    <div className="text-xs space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200/60">
                      <div className="flex justify-between">
                        <span className="text-slate-400">参考最安価格</span>
                        <span className="font-bold text-indigo-600">¥{item.price_min?.toLocaleString() || '応相談'}〜</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">納期目安</span>
                        <span className="font-semibold text-slate-700">{item.lead_time_days || 14}日以内</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">商用利用</span>
                        <span className={`font-semibold ${item.commercial_use_allowed ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {item.commercial_use_allowed ? '可能' : '不可'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/creator/${item.user_id}`}
                    className="block w-full py-2.5 bg-slate-900 hover:bg-indigo-600 text-white text-xs font-semibold text-center rounded-xl transition-all shadow-xs"
                  >
                    詳細ページを見る
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