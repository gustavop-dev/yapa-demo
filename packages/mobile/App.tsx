import { CARDS, decide, recommend, resolveNearby } from '@yapa/engine';
import type {
  Card,
  Decision,
  MerchantCandidate,
  NearbyResult,
  ProximityEvent,
  Recommendation,
} from '@yapa/engine';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ALL_MERCHANTS, ALL_VENUES, ATTRIBUTION, REGIONS } from './src/data';
import {
  openAppSettings,
  requestFix,
  requestPrecisionUpgrade,
  type LocationOutcome,
} from './src/location';
import {
  getPushToken,
  notifyInSeconds,
  notifyNow,
  setupNotifications,
} from './src/notifications';
import {
  simulateArrival,
  startProximityWatch,
  type ProximitySnapshot,
  type ProximityWatcher,
} from './src/proximity';

// The on screen copy stays in Spanish: it is what the founder reads during the call.

/** The canonical US-market case from the Costa Mesa seed. */
const REHEARSAL_POINT = REGIONS.find((r) => r.id === 'costa-mesa')!.demoPoint;

type Screen = {
  busy: boolean;
  outcome: LocationOutcome | null;
  nearby: NearbyResult | null;
  decision: Decision | null;
  /** Merchant picked by the user when candidates disagree. */
  resolvedGroup: string | null;
  notice: string | null;
};

type ProximityResult = {
  source: 'watch' | 'simulation';
  event: ProximityEvent;
  venue?: { id: string; name: string };
};

const EMPTY: Screen = {
  busy: false,
  outcome: null,
  nearby: null,
  decision: null,
  resolvedGroup: null,
  notice: null,
};

