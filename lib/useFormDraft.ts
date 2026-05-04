import { useState, useEffect, useRef } from "react";

/**
 * Form məlumatlarını sessionStorage-da saxlayır.
 * - Hər dəyişiklikdə avtomatik yadda saxlayır
 * - Uğurlu submit-dən sonra `clearDraft()` çağırılmalıdır
 * - Yalnız YENİ form üçün işləyir (edit formu üçün deyil)
 * - Həm object, həm array tipləri üçün işləyir
 */
export function useFormDraft<T>(
  key: string,
  initialValue: T,
  isEditMode = false
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const storageKey = `form_draft_${key}`;

  // Edit modunda draft-ı ignore et
  const getInitial = (): T => {
    if (isEditMode) return initialValue;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Array üçün birbaşa qaytar, object üçün merge et
        if (Array.isArray(parsed)) return parsed as T;
        if (typeof parsed === "object" && parsed !== null && typeof initialValue === "object" && !Array.isArray(initialValue)) {
          return { ...(initialValue as object), ...parsed } as T;
        }
        return parsed as T;
      }
    } catch {}
    return initialValue;
  };

  const [value, setValue] = useState<T>(getInitial);

  // Dəyər dəyişdikdə sessionStorage-a yaz (edit modunda yox)
  const isFirst = useRef(true);
  useEffect(() => {
    if (isEditMode) return;
    if (isFirst.current) { isFirst.current = false; return; }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {}
  }, [value, storageKey, isEditMode]);

  const clearDraft = () => {
    try { sessionStorage.removeItem(storageKey); } catch {}
  };

  return [value, setValue, clearDraft];
}
