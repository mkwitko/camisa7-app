import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker, type MapPressEvent, type Region } from "react-native-maps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useDeviceLocation } from "@/hooks/location/use-device-location";
import { isPlacesAutocompleteEnabled } from "@/env";
import { searchPlaces, type PlaceSuggestion } from "@/lib/location/places";

/**
 * Local escolhido no picker. Coords podem ser `null` (cidade digitada à mão,
 * sem pin) — casa com o schema do create-match (todos nullable/opcionais).
 */
export type LocationValue = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  address: string | null;
};

export type LocationPickerProps = {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
};

// Região default (Porto Alegre) quando ainda não há pin — só pra centralizar o
// mapa; não vira valor até o usuário interagir.
const DEFAULT_REGION: Region = {
  latitude: -30.0346,
  longitude: -51.2177,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

/**
 * Reverse-geocode grátis (expo-location) de umas coords → cidade/endereço.
 * Nunca lança — em falha volta `{ city: null, address: null }`.
 */
async function resolveFromCoords(
  latitude: number,
  longitude: number,
): Promise<{ city: string | null; address: string | null }> {
  try {
    const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
    const first = geo[0];
    if (!first) return { city: null, address: null };
    const city = first.city ?? first.subregion ?? null;
    const address =
      [first.street, first.name, first.district].filter(Boolean).join(", ") || null;
    return { city, address };
  } catch {
    return { city: null, address: null };
  }
}

/**
 * Escolhe o local da pelada: mapa (`react-native-maps`) com pino arrastável +
 * "usar minha localização" + reverse-geocode grátis (base, sem chave). Quando
 * o Places Autocomplete está ligado (`isPlacesAutocompleteEnabled`), mostra
 * também uma barra de busca de endereço. Input de cidade sempre disponível como
 * fallback (geo negada / sem pin).
 */
export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useTranslation("common");
  const mapRef = useRef<MapView>(null);
  const device = useDeviceLocation();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<"off" | "denied" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Escolher uma sugestão seta o `query` com o endereço escolhido — sem esse
  // guard o efeito de busca dispararia de novo e reabriria a caixa de sugestões.
  const skipNextSearchRef = useRef(false);

  const hasCoords = value?.latitude != null && value?.longitude != null;
  const markerCoord = hasCoords
    ? { latitude: value!.latitude as number, longitude: value!.longitude as number }
    : { latitude: DEFAULT_REGION.latitude, longitude: DEFAULT_REGION.longitude };
  // Endereço escolhido (via suggestion ou reverse-geocode) — exibido como
  // chip acima do mapa pra confirmar visualmente o que foi selecionado.
  const selectedAddress = (value?.address ?? query) || "";

  // Debounce pra evitar spammar a API do Places a cada tecla. Dispara apenas
  // 350ms depois que o usuário para de digitar. Cancela o anterior se vir nova.
  useEffect(() => {
    if (!isPlacesAutocompleteEnabled) return;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      // Limpa no próximo tick (não sincronamente dentro do efeito).
      debounceRef.current = setTimeout(() => {
        setSuggestions([]);
        setSearching(false);
      }, 0);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchPlaces(query);
      if (!cancelled) {
        setSuggestions(result.suggestions);
        setSearchError(result.error);
        setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const centerOn = useCallback((latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
  }, []);

  const applyCoords = useCallback(
    async (latitude: number, longitude: number) => {
      const { city, address } = await resolveFromCoords(latitude, longitude);
      onChange({ latitude, longitude, city: city ?? value?.city ?? null, address });
    },
    [onChange, value?.city],
  );

  const handleMapPress = useCallback(
    (event: MapPressEvent) => {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      void applyCoords(latitude, longitude);
    },
    [applyCoords],
  );

  const handleUseMyLocation = useCallback(async () => {
    const current = await device.getCurrent();
    if (!current) return;
    centerOn(current.lat, current.lng);
    // Faz reverse-geocode das coords novas — antes o address da seleção
    // anterior ficava pendurado e parecia que nada tinha atualizado. A
    // `applyCoords` chama `resolveFromCoords` e seta address + city do novo
    // ponto, mantendo o `city` anterior se o reverse-geocode não devolver.
    await applyCoords(current.lat, current.lng);
  }, [centerOn, applyCoords, device]);

  const handleSearchChange = useCallback((text: string) => {
    setQuery(text);
  }, []);

  const handleSelectSuggestion = useCallback(
    (suggestion: PlaceSuggestion) => {
      skipNextSearchRef.current = true;
      setSuggestions([]);
      setQuery(suggestion.description);
      // Photon já devolve coords na busca — aplica direto, sem 2ª chamada.
      centerOn(suggestion.lat, suggestion.lng);
      onChange({
        latitude: suggestion.lat,
        longitude: suggestion.lng,
        city: suggestion.city,
        address: suggestion.description,
      });
    },
    [centerOn, onChange],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    setSuggestions([]);
  }, []);

  const handleCityChange = useCallback(
    (city: string) => {
      onChange({
        latitude: value?.latitude ?? null,
        longitude: value?.longitude ?? null,
        city: city.length > 0 ? city : null,
        address: value?.address ?? null,
      });
    },
    [onChange, value?.address, value?.latitude, value?.longitude],
  );

  return (
    <View className="gap-2">
      {isPlacesAutocompleteEnabled ? (
        <View className="gap-1">
          <View className="relative">
            <Input
              label={t("location.searchLabel")}
              placeholder={t("location.searchPlaceholder")}
              value={query}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              testID="location-search"
              className="pr-10"
            />
            {searching ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                className="absolute right-3 top-[38px]"
              />
            ) : query.length > 0 ? (
              <Pressable
                onPress={clearSearch}
                accessibilityLabel={t("location.clearSearch")}
                hitSlop={8}
                className="absolute right-3 top-[38px] h-5 w-5 items-center justify-center"
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          {suggestions.length > 0 ? (
            <ScrollView
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-md"
              style={{ maxHeight: 220 }}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {suggestions.map((suggestion, i) => (
                <Pressable
                  key={suggestion.placeId}
                  onPress={() => void handleSelectSuggestion(suggestion)}
                  className={cn(
                    "flex-row items-center gap-2.5 border-b border-line px-4 py-3 active:bg-surface-up",
                    i === suggestions.length - 1 && "border-b-0",
                  )}
                  accessibilityRole="button"
                >
                  <Ionicons name="location-outline" size={16} color={colors.muted} />
                  <Text className="flex-1 font-body text-sm text-ink" numberOfLines={2}>
                    {suggestion.description}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {searchError === "denied" && query.trim().length >= 3 ? (
            <Text className="font-body text-sm text-danger">
              {t("location.searchDeniedError")}
            </Text>
          ) : null}
        </View>
      ) : null}

      {selectedAddress ? (
        <View className="flex-row items-start gap-2 rounded-xl bg-surface-up px-3 py-2.5">
          <Ionicons name="location" size={16} color={colors.primary} className="mt-0.5" />
          <Text className="flex-1 font-body text-sm text-ink" numberOfLines={2}>
            {selectedAddress}
          </Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-xl border border-line" style={{ height: 220 }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={
            hasCoords
              ? { ...markerCoord, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : DEFAULT_REGION
          }
          showsUserLocation
          onPress={handleMapPress}
          testID="location-map"
        >
          {hasCoords ? (
            <Marker
              draggable
              coordinate={markerCoord}
              onDragEnd={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                void applyCoords(latitude, longitude);
              }}
              testID="location-marker"
            />
          ) : null}
        </MapView>
      </View>

      <Button
        variant="secondary"
        size="sm"
        onPress={() => void handleUseMyLocation()}
        loading={device.loading}
        testID="location-use-mine"
      >
        {device.loading ? t("location.locating") : t("location.useMyLocation")}
      </Button>

      {device.permissionDenied ? (
        <Text className="font-body text-sm text-muted">{t("location.permissionDenied")}</Text>
      ) : null}

      <Input
        label={t("location.cityLabel")}
        placeholder={t("location.cityPlaceholder")}
        value={value?.city ?? ""}
        onChangeText={handleCityChange}
        testID="location-city"
      />
    </View>
  );
}
