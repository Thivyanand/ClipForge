const features = [
  { title: "AI clip discovery", description: "Find complete, engaging moments in long-form recordings." },
  { title: "Smart captions", description: "Create editable subtitles with creator-friendly styles." },
  { title: "Creator studio", description: "Review, refine and export clips from one workspace." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-10">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <a className="text-xl font-semibold tracking-tight" href="/">
          clip<span className="text-violet-400">forge</span>
        </a>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">
          Early development
        </span>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-5 text-sm font-medium uppercase tracking-[0.24em] text-violet-300">
          AI video repurposing studio
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
          Your long videos.<br /><span className="text-zinc-500">More ways to share.</span>
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-zinc-400">
          ClipForge is being built to discover the strongest moments in your recordings
          and turn them into short-form videos you can make your own.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <span className="rounded-lg bg-violet-500 px-5 py-3 text-sm font-semibold text-white">
            Creator studio coming soon
          </span>
          <span className="rounded-lg border border-white/10 px-5 py-3 text-sm text-zinc-300">
            Phase 0 · Foundation
          </span>
        </div>
      </section>
      <section className="grid gap-4 border-t border-white/10 pt-8 md:grid-cols-3">
        {features.map((feature) => (
          <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-5 font-medium">{feature.title}</h2>
            <p className="text-sm leading-6 text-zinc-400">{feature.description}</p>
          </article>
        ))}
      </section>
      <footer className="pt-10 text-xs text-zinc-600">ClipForge · Built for creators</footer>
    </main>
  );
}
