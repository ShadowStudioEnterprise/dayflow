import { useNativeState } from './native-state'
export function NativeNotice() {
  const error = useNativeState((state) => state.error)
  return error ? (
    <p role="alert" className="notice">
      {error}
    </p>
  ) : null
}
