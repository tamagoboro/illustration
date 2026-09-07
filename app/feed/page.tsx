'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { convertToWebp } from '@/lib/imageUtils'

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

export default function FeedPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [posts, setPosts] = useState<PostWithAuthor[]>([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUser(data.user)
    })
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    setLoading(true)
    const { data: userResp } = await supabase.auth.getUser()
    const activeUserId = userResp.user?.id

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

    if (!error && data) {
      const formatted = data.map((post: any) => ({
        ...post,
        likes_count: post.post_likes?.length || 0,
        is_liked_by_me: activeUserId
          ? post.post_likes?.some((l: any) => l.user_id === activeUserId)
          : false,
      }))
      setPosts(formatted)
    }
    setLoading(false)
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
        const webpBlob = await convertToWebp(file)
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

    if (post.is_liked_by_me) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: currentUser.id })
    }

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === post.id) {
          return {
            ...p,
            is_liked_by_me: !p.is_liked_by_me,
            likes_count: (p.likes_count || 0) + (p.is_liked_by_me ? -1 : 1),
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
    if (!searchTag) return posts
    return posts.filter((p) => p.content.includes(searchTag))
  }, [posts, searchTag])

  const getImageGridClass = (count: number) => {
    if (count === 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count === 3) return 'grid-cols-2 [&>*:first-child]:col-span-2'
    return 'grid-cols-2'
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-2">
          <h1 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <span className="text-pink-500">✨</span>タイムライン
          </h1>
          {searchTag && (
            <button
              onClick={() => setSearchTag('')}
              className="text-xs font-bold text-pink-600 bg-pink-50 border border-pink-200 px-3 py-1.5 rounded-full hover:bg-pink-100 transition flex items-center gap-1 cursor-pointer"
            >
              <span>{searchTag}</span>
              <span className="text-pink-400">✕ 解除</span>
            </button>
          )}
        </div>

        {/* 新規投稿フォーム */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border border-slate-200/80 shadow-sm transition-all focus-within:shadow-md">
          {currentUser ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <textarea
                rows={3}
                maxLength={200}
                placeholder="いまどんな作品を描いてる？（最大200文字 / #ハッシュタグ可）"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none border-none focus:outline-none focus:ring-0 leading-relaxed"
              />

              {previewUrls.length > 0 && (
                <div className={`grid gap-2 ${getImageGridClass(previewUrls.length)}`}>
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative aspect-video rounded-2xl overflow-hidden bg-slate-100 group border border-slate-200/60">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-2 right-2 bg-slate-900/60 hover:bg-slate-900 backdrop-blur-md text-white rounded-full w-7 h-7 text-xs font-bold flex items-center justify-center transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-4">
                  <label className="group flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-pink-600 cursor-pointer transition">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-pink-50 flex items-center justify-center text-slate-600 group-hover:text-pink-500 transition">
                      🖼️
                    </div>
                    <span>画像 ({selectedFiles.length}/4)</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={selectedFiles.length >= 4}
                    />
                  </label>

                  <span className={`text-xs font-bold ${content.length >= 190 ? 'text-rose-500' : 'text-slate-300'}`}>
                    {content.length}/200
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || (!content.trim() && selectedFiles.length === 0)}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md hover:shadow-lg disabled:opacity-40 transition-all transform active:scale-95 cursor-pointer"
                >
                  {isSubmitting ? '送信中...' : '投稿する'}
                </button>
              </div>
            </form>
          ) : (
            <div className="text-center py-6 space-y-2">
              <p className="text-xs font-bold text-slate-500">ログインすると作品の投稿や「いいね」、コメントができます</p>
              <Link
                href="/login"
                className="inline-block text-xs font-black text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-5 py-2.5 rounded-full transition"
              >
                ログインして参加する
              </Link>
            </div>
          )}
        </div>

        {/* タイムライン */}
        {loading ? (
          <div className="text-center py-10 text-xs font-bold text-slate-400">読み込み中...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16 bg-white/40 rounded-3xl border border-dashed border-slate-200">
            <p className="text-sm font-bold text-slate-400">投稿がありません</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => {
              const isMyPost = currentUser?.id === post.user_id

              return (
                <article
                  key={post.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200/70 shadow-sm hover:border-slate-300 transition-all space-y-3.5"
                >
                  {/* ヘッダー（アイコン・名前・編集/削除ボタン） */}
                  <div className="flex items-center justify-between">
                    <Link href={`/${post.user_id}`} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60 shrink-0 group-hover:scale-105 transition-transform">
                        {post.profiles?.avatar_url ? (
                          <img
                            src={post.profiles.avatar_url}
                            alt={post.profiles.display_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xs">
                            ?
                          </div>
                        )}
                      </div>
                      <div>
                        <h2 className="text-xs font-black text-slate-800 group-hover:text-pink-600 transition-colors">
                          {post.profiles?.display_name || 'クリエイター'}
                        </h2>
                        <time className="text-[10px] text-slate-400 font-medium">
                          {new Date(post.created_at).toLocaleString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      {isMyPost && (
                        <>
                          <button
                            onClick={() => startEdit(post)}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-600 p-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="text-[11px] font-bold text-rose-400 hover:text-rose-600 p-1"
                          >
                            削除
                          </button>
                        </>
                      )}
                      <Link
                        href={`/${post.user_id}`}
                        className="text-[11px] font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-3 py-1.5 rounded-full transition"
                      >
                        依頼窓口 →
                      </Link>
                    </div>
                  </div>

                  {/* 投稿本文（編集中の場合はテキストエリア化） */}
                  {editingPostId === post.id ? (
                    <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      <textarea
                        rows={3}
                        maxLength={200}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full text-xs text-slate-800 bg-transparent resize-none focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="text-xs font-bold text-slate-400 px-3 py-1 rounded-lg"
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={() => handleUpdatePost(post.id)}
                          className="text-xs font-bold bg-pink-500 text-white px-3 py-1 rounded-lg"
                        >
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-700 leading-relaxed font-normal whitespace-pre-wrap">
                      {renderFormattedContent(post.content)}
                    </p>
                  )}

                  {/* 画像表示 */}
                  {post.image_urls && post.image_urls.length > 0 && (
                    <div className={`grid gap-2 ${getImageGridClass(post.image_urls.length)}`}>
                      {post.image_urls.map((url, i) => (
                        <div
                          key={i}
                          className="aspect-video rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/50 group/img"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* いいね＆コメントアイコンエリア */}
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100/80">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition cursor-pointer ${
                        post.is_liked_by_me
                          ? 'text-rose-500 bg-rose-50'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm">{post.is_liked_by_me ? '❤️' : '🤍'}</span>
                      <span>{post.likes_count || 0}</span>
                    </button>

                    <button
                      onClick={() => setOpenCommentPostId(openCommentPostId === post.id ? null : post.id)}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-full hover:bg-slate-50 transition cursor-pointer"
                    >
                      <span>💬</span>
                      <span>{post.post_comments?.length || 0}</span>
                    </button>
                  </div>

                  {/* コメント表示・入力セクション */}
                  {openCommentPostId === post.id && (
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      {/* コメント一覧 */}
                      {post.post_comments && post.post_comments.length > 0 ? (
                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                          {post.post_comments.map((comment) => (
                            <div key={comment.id} className="bg-slate-50 p-2.5 rounded-2xl flex gap-2.5">
                              <Link href={`/${comment.user_id}`} className="shrink-0">
                                <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                                  {comment.profiles?.avatar_url && (
                                    <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                  )}
                                </div>
                              </Link>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    {comment.profiles?.display_name || 'ユーザー'}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {new Date(comment.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 font-bold text-center py-2">コメントはまだありません</p>
                      )}

                      {/* コメント入力フォーム */}
                      {currentUser ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="コメントを入力..."
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            className="flex-1 text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                          >
                            送信
                          </button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 text-center">コメント投稿にはログインが必要です</p>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}