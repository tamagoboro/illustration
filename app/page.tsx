'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import { useCompareStore } from '@/store/useCompareStore'
import { loadFavorites, toggleFavoriteRecord } from '@/lib/favorites'
import { SlidersHorizontal, RotateCcw, Search, Wallet, Clock, Tag } from 'lucide-react'
import AvatarRing from '@/components/AvatarRing'
import ProtectedImage from '@/components/ProtectedImage'
import CreatorThumbnailSlideshow, { ThumbnailSlide } from '@/components/CreatorThumbnailSlideshow'
import { MODERATED_PLACEHOLDER_URL } from '@/lib/storageUtils'
import NotificationBell from '@/components/NotificationBell'
import RecentlyViewedCreators from '@/components/RecentlyViewedCreators'
import { isCampaignActive, applyDiscount, formatDiscountBadge, Campaign } from '@/lib/discount'
import { UPDATES } from '@/lib/updates'
import { getSoulStatus } from '@/lib/soulListings'
import { TOP_BANNER } from '@/lib/banner'

// メニュー項目の型定義
type MenuItem = {
  title: string
  price: number | ''
}

// 該当クリエイターがいない・不要になったタグは「ジャンルから探す」の候補から除外する
const HIDDEN_TASTES = new Set(['IRIAMライバー向け'])

// 拡張型定義（追加された制作条件フィールドを反映）
type ProfileWithImage = Profile & {
  thumbnail_url?: string | null
  // カードの自動スライド用（最大3枚、focal_x/yはダッシュボードで指定したサムネイル位置）
  thumbnail_slides?: ThumbnailSlide[]
  likes_count?: number
  menu_items?: MenuItem[] | null
  ai_usage?: string | null
  free_revision_count?: number | null
  express_option_available?: boolean | null
  copyright_transfer_available?: boolean | null
  ai_learning_allowed?: boolean | null
  r18_allowed?: boolean | null
  campaign_enabled?: boolean | null
  active_projects_count?: number | null
  max_projects_capacity?: number | null
  campaign_label?: string | null
  campaign_discount_type?: 'percent' | 'fixed' | null
  campaign_discount_value?: number | null
  campaign_start_at?: string | null
  campaign_end_at?: string | null
}

// 指定の背景画像URL
const BACKGROUND_IMAGE_URL =
  'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

// ヘッダーのナビゲーション（# 始まりはトップページ内の見出しへジャンプ）
const NAV_LINKS = [
  { href: '#news', label: '最新情報' },
  { href: '#pickup', label: 'イラストレーター紹介' },
  { href: '#search', label: 'クリエイターを探す' },
  { href: '/ranking', label: '注目クリエイター' },
  { href: '/feed', label: 'フィード' },
]

// 「イラストレーター紹介」に表示する人数
const PICKUP_COUNT = 4

// 最新情報として表示するお知らせ（日付つきで新しい順に平坦化）
const LATEST_NEWS = UPDATES.flatMap((entry) =>
  entry.items.map((item) => ({ date: entry.date.replace(/-/g, '.'), text: item }))
).slice(0, 5)

