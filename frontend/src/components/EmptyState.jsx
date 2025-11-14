export default function EmptyState({ 
  icon = '📭', 
  title = 'No data found', 
  description = 'There is nothing to display here yet.',
  action,
  actionLabel 
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-fadeIn">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400 max-w-md mb-6">{description}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="btn-primary"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

