import { useState, useEffect, useRef } from "react";

/**
 * Form məlumatlarını sessionStorage-da saxlayır.
 * - Hər dəyişiklikdə avtomatik yadda saxlayır
 * - Uğurlu submit-dən sonra `clearDraft()` çağırılmalıdır
 * - Yalnız YENİ form üçün işləyir (edit formu üçün deyil)
 */
export function useFormDraft<T extends object>(
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
      if (saved) return { ...initialValue, ...JSON.parse(saved) };
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
