export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
    xl: 'h-16 w-16 border-4'
  }

  return (
    <div className={`inline-block ${sizes[size]} ${className}`}>
      <div className="h-full w-full animate-spin rounded-full border-indigo-500 border-t-transparent"></div>
    </div>
  )
}

export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl bg-white px-8 py-6 text-center shadow-2xl dark:bg-slate-900 animate-fadeIn">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
      </div>
    </div>
  )
}

export function LoadingSkeleton({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4 rounded w-full"></div>
      ))}
    </div>
  )
}

