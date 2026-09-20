// maxDimension: 長辺がこれを超える場合は縮小する（表示に使わない解像度をそのまま
// アップロードすると通信量・表示速度に無駄な負荷がかかるため）。undefinedなら縮小しない。
export const convertToWebp = (file: File, quality = 0.85, maxDimension?: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.src = objectUrl

    img.onload = () => {
      try {
        let { width, height } = img
        if (maxDimension && Math.max(width, height) > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas context failure'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('WebP conversion failed'))
          },
          'image/webp',
          quality
        )
      } finally {
        // Blob URL は読み込み完了後は不要になるため、リークしないよう必ず解放する
        URL.revokeObjectURL(objectUrl)
      }
    }

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl)
      reject(err)
    }
  })
}