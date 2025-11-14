export default function PageContainer({ children, className = '' }) {
  return (
    <section className={`mx-auto my-6 max-w-6xl rounded-2xl bg-white p-7 shadow-2xl ring-1 ring-black/5 dark:bg-slate-900 dark:ring-slate-800 animate-fadeIn ${className}`}>
      {children}
    </section>
  )
}
