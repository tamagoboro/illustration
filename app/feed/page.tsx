'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'
import AvatarRing from '@/components/AvatarRing'
import ProtectedImage from '@/components/ProtectedImage'
import { backgroundImageStyle } from '@/lib/background'
import SimpleHeader from '@/components/SimpleHeader'

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  }
}

type PostWithAuthor = {
  id: string
  user_id: string
  content: string
  image_urls: string[]
  is_sensitive: boolean
  created_at: string
  profiles: {
    display_name: string
    avatar_url: string | null
  }
  likes_count?: number
  is_liked_by_me?: boolean
  post_comments?: Comment[]
}

const FEED_PAGE_SIZE = 30

// 「3分前」「2日前」のような相対表記。1週間以上前は日付で表示する
const formatRelativeTime = (iso: string) => {
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'たった今'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分前`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}時間前`
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}日前`
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function FeedPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  // いいねの連打で二重送信になったり、失敗時に表示だけ変わってDBと食い違ったりするのを防ぐ
  const [likingPostIds, setLikingPostIds] = useState<Set<string>>(new Set())
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [ringMap, setRingMap] = useState<Record<string, string | null>>({})

  // 新規投稿ステート
  const [content, setContent] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchTag, setSearchTag] = useState('')

  // 編集ステート
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  // コメント展開・入力ステート
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null)
  const [commentInput, setCommentInput] = useState('')

  // 表示まわりのステート
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null)
  const [imagesOnly, setImagesOnly] = useState(false)
  const [revealedPostIds, setRevealedPostIds] = useState<Set<string>>(new Set())
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number; name: string } | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setCurrentUser(data.user)
      if (data.user) {
        const { data: me } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('user_id', data.user.id)
          .maybeSingle()
        setMyAvatarUrl(me?.avatar_url ?? null)
      }
    })
    fetchPosts()
  }, [])

  // 拡大表示中は背景スクロールを止め、Esc/←/→ で操作できるようにする
  useEffect(() => {
    if (!lightbox) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowRight')
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.urls.length } : lb))
      if (e.key === 'ArrowLeft')
        setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.urls.length) % lb.urls.length } : lb))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox])

  const fetchPosts = async (pageToLoad = 0, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const { data: userResp } = await supabase.auth.getUser()
    const activeUserId = userResp.user?.id

    const from = pageToLoad * FEED_PAGE_SIZE
    const to = from + FEED_PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (display_name, avatar_url),
        post_likes (user_id),
        post_comments (
          id,
          user_id,
          content,
          created_at,
          profiles:user_id (display_name, avatar_url)
        )
      `)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (!error && data) {
      const formatted = data.map((post: any) => ({
        ...post,
        likes_count: post.post_likes?.length || 0,
        is_liked_by_me: activeUserId
          ? post.post_likes?.some((l: any) => l.user_id === activeUserId)
          : false,
      }))

      setPosts((prev) => (append ? [...prev, ...formatted] : formatted))
      setPage(pageToLoad)
      setHasMore(data.length === FEED_PAGE_SIZE)

      // 投稿者・コメント投稿者の装着中アイコンリングをまとめて取得
      const userIds = new Set<string>()
      formatted.forEach((post: any) => {
        userIds.add(post.user_id)
        post.post_comments?.forEach((c: any) => userIds.add(c.user_id))
      })
      if (userIds.size > 0) {
        const { data: ringsData } = await supabase
          .from('public_equipped_rings')
          .select('user_id, equipped_ring_id')
          .in('user_id', Array.from(userIds))
        setRingMap((prev) => {
          const merged = append ? { ...prev } : {}
          ;(ringsData || []).forEach((r: any) => {
            merged[r.user_id] = r.equipped_ring_id
          })
          return merged
        })
      }
    }

    if (append) setLoadingMore(false)
    else setLoading(false)
  }

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    fetchPosts(page + 1, true)
  }

  // 画像選択処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)

    if (selectedFiles.length + files.length > 4) {
      alert('画像は最大4枚まで選択可能です')
      return
    }

    const updatedFiles = [...selectedFiles, ...files].slice(0, 4)
    setSelectedFiles(updatedFiles)
    setPreviewUrls(updatedFiles.map((file) => URL.createObjectURL(file)))
  }

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(updatedFiles)
    setPreviewUrls(updatedFiles.map((file) => URL.createObjectURL(file)))
  }

  // 新規投稿
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return alert('投稿するにはログインが必要です')
    if (!content.trim() && selectedFiles.length === 0) return
    if (content.length > 200) return alert('文字数は200文字までにしてください')

    setIsSubmitting(true)
    try {
      const uploadedImageUrls: string[] = []

      for (const file of selectedFiles) {
        const webpBlob = await convertToWebp(file, 0.85, 1600)
        const fileName = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.webp`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('portfolios')
          .upload(fileName, webpBlob, { contentType: 'image/webp' })

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('portfolios')
          .getPublicUrl(uploadData.path)

        uploadedImageUrls.push(publicUrlData.publicUrl)
      }

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: currentUser.id,
        content: content.trim(),
        image_urls: uploadedImageUrls,
      })

      if (insertError) throw insertError

      setContent('')
      setSelectedFiles([])
      setPreviewUrls([])
      fetchPosts()
    } catch (err) {
      console.error(err)
      alert('投稿に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 投稿削除
  const handleDeletePost = async (postId: string) => {
    if (!confirm('この投稿を削除してもよろしいですか？')) return

    const { error } = await supabase.from('posts').delete().eq('id', postId)
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId))
    } else {
      alert('削除に失敗しました')
    }
  }

  // 投稿編集の開始
  const startEdit = (post: PostWithAuthor) => {
    setEditingPostId(post.id)
    setEditContent(post.content)
  }

  // 投稿編集の保存
  const handleUpdatePost = async (postId: string) => {
    if (!editContent.trim()) return alert('内容を入力してください')
    if (editContent.length > 200) return alert('200文字以内で入力してください')

    const { error } = await supabase
      .from('posts')
      .update({ content: editContent.trim() })
      .eq('id', postId)

    if (!error) {
      setEditingPostId(null)
      fetchPosts()
    } else {
      alert('更新に失敗しました')
    }
  }

  // いいね機能
  const toggleLike = async (post: PostWithAuthor) => {
    if (!currentUser) return alert('いいねをするにはログインが必要です')
    if (likingPostIds.has(post.id)) return // 連打防止（前の処理が終わるまで二重送信しない）

    setLikingPostIds((prev) => new Set(prev).add(post.id))

    const wasLiked = post.is_liked_by_me
    const { error } = wasLiked
      ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id)
      : await supabase.from('post_likes').insert({ post_id: post.id, user_id: currentUser.id })

    setLikingPostIds((prev) => {
      const next = new Set(prev)
      next.delete(post.id)
      return next
    })

    if (error) {
      console.error('いいねの更新エラー:', error)
      return // 失敗時は表示を変えない（DBの状態と食い違わせない）
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            is_liked_by_me: !wasLiked,
            likes_count: (p.likes_count || 0) + (wasLiked ? -1 : 1),
          }
        }
        return p
      })
    )
  }

  // コメント送信
  const handleAddComment = async (postId: string) => {
    if (!currentUser) return alert('コメントをするにはログインが必要です')
    if (!commentInput.trim()) return

    const { error } = await supabase.from('post_comments').insert({
      post_id: postId,
      user_id: currentUser.id,
      content: commentInput.trim(),
    })

    if (!error) {
      setCommentInput('')
      fetchPosts()
    } else {
      alert('コメントの送信に失敗しました')
    }
  }

  const renderFormattedContent = (text: string) => {
    const parts = text.split(/(#[^\s#]+)/g)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <button
            key={i}
            onClick={() => setSearchTag(part)}
            className="text-pink-500 font-bold hover:underline cursor-pointer transition-colors"
          >
            {part}
          </button>
        )
      }
      return part
    })
  }

  const filteredPosts = useMemo(() => {
    return posts.filter(
      (p) =>
        (!searchTag || p.content.includes(searchTag)) &&
        (!imagesOnly || (p.image_urls && p.image_urls.length > 0))
    )
  }, [posts, searchTag, imagesOnly])

  // 読み込み済みの投稿でよく使われているハッシュタグ
  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {}
    posts.forEach((p) => {
      new Set(p.content.match(/#[^\s#]+/g) || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1
      })
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
  }, [posts])

  const getImageGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 3) return 'grid-cols-2 [&>*:first-child]:col-span-2'
    return 'grid-cols-2'
  }

  // 1枚のときは元の縦横比のまま（縦長イラストが切れないよう高さだけ制限）、複数枚は正方形で並べる
  const getImageCellClass = (count: number, index: number) => {
    if (count === 1) return 'max-h-[560px]'
    if (count === 3 && index === 0) return 'aspect-[2/1]'
    return 'aspect-square'
  }

  const revealPost = (postId: string) =>
    setRevealedPostIds((prev) => new Set(prev).add(postId))

  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="フィード" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
        {/* メインカラム */}
        <div className="space-y-5 min-w-0">
          {/* タイトル */}
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10px] font-black text-sky-600 tracking-[0.2em] drop-shadow-xs">FEED</p>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight drop-shadow-sm">みんなの制作日記</h1>
              <p className="text-[11px] text-slate-600 font-medium drop-shadow-xs">
                クリエイターの制作中の作品や近況をチェックしよう
              </p>
            </div>
          </div>

          {/* 新規投稿フォーム */}
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm transition-all focus-within:shadow-md focus-within:ring-2 focus-within:ring-sky-200">
            {currentUser ? (
              <form onSubmit={handleSubmit} className="flex gap-3">
                <div className="shrink-0 w-10 h-10 rounded-full overflow-hidden bg-sky-100 border border-sky-100">
                  {myAvatarUrl && <img src={myAvatarUrl} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <textarea
                    rows={3}
                    maxLength={200}
                    placeholder="いまどんな作品を描いてる？（#ハッシュタグ も使えます）"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none focus:outline-none focus:ring-0 leading-relaxed pt-2"
                  />

                  {previewUrls.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200/60">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="absolute top-1 right-1 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full w-6 h-6 text-[10px] font-bold flex items-center justify-center transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <label
                        className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full transition ${
                          selectedFiles.length >= 4
                            ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                            : 'text-sky-600 bg-sky-50 hover:bg-sky-100 cursor-pointer'
                        }`}
                      >
                        <span>🖼</span>
                        <span>画像 {selectedFiles.length}/4</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={selectedFiles.length >= 4}
                        />
                      </label>
                      <span className={`text-[11px] font-bold tabular-nums ${content.length >= 190 ? 'text-rose-500' : 'text-slate-300'}`}>
                        {content.length}/200
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                      className="bg-gradient-to-r from-sky-500 to-cyan-500 hover:brightness-105 text-white font-black text-xs px-6 py-2.5 rounded-full shadow-sm hover:shadow-md disabled:opacity-40 disabled:shadow-none transition-all active:scale-95 cursor-pointer"
                    >
                      {isSubmitting ? '送信中...' : '投稿する'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
                <p className="text-xs font-bold text-slate-600 text-center sm:text-left">
                  ログインすると作品の投稿や「いいね」、コメントができます
                </p>
                <Link
                  href="/login"
                  className="shrink-0 text-xs font-black text-white bg-sky-500 hover:bg-sky-600 px-5 py-2.5 rounded-full shadow-sm transition"
                >
                  ログインして参加する
                </Link>
              </div>
            )}
          </div>

          {/* 絞り込みバー */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-white/85 backdrop-blur-md rounded-full p-1 border border-white/70 shadow-2xs">
              {[
                { value: false, label: 'すべて' },
                { value: true, label: '画像つき' },
              ].map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => setImagesOnly(tab.value)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-black transition cursor-pointer ${
                    imagesOnly === tab.value ? 'bg-sky-500 text-white shadow-2xs' : 'text-slate-500 hover:text-sky-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {searchTag && (
              <button
                onClick={() => setSearchTag('')}
                className="text-[11px] font-black text-sky-700 bg-white/90 border border-sky-200 px-3 py-1.5 rounded-full hover:bg-sky-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>{searchTag}</span>
                <span className="text-slate-400">✕</span>
              </button>
            )}
          </div>

          {/* タイムライン */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white/85 rounded-3xl p-5 space-y-3 animate-pulse border border-white/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100" />
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 bg-sky-100 rounded" />
                      <div className="h-2 w-12 bg-sky-50 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-3/4 bg-sky-50 rounded" />
                  <div className="aspect-video bg-sky-50 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16 bg-white/85 backdrop-blur-md rounded-3xl border border-white/70 space-y-2">
              <p className="text-3xl">🎨</p>
              <p className="text-sm font-black text-slate-600">
                {searchTag || imagesOnly ? '条件に合う投稿がありません' : 'まだ投稿がありません'}
              </p>
              {currentUser && !searchTag && !imagesOnly && (
                <p className="text-[11px] text-slate-400 font-bold">最初の投稿をしてみましょう！</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isMyPost = currentUser?.id === post.user_id
                const images = post.image_urls || []
                const isHidden = post.is_sensitive && !revealedPostIds.has(post.id)
                const authorName = post.profiles?.display_name || 'クリエイター'

                return (
                  <article
                    key={post.id}
                    className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-white/70 shadow-sm hover:shadow-md transition-all space-y-3"
                  >
                    {/* 投稿者 */}
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/creator/${post.user_id}`} className="flex items-center gap-3 group min-w-0">
                        <div className="shrink-0 group-hover:scale-105 transition-transform">
                          <AvatarRing
                            src={post.profiles?.avatar_url}
                            alt={authorName}
                            size={42}
                            ringId={ringMap[post.user_id]}
                            fallback={
                              <div className="w-full h-full rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-300 font-black text-xs">
                                {authorName.slice(0, 1)}
                              </div>
                            }
                          />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-sm font-black text-slate-800 group-hover:text-sky-600 transition-colors truncate">
                            {authorName}
                          </h2>
                          <time
                            dateTime={post.created_at}
                            title={new Date(post.created_at).toLocaleString('ja-JP')}
                            className="text-[10px] text-slate-400 font-bold"
                          >
                            {formatRelativeTime(post.created_at)}
                          </time>
                        </div>
                      </Link>

                      <div className="flex items-center gap-1 shrink-0">
                        {isMyPost && (
                          <>
                            <button
                              onClick={() => startEdit(post)}
                              className="text-[11px] font-bold text-slate-400 hover:text-slate-700 hover:bg-slate-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="text-[11px] font-bold text-rose-400 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                            >
                              削除
                            </button>
                          </>
                        )}
                        {!isMyPost && (
                          <Link
                            href={`/creator/${post.user_id}`}
                            className="text-[11px] font-black text-sky-600 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full transition"
                          >
                            依頼する →
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* 本文（編集中はテキストエリア） */}
                    {editingPostId === post.id ? (
                      <div className="space-y-2 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
                        <textarea
                          rows={3}
                          maxLength={200}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full text-sm text-slate-800 bg-transparent resize-none focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="text-xs font-bold text-slate-500 px-3 py-1.5 rounded-lg hover:bg-white cursor-pointer"
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={() => handleUpdatePost(post.id)}
                            className="text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white px-4 py-1.5 rounded-lg cursor-pointer"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      post.content && (
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                          {renderFormattedContent(post.content)}
                        </p>
                      )
                    )}

                    {/* 画像 */}
                    {images.length > 0 && (
                      <div className="relative rounded-2xl overflow-hidden">
                        <div className={`grid gap-1 ${getImageGridClass(images.length)} ${isHidden ? 'blur-2xl scale-105' : ''}`}>
                          {images.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => !isHidden && setLightbox({ urls: images, index: i, name: authorName })}
                              className={`relative overflow-hidden bg-slate-100 cursor-zoom-in group/img ${getImageCellClass(images.length, i)}`}
                            >
                              <ProtectedImage
                                src={url}
                                alt=""
                                watermarkText={authorName}
                                loading="lazy"
                                decoding="async"
                                wrapperClassName={images.length === 1 ? 'relative w-full' : 'relative w-full h-full'}
                                className={
                                  images.length === 1
                                    ? 'block w-full max-h-[560px] object-contain bg-slate-50'
                                    : 'w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500'
                                }
                              />
                            </button>
                          ))}
                        </div>
                        {isHidden && (
                          <button
                            type="button"
                            onClick={() => revealPost(post.id)}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/30 text-white cursor-pointer"
                          >
                            <span className="text-[11px] font-black bg-slate-900/60 px-3 py-1 rounded-full">センシティブな内容</span>
                            <span className="text-xs font-black underline underline-offset-2">タップして表示</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* いいね・コメント */}
                    <div className="flex items-center gap-1 pt-1">
                      <button
                        onClick={() => toggleLike(post)}
                        disabled={likingPostIds.has(post.id)}
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${
                          post.is_liked_by_me ? 'text-rose-500 bg-rose-50' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                      >
                        <span className="text-sm">{post.is_liked_by_me ? '♥' : '♡'}</span>
                        <span className="tabular-nums">{post.likes_count || 0}</span>
                      </button>

                      <button
                        onClick={() => {
                          setOpenCommentPostId(openCommentPostId === post.id ? null : post.id)
                          setCommentInput('')
                        }}
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-full transition cursor-pointer ${
                          openCommentPostId === post.id ? 'text-sky-600 bg-sky-50' : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                        }`}
                      >
                        <span>💬</span>
                        <span className="tabular-nums">{post.post_comments?.length || 0}</span>
                      </button>
                    </div>

                    {/* コメント */}
                    {openCommentPostId === post.id && (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        {post.post_comments && post.post_comments.length > 0 ? (
                          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {post.post_comments.map((comment) => (
                              <div key={comment.id} className="flex gap-2.5">
                                <Link href={`/creator/${comment.user_id}`} className="shrink-0 pt-0.5">
                                  <AvatarRing
                                    src={comment.profiles?.avatar_url}
                                    alt=""
                                    size={28}
                                    ringId={ringMap[comment.user_id]}
                                    fallback={<div className="w-full h-full rounded-full bg-slate-200" />}
                                  />
                                </Link>
                                <div className="bg-slate-50 rounded-2xl rounded-tl-md px-3 py-2 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-black text-slate-800 truncate">
                                      {comment.profiles?.display_name || 'ユーザー'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-bold shrink-0">
                                      {formatRelativeTime(comment.created_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 break-words">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-bold text-center py-1">
                            まだコメントはありません。最初のコメントをどうぞ！
                          </p>
                        )}

                        {currentUser ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault()
                              handleAddComment(post.id)
                            }}
                            className="flex gap-2"
                          >
                            <input
                              type="text"
                              placeholder="コメントを入力..."
                              value={commentInput}
                              onChange={(e) => setCommentInput(e.target.value)}
                              className="flex-1 min-w-0 text-xs px-4 py-2 rounded-full bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:bg-white"
                            />
                            <button
                              type="submit"
                              disabled={!commentInput.trim()}
                              className="bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white text-xs font-black px-4 py-2 rounded-full transition cursor-pointer"
                            >
                              送信
                            </button>
                          </form>
                        ) : (
                          <p className="text-[10px] text-slate-400 text-center font-bold">
                            <Link href="/login" className="text-sky-600 hover:underline">ログイン</Link>
                            するとコメントできます
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}

          {/* もっと見る（タグ検索中は表示しない） */}
          {!loading && !searchTag && hasMore && posts.length > 0 && (
            <div className="text-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-2.5 bg-white/90 hover:bg-white border border-white/70 text-sky-700 font-black text-xs rounded-full transition cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {loadingMore ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </div>

        {/* サイドバー（PCのみ） */}
        <aside className="hidden lg:block space-y-4 sticky top-20">
          <div className="bg-white/90 backdrop-blur-md rounded-3xl p-5 border border-white/70 shadow-sm space-y-3">
            <h2 className="text-xs font-black text-slate-700 tracking-wider"># 人気のタグ</h2>
            {popularTags.length === 0 ? (
              <p className="text-[11px] text-slate-400 font-bold">まだタグ付きの投稿がありません</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setSearchTag(searchTag === tag ? '' : tag)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                      searchTag === tag
                        ? 'bg-sky-500 text-white border-sky-500'
                        : 'bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100'
                    }`}
                  >
                    {tag}
                    <span className={`ml-1 ${searchTag === tag ? 'text-sky-100' : 'text-sky-400'}`}>{count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-sky-500 to-cyan-400 rounded-3xl p-5 text-white shadow-sm space-y-2">
            <p className="text-sm font-black">お気に入りの絵柄を見つけたら</p>
            <p className="text-[11px] text-sky-50 font-medium leading-relaxed">
              料金・納期・商用利用の条件でクリエイターを比較して、そのまま依頼の相談ができます。
            </p>
            <Link
              href="/"
              className="inline-block mt-1 text-[11px] font-black bg-white text-sky-700 px-4 py-2 rounded-full hover:bg-sky-50 transition"
            >
              クリエイターを探す →
            </Link>
          </div>
        </aside>
      </div>

      {/* 画像の拡大表示 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
            aria-label="閉じる"
          >
            ✕
          </button>
          {lightbox.urls.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({ ...lightbox, index: (lightbox.index - 1 + lightbox.urls.length) % lightbox.urls.length })
                }}
                className="absolute left-3 sm:left-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-bold cursor-pointer"
                aria-label="前の画像"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox({ ...lightbox, index: (lightbox.index + 1) % lightbox.urls.length })
                }}
                className="absolute right-3 sm:right-6 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-bold cursor-pointer"
                aria-label="次の画像"
              >
                ›
              </button>
              <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs font-bold text-white/70 tabular-nums">
                {lightbox.index + 1} / {lightbox.urls.length}
              </span>
            </>
          )}
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl max-h-[85vh]">
            <ProtectedImage
              src={lightbox.urls[lightbox.index]}
              alt=""
              watermarkText={lightbox.name}
              wrapperClassName="relative"
              className="block max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
}
