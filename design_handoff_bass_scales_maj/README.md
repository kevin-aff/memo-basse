# Handoff : Mémo basse — gammes, cercle des quintes, entraînement

## Overview
Application d'aide à l'apprentissage de la basse (4 cordes, accordage standard E-A-D-G),
pensée pour un usage mobile **et** desktop. Trois sections, accessibles depuis un menu :

1. **Gammes** — aide-mémoire visuel : un gros bouton-diagramme par type de gamme (motif d'une
   octave, degrés affichés), puis une page par gamme où l'on choisit la tonalité et le mode, avec
   notes réelles, numéros de frettes, manche complet 0–19, écoute audio et fiches théoriques.
2. **Cercle des quintes** — roue interactive à 3 anneaux **en secteurs pleins** (majeurs / mineurs
   relatifs / diminué) avec « fenêtre de tonalité » : armure, accords diatoniques (triades ou
   tétrades), cadence II-V-I, tonalités voisines. Chaque secteur est cliquable et **sonne** (note
   seule, arpège ou accord plaqué, timbre piano) ; double-clic = verrouiller la tonalité.
3. **Entraînement** — répétition métronomée d'une gamme : choix gamme / tonalité / corde de départ,
   exercice (un mode ou cycle des modes), étendue (une octave ou position 4 cordes), motif
   (linéaire, intervalles brisés, triades), tempo, boucle, son notes ou métronome accentué,
   diagramme animé note à note et tablature générée.

## About the Design Files
Les fichiers de ce dossier sont des **références de design réalisées en HTML** : un prototype
fonctionnel qui montre l'apparence et le comportement attendus, **pas du code de production à
copier tel quel**. La tâche côté Claude Code est de **recréer ce design dans l'environnement du
projet cible** (React / React Native / Vue / SwiftUI…) avec ses conventions et sa bibliothèque de
composants. Si aucun environnement n'existe encore, choisir la stack la plus adaptée — pour une
appli mobile + web, React + Vite (web) ou React Native / Expo est un choix naturel, la logique
musicale étant du JavaScript pur, portable telle quelle.

Le prototype est écrit dans un format « Design Component » propriétaire (`.dc.html` + `support.js`) :
un template HTML avec des trous `{{ valeur }}` et une classe de logique `Component extends DCLogic`
(équivalent d'un composant classe React sans `render()` : `renderVals()` retourne les valeurs
injectées dans le template). **Ne pas porter ce runtime** : reprendre la classe de logique comme
spécification et la réécrire en composant(s) de la stack cible.

## Fidelity
**High-fidelity.** Couleurs, typographies, espacements et interactions sont définitifs et doivent
être reproduits fidèlement. Deux thèmes existent (« Studio » sombre par défaut, « Carnet » clair) ;
le sélecteur de thème en en-tête est un outil de design — à conserver ou à remplacer par un réglage
d'application selon le besoin produit.

---

## Modèle de données musical (à porter tel quel)

Tout est en JavaScript pur dans la classe de logique de `Gammes Basse.dc.html`. C'est le cœur du
projet : le porter à l'identique évite toute régression théorique.

### Constantes
| Nom | Contenu |
|---|---|
| `KEYS` | 12 tonalités `{pc, maj, min}` — orthographe majeure et mineure distinctes (`D♭` vs `C♯`, `A♭` vs `G♯`) |
| `LETTERS`, `NAT` | lettres C…B et leur hauteur naturelle, pour l'orthographe des notes |
| `SCALES` | 8 gammes : `{id, nom, semis[], degs[]}` — `semis` = intervalles en demi-tons depuis la fondamentale (octave incluse), `degs` = degré diatonique de chaque note (permet l'orthographe correcte : blues mineure = 1 ♭3 4 ♭5 5 ♭7) |
| `MODE_NAMES` | noms des modes par gamme mère (7 modes pour majeure / mineure nat. / harmonique / mélodique, 5 pour les pentatoniques) |
| `MOTIF_STEP`, `MOTIFS` | motifs d'entraînement : linéaire, tierces→septièmes brisées (saut de 2 à 6 degrés), triades |
| `OPEN_MIDI` | `[43, 38, 33, 28]` = G2 D2 A1 E1, index 0 = corde aiguë (Sol) → 3 = grave (Mi) |
| `STR_NAMES` | `['G','D','A','E']` |
| `QUAL`, `QUAL3`, `ROMAN` | qualités d'accords par empreinte d'intervalles — `QUAL` pour les tétrades (`4-7-11`→`maj7`), `QUAL3` pour les triades (`4-7`→``, `3-7`→`m`, `3-6`→`°`) ; chiffrage romain |

### Fonctions clés
- `spell(tonic, degré, pitchClass)` — orthographe correcte d'une note (lettre imposée par le degré,
  altération déduite). C'est ce qui donne `E♭` et non `D♯` en do blues mineure.
