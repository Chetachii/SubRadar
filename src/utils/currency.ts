export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$',  label: 'US Dollar' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
]

export function currencySymbol(code: string | undefined): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? '$'
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}
