'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ArticleBody from '@/components/articles/ArticleBody'
import ArticleToc from '@/components/articles/ArticleToc'
import { refreshArticlePages, uploadArticleImage } from '@/lib/adminArticles'
import { ARTICLE_CATEGORIES, SLUG_PATTERN, categoryInfo, extractToc, randomSlug, readingMinutes, type Article } from '@/lib/articles'

type Draft = Pick<Article, 'title' | 'slug' | 'category' | 'description' | 'cover_image_url' | 'body'>

const EMPTY: Draft = { title: '', slug: '', category: 'basics', description: '', cover_image_url: null, body: '' }

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400'

// 記事の記入ページ（管理者だけ）。本文は Markdown。ツールバーのボタンで記号を入れられるので、覚えていなくても書ける。
// 画像はボタン・貼り付け（Ctrl+V）・ドラッグ＆ドロップでアップロードして本文に入る。
export default function ArticleEditor({ id }: { id: string }) {
  const router = useRouter()
  const isNew = id === 'new'
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [status, setStatus] = useState<Article['status']>('draft')
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write')
  const [helpOpen, setHelpOpen] = useState(false)

  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data.user?.id
      if (!uid) {
        router.replace(`/login?next=${encodeURIComponent(`/admin/articles/${id}`)}`)
        return
      }
      const { data: adminRow } = await supabase.from('admins').select('user_id').eq('user_id', uid).maybeSingle()
      setIsAdmin(!!adminRow)
      if (adminRow && !isNew) {
        const { data: row } = await supabase.from('articles').select('*').eq('id', id).maybeSingle()
        if (!row) setNotFound(true)
        else {
          const a = row as Article
          setDraft({ title: a.title, slug: a.slug, category: a.category, description: a.description, cover_image_url: a.cover_image_url, body: a.body })
          setStatus(a.status)
          setSavedSlug(a.slug)
        }
      }
      setChecking(false)
    }
    init()
  }, [id, isNew, router])

  // 保存していない変更があるときは、ページを閉じる前に確認する
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // ---- 本文への書き込み ----

  // 選択中の文字を before/after で囲む（選択が無ければ placeholder を入れて選択状態にする）
  const wrapSelection = (before: string, after = '', placeholder = '') => {
    const el = bodyRef.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end, value } = el
    const selected = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + selected + after + value.slice(end)
    update('body', next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, start + before.length + selected.length)
    })
  }

  // カーソルの位置に、前後を空行で区切ったブロックを入れる
  const insertBlock = useCallback((block: string) => {
    const el = bodyRef.current
    const value = el?.value ?? ''
    const pos = el ? el.selectionEnd : value.length
    const before = value.slice(0, pos)
    const after = value.slice(pos)
    const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
    const tail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
    const next = before + lead + block + tail + after
    setDraft((prev) => ({ ...prev, body: next }))
    setDirty(true)
    const caret = (before + lead + block).length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }, [])

  const uploadImages = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/'))
      if (images.length === 0) return
      setUploading(true)
      setMessage(null)
      try {
        for (const file of images) {
          const url = await uploadArticleImage(file)
          insertBlock(`![画像の説明](${url})`)
        }
      } catch (e) {
        console.error('記事画像のアップロードエラー:', e)
        setMessage({ kind: 'error', text: `画像をアップロードできませんでした（${e instanceof Error ? e.message : '通信エラー'}）` })
      } finally {
        setUploading(false)
      }
    },
    [insertBlock]
  )

  const insertEmbed = () => {
    const url = window.prompt('埋め込むURLを貼り付けてください（YouTube・ニコニコ・Vimeo は動画、それ以外はリンクカードになります）')
    if (!url) return
    if (!/^https?:\/\/\S+$/.test(url.trim())) {
      setMessage({ kind: 'error', text: 'URLは https:// から始まる形で入力してください' })
      return
    }
    insertBlock(url.trim())
  }

  const insertLink = () => {
    const url = window.prompt('リンク先のURL')
    if (!url) return
    wrapSelection('[', `](${url.trim()})`, 'リンクの文字')
  }

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      update('cover_image_url', await uploadArticleImage(file, 1600))
    } catch (err) {
      setMessage({ kind: 'error', text: `カバー画像をアップロードできませんでした（${err instanceof Error ? err.message : '通信エラー'}）` })
    } finally {
      setUploading(false)
    }
  }

  // ---- 保存 ----

  const save = async (nextStatus: Article['status']) => {
    const title = draft.title.trim()
    if (!title) return setMessage({ kind: 'error', text: 'タイトルを入力してください' })
    const slug = (draft.slug.trim() || randomSlug()).toLowerCase()
    if (!SLUG_PATTERN.test(slug)) {
      return setMessage({ kind: 'error', text: 'URLは英小文字・数字・ハイフンで入力してください（例: what-is-tachie）' })
    }
    if (nextStatus === 'published' && !draft.body.trim()) return setMessage({ kind: 'error', text: '本文を書いてから公開してください' })

    setSaving(true)
    setMessage(null)
    const { data: userData } = await supabase.auth.getUser()
    const payload = {
      title,
      slug,
      category: draft.category,
      description: draft.description.trim(),
      cover_image_url: draft.cover_image_url,
      body: draft.body,
      status: nextStatus,
    }
    const result = isNew
      ? await supabase.from('articles').insert({ ...payload, author_id: userData.user?.id ?? null }).select('id').single()
      : await supabase.from('articles').update(payload).eq('id', id).select('id').single()
    setSaving(false)

    if (result.error || !result.data) {
      console.error('記事の保存エラー:', result.error)
      const duplicate = result.error?.code === '23505'
      setMessage({
        kind: 'error',
        text: duplicate ? 'このURLはほかの記事で使われています。別のURLにしてください。' : `保存に失敗しました（${result.error?.message || '通信エラー'}）`,
      })
      return
    }

    await refreshArticlePages([slug, ...(savedSlug && savedSlug !== slug ? [savedSlug] : [])])
    setDraft((prev) => ({ ...prev, title, slug }))
    setStatus(nextStatus)
    setSavedSlug(slug)
    setDirty(false)
    setMessage({
      kind: 'ok',
      text: nextStatus === 'published' ? (status === 'published' ? '更新しました' : '公開しました！') : '下書きを保存しました',
    })
    if (isNew) router.replace(`/admin/articles/${result.data.id}`)
  }

  const remove = async () => {
    if (!confirm('この記事を削除しますか？元に戻せません。')) return
    const { error } = await supabase.from('articles').delete().eq('id', id)
    if (error) {
      setMessage({ kind: 'error', text: `削除できませんでした（${error.message}）` })
      return
    }
    if (savedSlug) await refreshArticlePages([savedSlug])
    setDirty(false)
    router.replace('/admin/articles')
  }

  if (checking) return <div className="p-8 text-center text-xs font-bold text-slate-400">読み込み中...</div>
  if (!isAdmin) return <div className="p-8 text-center text-sm font-bold text-slate-600">このページは管理者だけが使えます</div>
  if (notFound) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-sm font-bold text-slate-600">記事が見つかりませんでした</p>
        <Link href="/admin/articles" className="text-xs font-bold text-sky-600 underline">
          記事の管理へ戻る
        </Link>
      </div>
    )
  }

  const toc = extractToc(draft.body)
  const category = categoryInfo(draft.category)

  const toolbar: { label: string; title: string; onClick: () => void }[] = [
    { label: '見出し', title: '大きい見出し（目次に載ります）', onClick: () => insertBlock('## 見出し') },
    { label: '小見出し', title: '小さい見出し（目次に載ります）', onClick: () => insertBlock('### 小見出し') },
    { label: 'B 太字', title: '選んだ文字を太字＋マーカーに', onClick: () => wrapSelection('**', '**', '強調したい文字') },
    { label: '🔗 リンク', title: '選んだ文字にリンクを付ける', onClick: insertLink },
    { label: '🖼 画像', title: '画像をアップロードして入れる', onClick: () => imageInputRef.current?.click() },
    { label: '🎬 動画・URL', title: 'YouTubeなどの動画やリンクカードを入れる', onClick: insertEmbed },
    { label: '・ 箇条書き', title: '箇条書き', onClick: () => insertBlock('- 項目1\n- 項目2\n- 項目3') },
    { label: '1. 番号', title: '番号付きの手順', onClick: () => insertBlock('1. 手順1\n2. 手順2\n3. 手順3') },
    { label: '✅ ポイント', title: '青い囲み', onClick: () => insertBlock('> [!POINT]\n> ここにポイントを書きます') },
    { label: '💡 ヒント', title: '緑の囲み', onClick: () => insertBlock('> [!TIP]\n> ここにヒントを書きます') },
    { label: '⚠️ 注意', title: '黄色の囲み', onClick: () => insertBlock('> [!WARNING]\n> ここに注意点を書きます') },
    { label: '📝 メモ', title: '灰色の囲み', onClick: () => insertBlock('> [!NOTE]\n> ここに補足を書きます') },
    { label: '▦ 表', title: '表', onClick: () => insertBlock('| 項目 | 内容 |\n| --- | --- |\n| 一枚絵 | 背景まで描き込んだ1枚のイラスト |\n| 立ち絵 | キャラクターの全身・半身 |') },
    { label: '― 区切り', title: '区切り線', onClick: () => insertBlock('---') },
  ]

  const preview = (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      {draft.cover_image_url && <img src={draft.cover_image_url} alt="" className="w-full aspect-[1200/630] object-cover" />}
      <div className="px-5 sm:px-8 py-6">
        <span className="inline-block text-[11px] font-black px-3 py-1 rounded-full bg-sky-50 text-sky-700">
          {category.emoji} {category.label}
        </span>
        <h1 className="mt-3 text-2xl font-black text-slate-900 leading-snug">{draft.title || '（タイトル）'}</h1>
        {draft.description && <p className="mt-2 text-sm text-slate-500">{draft.description}</p>}
        <p className="mt-2 text-[11px] font-bold text-slate-400">約{readingMinutes(draft.body)}分で読めます</p>
        <ArticleToc items={toc} className="mt-6" />
        {draft.body.trim() ? <ArticleBody body={draft.body} /> : <p className="mt-6 text-sm text-slate-300">本文を書くと、ここに表示されます</p>}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="px-4 sm:px-6 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <Link href="/admin/articles" className="text-xs font-bold text-slate-500 hover:text-slate-800 shrink-0">
            ← 記事の管理
          </Link>
          <p className="text-xs font-bold text-slate-500 truncate">
            <span
              className={`mr-2 px-2 py-0.5 rounded-full text-[10px] font-black ${status === 'published' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}
            >
              {status === 'published' ? '公開中' : '下書き'}
            </span>
            {dirty ? '未保存の変更があります' : '保存済み'}
          </p>
          {status === 'published' && savedSlug ? (
            <Link href={`/articles/${savedSlug}`} target="_blank" className="text-[11px] font-bold text-sky-600 hover:underline shrink-0">
              公開ページ ↗
            </Link>
          ) : (
            <span className="w-16" />
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {message && (
          <p
            role="status"
            className={`p-3 rounded-2xl text-xs font-bold border ${
              message.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-600'
            }`}
          >
            {message.text}
          </p>
        )}

        {/* 基本情報 */}
        <section className="bg-white rounded-3xl border border-slate-100 p-5 space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">タイトル</label>
            <input
              value={draft.title}
              maxLength={120}
              onChange={(e) => update('title', e.target.value)}
              placeholder="例：「立ち絵」と「一枚絵」の違いとは？はじめての依頼で迷わないための基礎知識"
              className={`${inputClass} text-base font-bold`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">カテゴリ</label>
              <select value={draft.category} onChange={(e) => update('category', e.target.value)} className={inputClass}>
                {ARTICLE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">URL（英小文字・数字・ハイフン）</label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-sky-400">
                <span className="pl-3 text-xs text-slate-400 whitespace-nowrap">/articles/</span>
                <input
                  value={draft.slug}
                  maxLength={80}
                  onChange={(e) => update('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="what-is-tachie（空なら自動）"
                  className="flex-1 min-w-0 px-2 py-2.5 bg-transparent text-sm text-slate-800 focus:outline-none"
                />
              </div>
              {status === 'published' && savedSlug && draft.slug !== savedSlug && (
                <p className="mt-1 text-[10px] font-bold text-amber-600">公開後にURLを変えると、シェア済みのリンクが開けなくなります</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-700 mb-1.5">
              説明文 <span className="font-bold text-slate-400">（一覧・検索結果・Xのカードに出る短い紹介。120文字くらいまでがおすすめ）</span>
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={draft.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="IRIAMで立ち絵を頼まれたけどパーツ分けは必要？はじめて依頼を受けるときに知っておきたい用語をまとめました。"
              className={`${inputClass} resize-none`}
            />
          </div>
          <div>
            <p className="text-xs font-black text-slate-700 mb-1.5">カバー画像 <span className="font-bold text-slate-400">（横長 1200×630 がおすすめ。Xのカードにも使われます）</span></p>
            <div className="flex items-center gap-3">
              <div className="w-40 aspect-[1200/630] rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center text-2xl">
                {draft.cover_image_url ? <img src={draft.cover_image_url} alt="" className="w-full h-full object-cover" /> : category.emoji}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 disabled:opacity-50 cursor-pointer"
                >
                  {draft.cover_image_url ? '画像を変える' : '画像を選ぶ'}
                </button>
                {draft.cover_image_url && (
                  <button type="button" onClick={() => update('cover_image_url', null)} className="text-[11px] font-bold text-slate-400 hover:text-rose-500 cursor-pointer">
                    外す
                  </button>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </div>
          </div>
        </section>

        {/* スマホは「書く／プレビュー」を切り替え */}
        <div className="lg:hidden flex bg-white rounded-full p-1 border border-slate-200 w-fit mx-auto">
          {(
            [
              ['write', '✏️ 書く'],
              ['preview', '👀 プレビュー'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setMobileTab(value)}
              className={`px-5 py-1.5 rounded-full text-xs font-black cursor-pointer ${mobileTab === value ? 'bg-sky-500 text-white' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {/* 本文 */}
          <section className={`bg-white rounded-3xl border border-slate-100 overflow-hidden ${mobileTab === 'write' ? '' : 'hidden lg:block'}`}>
            <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50/80 sticky top-[53px] z-10">
              {toolbar.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  title={t.title}
                  onClick={t.onClick}
                  disabled={uploading && t.label.includes('画像')}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-sky-300 hover:text-sky-600 disabled:opacity-50 cursor-pointer"
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                className="ml-auto px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-sky-600 hover:bg-sky-50 cursor-pointer"
              >
                ❓ 書き方
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  e.target.value = ''
                  uploadImages(files)
                }}
              />
            </div>

            {helpOpen && (
              <div className="px-4 py-3 border-b border-slate-100 bg-sky-50/50 text-[11px] text-slate-600 leading-relaxed space-y-1">
                <p><code className="text-sky-700">## 見出し</code> / <code className="text-sky-700">### 小見出し</code> … 目次に自動で載ります</p>
                <p><code className="text-sky-700">**太字**</code> … 太字＋黄色いマーカー</p>
                <p><code className="text-sky-700">[文字](https://...)</code> … リンク</p>
                <p><code className="text-sky-700">![説明](画像URL)</code> … 画像（説明は画像の下に表示）。画像は貼り付け・ドラッグでも入ります</p>
                <p>1行に <code className="text-sky-700">URLだけ</code> … YouTube・ニコニコ・Vimeoは動画、それ以外はリンクカード</p>
                <p><code className="text-sky-700">&gt; [!POINT]</code>（TIP / WARNING / NOTE）… 色付きの囲み。次の行から <code>&gt; </code> を付けて書く</p>
                <p>段落を分けるときは、空行を1行あけます</p>
              </div>
            )}

            <textarea
              ref={bodyRef}
              value={draft.body}
              onChange={(e) => update('body', e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files)
                if (files.some((f) => f.type.startsWith('image/'))) {
                  e.preventDefault()
                  uploadImages(files)
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const files = Array.from(e.dataTransfer.files)
                if (files.length > 0) {
                  e.preventDefault()
                  uploadImages(files)
                }
              }}
              placeholder={'## 立ち絵とは？\n\nキャラクターの全身や半身を、背景なしで描いたイラストのことです。\n\n> [!POINT]\n> IRIAMでは、表情差分やパーツ分けが必要になることがあります。'}
              className="w-full min-h-[60vh] p-4 text-sm leading-relaxed font-mono text-slate-800 resize-y focus:outline-none"
            />
            {uploading && <p className="px-4 pb-3 text-[11px] font-bold text-sky-600">画像をアップロード中...</p>}
            <p className="px-4 pb-3 text-right text-[10px] font-bold text-slate-300 tabular-nums">{draft.body.length.toLocaleString()} 文字</p>
          </section>

          {/* プレビュー */}
          <section className={`lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto rounded-3xl ${mobileTab === 'preview' ? '' : 'hidden lg:block'}`}>
            {preview}
          </section>
        </div>
      </div>

      {/* 保存バー */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 justify-end">
          {!isNew && (
            <button onClick={remove} className="mr-auto text-xs font-bold text-rose-400 hover:text-rose-600 cursor-pointer">
              削除
            </button>
          )}
          {status === 'published' ? (
            <>
              <button
                onClick={() => save('draft')}
                disabled={saving}
                className="px-4 py-2.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
              >
                非公開（下書き）に戻す
              </button>
              <button
                onClick={() => save('published')}
                disabled={saving || uploading}
                className="px-6 py-2.5 rounded-full text-xs font-black bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50 cursor-pointer"
              >
                {saving ? '保存中...' : '更新する'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => save('draft')}
                disabled={saving || uploading}
                className="px-4 py-2.5 rounded-full text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 cursor-pointer"
              >
                {saving ? '保存中...' : '下書き保存'}
              </button>
              <button
                onClick={() => save('published')}
                disabled={saving || uploading}
                className="px-6 py-2.5 rounded-full text-xs font-black bg-gradient-to-r from-sky-500 to-cyan-500 text-white hover:brightness-105 disabled:opacity-50 cursor-pointer"
              >
                公開する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
