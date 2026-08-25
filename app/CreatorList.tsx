'use client'

import { useState, useEffect } from 'react'
// databass.ts と同じインポート形式に揃えます
import { supabase, Profile } from '@/lib/supabase' // ※ファイル名が database.ts の場合はパスを修正してください

export default function CreatorList() {
  const [creators, setCreators] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCreators = async () => {
      // テーブル名も 'profiles' に合わせます
      const { data, error } = await supabase.from('profiles').select('*')
      if (error) {
        console.error('Error fetching creators:', error)
      } else if (data) {
        setCreators(data)
      }
      setLoading(false)
    }

    fetchCreators()
  }, [])

  if (loading) {
    return <div>読み込み中...</div>
  }

  return (
    <div>
      {creators.map((creator) => (
        <div key={creator.user_id}>
          <p>{creator.display_name}</p>
        </div>
      ))}
    </div>
  )
}