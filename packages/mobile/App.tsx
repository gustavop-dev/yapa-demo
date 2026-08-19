import { CARDS, decide, resolveNearby } from '@yapa/engine';
import type { Decision, NearbyResult } from '@yapa/engine';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ALL_MERCHANTS, ATTRIBUTION, REGIONS } from './src/data';
import {
  openAppSettings,
  requestFix,
  requestPrecisionUpgrade,
  type LocationOutcome,
} from './src/location';
import { notifyInSeconds, notifyNow, setupNotifications } from './src/notifications';
import {
  simulateArrival,
  startProximityWatch,
  type ProximityWatcher,
} from './src/proximity';

// The on screen copy stays in Spanish: it is what the founder reads during the call.

/** The densest corner of the seed, from the grid measured over Duitama. */
const REHEARSAL_POINT = REGIONS.find((r) => r.id === 'duitama')!.demoPoint;

type Screen = {
  busy: boolean;
  outcome: LocationOutcome | null;
  nearby: NearbyResult | null;
  decision: Decision | null;
  /** Merchant picked by the user when candidates disagree. */
  resolvedGroup: string | null;
  notice: string | null;
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
    setSelectedCards((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
      setScreen((prev) => ({ ...prev, notice: 'Vigilancia detenida.' }));
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

    const started = await startProximityWatch({
      merchants: ALL_MERCHANTS,
      cards,
      onEvent: (event) => {
        setScreen((prev) => ({
          ...prev,
          notice: `Notificacion disparada cerca de ${event.anchor.name}.`,
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
    const setup = await setupNotifications();
    if (setup.kind === 'denied') return;

    const event = await simulateArrival({
      point: REHEARSAL_POINT,
      merchants: ALL_MERCHANTS,
      cards,
    });

    setScreen((prev) => ({
      ...prev,
      notice: event
        ? `Simulado en ${REHEARSAL_POINT.note}`
        : 'No hay comercios sembrados en el punto de ensayo.',
    }));
  }, [cards]);

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

        {screen.decision ? <DecisionPanel decision={screen.decision} /> : null}

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
        {nearby.candidates.length} candidatos en {Math.round(nearby.radiusM)} m
      </Text>
      {nearby.venue ? (
        <Text style={styles.panelBody}>Dentro de {nearby.venue.name}</Text>
      ) : null}
      <Text style={styles.panelBody}>
        {nearby.candidates
          .map((c) => `${c.name} (${c.mcc})`)
          .slice(0, 8)
          .join(', ')}
      </Text>
    </View>
  );
}

function DecisionPanel({ decision }: { decision: Decision }) {
  if (decision.kind === 'converged') {
    const rec = decision.recommendation;
    return (
      <View style={[styles.panel, styles.panelGood]}>
        <Text style={styles.panelTitle}>
          {decision.candidates.length} comercios cerca, todos coinciden
        </Text>
        <Text style={styles.answer}>{rec.winner.cardName}</Text>
        <Text style={styles.panelBody}>
          {rec.winner.rule.label}, {(rec.winner.valuePerDollar * 100).toFixed(2)}% por
          dolar
        </Text>
        <Text style={styles.panelBody}>
          MCC {rec.mcc.code}, {rec.mcc.title}
        </Text>
        <Text style={styles.provenance}>
          {rec.winner.rule.provenance.verified
            ? `Tasa verificada (${rec.winner.rule.provenance.sourceDate})`
            : 'Tasa SIN VERIFICAR'}
        </Text>
        {rec.rejected.slice(0, 3).map((r) => (
          <Text key={r.rule.id} style={styles.rejected}>
            {r.cardName}: {r.reason}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.panel, styles.panelWarn]}>
      <Text style={styles.panelTitle}>Los candidatos no coinciden</Text>
      <Text style={styles.panelBody}>
        {decision.groups.length} respuestas posibles. Se pregunta lo minimo que
        desempata, agrupando por respuesta y no por comercio.
      </Text>
      {decision.groups.map((g) => (
        <View key={g.cardId} style={styles.group}>
          <Text style={styles.groupTitle}>Si estas en</Text>
          <Text style={styles.panelBody}>
            {g.merchants.map((m) => m.name).join(', ')}
          </Text>
          <Text style={styles.answer}>{g.cardName}</Text>
        </View>
      ))}
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
  group: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#21262d',
  },
  groupTitle: { color: '#8b949e', fontSize: 12, textTransform: 'uppercase' },
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
  smallBtnTextOn: { color: '#fff', fontSize: 14, fontWeight: '600' },
  footer: { color: '#484f58', fontSize: 11, marginTop: 36, textAlign: 'center' },
});
