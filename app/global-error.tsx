"use client"

import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    if (!error) return
    const message = String(error?.message || "")
    const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(message)
    if (isChunkError) {
      const key = "__chunk_reload_once__"
      try {
        const already = typeof window !== "undefined" ? sessionStorage.getItem(key) === "1" : false
        if (!already) {
          sessionStorage.setItem(key, "1")
          window.location.reload()
        }
      } catch {}
    }
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">A network hiccup may have prevented a script from loading. Please try again.</p>
            <button onClick={() => reset()} className="px-4 py-2 rounded bg-black text-white">Try again</button>
          </div>
        </div>
      </body>
    </html>
  )
}