- `degLabel(degré, demi-tons, num)` — libellé de degré : `R`, `ᐃ2`, `♭3`, `p4`, `p5`, `♭7`…
  (ou 1/2/♭3/4/5 si le prop `degreeStyle = "num"`).
- `modeScale(parent, tonique, tonalité, i)` — rotation d'une gamme sur son i-ème degré : renvoie
  la gamme du mode, sa tonique orthographiée, son nom.
- `pattern(sc, rs, extraUp, extraLow, minOff, maxOff)` — motif d'une octave sur le manche.
  `rs` = index de la corde de la fondamentale (2 = La, 3 = Mi). Placement : `v ≤ 3` sur `rs`,
  `4–8` sur `rs-1`, `9–12` sur `rs-2`, au-delà sur `rs-3`. `extraUp` / `extraLow` prolongent la
  gamme au-dessus de l'octave et sous la fondamentale (nécessaire aux intervalles brisés et aux
  triades) ; `minOff` / `maxOff` écartent les notes hors du manche (frette 0 à 19).
- `rootFret(sc, pc, rs, extra)` — frette de la fondamentale ; remonte d'une octave si le motif
  tomberait sous la frette 1. **Calculée sur la phase ascendante seule** (sinon la position saute).
- `rows(sc, opt)` — grille du diagramme : 4 cordes × fenêtre de frettes, chaque case portant
  `label`, `isNote`, `isRoot`, `isGhost`/`isGhostRoot` (notes translucides hors motif) ou, en mode
  `full`, toutes les notes de la gamme de la position.
- `applyMotif(pool, motif, i0, iTop)` — génère la séquence d'un exercice : montée depuis la tonique
  jusqu'au motif partant de l'octave, puis descente jusqu'au motif partant de la tonique, avec
  ajout d'une tonique de résolution si la dernière note n'en est pas une.
