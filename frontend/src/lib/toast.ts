// 轻量全局 toast：模块级事件总线，无需 Context，任何地方 import { toast } 即可
export type ToastKind = 'error' | 'success' | 'info';
export interface ToastItem { id: number; text: string; kind: ToastKind }

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function toast(text: string, kind: ToastKind = 'error', duration = 4000) {
  const item: ToastItem = { id: nextId++, text, kind };
  toasts = [...toasts, item];
  emit();
  if (duration > 0) setTimeout(() => dismissToast(item.id), duration);
  return item.id;
}

export function dismissToast(id: number) {
  if (!toasts.some(t => t.id === id)) return;
  toasts = toasts.filter(t => t.id !== id);
  emit();
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => { listeners.delete(listener); };
}
