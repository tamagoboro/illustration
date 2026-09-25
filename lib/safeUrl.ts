// ユーザーが入力したURLをリンク（href）や画像（src）にそのまま使うと、javascript: や data: などの
// 危険なスキームが混ざる恐れがある。表示前にこの関数を通し、http / https 以外は null にする。
// スキームが無い入力（example.com など）は https:// を補う。
export function toSafeHttpUrl(input?: string | null): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // 「javascript:alert(1)」のようにスキームだけがあって // が無いものは、https:// を補うのではなく拒否する
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

// <script type="application/ld+json"> に JSON を埋め込むときのシリアライズ。
// JSON.stringify のままだと、値に含まれる「</script>」でタグが閉じられ、後ろに書かれたスクリプトが
// 実行されてしまう。「<」を < に置き換えれば、JSONとしての意味は変わらずタグを閉じられなくなる。
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
