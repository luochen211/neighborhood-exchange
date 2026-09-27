// Issue #10 owns these slots. Detail (Issue #9) supplies itemId only;
// actions obtain their own item/session state through the shared client.
export interface ExchangeActionsProps { itemId: string }
export function IntentActions(_props: ExchangeActionsProps) { void _props; return null; }
export function OwnerActions(_props: ExchangeActionsProps) { void _props; return null; }