- `chords(sc, pc, tonic, num, sev)` — table des 7 accords diatoniques. `sev = false` → triades
  (3 notes), `true` → tétrades (4 notes). Renvoie pour chaque degré : chiffre romain, nom d'accord,
  notes orthographiées et **degrés relatifs à la tonique de la tonalité** (pas à la fondamentale de
  l'accord) ; au-delà de l'octave les degrés sont prolongés (`R`→`8`, `ᐃ2`→`ᐃ9`, `p4`→`p11`,
  `ᐃ6`→`ᐃ13`).
- `relatives`, `usableChords`, `formula`, `circleVals` — contenus des fiches théoriques.
- Audio :
  - `actx()` — `AudioContext` unique, `resume()` si suspendue.
  - `piano(midi, dur, gainMul, at)` — **synthèse additive type piano** : 6 partiels sinus de gains
    `[1, .3, .12, .055, .022, .01]`, enveloppe attaque 5 ms → chute à 32 % en 160 ms → extinction
    exponentielle, passe-bas qui se referme de `min(8000, f×10)` vers `max(600, f×3)` sur 80 % de la
    durée. `at` = date de départ sur l'horloge audio (permet arpèges et accords roulés précis).
  - `tone(midi, dur, gainMul, at)` — alias de `piano`, utilisé par gammes et entraînement.
  - `sound(rootPc, quality, basePc)` — jeu d'un accord du cercle selon le mode choisi :
    `note` (fondamentale seule), `arp` (les 3 ou 4 notes espacées de 170 ms), `chord` (accord
    plaqué, notes décalées de 12 ms). **Voicing ancré sur la tonique** : `root = 48 + ((rootPc −
    basePc) mod 12)` — toutes les notes restent dans la même octave montante depuis la tonique de
    la tonalité, donc C-Dm-Em ne redescend pas d'une octave sur le Em.
  - `click(accent)` — métronome (square 1760 Hz accentué / 1100 Hz).
- Séquenceur : `tStart` / `tTick` / `tStop`, enchaînement par `setTimeout(60000 / tempo)`,
  index courant dans le state, `componentWillUnmount` nettoie le timer.

---

## Screens / Views

### 0. Menu
- Grille `repeat(auto-fit, minmax(300px, 1fr))`, gap 16 px, trois cartes hautes de 200 px min.
- Chaque carte : numéro `01/02/03` (mono 11 px, letter-spacing .16em, majuscules, couleur `--dim`),
  titre 34 px `--display`, description 15 px `--dim` (max 40ch).
- Hover : fond `--surface2`, `translateY(-2px)`, transition 150 ms.
- En-tête global : surtitre « Basse 4 cordes · E A D G », titre « Mémo basse », sélecteur de thème
  (2 pilules dans un conteneur arrondi).

### 1. Gammes — index
- Paragraphe d'explication (max 56ch) + sélecteur « Fondamentale corde La / corde Mi ».
- Grille de cartes `minmax(320px, 1fr)` : nom de la gamme (22 px), nombre de notes, **diagramme**
  (4 lignes de 42 px, pastilles 32 px, fondamentale en `--accent`, notes hors motif translucides
  sur la corde voisine), liste des degrés en mono.

### 2. Gammes — page d'une gamme
- Retour + titre `Tonique Mode` + gamme mère.
- Grille des 12 tonalités (`minmax(72px, 1fr)`, pastilles 14 px de padding, mono 17 px).
- Grille des modes (tonique + nom, `minmax(150px, 1fr)`) pour les gammes à 5 ou 7 notes.
- Carte diagramme : libellé de position, sélecteur de corde, bouton notes/degrés, bouton
  « ▶ Écouter la gamme ». Lignes de 56 px, pastilles 44 px, numéros de frettes sous la grille.
- Carte manche complet : sillet épais (5 px, notes des cordes à vide dessus), frettes 1 à 19,
  repères 3-5-7-9-12-15-17-19, **cases du motif surlignées** (`color-mix(--accent 12%)`) à chacune
  de ses occurrences (fondamentale sur Mi ou sur La).
- 4 fiches : formule en tons, notes de la gamme, accords diatoniques (ou accords associés pour les
  pentatoniques/blues), gammes liées.

### 3. Cercle des quintes
- Roue carrée (max 520 px) dessinée en **SVG `viewBox="0 0 100 100"`, secteurs pleins jointifs**
  (plus de pastilles rondes). Un secteur = un `<path>` de 30° construit par `wedge(i, ri, ro)`
  (arc externe + arc interne inversé), séparé de ses voisins par un liseré `stroke: var(--bg)` de
  0,5. Rayons par anneau : majeurs `ri 36 / ro 49`, mineurs `24 / 36`, diminués `12 / 24` ;
  disque central `r 12` en `--surface`.
- Les libellés ne sont **pas** dans le SVG : ce sont des `<div>` positionnés en % (`lx`/`ly`
  calculés aux rayons 42,5 / 30 / 18) superposés à la roue, en `pointer-events: none`, ce qui
  garde une typo nette et non déformée. Tailles 17 / 13,5 / 10,5 px, sous-titre 8 / 7,5 / 6,5 px.
- Remplissages : tonique = `--accent` plein (texte `--accent-ink`) ; degré de la tonalité =
  `color-mix(in oklch, var(--accent) 20%, transparent)` ; hors tonalité = `--surface2` (majeurs),
  `--surface` (mineurs), `--bg` + liseré `--line` (diminués), hover `opacity .7`.
- Sous-titres : degré romain + extension, qui suit le switch triades/tétrades (`I · maj7` vs `I`,
  `vi · m7` vs `vi · m`).
- **Clic** = jouer l'accord (voir `sound`) et sélectionner la tonalité ; **double-clic** = figer la
  tonalité. Une fois figée, les clics simples ne font plus que jouer : le diagramme et les fiches
  ne bougent plus. Un bouton pilule sous la roue affiche l'état (« ◯ Figer la tonalité sur C » /
  « ◉ Tonalité figée sur C — déverrouiller ») et permet de déverrouiller.
