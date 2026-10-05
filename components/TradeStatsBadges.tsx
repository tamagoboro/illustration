'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// クリエイターページの「取引の実績」（合意内容の控えから数える。supabase/add_agreement_safety.sql の get_creator_trade_stats）。
// 件数だけを出し、取引の内容や相手は出さない。どちらも0件なら何も表示しない。
export default function TradeStatsBadges({ creatorId }: { creatorId: string }) {
  const [stats, setStats] = useState<{ completed: number; overdue: number } | null>(null)

  useEffect(() => {
    let active = true
    supabase.rpc('get_creator_trade_stats', { p_user_id: creatorId }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data
      if (active && row) setStats({ completed: Number(row.completed) || 0, overdue: Number(row.overdue) || 0 })
    })
    return () => {
      active = false
    }
  }, [creatorId])

  if (!stats) return null
  return (
    <>
      {stats.completed > 0 && (
        <span
          title="Drawkerの「合意内容の控え」で、依頼者が受け取りを確認した取引の数です"
          className="text-[11px] bg-emerald-500/10 text-emerald-800 font-extrabold px-3 py-0.5 rounded-full border border-emerald-300 shadow-2xs"
        >
          🤝 取引完了 {stats.completed}件
        </span>
      )}
      {stats.overdue > 0 && (
        <span
          title="「合意内容の控え」で、納期を過ぎてもまだ納品の記録がない取引の数です"
          className="text-[11px] bg-amber-500/10 text-amber-800 font-extrabold px-3 py-0.5 rounded-full border border-amber-300 shadow-2xs"
        >
          ⚠ 納期を過ぎた未納品 {stats.overdue}件
        </span>
      )}
    </>
  )
}
