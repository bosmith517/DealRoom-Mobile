/**
 * DealRoomMap Component
 *
 * Native Mapbox map using @rnmapbox/maps.
 * Requires EAS build (not Expo Go) - uses native modules.
 *
 * Features:
 * - No tenant DB dependency for initialization
 * - Token from EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
 * - User location tracking
 * - Marker pins for leads/properties
 * - Route line drawing for driving sessions
 */

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native'
import Mapbox, {
  MapView,
  Camera,
  UserLocation,
  PointAnnotation,
  ShapeSource,
  LineLayer,
  CircleLayer,
} from '@rnmapbox/maps'
import { colors, spacing } from '../theme'

// Initialize Mapbox with public token (no DB dependency)
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || ''

if (MAPBOX_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_TOKEN)
}

// Types
export interface MapPin {
  id: string
  lat: number
  lng: number
  label?: string
  type?: 'lead' | 'property' | 'deal' | 'visited' | 'current'
  color?: string
  data?: any
}

export interface RoutePoint {
  lat: number
  lng: number
  timestamp?: number
}

interface DealRoomMapProps {
  // Initial view
  initialCenter?: [number, number] // [lng, lat]
  initialZoom?: number

  // Pins
  pins?: MapPin[]
  onPinPress?: (pin: MapPin) => void

  // Route line (for driving sessions)
  routePoints?: RoutePoint[]
  showRoute?: boolean

  // User location
  showUserLocation?: boolean
  followUser?: boolean

  // Map style
  styleURL?: string

  // Callbacks
  onMapReady?: () => void
  onRegionChange?: (region: { lat: number; lng: number; zoom: number }) => void
  onLongPress?: (coords: { lat: number; lng: number }) => void

  // Container style
  style?: object
}

// Pin color by type
const PIN_COLORS: Record<string, string> = {
  lead: colors.brand[500],
  property: colors.info[500],
  deal: colors.success[500],
  visited: colors.slate[400],
  current: colors.error[500],
}

export function DealRoomMap({
  initialCenter = [-87.6298, 41.8781], // Chicago default
  initialZoom = 12,
  pins = [],
  onPinPress,
  routePoints = [],
  showRoute = false,
  showUserLocation = true,
  followUser = false,
  styleURL = Mapbox.StyleURL.Street,
  onMapReady,
  onRegionChange,
  onLongPress,
  style,
}: DealRoomMapProps) {
  const mapRef = useRef<MapView>(null)
  const cameraRef = useRef<Camera>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check token on mount
  useEffect(() => {
    if (!MAPBOX_TOKEN) {
      setError('Mapbox token not configured')
    }
  }, [])

  // Handle map ready
  const handleMapReady = useCallback(() => {
    setIsReady(true)
    onMapReady?.()
  }, [onMapReady])

  // Handle region change
  const handleRegionChange = useCallback(
    (feature: any) => {
      if (!onRegionChange) return
      const { geometry, properties } = feature
      if (geometry?.coordinates) {
        onRegionChange({
          lng: geometry.coordinates[0],
          lat: geometry.coordinates[1],
          zoom: properties?.zoomLevel || initialZoom,
        })
      }
    },
    [onRegionChange, initialZoom]
  )

  // Handle long press (for adding pins)
  const handleLongPress = useCallback(
    (feature: any) => {
      if (!onLongPress) return
      const { geometry } = feature
      if (geometry?.coordinates) {
        onLongPress({
          lng: geometry.coordinates[0],
          lat: geometry.coordinates[1],
        })
      }
    },
    [onLongPress]
  )

  // Convert route points to GeoJSON LineString
  const routeGeoJSON = {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: routePoints.map((p) => [p.lng, p.lat]),
    },
    properties: {},
  }

  // Convert pins to GeoJSON for clustering (optional)
  const pinsGeoJSON = {
    type: 'FeatureCollection' as const,
    features: pins.map((pin) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.lng, pin.lat],
      },
      properties: {
        id: pin.id,
        label: pin.label,
        type: pin.type || 'lead',
        color: pin.color || PIN_COLORS[pin.type || 'lead'] || colors.brand[500],
      },
    })),
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer, style]}>
        <Text style={styles.errorIcon}>🗺️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorSubtext}>Map unavailable</Text>
      </View>
    )
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL={styleURL}
        onDidFinishLoadingMap={handleMapReady}
        onRegionDidChange={handleRegionChange}
        onLongPress={handleLongPress}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        scaleBarEnabled={false}
      >
        {/* Camera */}
        <Camera
          ref={cameraRef}
          centerCoordinate={initialCenter}
          zoomLevel={initialZoom}
          followUserLocation={followUser}
          followUserMode={followUser ? 'compass' : undefined}
          animationMode="flyTo"
          animationDuration={1000}
        />

        {/* User Location */}
        {showUserLocation && (
          <UserLocation
            visible={true}
            showsUserHeadingIndicator={true}
            minDisplacement={5}
          />
        )}

        {/* Route Line */}
        {showRoute && routePoints.length > 1 && (
          <ShapeSource id="route-source" shape={routeGeoJSON}>
            <LineLayer
              id="route-line"
              style={{
                lineColor: colors.brand[500],
                lineWidth: 4,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.8,
              }}
            />
          </ShapeSource>
        )}

        {/* Pins using CircleLayer for performance */}
        {pins.length > 0 && (
          <ShapeSource
            id="pins-source"
            shape={pinsGeoJSON}
            onPress={(feature) => {
              const props = feature.features[0]?.properties
              if (props?.id && onPinPress) {
                const pin = pins.find((p) => p.id === props.id)
                if (pin) onPinPress(pin)
              }
            }}
          >
            <CircleLayer
              id="pins-circle"
              style={{
                circleRadius: 12,
                circleColor: ['get', 'color'],
                circleStrokeColor: '#ffffff',
                circleStrokeWidth: 2,
              }}
            />
          </ShapeSource>
        )}

        {/* Individual pin annotations (for labels, up to 50) */}
        {pins.slice(0, 50).map((pin) => (
          <PointAnnotation
            key={pin.id}
            id={pin.id}
            coordinate={[pin.lng, pin.lat]}
            onSelected={() => onPinPress?.(pin)}
          >
            <View style={[styles.pinMarker, { backgroundColor: pin.color || PIN_COLORS[pin.type || 'lead'] }]}>
              <Text style={styles.pinMarkerText}>
                {pin.type === 'lead' ? '📍' : pin.type === 'deal' ? '🏠' : '•'}
              </Text>
            </View>
          </PointAnnotation>
        ))}
      </MapView>

      {/* Loading overlay */}
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.brand[500]} />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      )}
    </View>
  )
}

// Imperative methods exposed via ref
export interface DealRoomMapRef {
  flyTo: (coords: { lat: number; lng: number }, zoom?: number) => void
  zoomIn: () => void
  zoomOut: () => void
  getCenter: () => Promise<{ lat: number; lng: number } | null>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate[100],
  },
  map: {
    flex: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  errorSubtext: {
    fontSize: 14,
    color: colors.slate[500],
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.slate[600],
  },
  pinMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand[500],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  pinMarkerText: {
    fontSize: 14,
  },
})

export default DealRoomMap
