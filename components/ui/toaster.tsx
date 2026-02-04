'use client'

import { useToast } from '@/hooks/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, className, ...props }) {
        const isSystemNotification = className?.includes('bg-orange-500') || className?.includes('bg-green-500')
        return (
          <Toast key={id} className={className} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle className={isSystemNotification ? 'text-white' : ''}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={isSystemNotification ? 'text-white' : ''}>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose className={isSystemNotification ? 'text-white hover:text-white/80 opacity-100' : ''} />
          </Toast>
        )
      })}
      <ToastViewport className="fixed top-0 right-0 z-[120] flex max-h-screen w-full flex-col p-4 md:max-w-[500px]" />
    </ToastProvider>
  )
}
