/**
 * Communications Utilities
 *
 * Helpers for initiating phone calls, SMS, and email from the app.
 */

import { Linking, Platform, Alert } from 'react-native'

/**
 * Open the phone dialer with a number pre-filled
 */
export async function openDialer(phoneNumber: string): Promise<boolean> {
  // Clean the phone number (remove non-numeric except +)
  const cleaned = phoneNumber.replace(/[^\d+]/g, '')

  const url = Platform.OS === 'ios' ? `telprompt:${cleaned}` : `tel:${cleaned}`

  try {
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      return true
    } else {
      Alert.alert('Unable to Call', 'This device cannot make phone calls.')
      return false
    }
  } catch (error) {
    console.error('[Communications] openDialer error:', error)
    Alert.alert('Error', 'Failed to open phone dialer.')
    return false
  }
}

/**
 * Open the SMS app with a number and optional pre-filled message
 */
export async function openSMS(phoneNumber: string, message?: string): Promise<boolean> {
  // Clean the phone number
  const cleaned = phoneNumber.replace(/[^\d+]/g, '')

  // iOS and Android handle the separator differently
  const separator = Platform.OS === 'ios' ? '&' : '?'
  let url = `sms:${cleaned}`

  if (message) {
    url += `${separator}body=${encodeURIComponent(message)}`
  }

  try {
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      return true
    } else {
      Alert.alert('Unable to Text', 'This device cannot send SMS messages.')
      return false
    }
  } catch (error) {
    console.error('[Communications] openSMS error:', error)
    Alert.alert('Error', 'Failed to open messaging app.')
    return false
  }
}

/**
 * Open the email app with a pre-filled email
 */
export async function openEmail(
  email: string,
  subject?: string,
  body?: string
): Promise<boolean> {
  let url = `mailto:${email}`
  const params: string[] = []

  if (subject) {
    params.push(`subject=${encodeURIComponent(subject)}`)
  }
  if (body) {
    params.push(`body=${encodeURIComponent(body)}`)
  }
  if (params.length > 0) {
    url += `?${params.join('&')}`
  }

  try {
    const canOpen = await Linking.canOpenURL(url)
    if (canOpen) {
      await Linking.openURL(url)
      return true
    } else {
      Alert.alert('Unable to Email', 'No email app is configured on this device.')
      return false
    }
  } catch (error) {
    console.error('[Communications] openEmail error:', error)
    Alert.alert('Error', 'Failed to open email app.')
    return false
  }
}

/**
 * Get lead source icon based on capture source
 */
export function getLeadSourceIcon(source?: string): string {
  if (!source) return '📍'

  const sourceIcons: Record<string, string> = {
    driving: '🚗',
    driving_for_dollars: '🚗',
    manual: '✏️',
    import: '📄',
    csv_import: '📄',
    api: '🔌',
    web: '🌐',
    referral: '👤',
    mls: '🏠',
    foreclosure: '⚠️',
    tax_lien: '💰',
    probate: '📋',
    absentee: '🏚️',
    vacant: '🏚️',
  }

  // Check for partial matches
  const lowerSource = source.toLowerCase()
  for (const [key, icon] of Object.entries(sourceIcons)) {
    if (lowerSource.includes(key)) {
      return icon
    }
  }

  return '📍'
}

/**
 * Get lead source label
 */
export function getLeadSourceLabel(source?: string): string {
  if (!source) return 'Unknown'

  const sourceLabels: Record<string, string> = {
    driving: 'Driving',
    driving_for_dollars: 'Driving',
    manual: 'Manual',
    import: 'Import',
    csv_import: 'CSV Import',
    api: 'API',
    web: 'Web',
    referral: 'Referral',
    mls: 'MLS',
    foreclosure: 'Foreclosure',
    tax_lien: 'Tax Lien',
    probate: 'Probate',
    absentee: 'Absentee',
    vacant: 'Vacant',
  }

  const lowerSource = source.toLowerCase()
  for (const [key, label] of Object.entries(sourceLabels)) {
    if (lowerSource.includes(key)) {
      return label
    }
  }

  return source
}

export const communications = {
  openDialer,
  openSMS,
  openEmail,
  getLeadSourceIcon,
  getLeadSourceLabel,
}
