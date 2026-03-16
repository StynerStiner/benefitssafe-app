'use client'

import { useEffect } from 'react'

export default function Error({
    error,
    reset,
}: {
    error: Error
    reset: () => void
}) {
    useEffect(() => {
        console.error('App Error:', error)
    }, [error])

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center text-red-600 p-6">
            <h2 className="text-2xl font-semibold">Something went wrong!</h2>
            <p className="mt-2 text-sm text-gray-500">
                {error.message || 'An unexpected error has occurred.'}
            </p>
            <button
                onClick={() => reset()}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
                Try Again
            </button>
        </div>
    )
}
