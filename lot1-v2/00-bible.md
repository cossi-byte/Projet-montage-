# Lou et Timo — Bible de production (LOT 1, version 2)

Nouvelle version demandée : personnages humains en 3D léchée « film d'animation », voix réelles d'enfants.
Inspiration de **genre** (comptines 3D pour tout-petits, couleurs vives, véhicules et fruits avec un visage) — personnages, noms et décors 100 % originaux, sans reprendre ceux d'une chaîne existante.

## Personnages

| Personnage | Description (ne jamais changer) | Voix |
|---|---|---|
| **Lou**, 4 ans, l'héroïne | petite fille ronde et pétillante ; cheveux roux en petit carré avec une frange, barrette étoile jaune ; taches de rousseur ; grands yeux verts ; peau claire, joues roses ; salopette-robe lavande avec une poche en forme de goutte ; collant blanc ; baskets jaunes | fille de 5-7 ans, joyeuse, claire, phrases de 10 mots max |
| **Timo**, 3 ans, son petit frère | petit garçon potelé et rieur ; peau brun doré ; cheveux noirs bouclés courts ; grands yeux noirs ; petites lunettes rondes vertes ; t-shirt orange avec une baleine bleue ; short bleu ; baskets vertes | garçon de 4-6 ans, mots courts, rires |
| **Maman** | douce et calme ; cheveux bruns en chignon flou ; pull moutarde ; pantalon bleu ciel | adulte, douce |
| **Tchou-Tchou** | petit train à vapeur vert menthe avec un grand visage souriant à l'avant, yeux bleus, cheminée rouge qui souffle des nuages en forme de cœur ; bavard | adulte jouant un personnage, voix ronde et rigolote |
| **Mamie Rose** | grand-mère gourmande, cheveux blancs en chignon, lunettes roses, tablier à carreaux rose et blanc ; tient l'étal de fruits | adulte âgée, chaleureuse |
| **Les fruits-copains** | fraise, banane, pomme verte, orange, myrtille avec de petits yeux et un sourire ; muets, ils rebondissent et font « pop » | aucune (bruitages) |

**Phrases cultes** : au début, Lou et Timo ensemble : « Un, deux, trois… c'est parti ! » ; à la fin : « À bientôt les copains, bisous ! » (bisou soufflé vers la caméra).

**Monde** : le village des Pommiers — maisons rondes aux toits de couleurs, une petite gare, un marché, un lac avec un ponton, des pommiers partout. Maison de Lou et Timo : maison ronde jaune pâle au toit bleu, porte rouge ronde, jardin fleuri.

## Balises pour les prompts (à remplacer par le bloc anglais)

| Balise | Bloc à coller |
|---|---|
| [STYLE] | high-quality 3D animated movie style for toddlers, soft rounded shapes, big expressive eyes, bright saturated colors, warm sunny lighting, soft shadows, cute and friendly, 16:9 |
| [LOU] | Lou, a chubby cheerful 4-year-old girl, short red bob haircut with bangs and a yellow star hair clip, freckles, big green eyes, fair skin with pink cheeks, lavender pinafore dress with a drop-shaped pocket, white tights, yellow sneakers |
| [TIMO] | Timo, a chubby giggly 3-year-old boy, golden-brown skin, short black curly hair, big dark eyes, small round green glasses, orange t-shirt with a blue whale, blue shorts, green sneakers |
| [MAMAN] | their mother, a gentle young woman with brown hair in a messy bun, mustard sweater, light blue trousers |
| [TCHOU] | Tchou-Tchou, a small mint-green steam train with a big smiling face on the front, blue eyes, a red chimney puffing heart-shaped clouds |
| [MAMIE] | Grandma Rose, a cheerful grandmother with white hair in a bun, pink glasses, pink-and-white gingham apron |
| [FRUITS] | tiny fruit friends with little eyes and smiles: a strawberry, a banana, a green apple, an orange and a blueberry |
| [VILLAGE] | the Apple-Tree Village, round houses with colorful roofs, apple trees, a little train station, a small market and a sparkling lake |
| [MAISON] | Lou and Timo's house, a round pale-yellow house with a blue roof, a round red door and a flower garden |

**Prompt négatif** : no text, no logos, no scary elements, no realistic photo style, no extra fingers, no existing cartoon characters.

**Générique (10 s)** : `[STYLE] [LOU] and [TIMO] ride waving on the front of [TCHOU] as it puffs heart clouds through [VILLAGE], wide shot` — jingle : ukulélé + sifflet de train joyeux ; titre « Lou et Timo » ajouté au montage.

## Fabrication (outils IA + voix réelles)

1. **Voix** : enregistrer d'abord toutes les répliques (voir `voix-enregistrement.md`).
2. **Images** : générer chaque plan avec le prompt du tableau ; créer d'abord une planche de référence de chaque personnage et la réutiliser comme image de référence pour garder le même visage.
3. **Clips** : animer chaque image (image vers vidéo, 5 à 8 s). Pour les plans avec dialogue, utiliser un outil de synchronisation labiale avec la voix enregistrée.
4. **Chanson** : chantée par l'enfant (meilleur résultat) ou par un générateur de musique avec le style indiqué.
5. **Montage** : clips + voix + chanson + bruitages, export 1080p.
