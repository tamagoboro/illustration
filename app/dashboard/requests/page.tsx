'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type RequestRow = {
  id: string
  client_id: string
  content: string
  budget: number | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  creator_response: string | null
  created_at: string
  client_display_name?: string | null
}

export default function DashboardRequestsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [statusFilter, setStatusFilter] = useState<'pending' | 'accepted' | 'declined' | 'all'>('pending')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [responseDrafts, setResponseDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUserId(user.id)
      await refreshRequests(user.id)
      setLoading(false)
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const refreshRequests = async (uid: string) => {
    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('creator_id', uid)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('リクエスト一覧の取得エラー:', error)
      return
    }

    const rows = (data || []) as RequestRow[]
    const clientIds = Array.from(new Set(rows.map((r) => r.client_id)))
    if (clientIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', clientIds)
      const nameMap: Record<string, string> = {}
      ;(profilesData || []).forEach((p: any) => {
        nameMap[p.user_id] = p.display_name
      })
      rows.forEach((r) => {
        r.client_display_name = nameMap[r.client_id] || null
      })
    }

    setRequests(rows)
  }

  const respondToRequest = async (id: string, status: 'accepted' | 'declined') => {
    setBusyId(id)
    const { error } = await supabase
      .from('requests')
      .update({
        status,
        creator_response: responseDrafts[id]?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    setBusyId(null)
    if (error) {
      console.error('リクエスト返信エラー:', error)
      alert('更新に失敗しました。時間をおいて再度お試しください。')
      return
    }
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status, creator_response: responseDrafts[id]?.trim() || null } : r))
    )
  }

  const visibleRequests = requests.filter((r) => statusFilter === 'all' || r.status === statusFilter)
  const statusLabel = (s: RequestRow['status']) =>
    s === 'pending' ? '未回答' : s === 'accepted' ? '承諾済み' : s === 'declined' ? '辞退済み' : 'キャンセル済み'

  if (loading) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-24">
      <header className="px-4 sm:px-6 py-3.5 bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            <span>←</span> ダッシュボードへ
          </Link>
          <h1 className="text-sm font-bold text-slate-900">受け取ったリクエスト</h1>
          <span />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(['pending', 'accepted', 'declined', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-xl transition cursor-pointer ${
                statusFilter === s ? 'bg-sky-500 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'すべて' : statusLabel(s)}
              {s !== 'all' && ` (${requests.filter((r) => r.status === s).length})`}
            </button>
          ))}
        </div>

        {visibleRequests.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-12">該当するリクエストはありません</p>
        ) : (
          <div className="space-y-3">
            {visibleRequests.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      r.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : r.status === 'accepted'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {statusLabel(r.status)}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {r.client_display_name || '依頼者'}さん・{new Date(r.created_at).toLocaleString('ja-JP')}
                  </span>
                </div>

                <p className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl">{r.content}</p>

                {r.budget != null && (
                  <p className="text-xs font-bold text-sky-600">提示予算: ¥{r.budget.toLocaleString()}</p>
                )}

                {r.status === 'pending' ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={2}
                      value={responseDrafts[r.id] || ''}
                      onChange={(e) => setResponseDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="返信コメント（任意・辞退理由など）"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToRequest(r.id, 'accepted')}
                        disabled={busyId === r.id}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        承諾する
                      </button>
                      <button
                        onClick={() => respondToRequest(r.id, 'declined')}
                        disabled={busyId === r.id}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-lg cursor-pointer disabled:opacity-50"
                      >
                        辞退する
                      </button>
                    </div>
                  </div>
                ) : (
                  r.creator_response && (
                    <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                      あなたの返信: {r.creator_response}
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
