# Yapa demo

Yapa recommends which of a user's cards to use at a merchant. The decision is based
on the merchant category code, card reward rules, and any merchant specific promotion
that applies.

This repository is a weekend technical demo for an Android presentation. It favors a
repeatable live flow, explicit uncertainty, and privacy boundaries over production
scale.

## What is implemented

- A pure TypeScript recommendation engine with unit tests
- Merchant seeds for Duitama, Colombia and Costa Mesa, California
- Foreground location with an explicit user action
- Nearby merchant resolution that accounts for reported GPS accuracy
- Indoor venue resolution for Innovo Plaza with a searchable 25 tenant directory
- Local proximity notifications with hysteresis and cooldown
- A deterministic Costa Mesa arrival simulation
- Expo push token plumbing for the remote push phase

The app does not connect bank accounts. Users declare the cards they have from a local
list.

## Repository layout

```text
packages/engine   Pure recommendation and geospatial logic
packages/seed     One time extraction and venue curation tools
packages/mobile   Expo Android application
data              Generated merchant seeds and curated venues
scripts           Demo and push helpers
.github           Pull request and master branch validation
```

## Quick verification

### Prerequisites

- Node.js 24 and npm
- JDK 17
- Android SDK platform 36 and build tools 36.0.0
- A physical Android phone with USB debugging enabled

The Android build has been verified on a Xiaomi Redmi Note 13 Pro running Android 16.
The Windows setup notes and the exact toolchain are recorded in
[`ARRANQUE.md`](ARRANQUE.md).

Install dependencies and run the repository checks:

```sh
npm ci
npm test
npm run typecheck
npm run demo
```

The expected result is 55 passing tests, 48 from the engine and 7 from the seed
package, followed by a clean typecheck.

### First Android build

Connect the phone, accept its USB debugging prompt, and verify the connection:

```sh
adb devices -l
```

The device must appear with the state `device`, not `unauthorized`. Build and install
the development application:

```sh
npm run android --workspace=@yapa/mobile
```

The first native build can take 10 to 30 minutes. Later JavaScript changes use Metro
and do not require another native build.

If the installed app reports that it cannot load the script, run Metro on localhost
and expose only that port to the phone through USB:

```sh
npm run start --workspace=@yapa/mobile -- --localhost
adb reverse tcp:8081 tcp:8081
adb shell am start -n com.yapa.demo/.MainActivity
```

Using localhost with `adb reverse` keeps the source bundle off the local network.

### Test with real GPS at Innovo Plaza

This is the complete indoor venue acceptance path:

1. Stand inside Innovo Plaza with device location enabled.
2. In Android permissions, grant Yapa precise location while using the app.
3. Open Yapa and leave at least one card selected.
4. Tap `Con cual pago`.
5. Confirm that the screen shows `Dentro de Innovo Plaza` and 25 curated tenants.
6. Open the tenant directory and search by name.
7. Exercise the category and floor filters.
8. Select a tenant such as Bosi.
9. Confirm that the result shows a card, the winning reward rule, and the MCC.

The GPS is expected to resolve the building, not an individual unit. Selecting the
tenant is an explicit user confirmation and is part of the product flow.

### Test away from Innovo Plaza

The application has deterministic paths for a desk review:

- `Con cual pago` uses the current real foreground location. It can correctly return
  no seeded merchants when the local catalog has no coverage at that point.
- `Simular llegada` runs the real proximity engine at the Costa Mesa Target demo point
  and shows the merchant, MCC, recommendation, and local notification.
- `Inmediata` sends a local notification immediately.
- `En 10 s` schedules a local notification ten seconds later.
- `Vigilar proximidad` subscribes only while the application is visible and stops when
  the app leaves the foreground.

Remote push is an optional account setup phase. Android requires Firebase credentials,
an EAS project identifier, and an FCM V1 service account. The private
`google-services.json` file is excluded from Git. Without that external configuration,
the local location and notification flows remain fully testable.

### Release rehearsal

Build the release variant used for a live presentation:

```sh
npm run android:release --workspace=@yapa/mobile
```

The release build embeds the JavaScript bundle and removes Metro as a live demo
dependency.

## Technical review guide

### Request path

```text
Explicit user tap
       |
       v
Foreground permission and precise location fix
       |
       v
resolveNearby(point, accuracy, merchants, venues)
       |
       +--> Located merchant candidates --> decide(candidates, cards)
       |
       +--> Known venue --> tenant search and confirmation --> recommend(tenant, cards)
       |
       v
Card, reward rule, MCC, provenance, and rejected alternatives
```

