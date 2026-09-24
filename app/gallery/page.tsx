import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ProtectedImage from '@/components/ProtectedImage'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

export const revalidate = 300

type GalleryItem = {
  id: string
  user_id: string
  image_url: string
  title: string | null
  display_name: string
  avatar_url: string | null
}

// クリエイター単位ではなく作品単位で新着を並べる発見導線。
// 一覧ページは既にクリエイターカード中心のため、こちらは「作品を見てから作者に飛ぶ」体験に振っている。
async function getRecentPortfolioItems(): Promise<GalleryItem[]> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .eq('is_public', true)

  const profileMap = new Map((profileData || []).map((p) => [p.user_id, p]))
  if (profileMap.size === 0) return []

  const { data: itemData } = await supabase
    .from('portfolio_items')
    .select('id, user_id, image_url, title, created_at')
    .order('created_at', { ascending: false })
    .limit(300)

  return (itemData || [])
    .filter((item) => !!item.image_url && profileMap.has(item.user_id))
    .slice(0, 60)
    .map((item) => {
      const profile = profileMap.get(item.user_id)!
      return {
        id: item.id,
        user_id: item.user_id,
        image_url: item.image_url,
        title: item.title,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      }
    })
}

export default async function GalleryPage() {
  const items = await getRecentPortfolioItems()

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="新着作品ギャラリー" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            🖼 新着作品ギャラリー
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">全クリエイターの新着作品から探す</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">気になる作品をクリックすると、その作者のページに移動します。</p>
        </div>

        {items.length === 0 ? (
          <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-16">まだ作品がありません。</p>
        ) : (
          <div className="columns-2 sm:columns-3 md:columns-4 gap-3 [column-fill:_balance]">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/creator/${item.user_id}`}
                className="block mb-3 break-inside-avoid rounded-2xl overflow-hidden border border-sky-100/60 bg-white shadow-xs hover:shadow-md transition-all group relative"
              >
                <ProtectedImage
                  src={item.image_url}
                  alt={item.title || item.display_name}
                  watermarkText={item.display_name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-500"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2.5 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.avatar_url && (
                    <img src={item.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover border border-white/60" />
                  )}
                  <span className="text-[11px] font-bold text-white line-clamp-1">{item.display_name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
