"use client"

import React from "react"

interface CustomScrollbarProps {
  children: React.ReactNode
  className?: string
}

export function CustomScrollbar({ children, className = "" }: CustomScrollbarProps) {
  return (
    <div className={`custom-scrollbar ${className}`}>
      {children}
    </div>
  )
}
