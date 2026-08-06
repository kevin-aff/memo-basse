# Mémo basse

Aide-mémoire pour la basse 4 cordes (accordage standard E-A-D-G) : gammes et modes,
cercle des quintes, et entraînement métronomé. Pensé pour le mobile **et** le desktop.

Implémentation React + Vite + TypeScript de la référence de design
[`design_handoff_bass_scales/Gammes Basse.dc.html`](design_handoff_bass_scales/Gammes%20Basse.dc.html).

## Démarrer

Prérequis : [Node.js](https://nodejs.org) 20 ou plus (npm inclus).

```bash
npm install
```

```bash
npm run dev
```

Autres scripts : `npm run build` (typecheck + build de production), `npm run preview`,
`npm run typecheck`.

## Sections

1. **Gammes** — index visuel (un diagramme par type de gamme, degrés affichés), puis une page
   par gamme : 12 tonalités, modes, diagramme de position, manche complet 0–19, écoute audio et
   4 fiches théoriques.
2. **Cercle des quintes** — roue à 3 anneaux en secteurs pleins (majeurs / mineurs relatifs /
   diminué) avec fenêtre de tonalité : armure, accords diatoniques (triades ou tétrades), cadence
   II-V-I, tonalités voisines. Chaque secteur sonne au clic — note seule, arpège ou accord plaqué ;
   double-clic pour figer la tonalité et parcourir les degrés à l'oreille sans perdre le contexte.
3. **Entraînement** — répétition métronomée : gamme, tonalité, corde de départ, exercice
   (un mode ou cycle des modes), étendue, motif, tempo, boucle, diagramme animé note à note
   et tablature générée.

## Structure

```
src/
  music/          logique musicale, JavaScript pur — aucune dépendance à React
    constants.ts    tonalités, cordes, qualités d'accords
    spelling.ts     spell() et degLabel() — orthographe des notes et des degrés
    scales.ts       gammes, modes, rotation modale, formule
    fretboard.ts    pattern(), rootFret(), buildRows() — placement sur le manche
    motifs.ts       motifs d'exercice et génération de séquence
    chords.ts       accords diatoniques, accords associés, gammes liées
    circle.ts       cercle des quintes
    training.ts     configuration, séquence et tablature d'un exercice
    scaleView.ts    assemblage des données de la page d'une gamme
  audio/
    engine.ts       AudioContext unique, timbre piano, accords du cercle, métronome
    useSequencer.ts séquenceur à lookahead sur l'horloge audio
  components/     briques d'interface (diagrammes, tablature, boutons)
  views/          les 5 écrans
  state/          état applicatif et persistance localStorage
  styles/         jetons de design (2 thèmes) et feuille de styles
```

Le dossier `src/music` ne dépend ni de React ni du DOM : il est réutilisable tel quel pour un
portage React Native / Expo.

## Notes d'implémentation

- **Orthographe des notes.** Aucune note n'est nommée par table chromatique : `spell()` déduit la
  lettre du degré diatonique puis l'altération, ce qui donne `E♭` et non `D♯` en do blues mineure.
- **Sillet.** La frette 0 n'est jamais une case : c'est une colonne distincte à bordure épaisse
  sur laquelle se posent les notes à vide ; la numérotation démarre à 1.
- **Position.** `rootFret()` ignore volontairement l'extension basse du motif, sinon la position
  saute d'une octave selon le motif choisi. Les notes d'extension hors des frettes 0–19 sont
  écartées.
- **Séquenceur.** Les notes sont planifiées à l'avance sur l'horloge de l'`AudioContext`
  (lookahead 150 ms) plutôt que par `setTimeout` : le tempo reste stable même quand le navigateur
  ralentit les timers. Seul le suivi visuel passe par `requestAnimationFrame`.
- **Audio.** Une unique `AudioContext`, créée au premier clic (contrainte navigateur) et reprise
  si suspendue. Timbre piano en synthèse additive (6 partiels sinus, enveloppe percussive,
  passe-bas qui se referme sur la durée), partagé par les gammes, l'entraînement et le cercle.
- **Voicing du cercle.** Les hauteurs sont calculées depuis la tonique de la tonalité —
  `root = 48 + ((rootPc − basePc) mod 12)` — jamais en absolu : sinon les degrés supérieurs
  sonnent une octave trop bas et la suite d'accords « saute ».
- **Degrés du tableau diatonique.** Relatifs à la tonique de la tonalité, pas à la fondamentale
  de l'accord (en do, Dm7 se lit `2 4 6 8`), et prolongés au-delà de l'octave.
- **Accessibilité.** `aria-pressed` sur les boutons de sélection, focus visible, et description
  textuelle (`role="img"` + `aria-label`) des diagrammes et de la tablature, qui sont purement
  visuels.
- **Persistance.** Le thème et les réglages d'entraînement sont conservés dans `localStorage` ;
  la navigation repart du menu à chaque ouverture.
- **Notation des degrés.** `DEGREE_STYLE` dans `src/config.ts` bascule entre `R ᐃ2 ♭3 p4`
  et `1 2 ♭3 4` (prop `degreeStyle` de la référence de design).

## Écarts assumés par rapport au prototype

- Le sélecteur de thème de l'en-tête est conservé comme réglage d'application ; ses libellés
  deviennent « Studio » et « Carnet » plutôt que « Direction A / B ».
- Le manche complet et le diagramme d'entraînement défilent horizontalement sur écran étroit.
- Le bouton « Écouter la gamme » utilise le timbre piano. Le prototype annonce ce timbre comme
  s'appliquant à toute l'application, mais son `play()` n'a pas été refactorisé et garde l'ancien
  son : l'intention déclarée a été suivie plutôt que le code.
- Les secteurs de la roue sont des `<path>` SVG focalisables (`role="button"`, Entrée/Espace pour
  écouter). Le verrouillage, non atteignable au double-clic clavier, reste accessible par le
  bouton « Figer la tonalité » sous la roue.

## Référence de design

`design_handoff_bass_scales/` contient le prototype d'origine et son handoff. `support.js` est le
runtime du format « Design Component » : il sert seulement à ouvrir le prototype dans un
navigateur, il n'est pas utilisé par l'application.
