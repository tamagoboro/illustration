import Link from 'next/link'
import SimpleHeader from '@/components/SimpleHeader'
import SoulGallery from '@/components/SoulGallery'
import SoulShareButton from '@/components/SoulShareButton'
import SoulApplyForm from '@/components/SoulApplyForm'
import SoulInterestButton from '@/components/SoulInterestButton'
import ProtectedImage from '@/components/ProtectedImage'
import Reveal from '@/components/Reveal'
import {
  SoulListing,
  COMMERCIAL_USE_LABELS,
  SOUL_STATUS_LABELS,
  getSoulStatus,
  formatSoulPeriod,
  formatPrice,
  minSoulPrice,
  soulDaysLeft,
} from '@/lib/soulListings'
import { normalizeBackground, backgroundStyle } from '@/lib/portfolioDesign'
import type { SoulPageData } from '@/lib/soulPageData'

// 魂募集の詳細ページの中身。公開ページ（サーバー）と、非公開・掲載前の本人プレビュー（ブラウザ）の両方で使う。
// 「どんな子で・何がもらえて・いくらで・どう進むか」が上から順に分かり、迷わず応募できる構成にしている。

const COMMERCIAL_STYLES: Record<SoulListing['commercial_use'], string> = {
  allowed: 'bg-emerald-100 text-emerald-700',
  not_allowed: 'bg-slate-200 text-slate-600',
  negotiable: 'bg-amber-100 text-amber-700',
}

// 応募の流れ（Drawkerは決済を仲介しないので、契約・支払いは当事者同士で行う）
const FLOW_STEPS = [
  { emoji: '✉️', title: '応募する', body: 'このページの応募フォームから、自己紹介や活動予定を送ります。' },
  { emoji: '💬', title: 'クリエイターと相談', body: 'クリエイターから連絡が来たら、プランや納品の詳細をすり合わせます。' },
  { emoji: '🤝', title: '契約・お支払い', body: '条件に合意したら、クリエイターと直接お支払いの方法を決めます。' },
  { emoji: '🎁', title: '納品・デビュー', body: 'データを受け取ったら、この子の魂としての活動スタートです！' },
]

function SectionTitle({ en, children }: { en: string; children: string }) {
  return (
    <div>
      <p className="text-[10px] font-black tracking-[0.3em] text-violet-500">{en}</p>
      <h2 className="text-lg font-black text-slate-800">{children}</h2>
    </div>
  )
}

