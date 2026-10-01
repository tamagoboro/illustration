// 文字をクリップボードにコピーする。成功したら true。
// navigator.clipboard は https 以外や一部のアプリ内ブラウザ（XやLINEの中で開いたときなど）で使えないことがあるため、
// 失敗したら昔ながらの方法（選択してコピー）も試す。
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 下の方法で再挑戦する
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-1000px'
    document.body.appendChild(textarea)
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

// コピーし、できなかったときは手でコピーできるよう文字を表示する。成功したら true。
export async function copyTextOrShow(text: string): Promise<boolean> {
  const ok = await copyText(text)
  if (!ok) {
    window.prompt('自動でコピーできませんでした。下の文字を選択（長押し）してコピーしてください。', text)
  }
  return ok
}
