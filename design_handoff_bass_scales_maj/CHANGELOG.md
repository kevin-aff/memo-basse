# Mise à jour du design — cercle des quintes

Tout ce qui a changé depuis le premier handoff. Seule la **section 3 (Cercle des quintes)** est
touchée ; les sections Gammes et Entraînement sont inchangées, sauf le moteur audio qui est commun.

## 1. Audio : nouveau timbre piano (impacte toute l'app)

`tone()` était deux oscillateurs (triangle + sinus). Il est remplacé par `piano()` :

- 6 partiels sinus, gains relatifs `[1, .3, .12, .055, .022, .01]` ;
- enveloppe : attaque 5 ms jusqu'au pic, chute à 32 % du pic en 160 ms, extinction exponentielle
  sur la durée demandée ;
- filtre passe-bas qui se referme de `min(8000, f×10)` Hz vers `max(600, f×3)` Hz sur 80 % de la
  durée — c'est ce qui donne le côté « percussion qui s'éteint » plutôt qu'un bourdon d'orgue ;
- signature `piano(midi, dur, gainMul, at)` où `at` est une date sur l'horloge de l'`AudioContext`
  (indispensable pour des arpèges réguliers et un accord légèrement roulé).

`tone(midi, dur, gainMul, at)` est désormais un simple alias de `piano()` : gammes et entraînement
en héritent sans autre modification. `actx()` centralise la création/reprise de l'`AudioContext`.

## 2. Jeu au clic sur le cercle

`sound(rootPc, quality, basePc)` :

| mode (`state.cSound`) | comportement |
|---|---|
| `note` (défaut) | la fondamentale seule, 2,4 s |
| `arp` | les notes de l'accord (3 ou 4 selon `cSev`), espacées de 170 ms, 1,7 s chacune |
| `chord` | accord plaqué, notes décalées de 12 ms, 2,8 s |

**Voicing** : `root = 48 + ((rootPc − basePc) mod 12)`, où `basePc` est la classe de hauteur de la
tonique de la tonalité courante. Toutes les fondamentales tiennent donc dans une seule octave
montante depuis la tonique — en do, C / Dm / Em s'enchaînent en montant, sans décrochage d'octave.

Trois pilules sous la roue exposent le mode : Note seule · Arpège · Accord plaqué.

## 3. Roue en secteurs pleins

Les 36 pastilles rondes deviennent 36 secteurs SVG jointifs.

```js
const P = (a, r) => { const t = (a - 90) * Math.PI / 180;
  return (50 + r*Math.cos(t)).toFixed(2) + ',' + (50 + r*Math.sin(t)).toFixed(2); };
const wedge = (i, ri, ro) => {
  const a0 = i*30 - 15, a1 = i*30 + 15;
  return 'M' + P(a0,ro) + ' A' + ro + ',' + ro + ' 0 0 1 ' + P(a1,ro) +
         ' L' + P(a1,ri) + ' A' + ri + ',' + ri + ' 0 0 0 ' + P(a0,ri) + ' Z';
};
const RINGS = { maj:{ri:36, ro:49, lr:42.5}, min:{ri:24, ro:36, lr:30}, dim:{ri:12, ro:24, lr:18} };
```

- `viewBox="0 0 100 100"`, conteneur carré max 520 px ; disque central `r 12`.
- Séparation entre secteurs : `stroke: var(--bg); stroke-width: .5` (pas de gap géométrique).
- **Les libellés sont des `<div>` HTML superposés**, pas des `<text>` SVG : positionnés en % aux
  rayons `lr` de chaque anneau, `pointer-events: none`, transform `translate(-50%,-50%)`. Typo
  nette à toute taille d'écran. 17 / 13,5 / 10,5 px pour le nom, 8 / 7,5 / 6,5 px pour le degré.
- Remplissages : tonique `--accent` ; dans la tonalité `color-mix(in oklch, var(--accent) 20%,
  transparent)` ; hors tonalité `--surface2` / `--surface` / `--bg`+liseré `--line` selon l'anneau.

## 4. Verrouillage de tonalité

- **Double-clic** sur un secteur → `cLock = true` avec cette tonalité sélectionnée.
- Verrouillé, un clic simple ne fait plus que jouer le son : diagramme, armure, tableau et fiches
  restent figés. Permet de parcourir les degrés à l'oreille sans perdre le contexte.
- Bouton pilule sous la roue, deux états : « ◯ Figer la tonalité sur C » / « ◉ Tonalité figée sur
  C — déverrouiller ».

## 5. Fiche Accords diatoniques

- Switch **Triades · 3 notes / Tétrades · 4 notes** (`state.cSev`, défaut tétrades). Il pilote à la
  fois le tableau, les suffixes affichés sur la roue et le nombre de notes jouées.
- `chords(sc, pc, tonic, num, sev)` prend le paramètre `sev` ; `QUAL3` donne les qualités de
  triades (`4-7`→`` , `3-7`→`m`, `3-6`→`°`, `4-8`→`+`).
- Tableau à 4 colonnes : `grid-template-columns: 34px 1fr 1.25fr 1.25fr; gap: 12px`, en-têtes mono
  10 px majuscules centrés — **N° · Accord · Notes · Degrés**. Colonne Accord à gauche, les autres
  centrées, lignes séparées par `1px solid var(--line)`.
- **Degrés relatifs à la tonique de la tonalité**, pas à la fondamentale de l'accord : en do,
  Dm7 → `2 4 6 8`. Au-delà de l'octave les degrés sont prolongés au lieu de revenir à `R` :
  `R`→`8`, `ᐃ2`→`ᐃ9`, `p4`→`p11`, `ᐃ6`→`ᐃ13`.

## 6. Nouveaux champs de state

```
cSound  'note' | 'arp' | 'chord'   // défaut 'note'
cSev    bool                       // défaut true (tétrades)
cLock   bool                       // tonalité figée
```

## Pièges rencontrés (à ne pas reproduire)

1. `sev` doit être déclaré **avant** la boucle qui construit les secteurs — sinon `ReferenceError`
   au rendu.
2. Les pistes de grille du tableau doivent être en unités absolues (`34px`) et non en `ch` :
   l'en-tête et les lignes n'utilisent pas la même fonte, `ch` ne résout pas à la même largeur et
   les colonnes se désalignent.
3. Ne pas mettre les libellés dans le SVG : à ces échelles la typo mise à l'échelle par le viewBox
   devient floue et les tailles ne suivent pas le reste de l'UI.