export default function SoulDetailView({ id, listing, profile, creatorStats }: { id: string } & SoulPageData) {
  const status = getSoulStatus(listing)
  const isOpen = status === 'open'
  const min = minSoulPrice(listing.prices)
  const daysLeft = isOpen ? soulDaysLeft(listing) : null
  const pageStyle = backgroundStyle(normalizeBackground(profile.page_background))
  const priceHeadline = listing.prices.length === 0 ? null : min === null ? '応相談' : `${formatPrice(min)}〜`

  return (
    <div className="min-h-screen pb-32 lg:pb-24 relative bg-cover bg-center" style={pageStyle}>
      <SimpleHeader label="魂募集" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-8">
        <Link
          href={`/creator/${id}`}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full shadow-sm hover:bg-white"
        >
          ← {profile.display_name}さんのページ
        </Link>

        {/* ===== ファーストビュー：イラスト（左）と、価格・応募ボタン（右） ===== */}
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-8 items-start">
          <div className="lg:sticky lg:top-24 bg-white/90 backdrop-blur-md rounded-[2rem] p-3 ring-1 ring-black/5 shadow-2xl">
            <SoulGallery
              images={listing.image_urls}
              title={listing.title}
              watermarkText={profile.display_name}
              overlayLabel={!isOpen ? SOUL_STATUS_LABELS[status] : null}
            />
          </div>

          <div className="space-y-5">
            <div className="bg-white/95 backdrop-blur-md rounded-[2rem] p-6 sm:p-7 ring-1 ring-black/5 shadow-xl space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${isOpen ? 'bg-violet-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  🎭 {isOpen ? '魂募集中' : SOUL_STATUS_LABELS[status]}
                </span>
                <span className={`text-[11px] font-black px-3 py-1 rounded-full ${COMMERCIAL_STYLES[listing.commercial_use]}`}>
                  {COMMERCIAL_USE_LABELS[listing.commercial_use]}
                </span>
                {daysLeft !== null && (
                  <span
                    className={`text-[11px] font-black px-3 py-1 rounded-full ${
                      daysLeft <= 7 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ⏳ {daysLeft === 0 ? '本日まで' : `残り${daysLeft}日`}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">{listing.title}</h1>
                <Link href={`/creator/${id}`} className="inline-flex items-center gap-2 group">
                  <span className="w-8 h-8 rounded-full overflow-hidden bg-sky-100 shrink-0 ring-2 ring-white shadow">
                    {profile.avatar_url && <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <span className="text-sm font-bold text-slate-600 group-hover:text-sky-600">{profile.display_name}</span>
                  {creatorStats.reviewCount > 0 && (
                    <span className="text-xs font-black text-amber-500">
                      ★ {creatorStats.reviewAvg.toFixed(1)}
                      <span className="text-slate-400 font-bold">（{creatorStats.reviewCount}）</span>
                    </span>
                  )}
                </Link>
              </div>

              {priceHeadline && (
                <div className="rounded-2xl bg-gradient-to-r from-violet-50 to-sky-50 px-5 py-4">
                  <p className="text-[11px] font-black text-slate-500">お迎え価格</p>
                  <p className="text-3xl font-black text-violet-700 tracking-tight">{priceHeadline}</p>
                  {listing.prices.length > 1 && (
                    <p className="text-[11px] font-bold text-slate-500 mt-0.5">{listing.prices.length}つのプランから選べます</p>
                  )}
                </div>
              )}

              {listing.target_audience && (
                <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
                  <span className="font-black text-violet-600">こんな方に：</span>
                  {listing.target_audience}
                </p>
              )}

              <div className="space-y-2.5">
                {isOpen ? (
                  <a
                    href="#apply"
                    className="flex items-center justify-center gap-2 w-full py-4 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:brightness-110 text-white text-base font-black shadow-lg shadow-violet-500/30 active:scale-[0.98] transition"
                  >
                    🎭 この子の魂に応募する
                  </a>
                ) : (
                  <div className="w-full py-4 rounded-full bg-slate-100 text-slate-500 text-sm font-black text-center">
                    この魂募集は{SOUL_STATUS_LABELS[status]}です
                  </div>
                )}
                <SoulInterestButton soulListingId={listing.id} creatorId={id} />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400">掲載 {formatSoulPeriod(listing)}</span>
                {isOpen && (
                  <div className="w-36 shrink-0">
                    <SoulShareButton listing={listing} creatorName={profile.display_name} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 詳細（左）と、描いたクリエイター（右） ===== */}
        <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 lg:gap-8 items-start">
          <div className="space-y-6 min-w-0">
            {/* 納品物 */}
            {listing.deliverables.length > 0 && (
              <Reveal>
                <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                  <SectionTitle en="WHAT YOU GET">お迎えすると受け取れるもの</SectionTitle>
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {listing.deliverables.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 bg-emerald-50/70 rounded-2xl px-4 py-3">
                        <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                          ✓
                        </span>
                        <span className="text-sm font-bold text-slate-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </Reveal>
            )}

            {/* プラン */}
            {listing.prices.length > 0 && (
              <Reveal>
                <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                  <SectionTitle en="PLANS">プラン</SectionTitle>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {listing.prices.map((p, i) => (
                      <div
                        key={p.label}
                        className={`rounded-2xl p-4 border-2 ${
                          i === 0 ? 'border-violet-300 bg-violet-50/60' : 'border-slate-100 bg-white'
                        }`}
                      >
                        <p className="text-xs font-black text-slate-500">{p.label}</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{formatPrice(p.price)}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* キャラクター設定 */}
            {listing.character_profile.length > 0 && (
              <Reveal>
                <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                  <SectionTitle en="PROFILE">キャラクター設定</SectionTitle>
                  <dl className="grid sm:grid-cols-2 gap-x-6 divide-y divide-slate-100 sm:divide-y-0">
                    {listing.character_profile.map((item) => (
                      <div key={item.label} className="flex gap-4 py-2.5 sm:border-b sm:border-slate-100">
                        <dt className="w-20 shrink-0 text-xs font-black text-violet-600">{item.label}</dt>
                        <dd className="text-sm font-bold text-slate-700 whitespace-pre-wrap break-words">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </Reveal>
            )}

            {/* 詳細 */}
            {(listing.target_audience || listing.description) && (
              <Reveal>
                <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                  <SectionTitle en="ABOUT">この子について</SectionTitle>
                  {listing.target_audience && (
                    <div className="rounded-2xl bg-violet-50/70 p-4">
                      <p className="text-xs font-black text-violet-600 mb-1">こんな方におすすめ</p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{listing.target_audience}</p>
                    </div>
                  )}
                  {listing.description && (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">{listing.description}</p>
                  )}
                </section>
              </Reveal>
            )}

            {/* 応募の流れ */}
            <Reveal>
              <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                <SectionTitle en="FLOW">お迎えまでの流れ</SectionTitle>
                <ol className="grid sm:grid-cols-4 gap-3">
                  {FLOW_STEPS.map((step, i) => (
                    <li key={step.title} className="relative rounded-2xl bg-slate-50 p-4 space-y-1.5">
                      <span className="text-[10px] font-black text-violet-500">STEP {i + 1}</span>
                      <p className="text-2xl">{step.emoji}</p>
                      <p className="text-sm font-black text-slate-800">{step.title}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{step.body}</p>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>

            {/* よくある質問 */}
            {listing.faqs.length > 0 && (
              <Reveal>
                <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                  <SectionTitle en="Q&A">よくある質問</SectionTitle>
                  <div className="space-y-2">
                    {listing.faqs.map((faq) => (
                      <details key={faq.q} className="group rounded-2xl bg-slate-50 open:bg-violet-50/60">
                        <summary className="flex items-center justify-between gap-3 cursor-pointer list-none px-4 py-3.5">
                          <span className="text-sm font-black text-slate-800">
                            <span className="text-violet-500 mr-1.5">Q.</span>
                            {faq.q}
                          </span>
                          <span className="text-slate-400 transition-transform group-open:rotate-45 text-lg leading-none">＋</span>
                        </summary>
                        <p className="px-4 pb-4 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                          <span className="font-black text-pink-500 mr-1.5">A.</span>
                          {faq.a}
                        </p>
                      </details>
                    ))}
                  </div>
                </section>
              </Reveal>
            )}

            {/* 応募フォーム */}
            <div id="apply" className="scroll-mt-24">
              <SoulApplyForm
                creatorId={id}
                listingId={listing.id}
                listingTitle={listing.title}
                prices={listing.prices}
                isOpen={isOpen}
              />
            </div>
          </div>

          {/* 描いたクリエイター */}
          <aside className="lg:sticky lg:top-24 space-y-4">
            <Reveal>
              <section className="bg-white/95 rounded-3xl p-6 ring-1 ring-black/5 shadow-lg space-y-4">
                <p className="text-[10px] font-black tracking-[0.3em] text-violet-500">ARTIST</p>
                <div className="flex items-center gap-3">
                  <span className="w-14 h-14 rounded-full overflow-hidden bg-sky-100 shrink-0 ring-4 ring-white shadow-md">
                    {profile.avatar_url && <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-black text-slate-800 truncate">{profile.display_name}</p>
                    <p className="text-xs font-bold text-amber-500">
                      {creatorStats.reviewCount > 0 ? (
                        <>
                          {'★'.repeat(Math.round(creatorStats.reviewAvg))}
                          <span className="text-slate-200">{'★'.repeat(5 - Math.round(creatorStats.reviewAvg))}</span>
                          <span className="text-slate-500 ml-1">
                            {creatorStats.reviewAvg.toFixed(1)}（{creatorStats.reviewCount}件）
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">レビューはまだありません</span>
                      )}
                    </p>
                  </div>
                </div>
                {profile.status_comment && (
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-4 whitespace-pre-wrap">{profile.status_comment}</p>
                )}
                {creatorStats.works.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {creatorStats.works.map((w) => (
                      <div key={w.id} className="aspect-square rounded-xl overflow-hidden bg-slate-100">
                        <ProtectedImage src={w.image_url} alt={w.title || ''} watermarkText={profile.display_name} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href={`/creator/${id}`}
                  className="block text-center w-full py-2.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-black transition-colors"
                >
                  ポートフォリオを見る →
                </Link>
              </section>
            </Reveal>
            <Link
              href="/client-guidelines"
              className="block text-center text-[11px] font-bold text-slate-600 bg-white/80 backdrop-blur rounded-2xl px-4 py-3 hover:bg-white shadow-sm"
            >
              📘 応募の前に：著作権・支払い・マナーの注意事項 →
            </Link>
          </aside>
        </div>
      </div>

      {/* スマホ下部：価格と応募ボタン */}
      {isOpen && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            {priceHeadline && (
              <div className="shrink-0 leading-tight">
                <p className="text-[10px] font-bold text-slate-400">お迎え価格</p>
                <p className="text-base font-black text-violet-700">{priceHeadline}</p>
              </div>
            )}
            <a
              href="#apply"
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-black shadow-md flex items-center justify-center"
            >
              🎭 この子の魂に応募する
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
