/**
 * AddressAutocomplete Component
 *
 * Google Places autocomplete for property address search.
 * Returns parsed address components (street, city, state, zip).
 */

import React, { useRef } from 'react'
import { StyleSheet, View, Text } from 'react-native'
import { GooglePlacesAutocomplete, GooglePlaceData, GooglePlaceDetail } from 'react-native-google-places-autocomplete'
import { colors, spacing, typography, radii } from '../theme'

// Get your API key from environment or constants
const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''

export interface ParsedAddress {
  streetAddress: string
  city: string
  state: string
  zipCode: string
  fullAddress: string
  lat?: number
  lng?: number
}

interface AddressAutocompleteProps {
  onAddressSelected: (address: ParsedAddress) => void
  placeholder?: string
  label?: string
  initialValue?: string
}

/**
 * Parse Google Place details into structured address components
 */
function parseGooglePlaceDetails(data: GooglePlaceData, details: GooglePlaceDetail | null): ParsedAddress {
  const components = details?.address_components || []

  let streetNumber = ''
  let route = ''
  let city = ''
  let state = ''
  let zipCode = ''

  for (const component of components) {
    const types = component.types

    if (types.includes('street_number')) {
      streetNumber = component.long_name
    } else if (types.includes('route')) {
      route = component.long_name
    } else if (types.includes('locality')) {
      city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      state = component.short_name // Use short name for state (e.g., "IL" not "Illinois")
    } else if (types.includes('postal_code')) {
      zipCode = component.long_name
    }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(' ')

  return {
    streetAddress,
    city,
    state,
    zipCode,
    fullAddress: data.description || details?.formatted_address || '',
    lat: details?.geometry?.location?.lat,
    lng: details?.geometry?.location?.lng,
  }
}

export function AddressAutocomplete({
  onAddressSelected,
  placeholder = 'Search address...',
  label,
  initialValue = '',
}: AddressAutocompleteProps) {
  const ref = useRef<any>(null)

  const handlePress = (data: GooglePlaceData, details: GooglePlaceDetail | null) => {
    const parsed = parseGooglePlaceDetails(data, details)
    onAddressSelected(parsed)
  }

  if (!GOOGLE_PLACES_API_KEY) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          Google Places API key not configured. Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your environment.
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <GooglePlacesAutocomplete
        ref={ref}
        placeholder={placeholder}
        onPress={handlePress}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: 'en',
          components: 'country:us', // Restrict to US addresses
          types: 'address', // Only return addresses, not businesses
        }}
        fetchDetails={true}
        textInputProps={{
          placeholderTextColor: colors.slate[400],
          returnKeyType: 'search',
          autoCorrect: false,
          autoCapitalize: 'words',
        }}
        styles={{
          container: styles.autocompleteContainer,
          textInputContainer: styles.textInputContainer,
          textInput: styles.textInput,
          listView: styles.listView,
          row: styles.row,
          description: styles.description,
          separator: styles.separator,
          poweredContainer: styles.poweredContainer,
          powered: styles.powered,
        }}
        enablePoweredByContainer={false}
        debounce={300}
        minLength={3}
        nearbyPlacesAPI="GooglePlacesSearch"
        GooglePlacesDetailsQuery={{
          fields: 'address_components,geometry,formatted_address',
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    zIndex: 10, // Ensure dropdown appears above other elements
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold as any,
    color: colors.slate[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  autocompleteContainer: {
    flex: 0,
  },
  textInputContainer: {
    backgroundColor: 'transparent',
  },
  textInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.fontSize.base,
    color: colors.ink,
    height: 48,
  },
  listView: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate[200],
    borderRadius: radii.lg,
    marginTop: spacing.xs,
    ...StyleSheet.flatten({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    }),
  },
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  description: {
    fontSize: typography.fontSize.sm,
    color: colors.ink,
  },
  separator: {
    height: 1,
    backgroundColor: colors.slate[100],
  },
  poweredContainer: {
    display: 'none',
  },
  powered: {
    display: 'none',
  },
  errorContainer: {
    backgroundColor: colors.warning[50],
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[700],
  },
})

export default AddressAutocomplete
