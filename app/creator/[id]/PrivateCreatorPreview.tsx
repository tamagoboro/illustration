'use client'

import PrivateCreatorGate from '@/components/PrivateCreatorGate'
import { loadCreatorPageData } from '@/lib/creatorPageData'
import CreatorClient from './CreatorClient'

// 非公開のクリエイターページ。本人ならプレビュー、それ以外は「非公開です」の案内（PrivateCreatorGate）
export default function PrivateCreatorPreview({ id }: { id: string }) {
  return (
    <PrivateCreatorGate
      creatorId={id}
      load={() => loadCreatorPageData(id)}
      render={(data) => (
        <CreatorClient
          id={id}
          initialProfile={data.profile}
          initialWorks={data.initialWorks}
          initialForms={data.estimateForms}
          initialReviews={data.initialReviews}
          creatorRingId={data.creatorRingId}
          initialSouls={data.initialSouls}
        />
      )}
    />
  )
}
