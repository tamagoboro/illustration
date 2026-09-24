'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Profile } from '@/lib/supabase'
import { loadFavorites, toggleFavoriteRecord } from '@/lib/favorites'
import ProtectedImage from '@/components/ProtectedImage'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

type FavoriteProfile = Profile & { thumbnail_url: string | null }

export default function FavoritesPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState<FavoriteProfile[]>([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id || null
      setUserId(uid)

      const favoriteIds = await loadFavorites(uid)
      if (favoriteIds.length === 0) {
        setLoading(false)
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', favoriteIds)
        .eq('is_public', true)

      const { data: thumbData } = await supabase
        .from('first_portfolio_thumbnails')
        .select('user_id, image_url')
        .in('user_id', favoriteIds)

      const thumbMap = new Map((thumbData || []).map((t) => [t.user_id, t.image_url]))

      // お気に入り登録順を維持して表示する
      const byId = new Map((profileData || []).map((p) => [p.user_id, p]))
      const ordered = favoriteIds
        .map((id) => byId.get(id))
        .filter((p): p is Profile => !!p)
        .map((p) => ({ ...p, thumbnail_url: thumbMap.get(p.user_id) || null }))

      setProfiles(ordered)
      setLoading(false)
    }
    init()
  }, [])

  const handleRemove = async (creatorId: string) => {
    setProfiles((prev) => prev.filter((p) => p.user_id !== creatorId))
    await toggleFavoriteRecord(userId, creatorId, true)
  }

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="お気に入り一覧" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-rose-100 text-rose-600 rounded-full text-[10px] font-black tracking-wide">
            ♥ お気に入り一覧
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">お気に入りに登録したクリエイター</h1>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-16">読み込み中...</p>
        ) : profiles.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-sky-100/60 space-y-3">
            <p className="text-sm text-slate-500 font-bold">まだお気に入りに登録したクリエイターがいません。</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-black"
            >
              クリエイターを探す
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.user_id}
                className="bg-white/85 backdrop-blur-md rounded-3xl border border-sky-100/80 shadow-xs hover:shadow-md transition-all overflow-hidden group relative"
              >
                <button
                  onClick={() => handleRemove(profile.user_id)}
                  aria-label="お気に入りから削除"
                  className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-rose-500 shadow-xs flex items-center justify-center cursor-pointer"
                >
                  ♥
                </button>
                <Link href={`/creator/${profile.user_id}`}>
                  <div className="relative w-full aspect-square bg-sky-50/50 overflow-hidden">
                    {profile.thumbnail_url ? (
                      <ProtectedImage
                        src={profile.thumbnail_url}
                        alt={profile.display_name}
                        watermarkText={profile.display_name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-sky-50/80 text-sky-300 text-[10px] font-black tracking-widest">
                        NO PORTFOLIO
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-black text-slate-800 line-clamp-1">{profile.display_name}</p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
