
'use client'
import { useEffect, useState } from 'react'

export function useSidebarCollapsed(): boolean {
    const [isCollapsed, setIsCollapsed] = useState(false)

    useEffect(() => {
        const sidebar = document.querySelector('[data-state]')

        const updateState = () => {
            const isCollapsedState = sidebar?.getAttribute('data-state') === 'collapsed'
            setIsCollapsed(isCollapsedState)
        }

        updateState()

        const observer = new MutationObserver(updateState)
        if (sidebar) {
        observer.observe(sidebar, { attributes: true, attributeFilter: ['data-state'] })
        }

        return () => observer.disconnect()
    }, [])

    return isCollapsed
}