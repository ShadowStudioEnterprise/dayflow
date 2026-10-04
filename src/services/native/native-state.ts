import { create } from 'zustand'
export const useNativeState = create<{ error: string }>(() => ({ error: '' }))
