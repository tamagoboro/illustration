import type { Metadata } from 'next'
import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import { backgroundImageStyle } from '@/lib/background'
import ContactForm from './ContactForm'

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: 'Drawkerへのご質問・不具合のご報告・機能のご要望・取材や提携のご相談は、こちらのフォームからお送りください。',
}

export default function ContactPage() {
  return (
    <div className="min-h-screen pb-20 relative bg-cover bg-center" style={backgroundImageStyle}>
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400/20 via-sky-100/10 to-sky-900/20 backdrop-blur-[2px] pointer-events-none -z-10" />
      <SimpleHeader label="お問い合わせ" />

      <div className="max-w-2xl mx-auto space-y-6 py-12 px-4 sm:px-6">
        <div className="text-center space-y-3">
          <span className="inline-block px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-[10px] font-black tracking-wide">
            CONTACT
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 drop-shadow-sm">お問い合わせ</h1>
          <p className="text-sm text-slate-600 font-medium drop-shadow-sm leading-relaxed">
            ご質問・不具合のご報告・ご要望など、
            <br className="sm:hidden" />
            お気軽にお送りください。
          </p>
        </div>

        <div className="rounded-2xl bg-white/80 border border-sky-100 px-4 py-3 text-[11px] text-slate-500 leading-relaxed">
          送信の前に、
          <Link href="/faq" className="font-bold text-sky-600 hover:underline">
            よくある質問
          </Link>
          もあわせてご確認ください。クリエイターとの取引内容（料金・納期など）については、運営ではお答えできないため、クリエイターへ直接お問い合わせください。
        </div>

        <ContactForm />
      </div>
    </div>
  )
}
