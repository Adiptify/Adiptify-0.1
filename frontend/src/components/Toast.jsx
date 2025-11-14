import { useEffect, useState } from 'react'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(), 300) // Wait for fade out
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'bg-blue-500'
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg ${bgColors[type]} text-white px-4 py-3 shadow-2xl min-w-[300px] max-w-md transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <span className="text-xl font-bold">{icons[type]}</span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={() => {
          setVisible(false)
          setTimeout(() => onClose?.(), 300)
        }}
        className="text-white/80 hover:text-white transition-colors"
      >
        ×
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