The mobile package obtains the location and renders the result. The engine owns all
distance, convergence, proximity, and recommendation decisions. This keeps React,
Expo, and platform APIs out of the domain layer.

### Main files

| File | Responsibility |
|---|---|
| `packages/mobile/App.tsx` | Card selection, location action, venue picker, recommendations, and demo controls |
| `packages/mobile/src/location.ts` | Foreground permission, Android precision detection, and the 15 second fix timeout |
| `packages/mobile/src/proximity.ts` | Foreground watcher lifecycle and local arrival notification plumbing |
| `packages/mobile/src/notifications.ts` | Android channel setup, permission order, local notifications, and Expo token retrieval |
| `packages/engine/src/geo.ts` | Accuracy aware merchant search and venue containment |
| `packages/engine/src/converge.ts` | Groups merchants when several candidates produce the same card answer |
| `packages/engine/src/recommend.ts` | Selects the winning card and explains why the other rules lost |
| `packages/engine/src/proximity.ts` | Arrival hysteresis, accuracy guard, single event behavior, and cooldown |
| `packages/seed/src/venue.ts` | Converts the curated venue source into engine ready JSON |
| `data/venues/innovo-plaza.txt` | Human reviewed tenant names, categories, floors, units, source, and observation date |

### Engine contracts

The mobile application consumes these pure APIs:

```ts
resolveNearby(point, accuracyM, merchants, venues?, limit?): NearbyResult
decide(candidates, cards): Decision
recommend(merchant, cards): Recommendation
evaluateProximity(state, point, accuracyM, merchants, cards, now): ProximityStep
buildConfirmation(merchantId, point, at): TrainingConfirmation
```

`resolveNearby` rejects fixes above 500 meters of reported error. For located merchants,
its search radius is twice the reported accuracy, clamped between 75 and 400 meters.
For a known venue, it checks whether the uncertainty circle overlaps the building and
returns the complete tenant set without distance sorting or an arbitrary result limit.

### Venue data lifecycle

The venue source is reviewed as text so changes remain readable in pull requests:

```text
data/venues/innovo-plaza.txt
              |
              v
packages/seed/src/venue.ts
              |
              v
data/venues/innovo-plaza.json
              |
              v
packages/mobile/scripts/sync-data.mjs
              |
              v
packages/mobile/src/data/venue.innovo-plaza.json
```

Regenerate and synchronize the venue after reviewing the source directory:

```sh
npm run venue --workspace=@yapa/seed -- innovo-plaza
npm run sync-data --workspace=@yapa/mobile
```

The source and embedded JSON files should match byte for byte after synchronization.
The generated data includes the source URL, observation date, tenant count, MCC
breakdown, category, and optional floor and unit metadata.

### Validation strategy

- The engine has unit coverage for geospatial resolution, venue containment,
  recommendation, convergence, proximity state, privacy, and seed invariants.
- The seed package tests the curated category to MCC vocabulary.
- TypeScript checks all three workspaces with no emitted files.
- GitHub Actions runs `npm ci`, `npm test`, and `npm run typecheck` for pull requests
  and pushes to `master`.
- The Android acceptance path is exercised on a physical phone because permission
  precision, notification channels, and OEM behavior are platform concerns.

### Innovo Plaza pilot changes

- Added a venue model that separates a building footprint from its tenants.
- Added source and observation metadata to the venue generator.
- Added category, floor, and unit metadata without assigning fictional store
  coordinates.
- Curated 25 representative tenants from the official directory.
- Added a searchable tenant selector with category and floor filters.
- Routed the selected tenant through the existing recommendation engine.
- Added venue context to foreground proximity monitoring.
- Added a repeatable data synchronization command for the mobile bundle.

## Location and privacy boundary

The main action requests one current foreground location. The phone resolves nearby
merchants locally against the embedded catalog. Raw coordinates are not sent to a
backend and are not persisted.

The proximity watcher also runs only while the app is visible. It stops when the app
leaves the foreground. The Android manifest blocks background location and location
foreground service permissions.

The app intentionally does not call background location or geofencing APIs.

## Merchant resolution

GPS returns a coordinate and an accuracy estimate. It does not identify a merchant.
The engine compares that fix with two local data models.

### Located merchants

OpenStreetMap merchants have an individual coordinate and an inferred MCC. The search
radius follows the reported accuracy and remains inside product safety limits. The
result can be a list of candidates because location uncertainty can cover more than
one business.

### Indoor venues

A mall is modeled as one building footprint with a list of tenants. Individual tenant
coordinates are intentionally omitted. Indoor GPS cannot reliably distinguish stores
that are only a few meters apart.

