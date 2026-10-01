'use client'

import PrivateCreatorGate from '@/components/PrivateCreatorGate'
import SoulDetailView from '@/components/SoulDetailView'
import { loadSoulPageData } from '@/lib/soulPageData'

// 本人以外には見せない魂募集の詳細ページ（ポートフォリオが非公開、または掲載開始前）。
// 本人ならプレビュー、それ以外の人には案内を表示する（PrivateCreatorGate）
export default function PrivateSoulPreview({
  id,
  soulId,
  reason,
}: {
  id: string
  soulId: string
  reason: 'privateProfile' | 'upcoming'
}) {
  return (
    <PrivateCreatorGate
      creatorId={id}
      load={() => loadSoulPageData(id, soulId)}
      render={(data) => <SoulDetailView id={id} {...data} />}
      bannerText={
        reason === 'privateProfile'
          ? 'あなたのポートフォリオは非公開のため、この魂募集もほかの人には見えていません。'
          : 'この魂募集は掲載開始日の前です。開始日まではあなたにしか見えません。'
      }
      bannerLink={
        reason === 'privateProfile'
          ? { href: '/dashboard', label: 'ダッシュボードで公開する →' }
          : { href: '/dashboard/souls', label: '掲載期間を変更する →' }
      }
      deniedVariant={reason === 'privateProfile' ? 'private' : 'notFound'}
    />
  )
}
