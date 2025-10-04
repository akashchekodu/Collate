"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, CheckCircle, Info, XCircle, Copy } from "lucide-react"

const ModalContext = createContext()

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

export function ModalProvider({ children }) {
  const [modals, setModals] = useState([])

  const showModal = useCallback((config) => {
    const id = Date.now().toString()
    const modal = {
      id,
      ...config,
      onClose: () => {
        setModals(prev => prev.filter(m => m.id !== id))
        config.onClose?.()
      }
    }
    setModals(prev => [...prev, modal])
    return id
  }, [])

  const closeModal = useCallback((id) => {
    setModals(prev => prev.filter(m => m.id !== id))
  }, [])

  const closeAllModals = useCallback(() => {
    setModals([])
  }, [])

  // Helper methods for common modal types
  const showSuccess = useCallback((title, message, options = {}) => {
    return showModal({
      type: 'success',
      title,
      message,
      ...options
    })
  }, [showModal])

  const showError = useCallback((title, message, options = {}) => {
    return showModal({
      type: 'error',
      title,
      message,
      ...options
    })
  }, [showModal])

  const showInfo = useCallback((title, message, options = {}) => {
    return showModal({
      type: 'info',
      title,
      message,
      ...options
    })
  }, [showModal])

  const showWarning = useCallback((title, message, options = {}) => {
    return showModal({
      type: 'warning',
      title,
      message,
      ...options
    })
  }, [showModal])

  const showConfirm = useCallback((title, message, options = {}) => {
    return new Promise((resolve) => {
      showModal({
        type: 'confirm',
        title,
        message,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
        ...options
      })
    })
  }, [showModal])

  const showCustom = useCallback((config) => {
    return showModal(config)
  }, [showModal])

  const value = {
    showModal,
    closeModal,
    closeAllModals,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showConfirm,
    showCustom
  }

  const getIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'error': return <XCircle className="h-6 w-6 text-red-600" />
      case 'warning': return <AlertTriangle className="h-6 w-6 text-yellow-600" />
      case 'info': return <Info className="h-6 w-6 text-blue-600" />
      default: return null
    }
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      
      {modals.map((modal) => (
        <Dialog key={modal.id} open={true} onOpenChange={modal.onClose}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {getIcon(modal.type)}
                <DialogTitle>{modal.title}</DialogTitle>
              </div>
              {modal.message && (
                <DialogDescription className="pt-2 whitespace-pre-line">
                  {modal.message}
                </DialogDescription>
              )}
            </DialogHeader>

            {/* Custom content */}
            {modal.content && (
              <div className="py-4">
                {modal.content}
              </div>
            )}

            {/* Copyable text */}
            {modal.copyableText && (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-md">
                <code className="flex-1 text-sm break-all">{modal.copyableText}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(modal.copyableText)
                    // Could show a toast here
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}

            <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
              {modal.type === 'confirm' ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      modal.onCancel?.()
                      modal.onClose()
                    }}
                  >
                    {modal.cancelText || 'Cancel'}
                  </Button>
                  <Button
                    onClick={() => {
                      modal.onConfirm?.()
                      modal.onClose()
                    }}
                  >
                    {modal.confirmText || 'Confirm'}
                  </Button>
                </>
              ) : (
                <Button onClick={modal.onClose}>
                  {modal.buttonText || 'OK'}
                </Button>
              )}
              
              {/* Custom buttons */}
              {modal.customButtons?.map((button, index) => (
                <Button
                  key={index}
                  variant={button.variant || 'default'}
                  onClick={() => {
                    button.onClick?.()
                    if (button.closeOnClick !== false) {
                      modal.onClose()
                    }
                  }}
                >
                  {button.text}
                </Button>
              ))}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </ModalContext.Provider>
  )
}