When a fix overlaps a known venue, the app resolves the building and considers every
curated tenant as a candidate. The app then opens a local directory with search and
filters for category and floor. The user confirms the exact tenant before the engine
calculates the recommendation.

## Innovo Plaza

Innovo Plaza is the first venue implementation. Its building center and 93 meter
radius come from the OpenStreetMap footprint. The tenant catalog is a point in time
selection from the official mall directory, observed on 2026-08-19.

The official directory describes 101 commercial units across three floors. The demo
includes 25 representative tenants across food, clothing, shoes, pharmacy, personal
care, optical, cosmetics, technology, and games. Floor and unit are stored only when
the official pages provide consistent values. A smaller set is enough to exercise the
search and different MCC answers without pretending that the demo maintains a complete
directory.

Sources:

- [Innovo Plaza official directory](https://innovoplaza.co/)
- [OpenStreetMap contributors](https://www.openstreetmap.org/)
- [Visa Merchant Data Standards Manual](https://developer.visa.com/request_sample_data/merchant_data_standards)

Regenerate the venue after editing its curated input:

```sh
npm run venue --workspace=@yapa/seed -- innovo-plaza
npm run sync-data --workspace=@yapa/mobile
```

The generated file records the source URL and observation date. Tenant MCC values are
inferred from curated directory categories. They are not MCC values observed from an
acquirer or a card transaction.

## Known limitations

| Area | Current limitation | Current response |
|---|---|---|
| Indoor positioning | GPS can resolve the mall but not the exact tenant | Let the user search and confirm the tenant from the venue directory |
| Directory coverage | OSM contains few indoor tenants for Innovo Plaza | Curate a representative snapshot from the official directory |
| Directory freshness | Mall websites can change without notice | Record source and observation date, then review diffs before publishing |
| MCC accuracy | Public place datasets provide categories, not the acquiring MCC | Mark the MCC as inferred and avoid claims of transaction level certainty |
| Geographic scale | A whole country catalog does not fit this demo model | Publish versioned geographic cells and resolve the precise point on device |
| Network reliability | Runtime place search can fail during a live call | Embed the demo catalog and keep recommendation logic offline |
| Background arrival | Background location is outside the compliance boundary | Watch only in foreground and stop explicitly when the app is hidden |

## Scaling path

The scalable version is an ingestion pipeline, not a larger runtime Overpass query.

```text
Overture Maps and OpenStreetMap
Mall directories and partner feeds
Merchant and user corrections
              |
              v
Normalization and entity resolution
Category to MCC inference with provenance
Freshness and confidence checks
              |
              v
Versioned catalogs by geographic cell and venue
              |
              v
On device candidate resolution
```

### Base catalog

[Overture Maps Places](https://docs.overturemaps.org/guides/places/) is the production
direction for broad place coverage. Its monthly releases include stable identifiers,
categories, operating status, source metadata, and confidence values. OpenStreetMap
remains useful for building geometry and community mapped indoor details.

The public Overpass instances are appropriate for occasional seed extraction. Their
operators explicitly discourage using them as the backend for a consumer app. A
production service should use Overture data, an owned spatial index, or a contracted
place provider.

### Venue directory adapters

Large malls need a venue specific source when open map coverage is incomplete. An
adapter can ingest an official API, structured website data, CSV export, or partner
feed into the same venue schema.

Every imported record should carry its source, observation time, operating status,
and confidence. A missing store should not be deleted after one failed observation.
It should be marked for review until another source confirms the change.

### Merchant category codes

Place categories and MCC values are different datasets. The scalable catalog should
keep both values and record how the MCC was obtained. Category based inference is
useful for candidate ranking, but issuer or acquirer evidence is required before
calling a merchant MCC verified.

### Distribution and privacy

The backend can publish compact, versioned catalogs by a coarse geographic cell. The
phone downloads the relevant cell and performs the precise point in polygon and
distance calculations locally. This keeps raw coordinates out of the catalog service
while allowing data updates without shipping a new application binary.

## Deliberate non-goals

- Bank account aggregation
- Background location
- Continuous server tracking
- Exact indoor store positioning
- A production place ingestion service
- Automatic trust in inferred MCC values

These boundaries keep the demo focused on the recommendation decision and the failure
modes that can be demonstrated honestly on a physical Android device.

## Pilot boundary

The Innovo Plaza directory picker is the final product feature in this pilot. The pilot
ends with one foreground location flow, one known indoor venue, a curated 25 tenant
sample, exact tenant confirmation, and an explainable card recommendation.

Adding all 101 units, automatic directory ingestion, indoor positioning, or a second
venue belongs to a later phase. Those changes require an operational data pipeline and
freshness ownership, not more demo UI.
