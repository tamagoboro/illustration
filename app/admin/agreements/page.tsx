'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { backgroundImageStyle } from '@/lib/background'
import { AGREEMENT_STATUS, Agreement, formatDateTime } from '@/lib/agreements'

type TroubleRow = {
  id: string
  agreement_id: string
  actor_id: string | null
  note: string | null
  created_at: string
}

// 取引のトラブル報告（合意内容の控えの「🚨 トラブルを運営に報告」）の一覧。管理者だけが見られる。
// 控えのページを開くと、内容と進み具合の記録をすべて確認できる。
export default function AdminAgreementTroublesPage() {
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [rows, setRows] = useState<TroubleRow[]>([])
  const [agreements, setAgreements] = useState<Record<string, Agreement>>({})
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (uid) {
        const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
        setIsAdmin(!!adminRow)
        if (adminRow) {
          const { data: events, error } = await supabase
            .from('agreement_events')
            .select('id, agreement_id, actor_id, note, created_at')
            .eq('kind', 'trouble_reported')
            .order('created_at', { ascending: false })
            .limit(200)
          if (error) {
            console.error('トラブル報告の取得エラー:', error)
            setLoadError(true)
          }
          const list = (events || []) as TroubleRow[]
          setRows(list)
          const ids = Array.from(new Set(list.map((r) => r.agreement_id)))
          if (ids.length) {
            const { data: ags } = await supabase.from('agreements').select('*').in('id', ids)
            setAgreements(Object.fromEntries(((ags || []) as Agreement[]).map((a) => [a.id, a])))
          }
        }
      }
      setChecking(false)
    }
    init()
  }, [])

  if (checking) return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  if (!isAdmin) return <div className="p-8 text-center text-sm font-bold text-slate-600">このページは管理者だけが使えます</div>

  return (
    <div className="min-h-screen pb-24 bg-cover bg-center" style={backgroundImageStyle}>
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/admin/reports" className="text-xs font-bold text-slate-500 hover:text-slate-800">
            ← 通報管理
          </Link>
          <h1 className="text-sm font-bold text-slate-900">取引のトラブル報告</h1>
          <span className="w-16" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-3">
        {loadError && (
          <p className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
            読み込めませんでした。supabase/add_agreement_safety.sql を実行済みか確認してください。
          </p>
        )}
        {rows.length === 0 ? (
          <p className="bg-white rounded-3xl p-10 text-center text-xs font-bold text-slate-400">トラブルの報告はありません</p>
        ) : (
          rows.map((row) => {
            const a = agreements[row.agreement_id]
            const reporter = a ? (row.actor_id === a.creator_id ? `クリエイター（${a.creator_name || ''}）` : `依頼者（${a.client_name || ''}）`) : ''
            return (
              <article key={row.id} className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-100 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">{formatDateTime(row.created_at)}</span>
                  {a && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${AGREEMENT_STATUS[a.status].className}`}>
                      {AGREEMENT_STATUS[a.status].label}
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-slate-800">{a?.title || '（控えが見つかりません）'}</p>
                {a && (
                  <p className="text-[11px] text-slate-500">
                    クリエイター：{a.creator_name}（{a.creator_contact}）　依頼者：{a.client_name}（{a.client_contact}）
                  </p>
                )}
                <p className="text-xs text-slate-700 bg-rose-50 rounded-xl px-3 py-2 whitespace-pre-wrap break-words">
                  <span className="font-black">報告者：{reporter}</span>
                  {'\n'}
                  {row.note}
                </p>
                <div className="flex flex-wrap gap-3 text-[11px] font-bold">
                  <Link href={`/agreements/${row.agreement_id}`} target="_blank" className="text-sky-600 hover:underline">
                    控えと記録を開く →
                  </Link>
                  {a?.creator_id && (
                    <Link href={`/admin/users`} className="text-rose-600 hover:underline">
                      ユーザー管理へ →
                    </Link>
                  )}
                </div>
              </article>
            )
          })
        )}
      </div>
    </div>
  )
}
