import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

/**
 * True on phone-width screens. Used where phones get different elements (bottom tab bar,
 * no floating help button) rather than restyled ones, so tour anchors exist only once.
 */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setPhone(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}

/** Opens the support panel from anywhere (the account menu on phones). */
export const HELP_EVENT = 'kawayan:open-help';
