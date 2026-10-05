'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Agreement, AgreementEvent, AgreementEventKind, EVENT_INFO, PROGRESS_STEPS, formatDateTime, progressIndex } from '@/lib/agreements'

// 同意後の「進み具合と支払いの記録」（supabase/add_agreement_extras.sql の agreement_events）。
// 依頼者は「支払いました」「受け取りました」、クリエイターは「入金確認・制作開始・ラフ提出・納品」を記録でき、
// どちらもメモを残せる。記録は消せない・直せないので、トラブルのときに「いつ何があったか」を示せる。
export default function AgreementProgress({
  agreement,
  userId,
  names,
  onChanged,
}: {
  agreement: Agreement
  userId: string
  names: Record<string, string>
  onChanged?: () => void
}) {
  const [events, setEvents] = useState<AgreementEvent[] | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [okMsg, setOkMsg] = useState('')
  // 解約の申し出・トラブル報告
  const [panel, setPanel] = useState<'terminate' | 'trouble' | null>(null)
  const [panelText, setPanelText] = useState('')
  const [replyNote, setReplyNote] = useState('')

  const isCreator = userId === agreement.creator_id
  // 当事者でない人（運営として見ている管理者など）には、記録・解約・報告のボタンを出さない
  const isParty = isCreator || userId === agreement.client_id
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('agreement_events')
      .select('*')
      .eq('agreement_id', agreement.id)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('進み具合の取得エラー:', error)
      setErrorMsg('進み具合を読み込めませんでした。supabase/add_agreement_extras.sql を実行済みか確認してください。')
      setEvents([])
      return
    }
    setEvents((data || []) as AgreementEvent[])
  }, [agreement.id])

  useEffect(() => {
    load()
  }, [load])

  const record = async (kind: AgreementEventKind) => {
    if (kind === 'received' && !confirm('作品を受け取り、取引を完了にしますか？\n完了にすると、これ以降は進み具合を記録できなくなります。')) return
    setBusy(true)
    setErrorMsg('')
    const { error } = await supabase.rpc('add_agreement_event', { p_id: agreement.id, p_kind: kind, p_note: note.trim() || null })
    setBusy(false)
    if (error) {
      setErrorMsg(error.code === 'P0001' && error.message ? error.message : `記録できませんでした（${error.message}）`)
      return
    }
    setNote('')
    load()
  }

  // 当事者の操作（解約の申し出・返事、トラブル報告）。どれも記録に残り、相手に通知される
  const callRpc = async (fn: string, args: Record<string, unknown>, done: string) => {
    setBusy(true)
    setErrorMsg('')
    setOkMsg('')
    const { error } = await supabase.rpc(fn, args)
    setBusy(false)
    if (error) {
      setErrorMsg(error.code === 'P0001' && error.message ? error.message : `送信できませんでした（${error.message}）`)
      return false
    }
    setOkMsg(done)
    setPanel(null)
    setPanelText('')
    setReplyNote('')
    onChanged?.()
    load()
    return true
  }

  if (events === null) return null

  // 返事を待っている解約の申し出（最後の申し出のあとに承諾・拒否が無いもの）
  const lastRequest = [...events].reverse().find((e) => e.kind === 'termination_requested')
  const openRequest =
    lastRequest &&
    !events.some(
      (e) => (e.kind === 'termination_accepted' || e.kind === 'termination_rejected') && new Date(e.created_at) >= new Date(lastRequest.created_at)
    )
      ? lastRequest
      : null
  const terminated = agreement.status === 'terminated'

  const step = progressIndex(events)
  const done = events.some((e) => e.kind === 'received')
  const has = (k: AgreementEventKind) => events.some((e) => e.kind === k)

  // 自分が押せるボタン。支払い・入金確認・ラフ提出は何度でも（着手金と残金など、分けて払うことがあるため）、
  // 制作開始・納品・受け取りは1回だけ
  const repeatable: AgreementEventKind[] = ['paid', 'payment_confirmed', 'draft']
  const actions: AgreementEventKind[] = (
    isCreator ? (['payment_confirmed', 'started', 'draft', 'delivered'] as const) : (['paid', 'received'] as const)
  ).filter((k) => repeatable.includes(k) || !has(k))

  return (
    <section className="bg-white rounded-3xl p-5 shadow-sm border border-sky-100/60 space-y-4 print:shadow-none">
      <div>
        <h2 className="text-sm font-black text-slate-800">📈 進み具合と支払いの記録</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">記録は双方に通知され、あとから消したり直したりできません。</p>
      </div>

      {/* 段階 */}
      <ol className="grid grid-cols-5 gap-1">
        {PROGRESS_STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-col items-center gap-1">
            <span
              className={`w-full h-1.5 rounded-full ${i <= step ? 'bg-gradient-to-r from-sky-400 to-cyan-400' : 'bg-slate-100'}`}
            />
            <span className={`text-[10px] font-black ${i <= step ? 'text-sky-700' : 'text-slate-300'}`}>{s.label}</span>
          </li>
        ))}
      </ol>

      {/* 記録の一覧 */}
      <ol className="space-y-2">
        <li className="flex gap-2.5 text-xs">
          <span className="shrink-0">🤝</span>
          <span className="min-w-0">
            <span className="font-bold text-slate-700">合意しました</span>
            <span className="block text-[10px] text-slate-400">{formatDateTime(agreement.agreed_at)}</span>
          </span>
        </li>
        {events.map((e) => (
          <li key={e.id} className="flex gap-2.5 text-xs">
            <span className="shrink-0">{EVENT_INFO[e.kind].emoji}</span>
            <span className="min-w-0">
              <span className="font-bold text-slate-700">
                {(e.actor_id && names[e.actor_id]) || '退会したユーザー'}：{EVENT_INFO[e.kind].label}
              </span>
              {e.note && <span className="block text-slate-600 whitespace-pre-wrap break-words">{e.note}</span>}
              <span className="block text-[10px] text-slate-400">{formatDateTime(e.created_at)}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 記録する */}
      {/* 解約の申し出への返事 */}
      {isParty && openRequest && !terminated && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-2 print:hidden">
          {openRequest.actor_id === userId ? (
            <p className="text-xs font-bold text-amber-800">
              ⚠ あなたが解約を申し出ています。相手が承諾するまで、取引は続いています。
            </p>
          ) : (
            <>
              <p className="text-xs font-black text-amber-900">⚠ 相手から解約の申し出が届いています</p>
              <p className="text-xs text-amber-900 whitespace-pre-wrap break-words bg-white/70 rounded-xl px-3 py-2">{openRequest.note}</p>
              <p className="text-[11px] text-amber-800">
                承諾すると、この取引は「双方の合意で解約」になります。返金などの条件に納得できないときは、承諾しないで話し合いましょう。
              </p>
              <textarea
                rows={2}
                maxLength={500}
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                placeholder="返事のコメント（任意）"
                className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm bg-white resize-none"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (confirm('解約を承諾しますか？この取引は解約になり、元に戻せません。'))
                      callRpc('respond_termination', { p_id: agreement.id, p_accept: true, p_note: replyNote.trim() || null }, '解約を承諾しました')
                  }}
                  disabled={busy}
                  className="px-4 py-2 rounded-full bg-amber-500 text-white text-xs font-black hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
                >
                  解約を承諾する
                </button>
                <button
                  onClick={() => callRpc('respond_termination', { p_id: agreement.id, p_accept: false, p_note: replyNote.trim() || null }, '承諾しないと返事しました')}
                  disabled={busy}
                  className="px-4 py-2 rounded-full bg-white border border-amber-300 text-amber-800 text-xs font-black hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
                >
                  承諾しない
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {terminated ? (
        <p className="text-xs font-black text-slate-600 bg-slate-100 rounded-2xl px-4 py-3 text-center">🤝 この取引は、双方の合意で解約されました</p>
      ) : done ? (
        <p className="text-xs font-black text-emerald-600 bg-emerald-50 rounded-2xl px-4 py-3 text-center">🎉 この取引は完了しました</p>
      ) : !isParty ? (
        <p className="text-[11px] font-bold text-slate-400 text-center">当事者ではないため、記録の閲覧のみできます</p>
      ) : (
        <div className="space-y-2 border-t border-slate-100 pt-3 print:hidden">
          <textarea
            rows={2}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isCreator ? 'メモ（任意）例：ラフをXのDMで送りました' : 'メモ（任意）例：銀行振込で15,000円を振り込みました'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {actions.map((kind) => (
              <button
                key={kind}
                onClick={() => record(kind)}
                disabled={busy}
                className={`px-3.5 py-2 rounded-full text-xs font-black disabled:opacity-50 cursor-pointer ${
                  kind === 'received' || kind === 'delivered'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white'
                    : 'bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100'
                }`}
              >
                {EVENT_INFO[kind].emoji} {EVENT_INFO[kind].label}
              </button>
            ))}
            <button
              onClick={() => record('note')}
              disabled={busy || !note.trim()}
              className="px-3.5 py-2 rounded-full text-xs font-black bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              📝 メモだけ残す
            </button>
          </div>
          {!isCreator && has('delivered') && !done && (
            <p className="text-[11px] font-bold text-emerald-700">作品が届いたら「受け取りました」を押して、取引を完了にしましょう。</p>
          )}
        </div>
      )}
      {errorMsg && <p className="text-[11px] font-bold text-rose-500">{errorMsg}</p>}
      {okMsg && <p className="text-[11px] font-bold text-emerald-600">{okMsg}</p>}

      {/* 困ったとき */}
      {isParty && (
      <div className="border-t border-slate-100 pt-3 space-y-2 print:hidden">
        <p className="text-[11px] font-black text-slate-500">困ったとき</p>
        <div className="flex flex-wrap gap-2">
          {!terminated && !done && !openRequest && (
            <button
              onClick={() => setPanel(panel === 'terminate' ? null : 'terminate')}
              className="px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-50 cursor-pointer"
            >
              取引をやめたい（解約の申し出）
            </button>
          )}
          <button
            onClick={() => setPanel(panel === 'trouble' ? null : 'trouble')}
            className="px-3.5 py-1.5 rounded-full bg-white border border-rose-200 text-rose-600 text-[11px] font-black hover:bg-rose-50 cursor-pointer"
          >
            🚨 トラブルを運営に報告
          </button>
        </div>

        {panel === 'terminate' && (
          <div className="rounded-2xl bg-slate-50 p-3.5 space-y-2">
            <p className="text-[11px] text-slate-600 leading-relaxed">
              同意した取引は、一方的にはやめられません。理由と、返金・支払いなどの条件を書いて申し出てください。相手が承諾したときだけ解約になります。
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={panelText}
              onChange={(e) => setPanelText(e.target.value)}
              placeholder="例：体調不良で納期までに描けなくなりました。着手金は全額お返しします。"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white resize-none"
            />
            <button
              onClick={() => callRpc('request_termination', { p_id: agreement.id, p_reason: panelText }, '解約を申し出ました。相手の返事を待ってください')}
              disabled={busy || !panelText.trim()}
              className="px-4 py-2 rounded-full bg-slate-800 text-white text-xs font-black hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
            >
              解約を申し出る
            </button>
          </div>
        )}

        {panel === 'trouble' && (
          <div className="rounded-2xl bg-rose-50 p-3.5 space-y-2">
            <p className="text-[11px] text-rose-800 leading-relaxed">
              納期を過ぎても納品されない、支払ったのに連絡がない、納品したのに支払われない、などを運営に知らせます。この控えと記録が運営に届き、内容を確認して対応します（相手のアカウントの非表示など）。
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={panelText}
              onChange={(e) => setPanelText(e.target.value)}
              placeholder="何が起きているか（いつから連絡がないか、など）"
              className="w-full px-3 py-2 rounded-xl border border-rose-200 text-sm bg-white resize-none"
            />
            <button
              onClick={() => callRpc('report_agreement_trouble', { p_id: agreement.id, p_detail: panelText }, '運営に報告しました。確認して対応します')}
              disabled={busy || !panelText.trim()}
              className="px-4 py-2 rounded-full bg-rose-500 text-white text-xs font-black hover:bg-rose-600 disabled:opacity-40 cursor-pointer"
            >
              運営に報告する
            </button>
            <p className="text-[10px] text-rose-700/80">お金をだまし取られた場合などは、警察相談専用電話「#9110」や消費者ホットライン「188」にもご相談ください。</p>
          </div>
        )}
      </div>
      )}
    </section>
  )
}
