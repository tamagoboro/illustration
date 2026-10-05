'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { copyTextOrShow } from '@/lib/clipboard'
import { AGREEMENT_STATUS, Agreement, agreementDocumentText, contactFromSnsLinks, formatDateTime, toDraft } from '@/lib/agreements'
import AgreementDocument from '@/components/AgreementDocument'
import AgreementProgress from './AgreementProgress'
import ContactInput from '@/components/ContactInput'

type Party = { name: string; avatarUrl: string | null }

// 控えの表示（/agreements/<id>）。クリエイターも依頼者も同じ画面を見る。
//   依頼者：内容を確認して「同意する」／「見直しをお願いする」
//   クリエイター：リンクのコピー・直す・取り下げ・変更版を作る
export default function AgreementView({ id }: { id: string }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined)
  const [agreement, setAgreement] = useState<Agreement | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [creator, setCreator] = useState<Party | null>(null)
  const [client, setClient] = useState<Party | null>(null)
  const [history, setHistory] = useState<Agreement[]>([])
  const [comment, setComment] = useState('')
  // 同意するときの依頼者の連絡先（必須）
  const [clientContact, setClientContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [justCreated, setJustCreated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async () => {
    const { data: rows, error } = await supabase.rpc('get_agreement', { p_id: id })
    const row = (rows as Agreement[] | null)?.[0]
    if (error || !row) {
      if (error) console.error('控えの取得エラー:', error)
      setNotFound(true)
      return
    }
    setAgreement(row)

    const ids = [row.creator_id, row.client_id].filter(Boolean) as string[]
    const { data: profiles } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', ids)
    const toParty = (uid: string | null, fixedName: string | null) => {
      const p = (profiles || []).find((x) => x.user_id === uid)
      if (!uid && !fixedName) return null
      return { name: fixedName || p?.display_name || '退会したユーザー', avatarUrl: p?.avatar_url || null }
    }
    setCreator(toParty(row.creator_id, row.creator_name))
    setClient(toParty(row.client_id, row.client_name))

    // 変更の履歴（元の版をさかのぼる＋この版の変更版）。当事者だけが読める
    const chain: Agreement[] = []
    let parentId = row.parent_id
    while (parentId && chain.length < 20) {
      const { data: parent } = await supabase.from('agreements').select('*').eq('id', parentId).maybeSingle()
      if (!parent) break
      chain.push(parent as Agreement)
      parentId = (parent as Agreement).parent_id
    }
    const { data: children } = await supabase.from('agreements').select('*').eq('parent_id', row.id)
    setHistory([...((children || []) as Agreement[]), ...chain])
  }, [id])

  useEffect(() => {
    setJustCreated(new URLSearchParams(window.location.search).get('created') === '1')
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) return
      load()
      supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', uid)
        .maybeSingle()
        .then(({ data: adminRow }) => setIsAdmin(!!adminRow))
      const { data: me } = await supabase.from('profiles').select('sns_links').eq('user_id', uid).maybeSingle()
      setClientContact((prev) => prev || contactFromSnsLinks(me?.sns_links))
    })
  }, [load])

  const pageUrl = () => `${window.location.origin}/agreements/${id}`

  const respond = async (accept: boolean) => {
    if (accept && clientContact.trim().replace(/^[^:]+:\s*/, '').length < 2) {
      setMessage({ kind: 'error', text: 'あなたの連絡先（X・Bluesky・DiscordなどのID）を入力してください' })
      return
    }
    if (accept && !confirm('この内容で同意しますか？\n同意したあとは、どちらも内容を書き換えられず、一方的に取りやめることもできなくなります。')) return
    setBusy(true)
    setMessage(null)
    const { error } = accept
      ? await supabase.rpc('accept_agreement', { p_id: id, p_contact: clientContact.trim(), p_comment: comment.trim() || null })
      : await supabase.rpc('decline_agreement', { p_id: id, p_comment: comment.trim() || null })
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: error.code === 'P0001' && error.message ? error.message : `送信できませんでした（${error.message}）` })
      return
    }
    setMessage({ kind: 'ok', text: accept ? '同意しました。この控えはマイページの「合意内容の控え」にも残ります。' : '見直しをお願いしました。クリエイターに通知が届きます。' })
    setComment('')
    load()
  }

  const cancel = async () => {
    if (!agreement || !confirm('この控えを取り下げますか？依頼者は同意できなくなります。')) return
    setBusy(true)
    const { error } = await supabase.from('agreements').update({ status: 'cancelled' }).eq('id', id)
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: `取り下げできませんでした（${error.message}）` })
      return
    }
    load()
  }

  const copyAsText = async () => {
    if (!agreement) return
    const footer = [
      '──────────',
      `依頼者：${client?.name || '未定'}${agreement.client_contact ? `（${agreement.client_contact}）` : ''}`,
      `クリエイター：${creator?.name || ''}（${agreement.creator_contact || '連絡先なし'}）`,
      agreement.agreed_at ? `合意日時：${formatDateTime(agreement.agreed_at)}` : `状態：${AGREEMENT_STATUS[agreement.status].label}`,
      `控え番号：${agreement.id.slice(0, 8).toUpperCase()}（第${agreement.version}版）`,
      pageUrl(),
    ]
    const text = agreementDocumentText(
      toDraft(agreement),
      { creator: creator?.name || 'クリエイター', client: client?.name || '（同意した依頼者）' },
      footer
    )
    if (await copyTextOrShow(text)) setMessage({ kind: 'ok', text: '合意書の文章をコピーしました' })
  }

  if (userId === undefined) return <p className="text-center text-xs font-bold text-slate-500 py-10">読み込み中...</p>

  if (userId === null) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-3 shadow-sm">
        <p className="text-3xl">📝</p>
        <p className="text-sm font-black text-slate-800">合意内容の控えが届いています</p>
        <p className="text-xs text-slate-500 leading-relaxed">内容の確認と同意には、ログイン（無料の新規登録）が必要です。ログインすると、このページに戻ってきます。</p>
        <Link href="/login" className="inline-block px-6 py-2.5 rounded-full bg-sky-500 text-white text-xs font-black hover:bg-sky-600">
          ログイン・新規登録
        </Link>
        <p>
          <Link href="/guide/agreements" className="text-[11px] font-bold text-sky-600 underline">
            合意内容の控えとは？（使い方）
          </Link>
        </p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="bg-white rounded-3xl p-8 text-center space-y-3 shadow-sm">
        <p className="text-sm font-black text-slate-800">控えが見つかりませんでした</p>
        <p className="text-xs text-slate-500">リンクが間違っているか、ほかの方あての控えの可能性があります。</p>
        <Link href="/agreements" className="text-xs font-bold text-sky-600 underline">
          自分の控えの一覧へ
        </Link>
      </div>
    )
  }

  if (!agreement) return <p className="text-center text-xs font-bold text-slate-500 py-10">読み込み中...</p>

  const isCreator = userId === agreement.creator_id
  // 運営（管理者）として開いているときは、同意のボタンを出さない
  const canRespond = !isCreator && !isAdmin && agreement.status === 'pending' && (!agreement.client_id || agreement.client_id === userId)
  const status = AGREEMENT_STATUS[agreement.status]

  return (
    <div className="space-y-4">
      {justCreated && isCreator && agreement.status === 'pending' && (
        <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-400 p-5 text-white shadow-sm space-y-2 print:hidden">
          <p className="text-sm font-black">✅ 控えを作りました。次は依頼者に送りましょう</p>
          <p className="text-[11px] font-bold opacity-90">
            下の「リンクをコピー」で、XのDMなどに貼って送ってください。
            {agreement.client_id ? '依頼者にはDrawkerの通知も届いています。' : '依頼者がログインして開くと、同意できます。'}
          </p>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`p-3 rounded-2xl text-xs font-bold border print:hidden ${
            message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-600'
          }`}
        >
          {message.text}
        </p>
      )}

      <article className="bg-white rounded-3xl shadow-sm border border-sky-100/60 overflow-hidden print:shadow-none print:border-slate-300">
        <header className="px-5 sm:px-7 py-5 border-b border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${status.className}`}>{status.label}</span>
            <span className="text-[11px] font-bold text-slate-400">第{agreement.version}版</span>
          </div>
          <p className="text-[10px] font-black tracking-widest text-sky-600">合意内容の控え</p>
          <h1 className="text-xl font-black text-slate-900 leading-snug">{agreement.title}</h1>
          <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-xs pt-1">
            <dt className="font-bold text-slate-400">クリエイター</dt>
            <dd className="font-bold text-slate-700">
              <Link href={`/creator/${agreement.creator_id}`} className="hover:underline">
                {creator?.name}
              </Link>
            </dd>
            {agreement.creator_contact && (
              <>
                <dt className="font-bold text-slate-400">　連絡先</dt>
                <dd className="text-slate-700 break-all">{agreement.creator_contact}</dd>
              </>
            )}
            <dt className="font-bold text-slate-400">依頼者</dt>
            <dd className="font-bold text-slate-700">{client?.name || '（同意した方の名前が入ります）'}</dd>
            {agreement.client_contact && (
              <>
                <dt className="font-bold text-slate-400">　連絡先</dt>
                <dd className="text-slate-700 break-all">{agreement.client_contact}</dd>
              </>
            )}
            <dt className="font-bold text-slate-400">作成</dt>
            <dd className="text-slate-600">{formatDateTime(agreement.created_at)}</dd>
            {agreement.agreed_at && (
              <>
                <dt className="font-bold text-slate-400">同意</dt>
                <dd className="font-bold text-emerald-700">{formatDateTime(agreement.agreed_at)}</dd>
              </>
            )}
          </dl>
        </header>

        <div className="px-5 sm:px-8 py-6">
          <AgreementDocument
            source={toDraft(agreement)}
            names={{ creator: creator?.name || 'クリエイター', client: client?.name || '（同意した依頼者）' }}
            footer={
              <dl className="grid grid-cols-[6.5rem_1fr] gap-y-1 text-xs font-sans">
                <dt className="font-bold text-slate-400">依頼者</dt>
                <dd className="text-slate-700 break-all">
                  {client?.name || '（同意した方の名前が入ります）'}
                  {agreement.client_contact && `（${agreement.client_contact}）`}
                </dd>
                <dt className="font-bold text-slate-400">クリエイター</dt>
                <dd className="text-slate-700 break-all">
                  {creator?.name}
                  {agreement.creator_contact && `（${agreement.creator_contact}）`}
                </dd>
                <dt className="font-bold text-slate-400">合意日時</dt>
                <dd className="text-slate-700">{agreement.agreed_at ? formatDateTime(agreement.agreed_at) : '（まだ同意されていません）'}</dd>
                <dt className="font-bold text-slate-400">控え番号</dt>
                <dd className="text-slate-700">
                  {agreement.id.slice(0, 8).toUpperCase()}（第{agreement.version}版）
                </dd>
              </dl>
            }
          />
          {agreement.client_comment && (
            <p className="mt-4 text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 whitespace-pre-wrap break-words">
              <span className="font-black">依頼者のコメント：</span>
              {agreement.client_comment}
            </p>
          )}
        </div>
      </article>

      {/* 同意後：進み具合と支払いの記録 */}
      {(agreement.status === 'agreed' || agreement.status === 'terminated') && userId && (
        <AgreementProgress
          agreement={agreement}
          userId={userId}
          onChanged={load}
          names={{
            [agreement.creator_id]: creator?.name || 'クリエイター',
            ...(agreement.client_id ? { [agreement.client_id]: client?.name || '依頼者' } : {}),
          }}
        />
      )}

      {/* 依頼者：同意する */}
      {canRespond && (
        <section className="bg-white rounded-3xl p-5 shadow-sm border-2 border-sky-200 space-y-3 print:hidden">
          <p className="text-sm font-black text-slate-800">
            内容を確認して、返事をしてください
            <Link href="/guide/agreements" target="_blank" className="ml-2 text-[11px] font-bold text-sky-600 underline">
              使い方
            </Link>
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            同意すると、この内容が双方の「合意内容の控え」に残り、どちらも書き換えられなくなります。違うところがあれば「見直しをお願いする」でクリエイターに伝えましょう。
          </p>
          <div>
            <p className="text-xs font-black text-slate-700 mb-1">あなたの連絡先（必須）</p>
            <p className="text-[11px] text-slate-400 mb-1.5">X・Bluesky・Discordなど、クリエイターと連絡を取っているアカウント。控えに記録されます</p>
            <ContactInput value={clientContact} onChange={setClientContact} required />
          </div>
          <textarea
            rows={2}
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="コメント（任意）例：よろしくお願いします！／納期を1週間延ばせますか？"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 resize-none"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => respond(true)}
              disabled={busy}
              className="flex-1 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-black hover:brightness-105 disabled:opacity-50 cursor-pointer"
            >
              ✅ この内容で同意する
            </button>
            <button
              onClick={() => respond(false)}
              disabled={busy}
              className="sm:w-56 py-3 rounded-full bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
            >
              見直しをお願いする
            </button>
          </div>
        </section>
      )}

      {/* 操作 */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {isCreator && agreement.status === 'pending' && (
          <>
            <button
              onClick={async () => {
                if (await copyTextOrShow(pageUrl())) setMessage({ kind: 'ok', text: '🔗 リンクをコピーしました。依頼者に送ってください' })
              }}
              className="px-4 py-2.5 rounded-full bg-sky-500 text-white text-xs font-black hover:bg-sky-600 cursor-pointer"
            >
              🔗 リンクをコピー
            </button>
            <Link href={`/agreements/new?edit=${agreement.id}`} className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50">
              ✏️ 内容を直す
            </Link>
            <button onClick={cancel} disabled={busy} className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-rose-500 text-xs font-black hover:bg-rose-50 cursor-pointer">
              取り下げる
            </button>
          </>
        )}
        {isCreator && agreement.status === 'agreed' && (
          <Link href={`/agreements/new?from=${agreement.id}`} className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50">
            📝 変更版を作る
          </Link>
        )}
        {isCreator && (agreement.status === 'declined' || agreement.status === 'cancelled') && (
          <Link href={`/agreements/new?copy=${agreement.id}`} className="px-4 py-2.5 rounded-full bg-sky-500 text-white text-xs font-black hover:bg-sky-600">
            📝 この内容をもとに作り直す
          </Link>
        )}
        <button onClick={copyAsText} className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 cursor-pointer">
          📋 合意書を文字でコピー
        </button>
        <button onClick={() => window.print()} className="px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-black hover:bg-slate-50 cursor-pointer">
          🖨 印刷・PDFで保存
        </button>
      </div>

      {/* 変更の履歴 */}
      {history.length > 0 && (
        <section className="bg-white/90 rounded-3xl p-5 border border-slate-100 space-y-2 print:hidden">
          <p className="text-xs font-black text-slate-700">ほかの版</p>
          <ul className="space-y-1.5">
            {history
              .sort((a, b) => b.version - a.version)
              .map((h) => (
                <li key={h.id}>
                  <Link href={`/agreements/${h.id}`} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100">
                    <span className="text-xs font-bold text-slate-700">
                      第{h.version}版　{h.title}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${AGREEMENT_STATUS[h.status].className}`}>
                      {AGREEMENT_STATUS[h.status].label}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="text-[10px] text-slate-500 leading-relaxed bg-white/85 rounded-2xl px-4 py-3 print:hidden">
        ※ この控えは、当事者どうしで合意した内容を記録するためのものです。Drawkerは取引の当事者ではなく、支払いの仲介や、内容の履行を保証するものではありません。トラブルの際は
        <Link href="/safety" className="underline">
          不審な連絡・詐欺への対処
        </Link>
        もご覧ください。
      </p>
    </div>
  )
}
