import { buildPageMetadata } from '@/lib/pageMetadata'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'

// 合意内容の控えは当事者だけのページなので、検索には出さない
export const metadata = buildPageMetadata({
  title: '合意内容の控え',
  description: '依頼者とクリエイターが合意した料金・納期・修正回数・使ってよい範囲などの控えです。',
  path: '/agreements',
  noindex: true,
})

export default function AgreementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24 relative bg-cover bg-center print:bg-none print:bg-white" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10 print:hidden" />
      <div className="print:hidden">
        <SimpleHeader label="合意内容の控え" />
      </div>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  )
}
