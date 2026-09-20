import { notFound, permanentRedirect } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// 旧URL（/{id}）は新URL（/creator/{id}）に統合済み。
// 古いブックマークや外部リンク、検索エンジンに残った古いインデックスを
// 正しく新ページへ引き継ぐため、恒久リダイレクト(308)を返す。
// 存在しない・非公開のIDはソフト404にせず、きちんとnotFound()で404を返す
// （そうしないとGoogleがいつまでも壊れたURLをインデックスから消してくれない）。

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function LegacyCreatorRedirectPage({ params }: PageProps) {
  const { id } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', id)
    .eq('is_public', true)
    .maybeSingle()

  if (!profile) {
    notFound()
  }

  permanentRedirect(`/creator/${id}`)
}
