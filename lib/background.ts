// サイト全体で共通の背景画像。利用規約・プライバシーポリシーなど法的文書のページは
// 可読性最優先のため対象外とし、それ以外のページで統一的に使う。
export const BACKGROUND_IMAGE_URL =
  'https://qcklfkslqtjnxufqcqyi.supabase.co/storage/v1/object/public/portfolios/bg.png'

export const backgroundImageStyle = {
  backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
}
