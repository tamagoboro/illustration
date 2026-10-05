'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { AGREEMENT_STATUS, Agreement, formatDateTime, formatYen } from '@/lib/agreements'

// 自分の「合意内容の控え」の一覧（クリエイターとして作ったもの・依頼者として受け取ったもの）
export default function AgreementsPage() {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [rows, setRows] = useState<Agreement[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'all' | 'creator' | 'client'>('all')
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) return
      const { data: list, error } = await supabase
        .from('agreements')
        .select('*')
        .or(`creator_id.eq.${uid},client_id.eq.${uid}`)
        .order('created_at', { ascending: false })
      if (error) {
        console.error('控えの一覧の取得エラー:', error)
        setLoadError(true)
        return
      }
      const items = (list || []) as Agreement[]
      setRows(items)
      const ids = Array.from(new Set(items.flatMap((a) => [a.creator_id, a.client_id]).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, display_name').in('user_id', ids)
        setNames(Object.fromEntries((profiles || []).map((p) => [p.user_id, p.display_name || 'ユーザー'])))
      }
    }
    load()
  }, [])

  if (userId === undefined) return <p className="text-center text-xs font-bold text-slate-500 py-10">読み込み中...</p>
  if (userId === null) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-700">控えを見るにはログインが必要です</p>
        <Link href="/login" className="inline-block px-5 py-2.5 rounded-full bg-sky-500 text-white text-xs font-black">
          ログイン
        </Link>
      </div>
    )
  }

  const visible = rows.filter((a) => tab === 'all' || (tab === 'creator' ? a.creator_id === userId : a.client_id === userId))
  const waitingForMe = rows.filter((a) => a.status === 'pending' && a.client_id === userId).length

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-sky-100/60 space-y-3">
        <div>
          <h1 className="text-lg font-black text-slate-900">📝 合意内容の控え</h1>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
            料金・納期・修正回数・使ってよい範囲など、依頼者とクリエイターで決めたことの記録です。同意した控えは、どちらも書き換えられません。
            <Link href="/guide/agreements" className="ml-1 font-bold text-sky-600 underline">
              使い方を見る
            </Link>
          </p>
        </div>
        <Link
          href="/agreements/new"
          className="block text-center rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 py-3 text-sm font-black text-white shadow-sm hover:brightness-105"
        >
          ＋ 控えを作る（クリエイター）
        </Link>
        <p className="text-[10px] text-slate-400">
          Drawkerの直接リクエストで届いた依頼は、
          <Link href="/dashboard/requests" className="underline">
            届いたリクエスト
          </Link>
          の「控えを作る」から作ると、内容が引き継がれます。
        </p>
      </div>

      {waitingForMe > 0 && (
        <p className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800">
          あなたの同意を待っている控えが {waitingForMe} 件あります
        </p>
      )}

      <div className="flex bg-white/90 rounded-full p-1 border border-white/70 w-fit">
        {(
          [
            ['all', 'すべて'],
            ['creator', '作った控え'],
            ['client', '受け取った控え'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-1.5 rounded-full text-[11px] font-black cursor-pointer ${tab === value ? 'bg-sky-500 text-white' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError ? (
        <p className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl text-xs font-bold">
          読み込めませんでした。supabase/add_agreements.sql を実行済みか確認してください。
        </p>
      ) : visible.length === 0 ? (
        <p className="bg-white/90 rounded-3xl p-10 text-center text-xs font-bold text-slate-400">まだ控えはありません</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => {
            const mine = a.creator_id === userId
            const other = mine ? a.client_id : a.creator_id
            return (
              <li key={a.id}>
                <Link href={`/agreements/${a.id}`} className="block bg-white rounded-2xl p-4 shadow-2xs border border-slate-100 hover:border-sky-200 transition">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black text-slate-800 min-w-0 break-words">{a.title}</p>
                    <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${AGREEMENT_STATUS[a.status].className}`}>
                      {AGREEMENT_STATUS[a.status].label}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {mine ? '依頼者' : 'クリエイター'}：{(mine ? a.client_name : a.creator_name) || (other ? names[other] || 'ユーザー' : '未定')}　／　{formatYen(a.price)}
                    {a.version > 1 && `　／　第${a.version}版`}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDateTime(a.created_at)} 作成</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
