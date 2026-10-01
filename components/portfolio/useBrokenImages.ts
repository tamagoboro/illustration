'use client'

import { useEffect, useState } from 'react'

// 読み込めない画像（削除済み・URL切れ）を調べる。
// <img> の onError だけだと、ページの準備（ハイドレーション）が終わる前に読み込みに失敗した画像を
// 取りこぼすことがあるため、別途 Image オブジェクトで読み込みを試して確かめる。
export function useBrokenImages(urls: string[]) {
  const [broken, setBroken] = useState<Set<string>>(new Set())
  const key = urls.join('\n')

  useEffect(() => {
    let active = true
    urls.forEach((url) => {
      const img = new Image()
      img.onerror = () => {
        if (active) setBroken((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
      }
      img.src = url
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const markBroken = (url: string) => setBroken((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))
  return { broken, markBroken }
}
