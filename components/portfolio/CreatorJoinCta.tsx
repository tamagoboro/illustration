import Link from 'next/link'
import Reveal from '@/components/Reveal'

// ポートフォリオを見に来たイラストレーターに「自分も作ってみたい」と思ってもらうための案内（本人以外に表示）
export default function CreatorJoinCta() {
  return (
    <Reveal>
      <section
        className="drawker-gradient-flow relative overflow-hidden rounded-3xl p-7 sm:p-10 text-white shadow-xl"
        // 端と端を同じ色にして、横に流れても継ぎ目が出ないグラデーションにする
        style={{ backgroundImage: 'linear-gradient(90deg, #0ea5e9, #8b5cf6, #ec4899, #8b5cf6, #0ea5e9)' }}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative grid sm:grid-cols-[1fr_auto] gap-5 items-center">
          <div className="space-y-2">
            <p className="text-[11px] font-black tracking-[0.25em] text-white/80">FOR ILLUSTRATORS</p>
            <h2 className="text-xl sm:text-2xl font-black leading-snug">
              あなたも、こんなポートフォリオを
              <br className="hidden sm:inline" />
              無料で作ってみませんか？
            </h2>
            <ul className="text-xs sm:text-sm font-bold text-white/90 space-y-1 pt-1">
              <li>🎨 背景やカバー画像を選んで、自分らしいページに</li>
              <li>🧮 料金表・見積もりフォームで依頼がスムーズに</li>
              <li>💸 掲載料・仲介手数料はずっと0円</li>
            </ul>
          </div>
          <Link
            href="/login"
            className="shrink-0 text-center px-7 py-3.5 rounded-full bg-white text-violet-700 text-sm font-black shadow-lg hover:scale-105 active:scale-95 transition-transform"
          >
            無料でポートフォリオを作る →
          </Link>
        </div>
      </section>
    </Reveal>
  )
}