- Sélecteur de rendu sonore sous la roue (3 pilules) : **Note seule** (défaut) · **Arpège** ·
  **Accord plaqué**.
- 4 fiches à droite : armure (altérations, ordre des ♯/♭, enharmonie), **accords diatoniques**,
  cadence II-V-I, tonalités voisines. Bouton « Travailler X dans Gammes → ».
- Fiche **Accords diatoniques** : switch « Triades · 3 notes / Tétrades · 4 notes » (pilotant aussi
  le cercle et l'audio) puis un tableau à 4 colonnes `grid-template-columns: 34px 1fr 1.25fr 1.25fr`,
  gap 12 px, en-têtes mono 10 px majuscules centrés (**N° · Accord · Notes · Degrés**), colonne
  « Accord » alignée à gauche, les trois autres centrées, ligne séparée par `1px solid --line`.

### 4. Entraînement
- Sélections successives : gamme (`minmax(180px,1fr)`), tonalité, corde de la fondamentale,
  exercice (un mode / cycle des modes), étendue (une octave / position 4 cordes), mode, motif.
- Barre de transport : titre du mode courant + sous-titre (exercice · étendue · motif · compteur),
  tempo −/+ 5 BPM (40–200), bascule **Notes jouées / Métronome**, boucle, Démarrer / Arrêter.
- En cycle : frise de pastilles, la position courante en `--accent`.
- Diagramme identique à la section Gammes + pastille « en cours » de 52 px avec halo
  (`box-shadow: 0 0 0 4px color-mix(--accent 30%)`), sillet si la fenêtre atteint la frette 0,
  défilement horizontal si la fenêtre dépasse la largeur (min-width = 26 + n×46 px).
- **Tablature** : sigle `T A B`, chiffrage `4/4` empilé, double barre 3 px à chaque extrémité,
  4 lignes continues, barre de mesure fine toutes les 4 notes, 16 notes (4 mesures) par système,
  colonnes élastiques, dernier système complété à la mesure près et mis à l'échelle,
  numéro de la note en cours sur fond `--accent`.

## Interactions & Behavior
- Navigation par état interne (pas de routeur) : `view ∈ {menu, home, scale, cercle, train}`.
- Tout changement de réglage d'entraînement **arrête** la lecture en cours (`tStop`).
- Lecture : une note par temps ; en fin de séquence, boucle si activée, sinon arrêt et retour à 0.
- Audio Web Audio API ; `AudioContext` créée à la première lecture et `resume()` si suspendue
  (contrainte navigateur : doit partir d'un geste utilisateur).
- Responsive : grilles `auto-fit`, pilules en `white-space: nowrap; flex-shrink: 0`, diagrammes
  larges dans un conteneur `overflow-x: auto`.
- Hover sur toutes les cartes et pilules ; pas d'état focus custom (à ajouter côté accessibilité).

## State Management
```
view, theme                       // navigation + thème
scaleId, keyPc, mode              // section Gammes
labels ('note' | 'deg'), rs       // affichage diagramme, corde de la fondamentale
cPc, cMin                         // cercle des quintes (tonalité, majeur/mineur)
cSound ('note'|'arp'|'chord')     // rendu sonore au clic sur le cercle (défaut 'note')
cSev (bool, défaut true)          // accords diatoniques : tétrades (true) ou triades (false)
cLock (bool)                      // tonalité figée : le clic joue mais ne resélectionne plus
tScale, tKey, tRs, tEx, tMode,    // entraînement : réglages
tFull, tMotif, tempo, tLoop, tSound
tRun, tIdx                        // séquenceur : lecture en cours, index de la note
```
Aucune donnée distante, aucune persistance actuellement. Pistes : mémoriser les derniers réglages
d'entraînement et le thème (localStorage / AsyncStorage).

## Design Tokens
Thème **Studio** (défaut) / **Carnet** :

| Token | Studio | Carnet |
|---|---|---|
| `--bg` | `oklch(0.19 0.012 265)` | `oklch(0.955 0.014 85)` |
| `--surface` | `oklch(0.235 0.014 265)` | `oklch(0.99 0.006 85)` |
| `--surface2` | `oklch(0.275 0.014 265)` | `oklch(0.93 0.016 85)` |
| `--line` | `oklch(0.42 0.015 265)` | `oklch(0.75 0.018 70)` |
| `--ink` | `oklch(0.95 0.008 90)` | `oklch(0.24 0.02 60)` |
| `--dim` | `oklch(0.7 0.012 265)` | `oklch(0.5 0.02 60)` |
| `--accent` | `oklch(0.63 0.2 28)` | `oklch(0.55 0.19 28)` |
| `--accent-ink` | `oklch(0.98 0.01 90)` | `oklch(0.99 0.01 90)` |
| `--dot` / `--dot-ink` | `oklch(0.96 0.006 90)` / `oklch(0.2 0.012 265)` | `oklch(0.22 0.02 60)` / `oklch(0.97 0.008 85)` |
| `--radius` | 18 px | 4 px |
| bordure carte | `1px solid oklch(0.34 0.014 265)` | `1px solid oklch(0.8 0.02 70)` |

Typographies (Google Fonts) : **Space Grotesk** 500 (titres, thème Studio), **Instrument Serif**
(titres, thème Carnet), **IBM Plex Sans** 400/500/600 (texte), **IBM Plex Mono** 500/600 (notes,
degrés, frettes, tablature, sur-titres).

Échelles : espacements 4 / 6 / 8 / 10 / 14 / 18 / 22 / 34 px ; rayons 12 px (boutons),
14 px (cartes d'option), 999 px (pilules), `--radius` (cartes) ; tailles de texte 11 · 12 · 13 · 14
· 15 · 17 · 22 · 24 · 30 · 34 px. Pastilles : 32 px (index), 44 px (diagramme), 52 px (note jouée).

## Assets
Aucun : pas d'image, pas d'icône bitmap, pas de SVG. Uniquement du texte, des symboles Unicode
(♯ ♭ ♮ ᐃ ° ▶ ■ ← −) et des formes CSS. Polices chargées depuis Google Fonts.

## Files
- `CHANGELOG.md` — **à lire en premier si tu as déjà porté une version précédente** : tout ce qui
  a changé dans la section Cercle des quintes et le moteur audio, avec les extraits de code.
- `Gammes Basse.dc.html` — le prototype complet (template + logique + props).
- `support.js` — runtime du format Design Component ; nécessaire seulement pour ouvrir le
  prototype dans un navigateur, **à ne pas porter**.
- Ouvrir `Gammes Basse.dc.html` directement dans un navigateur pour explorer le comportement.

## Points d'attention pour le portage
1. **Orthographe des notes** : ne jamais nommer une note par une simple table chromatique — passer
   par `spell()` (lettre du degré + altération), sinon `E♭` devient `D♯` et la lecture est fausse.
2. **Position et manche** : `rootFret` doit ignorer l'extension basse, et toute note d'extension
   hors des frettes 0–19 doit être écartée, sinon l'exercice devient injouable.
3. **Sillet** : la frette 0 n'est jamais une case ; c'est une colonne « sillet » (bordure épaisse)
   sur laquelle se posent les notes à vide, la numérotation démarre à 1.
4. **Séquenceur** : `setTimeout` suffit ici, mais un portage sérieux devrait planifier les notes
   sur l'horloge de l'`AudioContext` (lookahead) pour un tempo stable en arrière-plan.
5. **Voicing du cercle** : toujours calculer les hauteurs à partir de la tonique de la tonalité
   (`basePc`), jamais en absolu — sinon les degrés supérieurs sonnent une octave trop bas et la
   suite d'accords « saute ».
6. **Degrés du tableau diatonique** : ils sont relatifs à la **tonique de la tonalité**, pas à la
   fondamentale de l'accord (en do, Dm7 = 2 4 6 8), et se prolongent au-delà de l'octave.
7. **Accessibilité** : ajouter des états focus visibles, des `aria-pressed` sur les pilules de
   sélection et un libellé textuel des diagrammes (actuellement purement visuels).
