'use client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  )
}
