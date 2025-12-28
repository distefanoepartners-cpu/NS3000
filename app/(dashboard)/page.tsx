'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/planning')
  }, [router])

  return (
    <div className="p-8">
      <div className="text-gray-600">Caricamento Planning...</div>
    </div>
  )
}