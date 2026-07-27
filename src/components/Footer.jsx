export default function Footer() {
  return (
    <footer className="mt-auto bg-ink text-manila-light/70">
      <div className="border-t-2 border-manila-dark" />
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/sys-logo.png"
            alt="SYS — The Systems Association of XIMB"
            className="h-9 w-9 rounded-sm border-2 border-manila-light/20 rotate-[-3deg] shadow-[2px_2px_0_rgba(0,0,0,0.3)]"
          />
          <span className="font-display text-[10px] uppercase tracking-wider text-manila-light/40">
            The Systems Association of XIMB
          </span>
        </div>

        <p className="font-hand text-lg -rotate-1">
          Designed by{' '}
          <a
            href="https://www.linkedin.com/in/YOUR-LINKEDIN-HANDLE"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-stamp transition-colors"
          >
            Tanish Rohil Gali
          </a>
          {' '}· XIMB MBA BM 2026-2028
        </p>
      </div>
    </footer>
  )
}
