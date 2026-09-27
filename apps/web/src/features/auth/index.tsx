import type { ReactNode } from 'react';
// Issue #10 supplies identity context and identity-switch UI through these exports.
export function AuthProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function IdentitySwitcher() { return null; }
