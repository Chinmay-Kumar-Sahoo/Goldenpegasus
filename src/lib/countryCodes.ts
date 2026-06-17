export interface CountryCode {
  code: string
  country: string
  label: string
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: '+1', country: 'US', label: '+1 (US)' },
  { code: '+1', country: 'CA', label: '+1 (Canada)' },
  { code: '+44', country: 'UK', label: '+44 (UK)' },
  { code: '+91', country: 'IN', label: '+91 (India)' },
  { code: '+61', country: 'AU', label: '+61 (Australia)' },
  { code: '+81', country: 'JP', label: '+81 (Japan)' },
  { code: '+86', country: 'CN', label: '+86 (China)' },
  { code: '+49', country: 'DE', label: '+49 (Germany)' },
  { code: '+33', country: 'FR', label: '+33 (France)' },
  { code: '+39', country: 'IT', label: '+39 (Italy)' },
  { code: '+55', country: 'BR', label: '+55 (Brazil)' },
  { code: '+7', country: 'RU', label: '+7 (Russia)' },
  { code: '+82', country: 'KR', label: '+82 (South Korea)' },
  { code: '+34', country: 'ES', label: '+34 (Spain)' },
  { code: '+31', country: 'NL', label: '+31 (Netherlands)' },
  { code: '+46', country: 'SE', label: '+46 (Sweden)' },
  { code: '+41', country: 'CH', label: '+41 (Switzerland)' },
  { code: '+971', country: 'AE', label: '+971 (UAE)' },
  { code: '+65', country: 'SG', label: '+65 (Singapore)' },
  { code: '+60', country: 'MY', label: '+60 (Malaysia)' },
  { code: '+63', country: 'PH', label: '+63 (Philippines)' },
  { code: '+64', country: 'NZ', label: '+64 (New Zealand)' },
  { code: '+27', country: 'ZA', label: '+27 (South Africa)' },
  { code: '+52', country: 'MX', label: '+52 (Mexico)' },
  { code: '+54', country: 'AR', label: '+54 (Argentina)' },
  { code: '+56', country: 'CL', label: '+56 (Chile)' },
  { code: '+57', country: 'CO', label: '+57 (Colombia)' },
  { code: '+351', country: 'PT', label: '+351 (Portugal)' },
  { code: '+353', country: 'IE', label: '+353 (Ireland)' },
  { code: '+45', country: 'DK', label: '+45 (Denmark)' },
  { code: '+47', country: 'NO', label: '+47 (Norway)' },
  { code: '+358', country: 'FI', label: '+358 (Finland)' },
  { code: '+32', country: 'BE', label: '+32 (Belgium)' },
  { code: '+43', country: 'AT', label: '+43 (Austria)' },
  { code: '+48', country: 'PL', label: '+48 (Poland)' },
  { code: '+30', country: 'GR', label: '+30 (Greece)' },
  { code: '+90', country: 'TR', label: '+90 (Turkey)' },
  { code: '+972', country: 'IL', label: '+972 (Israel)' },
  { code: '+966', country: 'SA', label: '+966 (Saudi Arabia)' },
  { code: '+20', country: 'EG', label: '+20 (Egypt)' },
  { code: '+234', country: 'NG', label: '+234 (Nigeria)' },
  { code: '+92', country: 'PK', label: '+92 (Pakistan)' },
  { code: '+880', country: 'BD', label: '+880 (Bangladesh)' },
  { code: '+94', country: 'LK', label: '+94 (Sri Lanka)' },
  { code: '+977', country: 'NP', label: '+977 (Nepal)' },
  { code: '+84', country: 'VN', label: '+84 (Vietnam)' },
  { code: '+66', country: 'TH', label: '+66 (Thailand)' },
  { code: '+62', country: 'ID', label: '+62 (Indonesia)' },
  { code: '+852', country: 'HK', label: '+852 (Hong Kong)' },
  { code: '+886', country: 'TW', label: '+886 (Taiwan)' },
]

export function getCountryCodeOptions(selectedCode?: string): CountryCode[] {
  if (!selectedCode) return COUNTRY_CODES
  const exists = COUNTRY_CODES.some(c => c.code === selectedCode)
  if (exists) return COUNTRY_CODES
  return [{ code: selectedCode, country: 'Other', label: `${selectedCode} (Other)` }, ...COUNTRY_CODES]
}