export default function App() {
  const [selectedCards, setSelectedCards] = useState<string[]>(
    CARDS.map((c) => c.id),
  );
  const [screen, setScreen] = useState<Screen>(EMPTY);
  const [watching, setWatching] = useState(false);
  const [watchSnapshot, setWatchSnapshot] = useState<ProximitySnapshot | null>(
    null,
  );
  const [proximityResult, setProximityResult] =
    useState<ProximityResult | null>(null);
  const [resolvedProximityGroup, setResolvedProximityGroup] = useState<
    string | null
  >(null);
  // Kept outside `screen` so a new tap does not wipe it: the token is read off the
  // mirrored phone and pasted into scripts/send-push.sh.
  const [pushToken, setPushToken] = useState<string | null>(null);
  const watcher = useRef<ProximityWatcher | null>(null);

  // The watcher holds a live location subscription. Leaving it running after the
  // screen is gone is exactly the background listening this project refuses to do.
  useEffect(() => {
    return () => {
      watcher.current?.stop();
      watcher.current = null;
    };
  }, []);

  const cards = useMemo(
    () => CARDS.filter((c) => selectedCards.includes(c.id)),
    [selectedCards],
  );

  const toggleCard = useCallback((id: string) => {
    watcher.current?.stop();
    watcher.current = null;
    setWatching(false);
    setWatchSnapshot(null);
    setSelectedCards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setScreen((prev) => ({
      ...prev,
      decision: null,
      resolvedGroup: null,
      notice: 'Tarjetas actualizadas. Volve a calcular la recomendacion.',
    }));
    setProximityResult(null);
    setResolvedProximityGroup(null);
  }, []);

  const onTap = useCallback(async () => {
    if (cards.length === 0) {
      setScreen({ ...EMPTY, notice: 'Elegi al menos una tarjeta.' });
      return;
    }

    // Guard against a double tap: there is an Expo issue where simultaneous calls to
    // getCurrentPositionAsync hang the promise.
    setScreen({ ...EMPTY, busy: true });

    const outcome = await requestFix();

    if (outcome.kind !== 'fix') {
      setScreen({ ...EMPTY, outcome });
      return;
    }

    const nearby = resolveNearby(
      { lat: outcome.lat, lon: outcome.lon },
      outcome.accuracyM ?? 999,
      ALL_MERCHANTS,
      ALL_VENUES,
    );

    const decision =
      nearby.status === 'ok' ? decide(nearby.candidates, cards) : null;

    setScreen({ ...EMPTY, outcome, nearby, decision });
  }, [cards]);

  const onUpgrade = useCallback(async () => {
    const precision = await requestPrecisionUpgrade();
    setScreen((prev) => ({
      ...prev,
      notice:
        precision === 'fine'
          ? 'Precision concedida. Toca de nuevo para resolver.'
          : 'El usuario mantuvo la precision aproximada.',
    }));
  }, []);

  const onTestNotification = useCallback(async () => {
    const setup = await setupNotifications();
    if (setup.kind === 'denied') {
      setScreen((prev) => ({
        ...prev,
        notice: 'Permiso de notificaciones denegado.',
      }));
      return;
    }
    await notifyNow(
      'Yapa',
      'Notificacion local inmediata. Esta no necesito ubicacion.',
    );
  }, []);

  const onDelayedNotification = useCallback(async () => {
    const setup = await setupNotifications();
    if (setup.kind === 'denied') return;
    await notifyInSeconds(
      'Tu categoria rotativa vence en 3 dias',
      'Activala para no perder el 5% en supermercados.',
      10,
    );
    setScreen((prev) => ({
      ...prev,
      notice: 'Agendada en 10 segundos. Podes cerrar la app.',
    }));
  }, []);

  const onToggleWatch = useCallback(async () => {
    if (watcher.current) {
      watcher.current.stop();
      watcher.current = null;
      setWatching(false);
      setWatchSnapshot(null);
      setScreen((prev) => ({ ...prev, notice: 'Vigilancia detenida.' }));
      return;
    }

    if (cards.length === 0) {
      setScreen((prev) => ({
        ...prev,
        notice: 'Elegi al menos una tarjeta antes de vigilar.',
      }));
      return;
    }

    const setup = await setupNotifications();
    if (setup.kind === 'denied') {
      setScreen((prev) => ({
        ...prev,
        notice: 'Sin permiso de notificaciones no hay nada que mostrar.',
      }));
      return;
    }

    setWatchSnapshot(null);
    setProximityResult(null);
    setResolvedProximityGroup(null);

    const started = await startProximityWatch({
      merchants: ALL_MERCHANTS,
      venues: ALL_VENUES,
      cards,
      onPosition: setWatchSnapshot,
      onEvent: (event, context) => {
        setProximityResult({ source: 'watch', event, venue: context.venue });
        setResolvedProximityGroup(null);
        setScreen((prev) => ({
          ...prev,
          notice: context.venue
            ? `Notificacion disparada dentro de ${context.venue.name}.`
            : `Notificacion disparada cerca de ${event.anchor.name}.`,
        }));
      },
    });

    if (started.kind === 'no-permission') {
      setScreen((prev) => ({
        ...prev,
        notice: 'Toca "Con cual pago" primero: la ubicacion se pide ahi.',
      }));
      return;
    }

    if (started.kind === 'error') {
      setScreen((prev) => ({ ...prev, notice: started.message }));
      return;
    }

    watcher.current = started.watcher;
    setWatching(true);
    setScreen((prev) => ({
      ...prev,
      notice: 'Vigilando. Solo con la app abierta: al salir se corta sola.',
    }));
  }, [cards]);

  const onSimulateArrival = useCallback(async () => {
    if (cards.length === 0) {
      setScreen((prev) => ({
        ...prev,
        notice: 'Elegi al menos una tarjeta antes de simular.',
      }));
      return;
    }

    const setup = await setupNotifications();
    if (setup.kind === 'denied') return;

    const event = await simulateArrival({
      point: REHEARSAL_POINT,
      merchants: ALL_MERCHANTS,
      cards,
    });

    setProximityResult(event ? { source: 'simulation', event } : null);
    setResolvedProximityGroup(null);

    setScreen((prev) => ({
      ...prev,
      notice: event
        ? `Simulado en ${REHEARSAL_POINT.note}`
        : 'No hay comercios sembrados en el punto de ensayo.',
    }));
  }, [cards]);

  const onShowPushToken = useCallback(async () => {
    const setup = await setupNotifications();
    if (setup.kind === 'denied') {
      setScreen((prev) => ({
        ...prev,
        notice: 'Sin permiso de notificaciones no hay token.',
      }));
      return;
    }

    const result = await getPushToken();

    if (result.kind === 'token') {
      setPushToken(result.token);
      // Also on the log, so it can be copied with adb logcat instead of by hand.
      console.log(`[yapa] ExponentPushToken: ${result.token}`);
      return;
    }

    setPushToken(null);
    setScreen((prev) => ({
      ...prev,
      notice:
        result.kind === 'no-project-id'
          ? 'Falta el projectId de EAS en app.json. Correr eas init.'
          : result.message,
    }));
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Yapa</Text>
        <Text style={styles.subtitle}>
          Con cual de tus tarjetas conviene pagar aca
        </Text>

        <Text style={styles.sectionLabel}>Mis tarjetas</Text>
        <View style={styles.chips}>
          {CARDS.map((card) => {
            const on = selectedCards.includes(card.id);
            return (
              <Pressable
                key={card.id}
                onPress={() => toggleCard(card.id)}
                style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
              >
                <Text style={on ? styles.chipTextOn : styles.chipTextOff}>
                  {card.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={onTap}
          disabled={screen.busy}
          style={[styles.cta, screen.busy && styles.ctaBusy]}
        >
          {screen.busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Con cual pago</Text>
          )}
        </Pressable>

        {screen.notice ? <Text style={styles.notice}>{screen.notice}</Text> : null}

        {screen.outcome ? (
          <OutcomePanel outcome={screen.outcome} onUpgrade={onUpgrade} />
        ) : null}

        {screen.nearby ? <NearbyPanel nearby={screen.nearby} /> : null}

        {screen.nearby?.status === 'ok' && screen.nearby.venue ? (
          <VenuePicker
            venueName={screen.nearby.venue.name}
            candidates={screen.nearby.candidates}
            cards={cards}
          />
        ) : screen.decision ? (
          <DecisionPanel
            decision={screen.decision}
            resolvedGroup={screen.resolvedGroup}
            onResolve={(cardId) =>
              setScreen((prev) => ({ ...prev, resolvedGroup: cardId }))
            }
          />
        ) : null}

        <Text style={styles.sectionLabel}>Notificaciones sin ubicacion</Text>
        <View style={styles.row}>
          <Pressable style={styles.smallBtn} onPress={onTestNotification}>
            <Text style={styles.smallBtnText}>Inmediata</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={onDelayedNotification}>
            <Text style={styles.smallBtnText}>En 10 s</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>Notificacion por proximidad</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.smallBtn, watching && styles.smallBtnOn]}
            onPress={onToggleWatch}
          >
            <Text style={watching ? styles.smallBtnTextOn : styles.smallBtnText}>
              {watching ? 'Vigilando, tocar para parar' : 'Vigilar proximidad'}
            </Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={onSimulateArrival}>
            <Text style={styles.smallBtnText}>Simular llegada</Text>
          </Pressable>
        </View>
        <Text style={styles.panelBody}>
          La vigilancia corre solo con la app abierta. Sin
          ACCESS_BACKGROUND_LOCATION, Android entrega unas pocas posiciones por hora
          en segundo plano, asi que un vigilante de fondo aparentaria funcionar sin
          hacerlo.
        </Text>

        {watching ? <WatchPanel snapshot={watchSnapshot} /> : null}

        {proximityResult ? (
          <ProximityResultPanel
            result={proximityResult}
            cards={cards}
            resolvedGroup={resolvedProximityGroup}
            onResolve={setResolvedProximityGroup}
          />
        ) : null}

        <Text style={styles.sectionLabel}>Push remota</Text>
        <Pressable style={styles.smallBtn} onPress={onShowPushToken}>
          <Text style={styles.smallBtnText}>Mostrar token</Text>
        </Pressable>
        {pushToken ? (
          <View style={[styles.panel, styles.panelGood]}>
            <Text style={styles.panelTitle}>ExponentPushToken</Text>
            <Text selectable style={styles.token}>
              {pushToken}
            </Text>
            <Text style={styles.panelBody}>
              Con esto, scripts/send-push.sh dispara la notificacion desde la
              terminal con la app cerrada. Esa no necesita ubicacion.
            </Text>
          </View>
        ) : null}

        <Text style={styles.footer}>{ATTRIBUTION}</Text>
      </ScrollView>
    </View>
  );
}

function OutcomePanel({
  outcome,
  onUpgrade,
}: {
  outcome: LocationOutcome;
  onUpgrade: () => void;
}) {
  if (outcome.kind === 'denied') {
    return (
      <View style={[styles.panel, styles.panelBad]}>
        <Text style={styles.panelTitle}>Sin permiso de ubicacion</Text>
        <Text style={styles.panelBody}>
          {outcome.canAskAgain
            ? 'Podes volver a intentarlo.'
            : 'Android ya no va a mostrar el dialogo. Hay que ir a Ajustes.'}
        </Text>
        {!outcome.canAskAgain ? (
          <Pressable style={styles.smallBtn} onPress={openAppSettings}>
            <Text style={styles.smallBtnText}>Abrir Ajustes</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (outcome.kind === 'services-off') {
    return (
      <View style={[styles.panel, styles.panelBad]}>
        <Text style={styles.panelTitle}>Ubicacion del dispositivo apagada</Text>
        <Text style={styles.panelBody}>
          Activala en los ajustes del sistema y volve a intentar.
        </Text>
      </View>
    );
  }

  if (outcome.kind === 'timeout') {
    return (
      <View style={[styles.panel, styles.panelBad]}>
        <Text style={styles.panelTitle}>El proveedor no devolvio un fix</Text>
        <Text style={styles.panelBody}>
          Cortamos a los 15 segundos. expo-location no trae timeout propio, asi que
          lo pusimos nosotros: sin eso la promesa no resuelve nunca.
        </Text>
      </View>
    );
  }

  if (outcome.kind === 'error') {
    return (
      <View style={[styles.panel, styles.panelBad]}>
        <Text style={styles.panelTitle}>Error</Text>
        <Text style={styles.panelBody}>{outcome.message}</Text>
      </View>
    );
  }

  const coarse = outcome.precision === 'coarse';

  return (
    <View style={[styles.panel, coarse ? styles.panelWarn : styles.panelGood]}>
      <Text style={styles.panelTitle}>
        {coarse ? 'Precision aproximada' : 'Precision precisa'}
      </Text>

      <Text style={styles.bigNumber}>
        {outcome.accuracyM === null
          ? 'sin dato'
          : `+/- ${Math.round(outcome.accuracyM)} m`}
      </Text>

      <Text style={styles.panelBody}>
        {outcome.lat.toFixed(6)}, {outcome.lon.toFixed(6)}
      </Text>

      {coarse ? (
        <>
          <Text style={styles.panelBody}>
            Android reporto permiso concedido, pero solo aproximado: unos 3 kilometros
            cuadrados. Con eso no se puede saber en que comercio estas.
          </Text>
          <Pressable style={styles.smallBtn} onPress={onUpgrade}>
            <Text style={styles.smallBtnText}>Pedir precision</Text>
          </Pressable>
        </>
      ) : null}

      {outcome.mocked ? (
        <Text style={styles.mocked}>
          Ubicacion simulada. La app lo detecta con el flag mocked del proveedor.
        </Text>
      ) : null}
    </View>
  );
}

function NearbyPanel({ nearby }: { nearby: NearbyResult }) {
  if (nearby.status === 'accuracy-too-low') {
    return (
      <View style={[styles.panel, styles.panelWarn]}>
        <Text style={styles.panelTitle}>Precision insuficiente</Text>
        <Text style={styles.panelBody}>
          El error de {Math.round(nearby.accuracyM)} m supera el umbral de{' '}
          {nearby.thresholdM} m. Preferimos decirlo antes que devolver una lista que
          aparenta una precision que no tenemos.
        </Text>
      </View>
    );
  }

  if (nearby.status === 'no-candidates') {
    return (
      <View style={[styles.panel, styles.panelWarn]}>
        <Text style={styles.panelTitle}>No hay comercios sembrados cerca</Text>
        <Text style={styles.panelBody}>
          Radio de busqueda: {Math.round(nearby.radiusM)} m. La app lo dice en vez de
          inventarse un comercio.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, styles.panelGood]}>
      <Text style={styles.panelTitle}>
        {nearby.venue
          ? 'Centro comercial detectado'
          : nearby.candidates.length === 1
          ? 'Comercio detectado'
          : `${nearby.candidates.length} comercios posibles`}
      </Text>
      {nearby.venue ? (
        <>
          <Text style={styles.answer}>Dentro de {nearby.venue.name}</Text>
          <Text style={styles.panelBody}>
            El GPS resolvio el edificio. Elige tu local en el directorio para obtener
            una recomendacion exacta.
          </Text>
        </>
      ) : null}
      <Text style={styles.panelBody}>
        {nearby.venue
          ? `${nearby.candidates.length} locales curados disponibles`
          : `Radio de busqueda: ${Math.round(nearby.radiusM)} m`}
      </Text>
      {!nearby.venue ? <CandidateList candidates={nearby.candidates} /> : null}
    </View>
  );
}

function CandidateList({
  candidates,
  hideDistance = false,
}: {
  candidates: MerchantCandidate[];
  hideDistance?: boolean;
}) {
  return (
    <View style={styles.candidateList}>
      {candidates.map((candidate) => (
        <View key={candidate.id} style={styles.candidate}>
          <Text style={styles.candidateName}>{candidate.name}</Text>
          <Text style={styles.candidateMeta}>
            {hideDistance
              ? `MCC ${candidate.mcc}`
              : `${Math.round(candidate.distanceM)} m, MCC ${candidate.mcc}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function WatchPanel({ snapshot }: { snapshot: ProximitySnapshot | null }) {
  if (!snapshot) {
    return (
      <View style={[styles.panel, styles.panelWarn]}>
        <Text style={styles.panelTitle}>Esperando la primera posicion</Text>
        <Text style={styles.panelBody}>
          Android entregara una lectura cuando el proveedor tenga un fix.
        </Text>
      </View>
    );
  }

  if (snapshot.kind === 'accuracy-too-low') {
    return (
      <View style={[styles.panel, styles.panelWarn]}>
        <Text style={styles.panelTitle}>Vigilando, precision insuficiente</Text>
        <Text style={styles.panelBody}>
          Error de {Math.round(snapshot.accuracyM)} m. El disparador exige como maximo{' '}
          {snapshot.thresholdM} m.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.panel, styles.panelGood]}>
      <Text style={styles.panelTitle}>
        {snapshot.venue
          ? `Dentro de ${snapshot.venue.name}: ${snapshot.candidates.length} comercios posibles`
          : snapshot.candidates.length === 0
            ? 'Vigilando, sin comercios a 120 m'
            : `${snapshot.candidates.length} comercios dentro de 120 m`}
      </Text>
      <Text style={styles.panelBody}>
        Precision actual: +/- {Math.round(snapshot.accuracyM)} m
      </Text>
      {snapshot.venue ? (
        <Text style={styles.panelBody}>
          La llegada abrira el directorio para confirmar el local exacto.
        </Text>
      ) : (
        <CandidateList candidates={snapshot.candidates} />
      )}
    </View>
  );
}

function ProximityResultPanel({
  result,
  cards,
  resolvedGroup,
  onResolve,
}: {
  result: ProximityResult;
  cards: Card[];
  resolvedGroup: string | null;
  onResolve: (cardId: string) => void;
}) {
  const decision = decide(result.event.candidates, cards);

  if (result.venue) {
    return (
      <>
        <View style={[styles.panel, styles.panelGood]}>
          <Text style={styles.panelTitle}>
            Llegada detectada dentro de {result.venue.name}
          </Text>
          <Text style={styles.panelBody}>
            El GPS resolvio el edificio. Confirma el local en el directorio.
          </Text>
        </View>
        <VenuePicker
          venueName={result.venue.name}
          candidates={result.event.candidates}
          cards={cards}
        />
      </>
    );
  }

  return (
    <>
      <View style={[styles.panel, styles.panelGood]}>
        <Text style={styles.panelTitle}>
          {result.source === 'simulation'
            ? 'Ensayo de llegada en Costa Mesa'
            : `Llegada detectada cerca de ${result.event.anchor.name}`}
        </Text>
        <Text style={styles.panelBody}>
          {result.event.candidates.length === 1
            ? 'El motor encontro un comercio dentro de 120 m.'
            : `El motor encontro ${result.event.candidates.length} comercios dentro de 120 m.`}
        </Text>
        <CandidateList candidates={result.event.candidates} />
      </View>
      <DecisionPanel
        decision={decision}
        resolvedGroup={resolvedGroup}
        onResolve={onResolve}
      />
    </>
  );
}

type VenueCategoryFilter = {
  id: string;
  label: string;
  categories: string[];
};

const VENUE_CATEGORY_FILTERS: VenueCategoryFilter[] = [
  {
    id: 'food',
    label: 'Comida',
    categories: ['restaurante', 'comida-rapida', 'cafe', 'heladeria', 'panaderia'],
  },
  {
    id: 'fashion',
    label: 'Moda',
    categories: ['ropa', 'zapatos', 'marroquineria'],
  },
  {
    id: 'health',
    label: 'Salud',
    categories: ['farmacia', 'optica'],
  },
  {
    id: 'beauty',
    label: 'Belleza',
    categories: ['peluqueria', 'cosmeticos'],
  },
  {
    id: 'technology',
    label: 'Tecnologia',
    categories: ['videojuegos', 'telefonia'],
  },
  { id: 'leisure', label: 'Ocio', categories: ['juguetes'] },
];

const VENUE_CATEGORY_LABELS: Record<string, string> = {
  restaurante: 'Restaurante',
  'comida-rapida': 'Comida rapida',
  cafe: 'Cafe',
  heladeria: 'Heladeria',
  panaderia: 'Panaderia',
  ropa: 'Ropa',
  zapatos: 'Calzado',
  marroquineria: 'Marroquineria',
  farmacia: 'Farmacia',
  optica: 'Optica',
  peluqueria: 'Peluqueria',
  cosmeticos: 'Cosmeticos',
  videojuegos: 'Videojuegos',
  telefonia: 'Telefonia',
  juguetes: 'Jugueteria',
};

function normalizeVenueSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tenantMeta(candidate: MerchantCandidate): string {
  const metadata = [
    VENUE_CATEGORY_LABELS[candidate.category ?? ''] ?? 'Categoria por confirmar',
  ];
  if (candidate.level) metadata.push(`Piso ${candidate.level}`);
  if (candidate.unit) metadata.push(`Local ${candidate.unit}`);
  return metadata.join(', ');
}

function VenuePicker({
  venueName,
  candidates,
  cards,
}: {
  venueName: string;
  candidates: MerchantCandidate[];
  cards: Card[];
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const availableCategoryFilters = useMemo(
    () =>
      VENUE_CATEGORY_FILTERS.filter((filter) =>
        candidates.some((candidate) =>
          filter.categories.includes(candidate.category ?? ''),
        ),
      ),
    [candidates],
  );
  const levels = useMemo(
    () =>
      [...new Set(candidates.flatMap((candidate) => candidate.level ?? []))].sort(
        (a, b) => a.localeCompare(b, 'es'),
      ),
    [candidates],
  );
  const hasUnknownLevel = candidates.some((candidate) => !candidate.level);
  const filteredCandidates = useMemo(() => {
    const normalizedQuery = normalizeVenueSearch(query.trim());
    const selectedCategory = VENUE_CATEGORY_FILTERS.find(
      (filter) => filter.id === categoryFilter,
    );

    return candidates
      .filter((candidate) => {
        const searchable = normalizeVenueSearch(
          [candidate.name, candidate.category, candidate.unit]
            .filter(Boolean)
            .join(' '),
        );
        const matchesQuery =
          normalizedQuery === '' || searchable.includes(normalizedQuery);
        const matchesCategory =
          !selectedCategory ||
          selectedCategory.categories.includes(candidate.category ?? '');
        const matchesLevel =
          levelFilter === 'all' ||
          (levelFilter === 'unknown'
            ? !candidate.level
            : candidate.level === levelFilter);
        return matchesQuery && matchesCategory && matchesLevel;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [candidates, categoryFilter, levelFilter, query]);

  const selected = candidates.find((candidate) => candidate.id === selectedId);
  const recommendation = selected && cards.length > 0 ? recommend(selected, cards) : null;

  const openDirectory = () => {
    setQuery('');
    setCategoryFilter('all');
    setLevelFilter('all');
    setVisible(true);
  };

  return (
    <>
      <View style={[styles.panel, styles.panelGood]}>
        <Text style={styles.panelTitle}>Confirma el local</Text>
        <Text style={styles.panelBody}>
          Busca por nombre o filtra el directorio por categoria y piso.
        </Text>
        <Pressable style={styles.venueButton} onPress={openDirectory}>
          <Text style={styles.venueButtonText}>
            {selected ? 'Cambiar local' : `Buscar entre ${candidates.length} locales`}
          </Text>
        </Pressable>
        {selected ? (
          <View style={styles.selectedTenant}>
            <Text style={styles.candidateName}>{selected.name}</Text>
            <Text style={styles.candidateMeta}>{tenantMeta(selected)}</Text>
          </View>
        ) : null}
        {selected && cards.length === 0 ? (
          <Text style={styles.notice}>Elegi al menos una tarjeta.</Text>
        ) : null}
      </View>

      {recommendation ? (
        <RecommendationPanel
          recommendation={recommendation}
          title={`Recomendacion para ${recommendation.merchant.name}`}
        />
      ) : null}

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>{venueName}</Text>
              <Text style={styles.modalSubtitle}>Selecciona el local donde estas</Text>
            </View>
            <Pressable style={styles.modalClose} onPress={() => setVisible(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar local"
            placeholderTextColor="#6e7681"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={styles.searchInput}
          />

          <Text style={styles.filterLabel}>Categoria</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Todas"
              selected={categoryFilter === 'all'}
              onPress={() => setCategoryFilter('all')}
            />
            {availableCategoryFilters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                selected={categoryFilter === filter.id}
                onPress={() => setCategoryFilter(filter.id)}
              />
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Piso</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <FilterChip
              label="Todos"
              selected={levelFilter === 'all'}
              onPress={() => setLevelFilter('all')}
            />
            {levels.map((level) => (
              <FilterChip
                key={level}
                label={`Piso ${level}`}
                selected={levelFilter === level}
                onPress={() => setLevelFilter(level)}
              />
            ))}
            {hasUnknownLevel ? (
              <FilterChip
                label="Sin dato"
                selected={levelFilter === 'unknown'}
                onPress={() => setLevelFilter('unknown')}
              />
            ) : null}
          </ScrollView>

          <Text style={styles.venueCount}>
            {filteredCandidates.length === 1
              ? '1 local'
              : `${filteredCandidates.length} locales`}
          </Text>
          <FlatList
            data={filteredCandidates}
            keyExtractor={(candidate) => candidate.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.venueList}
            ListEmptyComponent={
              <Text style={styles.emptyVenueList}>No hay locales con esos filtros.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedId(item.id);
                  setVisible(false);
                }}
                style={[
                  styles.tenantRow,
                  item.id === selectedId && styles.tenantRowSelected,
                ]}
              >
                <View style={styles.tenantText}>
                  <Text style={styles.candidateName}>{item.name}</Text>
                  <Text style={styles.candidateMeta}>{tenantMeta(item)}</Text>
                </View>
                <Text style={styles.tenantAction}>Elegir</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterChip, selected && styles.filterChipSelected]}
    >
      <Text style={selected ? styles.filterChipTextSelected : styles.filterChipText}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecommendationPanel({
  recommendation,
  title,
}: {
  recommendation: Recommendation;
  title: string;
}) {
  return (
    <View style={[styles.panel, styles.panelGood]}>
      <Text style={styles.panelTitle}>{title}</Text>
      <Text style={styles.answer}>{recommendation.winner.cardName}</Text>
      <Text style={styles.panelBody}>
        {recommendation.winner.rule.label},{' '}
        {(recommendation.winner.valuePerDollar * 100).toFixed(2)}% por dolar
      </Text>
      <Text style={styles.panelBody}>
        MCC {recommendation.mcc.code}, {recommendation.mcc.title}
      </Text>
      <Text style={styles.provenance}>
        {recommendation.winner.rule.provenance.verified
          ? `Tasa verificada (${recommendation.winner.rule.provenance.sourceDate})`
          : 'Tasa SIN VERIFICAR'}
      </Text>
      {recommendation.rejected.slice(0, 3).map((rejection) => (
        <Text key={rejection.rule.id} style={styles.rejected}>
          {rejection.cardName}: {rejection.reason}
        </Text>
      ))}
    </View>
  );
}

function DecisionPanel({
  decision,
  resolvedGroup,
  onResolve,
}: {
  decision: Decision;
  resolvedGroup: string | null;
  onResolve: (cardId: string) => void;
}) {
  if (decision.kind === 'converged') {
    const rec = decision.recommendation;
    return (
      <RecommendationPanel
        recommendation={rec}
        title={
          decision.candidates.length === 1
            ? `Recomendacion para ${rec.merchant.name}`
            : `${decision.candidates.length} comercios, misma recomendacion`
        }
      />
    );
  }

  const selected = decision.groups.find((group) => group.cardId === resolvedGroup);

  return (
    <View style={[styles.panel, styles.panelWarn]}>
      <Text style={styles.panelTitle}>Confirma en cual estas</Text>
      <Text style={styles.panelBody}>
        Hay {decision.groups.length} respuestas posibles. Los comercios que llevan a
        la misma tarjeta aparecen juntos.
      </Text>
      {decision.groups.map((g) => (
        <Pressable
          key={g.cardId}
          onPress={() => onResolve(g.cardId)}
          style={[
            styles.group,
            resolvedGroup === g.cardId && styles.groupSelected,
          ]}
        >
          <Text style={styles.groupTitle}>Si estas en</Text>
          <Text style={styles.groupMerchants}>
            {g.merchants.map((m) => m.name).join(', ')}
          </Text>
          <Text style={styles.groupAnswer}>Usa {g.cardName}</Text>
        </Pressable>
      ))}
      {selected ? (
        <View style={styles.selectedAnswer}>
          <Text style={styles.groupTitle}>Respuesta seleccionada</Text>
          <Text style={styles.answer}>{selected.cardName}</Text>
          <Text style={styles.panelBody}>
            {selected.recommendation.winner.rule.label},{' '}
            {(selected.recommendation.winner.valuePerDollar * 100).toFixed(2)}% por
            dolar
          </Text>
          <Text style={styles.panelBody}>
            MCC {selected.recommendation.mcc.code},{' '}
            {selected.recommendation.mcc.title}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d1117' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  title: { color: '#fff', fontSize: 34, fontWeight: '700' },
  subtitle: { color: '#8b949e', fontSize: 15, marginBottom: 24 },
  sectionLabel: {
    color: '#8b949e',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  chipOn: { backgroundColor: '#1f6feb' },
  chipOff: { backgroundColor: '#21262d' },
  chipTextOn: { color: '#fff', fontWeight: '600', fontSize: 13 },
  chipTextOff: { color: '#8b949e', fontSize: 13 },
  cta: {
    backgroundColor: '#238636',
    paddingVertical: 20,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  ctaBusy: { backgroundColor: '#1a5928' },
  ctaText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  notice: { color: '#d29922', marginTop: 14, fontSize: 14 },
  panel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: '#161b22',
  },
  panelGood: { borderLeftColor: '#238636' },
  panelWarn: { borderLeftColor: '#d29922' },
  panelBad: { borderLeftColor: '#da3633' },
  panelTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  panelBody: { color: '#8b949e', fontSize: 14, lineHeight: 20, marginTop: 4 },
  bigNumber: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    marginVertical: 6,
  },
  mocked: { color: '#d29922', fontSize: 13, marginTop: 10, fontWeight: '600' },
  answer: { color: '#58a6ff', fontSize: 24, fontWeight: '700', marginTop: 8 },
  provenance: { color: '#d29922', fontSize: 12, marginTop: 8 },
  rejected: { color: '#6e7681', fontSize: 12, marginTop: 8, lineHeight: 17 },
  candidateList: { marginTop: 8, gap: 8 },
  candidate: {
    backgroundColor: '#0d1117',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  candidateName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  candidateMeta: { color: '#8b949e', fontSize: 12, marginTop: 3 },
  group: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 8,
  },
  groupSelected: { borderColor: '#58a6ff', backgroundColor: '#0d2847' },
  groupTitle: { color: '#8b949e', fontSize: 12, textTransform: 'uppercase' },
  groupMerchants: { color: '#fff', fontSize: 14, lineHeight: 20, marginTop: 5 },
  groupAnswer: { color: '#58a6ff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  selectedAnswer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#30363d',
  },
  venueButton: {
    backgroundColor: '#1f6feb',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  venueButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  selectedTenant: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#0d1117',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingHorizontal: 18,
    paddingTop: 54,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeading: { flex: 1 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '700' },
  modalSubtitle: { color: '#8b949e', fontSize: 13, marginTop: 3 },
  modalClose: {
    backgroundColor: '#21262d',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 8,
  },
  modalCloseText: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },
  searchInput: {
    color: '#fff',
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 20,
  },
  filterLabel: {
    color: '#8b949e',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  filterRow: { gap: 8, paddingRight: 18 },
  filterChip: {
    backgroundColor: '#21262d',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  filterChipSelected: { backgroundColor: '#1f6feb', borderColor: '#1f6feb' },
  filterChipText: { color: '#8b949e', fontSize: 13 },
  filterChipTextSelected: { color: '#fff', fontSize: 13, fontWeight: '600' },
  venueCount: { color: '#8b949e', fontSize: 13, marginTop: 18 },
  venueList: { paddingTop: 8, paddingBottom: 28, gap: 8 },
  emptyVenueList: { color: '#8b949e', fontSize: 14, paddingVertical: 24 },
  tenantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#161b22',
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#21262d',
  },
  tenantRowSelected: { borderColor: '#58a6ff', backgroundColor: '#0d2847' },
  tenantText: { flex: 1 },
  tenantAction: { color: '#58a6ff', fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  smallBtn: {
    backgroundColor: '#21262d',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  smallBtnText: { color: '#58a6ff', fontSize: 14, fontWeight: '600' },
  smallBtnOn: { backgroundColor: '#1f6feb' },
  token: {
    color: '#58a6ff',
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: 8,
  },
  smallBtnTextOn: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { color: '#484f58', fontSize: 11, marginTop: 36, textAlign: 'center' },
});