// レビューの★表示（平均を0.5刻みで塗る）と件数。レビューが無いときは控えめに「レビューなし」
function StarRating({ stats }: { stats?: { avg: number; count: number } }) {
  if (!stats || stats.count === 0) {
    return <p className="text-[10px] font-bold text-slate-300">★ レビューなし</p>
  }
  const rounded = Math.round(stats.avg * 2) / 2
  return (
    <div
      className="flex items-center gap-1"
      aria-label={`評価 5点中${stats.avg.toFixed(1)}点、レビュー${stats.count}件`}
    >
      <div className="flex text-[12px] leading-none">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = rounded >= i ? 100 : rounded >= i - 0.5 ? 50 : 0
          return (
            <span key={i} className="relative text-slate-200">
              ★
              <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill}%` }}>
                ★
              </span>
            </span>
          )
        })}
      </div>
      <span className="text-[11px] font-black text-slate-700">{stats.avg.toFixed(1)}</span>
      <span className="text-[10px] font-bold text-slate-400">（{stats.count}件）</span>
    </div>
  )
}

// ===== 絞り込みの選択肢 =====
// 予算・納期はタップで選ぶボタン式（数字を打たなくていいように）
const PRICE_OPTIONS = [3000, 5000, 10000, 20000, 30000]
const LEAD_TIME_OPTIONS = [7, 14, 30]

// こだわり条件（タップで複数選べる。選んだ条件をすべて満たす人だけを表示）
type ConditionKey =
  | 'commercial'
  | 'handDrawn'
  | 'express'
  | 'freeRevision'
  | 'copyright'
  | 'r18'
  | 'campaign'
  | 'capacity'
  | 'soul'
  | 'newcomer'
  | 'rated4'
  | 'hasReview'

const CONDITION_GROUPS: { title: string; items: { key: ConditionKey; label: string }[] }[] = [
  {
    title: 'おすすめ',
    items: [
      { key: 'campaign', label: '🎉 キャンペーン中' },
      { key: 'capacity', label: '🟢 空き枠あり' },
      { key: 'soul', label: '🎭 魂募集中' },
      { key: 'newcomer', label: '🌱 新着（30日以内）' },
    ],
  },
  {
    title: '評価',
    items: [
      { key: 'rated4', label: '★4以上' },
      { key: 'hasReview', label: 'レビューあり' },
    ],
  },
  {
    title: 'こだわり条件',
    items: [
      { key: 'commercial', label: '商用利用OK' },
      { key: 'handDrawn', label: '完全手描き' },
      { key: 'express', label: '特急対応' },
      { key: 'freeRevision', label: '無料リテイク' },
      { key: 'copyright', label: '著作権譲渡' },
      { key: 'r18', label: 'R-18対応' },
    ],
  },
]
const CONDITION_LABELS = Object.fromEntries(CONDITION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label]))) as Record<
  ConditionKey,
  string
>

const STATUS_LABELS: Record<string, string> = { available: '即対応可', busy: '相談受付中' }

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [hasDashboardSetup, setHasDashboardSetup] = useState(false)

  // 検索・フィルター・ソート用ステート
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTastes, setSelectedTastes] = useState<string[]>([])
  const [tasteSearch, setTasteSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [maxLeadTime, setMaxLeadTime] = useState<number | ''>('')
  const [maxPrice, setMaxPrice] = useState<number | ''>('')
  const [conditions, setConditions] = useState<ConditionKey[]>([])
  // スマホでは絞り込み欄を折りたたんでおく（PCでは常に表示）
  const [filtersOpen, setFiltersOpen] = useState(false)
  // 魂募集を掲載中（掲載期間内で募集中）のクリエイター
  const [soulCreatorIds, setSoulCreatorIds] = useState<Set<string>>(new Set())
  const [sortOption, setSortOption] = useState<'random' | 'price_asc' | 'price_desc' | 'likes_desc' | 'rating_desc'>('random')
  const [visibleCount, setVisibleCount] = useState(10)

  // お気に入りステート
  const [favorites, setFavorites] = useState<string[]>([])
  const [ringMap, setRingMap] = useState<Record<string, string | null>>({})
  // クリエイターごとのレビュー平均（★）と件数
  const [reviewStats, setReviewStats] = useState<Record<string, { avg: number; count: number }>>({})
  const [badgeMap, setBadgeMap] = useState<Record<string, { isTrending: boolean; isPopularInquiries: boolean; isFastResponder: boolean }>>({})
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [isCompareOpen, setIsCompareOpen] = useState(false)

  // 比較リストは useCompareStore（zustand・永続化）で /compare ページと共有する
  const { selectedIds: compareIds, toggleIllustrator } = useCompareStore()
  const compareList = useMemo(
    () => profiles.filter((p) => compareIds.includes(p.user_id)),
    [profiles, compareIds]
  )

  // ログイン状態を確認しつつお気に入り一覧を読み込む
  // （ログイン中はアカウントに保存された一覧、未ログインはブラウザ保存分を使う）
  useEffect(() => {
    let isMounted = true
    const initFavorites = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id || null
      if (!isMounted) return
      setCurrentUserId(uid)
      if (uid) setIsLoggedIn(true)

      // お気に入り一覧と「クリエイター登録済みか」は互いに独立しているので並行取得する
      const [favs, dashboardSetupRes] = await Promise.all([
        loadFavorites(uid),
        uid
          ? supabase.from('profiles').select('has_dashboard_setup').eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
      if (!isMounted) return
      setFavorites(favs)
      setHasDashboardSetup(!!dashboardSetupRes.data?.has_dashboard_setup)
    }
    initFavorites()
    return () => {
      isMounted = false
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
          const userIds = profileData.map((p) => p.user_id)

          // クリエイターごとに、先頭から最大3枚だけをDB側で絞り込んで取得する
          // （sort_orderにインデックスがあるため、全作品を取ってからJS側で絞るより軽い）。
          // カードで複数枚を自動スライド表示するための材料。1枚しか無いクリエイターは
          // 結果的に1枚だけ返るので、その場合はスライドせず今までどおり静止画になる。
          const { data: portfolioData } = await supabase
            .from('portfolio_items')
            .select('user_id, image_url, focal_x, focal_y, sort_order')
            .in('user_id', userIds)
            .lt('sort_order', 3)
            .order('sort_order', { ascending: true })

          const slidesMap: Record<string, ThumbnailSlide[]> = {}
          if (portfolioData) {
            portfolioData.forEach((item) => {
              // 管理者に非表示にされた作品（代替画像）は、カードの掲載候補から外す
              if (!item.image_url || item.image_url === MODERATED_PLACEHOLDER_URL) return
              if (!slidesMap[item.user_id]) slidesMap[item.user_id] = []
              slidesMap[item.user_id].push({
                url: item.image_url,
                focalX: item.focal_x ?? 50,
                focalY: item.focal_y ?? 50,
              })
            })
          }

          // 作品を1枚も登録していないクリエイターは一覧に出しても価値が低いため非表示にする
          // （アバターだけの空っぽなカードが並ぶのを防ぐ）
          const combined: ProfileWithImage[] = profileData
            .filter((p) => !!slidesMap[p.user_id]?.length)
            .map((p) => ({
              ...p,
              thumbnail_url: slidesMap[p.user_id][0].url,
              thumbnail_slides: slidesMap[p.user_id],
              likes_count: p.likes_count ?? 0,
              menu_items: Array.isArray(p.menu_items) ? p.menu_items : null
            }))

          const randomized = [...combined]
          for (let i = randomized.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomized[i], randomized[j]] = [randomized[j], randomized[i]]
          }

          setProfiles(randomized)

          // 行動データ（PV・問い合わせ数）に基づく実績バッジ。手動申請なしで自動計算されるが、
          // analytics_logs全体を集計する重いクエリなのでトップページを開くたびに毎回叩かないよう、
          // 同じタブ内では10分間だけsessionStorageにキャッシュして再利用する。
          const BADGE_CACHE_KEY = 'drawker_badge_cache_v1'
          const BADGE_CACHE_TTL_MS = 10 * 60 * 1000
          let cachedBadges: any[] | null = null
          try {
            const cached = sessionStorage.getItem(BADGE_CACHE_KEY)
            if (cached) {
              const parsed = JSON.parse(cached)
              if (Date.now() - parsed.savedAt < BADGE_CACHE_TTL_MS) {
                cachedBadges = parsed.data
              }
            }
          } catch (e) {
            // noop
          }

          // リング取得とバッジ取得は互いに独立しているので、直列にawaitせず並行実行して
          // 待ち時間を短縮する（バッジがキャッシュ済みならRPC自体を呼ばない）
          const [ringsResult, badgeResult, reviewsResult, soulsResult] = await Promise.all([
            supabase.from('public_equipped_rings').select('user_id, equipped_ring_id').in('user_id', userIds),
            cachedBadges ? Promise.resolve({ data: cachedBadges }) : supabase.rpc('get_public_creator_badges'),
            supabase.from('reviews').select('creator_id, rating').in('creator_id', userIds),
            supabase.from('soul_listings').select('user_id, starts_at, ends_at, is_closed').in('user_id', userIds),
          ])

          setSoulCreatorIds(
            new Set(
              (soulsResult.data || [])
                .filter((row: { starts_at: string | null; ends_at: string | null; is_closed: boolean }) => getSoulStatus(row) === 'open')
                .map((row: { user_id: string }) => row.user_id)
            )
          )

          const stats: Record<string, { sum: number; count: number }> = {}
          ;(reviewsResult.data || []).forEach((r: { creator_id: string; rating: number }) => {
            if (!stats[r.creator_id]) stats[r.creator_id] = { sum: 0, count: 0 }
            stats[r.creator_id].sum += r.rating
            stats[r.creator_id].count += 1
          })
          setReviewStats(
            Object.fromEntries(
              Object.entries(stats).map(([id, s]) => [id, { avg: s.sum / s.count, count: s.count }])
            )
          )

          const map: Record<string, string | null> = {}
          ;(ringsResult.data || []).forEach((r: any) => {
            map[r.user_id] = r.equipped_ring_id
          })
          setRingMap(map)

          const badgeData = badgeResult.data
          if (!cachedBadges) {
            try {
              sessionStorage.setItem(BADGE_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: badgeData }))
            } catch (e) {
              // noop
            }
          }

          const bMap: Record<string, { isTrending: boolean; isPopularInquiries: boolean; isFastResponder: boolean }> = {}
          ;(badgeData || []).forEach((b: any) => {
            bMap[b.user_id] = {
              isTrending: !!b.is_trending,
              isPopularInquiries: !!b.is_popular_inquiries,
              isFastResponder: !!b.is_fast_responder,
            }
          })
          setBadgeMap(bMap)
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

  // お気に入りの追加 / 解除（ログイン中はアカウントに、未ログインはブラウザに保存）
  const toggleFavorite = async (userId: string) => {
    const isFav = favorites.includes(userId)
    const targetProfile = profiles.find((p) => p.user_id === userId)
    if (!targetProfile) return

    const currentLikes = targetProfile.likes_count ?? 0
    const newLikes = isFav ? Math.max(0, currentLikes - 1) : currentLikes + 1

    const nowFavorite = await toggleFavoriteRecord(currentUserId, userId, isFav)

    setFavorites((prev) =>
      nowFavorite ? [...prev, userId] : prev.filter((fid) => fid !== userId)
    )

    // いいね数はDB側のトリガーが favorite_creators から集計する。数えられるのは
    // ログイン中の他人へのお気に入りだけなので、画面の数もその場合だけ動かす
    // （未ログインのお気に入りはブラウザ保存のみ／自分自身は数えない）
    const countChanged = !!currentUserId && currentUserId !== userId && nowFavorite !== isFav
    if (countChanged) {
      setProfiles((prevProfiles) =>
        prevProfiles.map((p) =>
          p.user_id === userId ? { ...p, likes_count: newLikes } : p
        )
      )
    }
    // compareList は profiles から自動導出されるため、上の setProfiles だけで比較モーダルのいいね数も同期される
  }

  const toggleTaste = (taste: string) => {
    setSelectedTastes((prev) =>
      prev.includes(taste)
        ? prev.filter((t) => t !== taste)
        : [...prev, taste]
    )
  }

  // クリエイターページのタグ（/?tag=○○）や、検索エンジンからのキーワード（/?q=○○）で来たときは、その条件で絞り込んでおく
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tag = params.get('tag')
    const q = params.get('q')
    if (tag) {
      setSelectedTastes([tag])
      setFiltersOpen(true)
    }
    if (q) setSearchTerm(q)
    if (tag || q) document.getElementById('search')?.scrollIntoView({ block: 'start' })
  }, [])

  const toggleCondition = (key: ConditionKey) =>
    setConditions((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const resetFilters = () => {
    setSearchTerm('')
    setSelectedTastes([])
    setTasteSearch('')
    setStatusFilter('ALL')
    setMaxLeadTime('')
    setMaxPrice('')
    setConditions([])
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

      const matchesConditions = conditions.every((key) => {
        const review = reviewStats[profile.user_id]
        switch (key) {
          case 'commercial':
            return profile.commercial_use_allowed === true
          case 'handDrawn':
            return profile.ai_usage === 'none'
          case 'express':
            return profile.express_option_available === true
          case 'freeRevision':
            return typeof profile.free_revision_count === 'number' && profile.free_revision_count >= 1
          case 'copyright':
            return profile.copyright_transfer_available === true
          case 'r18':
            return profile.r18_allowed === true
          case 'campaign':
            return isCampaignActive({
              enabled: profile.campaign_enabled,
              discountType: profile.campaign_discount_type,
              discountValue: profile.campaign_discount_value,
              startAt: profile.campaign_start_at,
              endAt: profile.campaign_end_at,
            })
          case 'capacity':
            return (
              typeof profile.max_projects_capacity === 'number' &&
              (profile.active_projects_count ?? 0) < profile.max_projects_capacity
            )
          case 'soul':
            return soulCreatorIds.has(profile.user_id)
          case 'newcomer':
            return !!profile.created_at && Date.now() - new Date(profile.created_at).getTime() <= 30 * 24 * 60 * 60 * 1000
          case 'rated4':
            return !!review && review.avg >= 4
          case 'hasReview':
            return !!review && review.count > 0
          default:
            return true
        }
      })

      const matchesFavorite =
        !showFavoritesOnly || favorites.includes(profile.user_id)

      return (
        matchesSearch &&
        matchesTaste &&
        matchesStatus &&
        matchesLeadTime &&
        matchesPrice &&
        matchesConditions &&
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
      if (sortOption === 'rating_desc') {
        // 平均が同じなら件数が多い方を上に。レビューが無い人は一番下
        const ra = reviewStats[a.user_id]
        const rb = reviewStats[b.user_id]
        return (rb?.avg ?? -1) - (ra?.avg ?? -1) || (rb?.count ?? 0) - (ra?.count ?? 0)
      }
      if (sortOption === 'random') {
        // サンプル作品（またはアバター）が無いクリエイターは、おすすめ順で上位に来ないよう後ろに回す。
        // 同じグループ内の順序はフェッチ時にシャッフル済みのため、ここでは崩さずグループだけ入れ替える。
        const aHasThumbnail = a.thumbnail_url ? 1 : 0
        const bHasThumbnail = b.thumbnail_url ? 1 : 0
        if (aHasThumbnail !== bHasThumbnail) return bHasThumbnail - aHasThumbnail
      }
      return 0
    })
  }, [profiles, searchTerm, selectedTastes, statusFilter, maxLeadTime, maxPrice, conditions, soulCreatorIds, showFavoritesOnly, favorites, sortOption, reviewStats])

  // 検索条件・並び順を変えたら表示件数を最初の10件に戻す
  useEffect(() => {
    setVisibleCount(10)
  }, [searchTerm, selectedTastes, statusFilter, maxLeadTime, maxPrice, conditions, showFavoritesOnly, sortOption])

  const visibleProfiles = useMemo(
    () => filteredProfiles.slice(0, visibleCount),
    [filteredProfiles, visibleCount]
  )

  // イラストレーター紹介：いいねが多い順（取得時にシャッフル済みなので同数はランダム）
  const pickupProfiles = useMemo(() => {
    return [...profiles]
      .filter((p) => p.thumbnail_url)
      .sort((a, b) => (b.likes_count ?? 0) - (a.likes_count ?? 0))
      .slice(0, PICKUP_COUNT)
  }, [profiles])

  // 新着クリエイター：登録日が新しい順
  const newcomerProfiles = useMemo(() => {
    return profiles
      .filter((p) => p.created_at)
      .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
      .slice(0, 3)
  }, [profiles])

  // ジャンル：そのジャンルのクリエイターが多い順に、人数つきで表示する
  const displayedTastes = useMemo(() => {
    const counts: Record<string, number> = {}
    profiles.forEach((p) => {
      new Set(p.tastes || []).forEach((taste: string) => {
        counts[taste] = (counts[taste] || 0) + 1
      })
    })
    return Object.entries(counts)
      .filter(([taste]) => !HIDDEN_TASTES.has(taste))
      .filter(([taste]) => taste.toLowerCase().includes(tasteSearch.toLowerCase()))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
  }, [profiles, tasteSearch])

  // 今かかっている条件（一覧の上にチップで並べ、✕で個別に解除できる）
  const activeFilterChips: { key: string; label: string; clear: () => void }[] = [
    ...(searchTerm ? [{ key: 'q', label: `「${searchTerm}」`, clear: () => setSearchTerm('') }] : []),
    ...(maxPrice !== '' ? [{ key: 'price', label: `¥${maxPrice.toLocaleString()}以下`, clear: () => setMaxPrice('') }] : []),
    ...(maxLeadTime !== '' ? [{ key: 'lead', label: `${maxLeadTime}日以内`, clear: () => setMaxLeadTime('') }] : []),
    ...(statusFilter !== 'ALL' ? [{ key: 'status', label: STATUS_LABELS[statusFilter] || statusFilter, clear: () => setStatusFilter('ALL') }] : []),
    ...conditions.map((key) => ({ key, label: CONDITION_LABELS[key], clear: () => toggleCondition(key) })),
    ...selectedTastes.map((taste) => ({ key: `t-${taste}`, label: `#${taste}`, clear: () => toggleTaste(taste) })),
    ...(showFavoritesOnly ? [{ key: 'fav', label: '♥ お気に入り', clear: () => setShowFavoritesOnly(false) }] : []),
  ]

  return (
    <div
      className="min-h-screen text-slate-800 pb-32 font-sans antialiased relative bg-cover bg-center"
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

          {/* ナビゲーション（PC） */}
          <nav className="hidden xl:flex items-center gap-1 text-xs font-bold text-slate-600">
            {NAV_LINKS.map((nav) => (
              <a
                key={nav.href}
                href={nav.href}
                className="px-3 py-2 rounded-xl hover:bg-sky-50 hover:text-sky-600 transition-colors whitespace-nowrap"
              >
                {nav.label}
              </a>
            ))}
          </nav>

          {/* アクションボタンエリア */}
          <div className="flex items-center gap-2.5">

            {/* 応援・寄付リンク */}
            <a
              href="https://buy.stripe.com/6oU6oIcOQ7YVckj2v94Ja00"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 text-xs font-bold rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span>☕</span>
              <span className="hidden sm:inline">応援する</span>
            </a>

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

            {/* 通知ベル：ログイン中のみ表示 */}
            <NotificationBell />

            {/* マイページ（ポイント・アイコンリング）ボタン：ログイン中のみ表示 */}
            {isLoggedIn && (
              <Link
                href="/rewards"
                className="px-3.5 py-2 text-xs font-bold rounded-2xl border border-sky-100 bg-white/90 hover:bg-white text-slate-600 hover:text-sky-600 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>🎁</span>
                <span className="hidden sm:inline">マイページ</span>
              </Link>
            )}

            {/* ログイン中でクリエイター登録済みの場合だけダッシュボードへの導線を出す。
                依頼者アカウントには出さず、代わりにクリエイター登録への案内を出す */}
            {isLoggedIn && hasDashboardSetup ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-bold rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-slate-800 hover:bg-slate-700 text-white border border-slate-600"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ダッシュボード</span>
              </Link>
            ) : (
              <Link
                href={isLoggedIn ? '/dashboard' : '/login'}
                className="px-4 py-2 text-xs font-bold rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 bg-gradient-to-r from-sky-400 to-cyan-400 hover:brightness-105 text-white border border-sky-200"
              >
                <span className="text-white">✦</span>
                <span>クリエイター無料登録</span>
              </Link>
            )}

          </div>
        </div>

        {/* ナビゲーション（スマホ・タブレット） */}
        <nav className="xl:hidden max-w-7xl mx-auto flex gap-1.5 overflow-x-auto pt-2 -mb-1 text-[11px] font-bold text-slate-600">
          {NAV_LINKS.map((nav) => (
            <a
              key={nav.href}
              href={nav.href}
              className="px-3 py-1 rounded-full bg-sky-50/80 hover:text-sky-600 whitespace-nowrap"
            >
              {nav.label}
            </a>
          ))}
        </nav>
      </header>

      {/* 最新情報ティッカー */}
      {LATEST_NEWS.length > 0 && (
        <div className="bg-slate-900/80 backdrop-blur-md text-white">
          <Link
            href="/updates"
            className="max-w-7xl mx-auto px-4 sm:px-8 py-2 flex items-center gap-3 text-[11px] font-bold hover:text-sky-200 transition-colors"
          >
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-sky-500 text-[10px] font-black tracking-wider">
              NEWS
            </span>
            <span className="shrink-0 text-slate-400">{LATEST_NEWS[0].date}</span>
            <span className="truncate">{LATEST_NEWS[0].text}</span>
          </Link>
        </div>
      )}

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
        <div className="pt-2">
          <Link
            href="/match"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-105 text-white font-black text-sm shadow-lg transition-all active:scale-95"
          >
            <span>🔮</span> 4つの質問でぴったりのクリエイターを診断する
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Link
            href="/guide"
            className="px-3.5 py-1.5 bg-white/85 backdrop-blur-md rounded-full text-[11px] font-bold text-sky-700 shadow-2xs border border-white/60 hover:bg-white transition-colors"
          >
            はじめての方はこちら
          </Link>
          <Link
            href="/gallery"
            className="px-3.5 py-1.5 bg-white/85 backdrop-blur-md rounded-full text-[11px] font-bold text-sky-700 shadow-2xs border border-white/60 hover:bg-white transition-colors"
          >
            🖼 新着作品
          </Link>
          <Link
            href="/market"
            className="px-3.5 py-1.5 bg-white/85 backdrop-blur-md rounded-full text-[11px] font-bold text-sky-700 shadow-2xs border border-white/60 hover:bg-white transition-colors"
          >
            💰 相場マップ
          </Link>
          <Link
            href="/ranking"
            className="px-3.5 py-1.5 bg-white/85 backdrop-blur-md rounded-full text-[11px] font-bold text-sky-700 shadow-2xs border border-white/60 hover:bg-white transition-colors"
          >
            📊 注目クリエイター
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
        <RecentlyViewedCreators />
      </section>

      {/* 画像バナー（画像・リンク先は lib/banner.ts で設定） */}
      {TOP_BANNER.enabled && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8">
          <a
            href={TOP_BANNER.href}
            {...(TOP_BANNER.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="block overflow-hidden border border-white/40 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <img
              src={TOP_BANNER.imageUrl}
              alt={TOP_BANNER.alt}
              className="w-full aspect-[3/1] object-cover bg-white"
            />
          </a>
        </section>
      )}

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
                <span className="text-[10px] font-bold bg-sky-600/40 text-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200/30">
                  閲覧数が見える
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black tracking-wide">
                イラストレーター・クリエイターの方へ：作品を掲載しませんか？
              </h3>
              <p className="text-xs text-sky-50 font-medium">
                料金表やポートフォリオを登録するだけで、直接ご相談を受け付けられます。
                掲載後は、ページが見られた回数・見積もりされた回数・お気に入り数をダッシュボードで確認できます。
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

      {/* 最新情報 & イラストレーター紹介 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* 最新情報 */}
        <div id="news" className="scroll-mt-32 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-xs tracking-wider text-sky-700">NEWS / 最新情報</h2>
            <Link href="/updates" className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline">
              一覧 →
            </Link>
          </div>

          <ul className="divide-y divide-sky-100">
            {LATEST_NEWS.map((news) => (
              <li key={news.text} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                <span className="text-[10px] font-bold text-slate-400">{news.date}</span>
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">{news.text}</p>
              </li>
            ))}
          </ul>

          {/* 新着クリエイター */}
          {newcomerProfiles.length > 0 && (
            <div className="pt-3 border-t border-sky-100 space-y-2">
              <span className="text-[10px] font-black text-slate-600 block">新着クリエイター</span>
              {newcomerProfiles.map((p) => (
                <Link
                  key={p.user_id}
                  href={`/creator/${p.user_id}`}
                  className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-sky-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-sky-100 overflow-hidden shrink-0">
                    {p.avatar_url && (
                      <img src={p.avatar_url} alt={p.display_name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{p.display_name}</p>
                    <p className="text-[9px] font-bold text-slate-400">
                      {p.created_at!.slice(0, 10).replace(/-/g, '.')} に登録
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* イラストレーター紹介 */}
        <div id="pickup" className="scroll-mt-32 lg:col-span-2 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-sky-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-black text-xs tracking-wider text-sky-700">PICK UP / イラストレーター紹介</h2>
            <Link href="/ranking" className="text-[11px] text-sky-600 hover:text-sky-800 font-bold hover:underline">
              注目クリエイター →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: PICKUP_COUNT }).map((_, n) => (
                <div key={n} className="aspect-[3/4] bg-sky-100/60 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : pickupProfiles.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 py-8 text-center">
              紹介できるイラストレーターがまだいません
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pickupProfiles.map((p) => (
                <Link
                  key={p.user_id}
                  href={`/creator/${p.user_id}`}
                  className="group relative aspect-[3/4] rounded-2xl overflow-hidden bg-sky-50 border border-sky-100 shadow-2xs"
                >
                  <ProtectedImage
                    src={p.thumbnail_url!}
                    alt={p.display_name}
                    watermarkText={p.display_name}
                    loading="lazy"
                    decoding="async"
                    style={{
                      objectPosition: `${p.thumbnail_slides?.[0]?.focalX ?? 50}% ${p.thumbnail_slides?.[0]?.focalY ?? 50}%`,
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/85 via-slate-900/40 to-transparent p-2.5 pt-8 space-y-1 pointer-events-none">
                    <p className="text-white text-xs font-black truncate">{p.display_name}</p>
                    <p className="text-[9px] text-sky-100 font-medium line-clamp-2 leading-relaxed">
                      {p.status_comment || p.tastes?.map((t) => `#${t}`).join(' ')}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-black">
                      <span className="text-white">
                        {p.price_min ? `¥${p.price_min.toLocaleString()}〜` : '応相談'}
                      </span>
                      <span className="text-rose-300">♥ {p.likes_count ?? 0}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* メインコンテンツ */}
      <main id="search" className="scroll-mt-32 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* サイドバー */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-sky-100/80 shadow-sm shadow-sky-100/40 overflow-hidden">
              {/* ヘッダー（スマホではここを押して開閉） */}
              <div className="flex justify-between items-center px-5 py-4 bg-gradient-to-r from-sky-500 via-sky-400 to-cyan-400">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(!filtersOpen)}
                  className="flex items-center gap-2 text-white lg:cursor-default cursor-pointer"
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal size={14} strokeWidth={2.5} />
                  <h2 className="font-black text-xs tracking-wider">絞り込み検索</h2>
                  {activeFilterChips.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white text-sky-600 text-[10px] font-black">{activeFilterChips.length}</span>
                  )}
                  <span className="lg:hidden text-[10px] font-bold text-white/90">{filtersOpen ? '▲ 閉じる' : '▼ 開く'}</span>
                </button>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-[11px] text-white/90 hover:text-white font-bold cursor-pointer transition-colors"
                >
                  <RotateCcw size={11} /> リセット
                </button>
              </div>

              <div className={`p-5 space-y-5 ${filtersOpen ? 'block' : 'hidden'} lg:block`}>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <Search size={12} className="text-sky-400" /> キーワード
                  </label>
                  <input
                    type="text"
                    placeholder="名前、アイコン、立ち絵など..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white focus:border-sky-300 transition-all"
                  />
                </div>

                {/* 予算 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <Wallet size={12} className="text-sky-400" /> 予算（最安価格）
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRICE_OPTIONS.map((price) => (
                      <button
                        key={price}
                        type="button"
                        onClick={() => setMaxPrice(maxPrice === price ? '' : price)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${maxPrice === price ? 'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'}`}
                      >
                        〜¥{price.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 納期 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    <Clock size={12} className="text-sky-400" /> 納期
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {LEAD_TIME_OPTIONS.map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setMaxLeadTime(maxLeadTime === days ? '' : days)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${maxLeadTime === days ? 'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'}`}
                      >
                        {days}日以内
                      </button>
                    ))}
                  </div>
                </div>

                {/* 受付状況 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-500 block">受付状況</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: 'ALL', label: 'すべて' },
                      { value: 'available', label: '即対応可' },
                      { value: 'busy', label: '相談受付中' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setStatusFilter(option.value)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${statusFilter === option.value ? 'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* おすすめ・評価・こだわり条件 */}
                {CONDITION_GROUPS.map((group) => (
                  <div key={group.title} className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 block">{group.title}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {group.items.map((item) => {
                        const selected = conditions.includes(item.key)
                        const isR18 = item.key === 'r18'
                        return (
                          <button
                            key={item.key}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleCondition(item.key)}
                            className={`px-3 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer border ${
                              selected
                                ? isR18
                                  ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                                  : 'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'
                            }`}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* ジャンル */}
                <div className="space-y-2.5 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                      <Tag size={12} className="text-sky-400" /> ジャンル（人気順）
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
                    placeholder="ジャンルを検索..."
                    value={tasteSearch}
                    onChange={(e) => setTasteSearch(e.target.value)}
                    className="w-full px-3.5 py-2 text-[11px] rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white focus:border-sky-300 transition-all"
                  />

                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pt-1">
                    {displayedTastes.length === 0 ? (
                      <p className="text-[10px] text-slate-400 py-1 font-bold">一致するジャンルが見つかりません</p>
                    ) : (
                      displayedTastes.map(([taste, count]) => {
                        const isSelected = selectedTastes.includes(taste)
                        return (
                          <button
                            key={taste}
                            onClick={() => toggleTaste(taste)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-sky-500 text-white border-sky-500 shadow-sm shadow-sky-200'
                                : 'bg-white text-sky-600 border-sky-100 hover:border-sky-300 hover:bg-sky-50'
                            }`}
                          >
                            #{taste}
                            <span className={`ml-1 ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>{count}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
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
                  <option value="rating_desc">評価が高い順</option>
                </select>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.clear}
                    className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur border border-sky-200 text-[11px] font-black text-sky-700 shadow-2xs hover:bg-sky-50 cursor-pointer"
                    aria-label={`${chip.label} の条件を外す`}
                  >
                    {chip.label}
                    <span className="text-slate-400 group-hover:text-rose-500">✕</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetFilters}
                  className="px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:text-rose-500 cursor-pointer drop-shadow-xs"
                >
                  すべてクリア
                </button>
              </div>
            )}

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
                {visibleProfiles.map((profile) => {
                  const isFav = favorites.includes(profile.user_id)
                  const isCompared = compareIds.includes(profile.user_id)
                  const isNew = isRecentlyUpdated(profile.updated_at)
                  
                  // 条件判定（完全手描き＆R-18対応）
                  const isPureHandDrawn = profile.ai_usage === 'none'
                  const isR18Allowed = profile.r18_allowed === true

                  // 行動データに基づく実績バッジ（PV急上昇・問い合わせ多数）
                  const badges = badgeMap[profile.user_id]

                  // キャンペーン割引（最低価格は常にキャンペーンの一律割引に従う）
                  const campaign: Campaign = {
                    enabled: profile.campaign_enabled,
                    discountType: profile.campaign_discount_type,
                    discountValue: profile.campaign_discount_value,
                    startAt: profile.campaign_start_at,
                    endAt: profile.campaign_end_at,
                  }
                  const campaignActive = isCampaignActive(campaign) && !!profile.price_min
                  const discountedPriceMin = campaignActive
                    ? applyDiscount(profile.price_min as number, {
                        type: campaign.discountType as 'percent' | 'fixed',
                        value: campaign.discountValue as number,
                      })
                    : null
                  const priceBadge = campaignActive
                    ? formatDiscountBadge({
                        type: campaign.discountType as 'percent' | 'fixed',
                        value: campaign.discountValue as number,
                      })
                    : null

                  return (
                    <div
                      key={profile.user_id}
                      className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-100/80 shadow-xs hover:shadow-md hover:border-sky-200 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                    >
                      {/* イラスト画像エリア */}
                      <div className="relative w-full aspect-square bg-sky-50/50 overflow-hidden">
                        {profile.thumbnail_slides && profile.thumbnail_slides.length > 1 ? (
                          <CreatorThumbnailSlideshow
                            slides={profile.thumbnail_slides}
                            alt={profile.display_name}
                            watermarkText={profile.display_name}
                            className="w-full h-full object-cover"
                            // すべての候補が読み込みエラーになった場合（稀）の代わりの表示
                            fallback={
                              <div className="w-full h-full flex flex-col items-center justify-center bg-sky-50/80 text-sky-300">
                                <span className="text-[10px] font-black tracking-widest">NO PORTFOLIO</span>
                              </div>
                            }
                          />
                        ) : profile.thumbnail_url ? (
                          <ProtectedImage
                            src={profile.thumbnail_url}
                            alt={profile.display_name}
                            watermarkText={profile.display_name}
                            loading="lazy"
                            decoding="async"
                            style={{
                              objectPosition: `${profile.thumbnail_slides?.[0]?.focalX ?? 50}% ${
                                profile.thumbnail_slides?.[0]?.focalY ?? 50
                              }%`,
                            }}
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

                          {/* 行動データに基づく実績バッジ（手動申請なしで自動計算） */}
                          {badges?.isTrending && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-orange-500 text-white shadow-xs">
                              📈 閲覧数急上昇中
                            </span>
                          )}
                          {badges?.isPopularInquiries && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-violet-500 text-white shadow-xs">
                              🔥 問い合わせ多数
                            </span>
                          )}
                          {badges?.isFastResponder && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-emerald-500 text-white shadow-xs">
                              ⚡ 返信はやい
                            </span>
                          )}

                          <span
                            className={`text-[9px] px-2.5 py-0.5 rounded-full font-black text-white shadow-xs ${
                              profile.status === 'available'
                                ? 'bg-emerald-500'
                                : profile.status === 'stopped'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                          >
                            {profile.status === 'available'
                              ? '即対応可'
                              : profile.status === 'stopped'
                              ? '受注停止中'
                              : '相談受付中'}
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
                            {campaignActive && discountedPriceMin !== null ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-300 text-[10px] line-through decoration-rose-400">
                                  ¥{(profile.price_min as number).toLocaleString()}
                                </span>
                                <span className="text-white font-black text-sm tracking-tight drop-shadow-xs">
                                  ¥{discountedPriceMin.toLocaleString()}〜
                                </span>
                                <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 py-0.5 rounded shadow-2xs">
                                  {priceBadge}
                                </span>
                              </div>
                            ) : (
                              <span className="text-white font-black text-sm tracking-tight drop-shadow-xs">
                                {profile.price_min ? `¥${profile.price_min.toLocaleString()}〜` : '応相談'}
                              </span>
                            )}
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
                            <div className="flex items-center gap-2.5">
                              <AvatarRing
                                src={profile.avatar_url}
                                alt=""
                                size={32}
                                ringId={ringMap[profile.user_id]}
                                fallback={<div className="w-full h-full rounded-full bg-sky-100" />}
                              />
                              <h3 className="font-bold text-xs text-slate-800 line-clamp-1">
                                {profile.display_name}
                              </h3>
                            </div>
                            <StarRating stats={reviewStats[profile.user_id]} />
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
                            onClick={() => toggleIllustrator(profile.user_id)}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              isCompared
                                ? 'bg-sky-100 text-sky-800 border-sky-300'
                                : 'bg-white text-slate-600 border-sky-100 hover:bg-sky-50'
                            }`}
                          >
                            + 比較
                          </button>
                          <Link
                            href={`/creator/${profile.user_id}`}
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

            {/* もっと見る */}
            {filteredProfiles.length > visibleCount && (
              <div className="text-center pt-6">
                <button
                  onClick={() => setVisibleCount((c) => c + 10)}
                  className="px-6 py-2.5 bg-white hover:bg-sky-50 border border-sky-100 text-sky-700 font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
                >
                  もっと見る（残り{filteredProfiles.length - visibleCount}人）
                </button>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* フッターは全ページ共通（components/SiteFooter.tsx。app/layout.tsx で表示） */}

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
                        <ProtectedImage
                          src={item.thumbnail_url}
                          alt={item.display_name}
                          watermarkText={item.display_name}
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
                        onClick={() => toggleIllustrator(item.user_id)}
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
                            {item.ai_usage === 'none' ? '完全手描き' : item.ai_usage === 'partial' ? '一部AI使用' : item.ai_usage === 'full' ? 'AIメイン' : '未設定'}
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
                    href={`/creator/${item.user_id}`}
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