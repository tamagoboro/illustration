'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react'

type ImageUploaderProps = {
  userId: string
  items: any[]
  onUpdate: () => void
}

export default function ImageUploader({ userId, items, onUpdate }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const supabase = createClient()

  // 画像アップロード処理
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true)
      const file = e.target.files?.[0]
      if (!file) return

      // ファイル名を一意にする (user_id/timestamp_filename)
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}/${Date.now()}.${fileExt}`

      // 1. Supabase Storage へアップロード
      const { error: uploadError } = await supabase.storage
        .from('portfolio')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. 公開URLの取得
      const { data: { publicUrl } } = supabase.storage
        .from('portfolio')
        .getPublicUrl(filePath)

      // 3. portfolio_items テーブルへ追加
      await supabase.from('portfolio_items').insert({
        user_id: userId,
        title: title || '無題の作品',
        image_url: publicUrl,
        sort_order: items.length,
      })

      setTitle('')
      onUpdate()
      alert('作品をアップロードしました！')
    } catch (error: any) {
      alert('アップロード失敗: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  // 削除処理
  const handleDelete = async (id: string) => {
    if (!confirm('この作品を削除しますか？')) return
    await supabase.from('portfolio_items').delete().eq('id', id)
    onUpdate()
  }

  return (
    <div className="space-y-6">
      {/* アップロードエリア */}
      <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100/50 transition">
        <input
          type="file"
          id="file-upload"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading}
          className="hidden"
        />
        <div className="space-y-3">
          <input
            type="text"
            placeholder="作品タイトル (任意)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-sm max-w-xs mx-auto block bg-white"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm cursor-pointer transition"
          >
            <Upload size={16} /> {uploading ? 'アップロード中...' : '作品画像をえらぶ'}
          </label>
        </div>
      </div>

      {/* アップロード済み作品一覧 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square">
            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-between">
              <button
                onClick={() => handleDelete(item.id)}
                className="self-end p-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
              >
                <Trash2 size={14} />
              </button>
              <p className="text-white text-xs font-bold truncate">{item.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}