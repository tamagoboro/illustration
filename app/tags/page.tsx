import type { Metadata } from 'next'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

const SITE_NAME = 'Drawker（ドローカー）'

export const metadata: Metadata = {
  title: `ジャンル一覧 | ${SITE_NAME}`,
  description: 'Drawkerに掲載されているクリエイターのジャンル・得意分野を一覧から探せます。',
}

export const revalidate = 300

type TagCount = { tag: string; count: number }

// タグページ(/tags/[tag])やsitemap.tsと同じく、作品を1枚も登録していないクリエイターは
// 数に含めない（そのタグを開いても実際には誰も表示されない、という食い違いを防ぐため）
async function getTagCounts(): Promise<TagCount[]> {
  const { data: profileData } = await supabase
    .from('profiles')
    .select('user_id, tastes')
    .eq('is_public', true)

  const profiles = profileData || []
  const userIds = profiles.map((p) => p.user_id)
  if (userIds.length === 0) return []

  const { data: thumbData } = await supabase
    .from('first_portfolio_thumbnails')
    .select('user_id')
    .in('user_id', userIds)

  const hasPortfolio = new Set((thumbData || []).map((t) => t.user_id))

  const counts: Record<string, number> = {}
  profiles
    .filter((p) => hasPortfolio.has(p.user_id))
    .forEach((p) => {
      ;(p.tastes || []).forEach((t: string) => {
        if (!t) return
        counts[t] = (counts[t] || 0) + 1
      })
    })

  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export default async function TagsIndexPage() {
  const tags = await getTagCounts()

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="ジャンル一覧" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        <div className="text-center space-y-2">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            🏷 ジャンル一覧
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 drop-shadow-sm">ジャンル・得意分野から探す</h1>
          <p className="text-xs text-slate-600 font-medium drop-shadow-sm">
            気になるジャンルを選ぶと、対応しているクリエイターの一覧が見られます。
          </p>
        </div>

        {tags.length === 0 ? (
          <p className="text-center text-sm text-slate-600 font-bold drop-shadow-sm py-16">まだジャンルが登録されていません。</p>
        ) : (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100/60">
            <div className="flex flex-wrap gap-2.5">
              {tags.map(({ tag, count }) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-sky-50 hover:bg-sky-100 border border-sky-100 text-sky-700 text-xs font-bold transition-colors"
                >
                  {tag}
                  <span className="text-[10px] text-sky-400 font-black">{count}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
