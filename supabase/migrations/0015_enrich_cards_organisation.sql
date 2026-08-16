-- 0015_enrich_cards_organisation.sql
--
-- Richer, more engaging back-face notes for the "Organisation générale de l'être
-- humain" chapter story cards (corrections: the flip-side notes felt too short).
-- Enrichment ONLY: this expands explanation / tips / traps in FR + EN and leaves
-- the front face, images and structural question/answer untouched. Idempotent —
-- keyed by the deterministic card ids seeded in 0012, so it can be re-run safely
-- and every field stays fully editable afterwards from the admin card editor.

-- niveaux-organisation [1] — La cellule, unité de base du vivant
update public.lesson_cards set
  explanation_fr = $c$L'organisme vivant est emboîté comme des poupées russes : atome → molécule → cellule → tissu → organe → appareil / système → organisme entier. On monte toujours du plus simple au plus complexe, et chaque étage se construit à partir du précédent en faisant apparaître des propriétés nouvelles que l'étage du dessous n'avait pas. La cellule occupe la place charnière : c'est le premier niveau réellement vivant, la plus petite unité capable, à elle seule, de se nourrir, de croître, de réagir, de se reproduire et d'échanger avec son milieu. En dessous d'elle, molécules et atomes ne sont que de la matière ; au-dessus, tout n'est qu'assemblage de cellules.$c$,
  explanation_en = $c$A living body is nested like Russian dolls: atom → molecule → cell → tissue → organ → apparatus / system → whole organism. You always climb from the simplest to the most complex, and each level is built from the one below it, giving rise to new properties the lower level did not have. The cell sits at the pivot: it is the first truly living level, the smallest unit able, on its own, to feed, grow, react, reproduce and exchange with its environment. Below it, molecules and atoms are only matter; above it, everything is just an assembly of cells.$c$,
  tips_fr = $c$Récite l'échelle du plus petit au plus grand sans sauter de barreau — l'ordre est presque toujours demandé au concours.$c$,
  tips_en = $c$Recite the ladder from smallest to largest without skipping a rung — the order is almost always asked in the exam.$c$,
  traps_fr = $c$Le premier niveau vivant est la cellule, pas la molécule ni l'atome : une molécule d'ADN isolée n'est pas vivante.$c$,
  traps_en = $c$The first living level is the cell, not the molecule or atom: an isolated DNA molecule is not alive.$c$
where id = '54ce8bc9-119b-5da8-93f3-9c668e7471c0';

-- niveaux-organisation [2] — C, H, O, N : 96 % de la masse corporelle
update public.lesson_cards set
  explanation_fr = $c$Quatre éléments — carbone (C), hydrogène (H), oxygène (O) et azote (N) — composent à eux seuls environ 96 % de la masse du corps humain. On les appelle les bioéléments majoritaires : en s'associant par liaisons covalentes, ce sont eux qui bâtissent toutes les molécules organiques (glucides, lipides, protides, acides nucléiques). L'oxygène l'emporte en masse, surtout parce que le corps est constitué de 60 à 70 % d'eau (H₂O). Tous les autres éléments (Na, K, Ca, Cl, Fe…) sont indispensables à la vie mais ne pèsent presque rien : ce sont des oligo-éléments, présents seulement à l'état de traces.$c$,
  explanation_en = $c$Four elements — carbon (C), hydrogen (H), oxygen (O) and nitrogen (N) — alone make up about 96% of the human body's mass. They are called the major bio-elements: by bonding covalently, they build every organic molecule (carbohydrates, lipids, proteins, nucleic acids). Oxygen leads by mass, mainly because the body is 60–70% water (H₂O). Every other element (Na, K, Ca, Cl, Fe…) is vital to life yet weighs almost nothing: these are trace elements, present only in tiny amounts.$c$,
  tips_fr = $c$Retiens le sigle CHON : ces quatre lettres forment le squelette de toute molécule organique.$c$,
  tips_en = $c$Remember the acronym CHON: those four letters form the backbone of every organic molecule.$c$,
  traps_fr = $c$Ne confonds pas les éléments majoritaires en masse (C, H, O, N) avec les ions indispensables (Na⁺, K⁺, Ca²⁺) : le calcium abonde dans l'os mais reste minoritaire dans le corps entier.$c$,
  traps_en = $c$Don't confuse the elements that dominate by mass (C, H, O, N) with the essential ions (Na⁺, K⁺, Ca²⁺): calcium is abundant in bone but stays a minority across the whole body.$c$
where id = 'f40ad2ba-6f43-5a04-be40-e7d89459ce53';

-- niveaux-organisation [3] — Molécules organiques et inorganiques
update public.lesson_cards set
  explanation_fr = $c$Le critère est simple : une molécule organique est bâtie autour d'une chaîne (ou d'un squelette) de carbone associée à de l'hydrogène. Ce sont les quatre grandes familles du vivant : glucides, lipides, protides et acides nucléiques (ADN, ARN). Les molécules inorganiques (ou minérales) ne reposent pas sur cette chaîne carbonée : c'est le cas de l'eau — de loin la plus abondante, 60 à 70 % de l'organisme —, des sels minéraux et des ions (Na⁺, K⁺, Cl⁻). Exemple repère : le glucose est organique ; l'eau et les ions sont inorganiques.$c$,
  explanation_en = $c$The criterion is simple: an organic molecule is built around a carbon chain (or backbone) combined with hydrogen. These are the four great families of life: carbohydrates, lipids, proteins and nucleic acids (DNA, RNA). Inorganic (mineral) molecules do not rest on this carbon chain: water — by far the most abundant, 60–70% of the body — mineral salts and ions (Na⁺, K⁺, Cl⁻). Landmark example: glucose is organic; water and ions are inorganic.$c$,
  tips_fr = $c$Teste toujours la définition sur deux repères : glucose = organique, eau = inorganique.$c$,
  tips_en = $c$Always test the definition on two landmarks: glucose = organic, water = inorganic.$c$,
  traps_fr = $c$Contenir du carbone ne suffit pas à être organique : le CO₂ et les carbonates restent des molécules inorganiques.$c$,
  traps_en = $c$Containing carbon is not enough to be organic: CO₂ and carbonates are still inorganic molecules.$c$
where id = 'a54e47cb-3ebb-5f09-ae54-586ec05b3d4e';

-- tissus-organes-appareils [1] — Les 4 tissus primaires
update public.lesson_cards set
  explanation_fr = $c$Un tissu est un groupe de cellules semblables qui coopèrent pour une même fonction. Le corps humain n'en compte que quatre types primaires, à connaître par cœur : l'épithélial (revêtement des surfaces et sécrétion : peau, muqueuses, glandes), le conjonctif (soutien, protection et liaison : os, cartilage, tendons, graisse… et le sang), le musculaire (mouvement et contraction) et le nerveux (réception et transmission des messages). Tous les organes du corps ne sont, au fond, que des combinaisons de ces quatre tissus de base.$c$,
  explanation_en = $c$A tissue is a group of similar cells cooperating for one function. The human body has only four primary types, to know by heart: epithelial (covering surfaces and secretion: skin, mucous membranes, glands), connective (support, protection and linkage: bone, cartilage, tendons, fat… and blood), muscle (movement and contraction) and nervous (receiving and transmitting messages). At heart, every organ in the body is just a combination of these four basic tissues.$c$,
  tips_fr = $c$Astuce d'examen : le sang est un tissu conjonctif (à matrice liquide, le plasma) — c'est le piège le plus fréquent.$c$,
  tips_en = $c$Exam tip: blood is a connective tissue (with a liquid matrix, the plasma) — the most frequent trap.$c$,
  traps_fr = $c$Le sang n'est pas un cinquième tissu : il appartient bien au tissu conjonctif.$c$,
  traps_en = $c$Blood is not a fifth tissue: it belongs to connective tissue.$c$
where id = '1385da24-1191-5d65-a144-879bc4189993';

-- tissus-organes-appareils [2] — Un organe : plusieurs tissus, une fonction
update public.lesson_cards set
  explanation_fr = $c$Un organe est une structure formée de plusieurs tissus différents qui travaillent ensemble pour remplir une fonction précise. Prends la peau : elle associe un épiderme (tissu épithélial) posé sur un derme (tissu conjonctif), avec des vaisseaux, des nerfs et des glandes — c'est donc bien un organe. L'épiderme pris seul, lui, n'est qu'un tissu. La règle à retenir : dès qu'au moins deux tissus s'unissent pour accomplir une même tâche, on passe du tissu à l'organe.$c$,
  explanation_en = $c$An organ is a structure made of several different tissues working together to carry out a precise function. Take the skin: it combines an epidermis (epithelial tissue) resting on a dermis (connective tissue), with vessels, nerves and glands — so it is indeed an organ. The epidermis on its own is only a tissue. The rule to keep: as soon as at least two tissues unite to accomplish one task, you move from tissue to organ.$c$,
  tips_fr = $c$Repère concret : l'épiderme est un tissu ; la peau (épiderme + derme + annexes) est un organe.$c$,
  tips_en = $c$Concrete landmark: the epidermis is a tissue; the skin (epidermis + dermis + appendages) is an organ.$c$,
  traps_fr = $c$Ne confonds pas organe et tissu : un tissu = un seul type de cellules ; un organe = plusieurs tissus réunis.$c$,
  traps_en = $c$Don't confuse organ and tissue: a tissue = one cell type; an organ = several tissues combined.$c$
where id = '85dead8b-57ec-5cea-831d-8bf67b16ecf0';

-- tissus-organes-appareils [3] — Système ou appareil ?
update public.lesson_cards set
  explanation_fr = $c$Attention, les deux mots ne sont pas synonymes en biologie. Un système réunit des organes de structure histologique semblable (un même tissu prédomine), répartis dans tout le corps : le système nerveux, le système endocrinien. Un appareil, lui, réunit des organes dissemblables (des tissus différents) qui concourent à une même fonction : l'appareil digestif (bouche, estomac, intestin, foie…) ou l'appareil respiratoire. En résumé : le système mise sur la ressemblance de tissu, l'appareil sur la coopération vers un but commun.$c$,
  explanation_en = $c$Careful — in biology the two words are not synonyms. A system groups organs of similar histological structure (one tissue predominates), spread throughout the body: the nervous system, the endocrine system. An apparatus groups dissimilar organs (different tissues) that serve one function: the digestive apparatus (mouth, stomach, intestine, liver…) or the respiratory apparatus. In short: a system relies on tissue resemblance, an apparatus on cooperation toward a shared goal.$c$,
  tips_fr = $c$« Système » = même tissu partout ; « appareil » = tissus différents, même fonction.$c$,
  tips_en = $c$"System" = same tissue everywhere; "apparatus" = different tissues, same function.$c$,
  traps_fr = $c$Dans le langage courant on échange les deux mots ; au concours, seule la structure histologique tranche.$c$,
  traps_en = $c$In everyday speech the two words are swapped; in the exam, only the histological structure decides.$c$
where id = '8b8967ec-88fd-5bfa-b759-45f81838eed7';

-- homeostasie-fonctions [1] — Homéostasie : stabilité du milieu intérieur
update public.lesson_cards set
  explanation_fr = $c$L'homéostasie est la capacité de l'organisme à garder son milieu intérieur (le sang, la lymphe et le liquide interstitiel qui baigne les cellules) dans un état stable, malgré les variations permanentes du milieu extérieur. Ce n'est jamais un blocage total mais un équilibre dynamique, tenu par des boucles de rétroaction qui suivent toujours le même circuit : un stimulus est détecté par un récepteur, transmis à un centre de contrôle, qui commande un effecteur chargé de corriger l'écart. Sans cette régulation permanente, les cellules cesseraient tout simplement de fonctionner.$c$,
  explanation_en = $c$Homeostasis is the body's ability to keep its internal environment (blood, lymph and the interstitial fluid bathing the cells) stable, despite the constant changes of the outside world. It is never a total standstill but a dynamic balance, held by feedback loops that always follow the same circuit: a stimulus is detected by a receptor, passed to a control centre, which commands an effector to correct the deviation. Without this constant regulation, cells would simply stop working.$c$,
  tips_fr = $c$Mémorise la boucle en quatre temps : stimulus → récepteur → centre de contrôle → effecteur.$c$,
  tips_en = $c$Memorise the four-step loop: stimulus → receptor → control centre → effector.$c$,
  traps_fr = $c$Homéostasie ne veut pas dire immobilité absolue : c'est une stabilité relative, sans cesse réajustée.$c$,
  traps_en = $c$Homeostasis does not mean absolute stillness: it is a relative stability, constantly readjusted.$c$
where id = '3e1ab488-457f-591a-8fd7-4c586fe9f797';

-- homeostasie-fonctions [2] — Trois constantes à connaître
update public.lesson_cards set
  explanation_fr = $c$Trois grandeurs du milieu intérieur sont surveillées et corrigées en permanence : la température corporelle, maintenue autour de 37 °C ; la glycémie (taux de glucose dans le sang), proche de 1 g/L à jeun ; et le pH sanguin, tenu entre 7,35 et 7,45, donc légèrement alcalin. Chaque écart porte un nom que le concours adore : fièvre pour la température, hypo- ou hyperglycémie pour le sucre, acidose ou alcalose pour le pH. Toute dérive importante menace le fonctionnement des cellules et déclenche aussitôt des mécanismes correcteurs.$c$,
  explanation_en = $c$Three internal-environment values are monitored and corrected non-stop: body temperature, held around 37 °C; blood glucose, close to 1 g/L when fasting; and blood pH, kept between 7.35 and 7.45, so slightly alkaline. Each deviation has a name the exam loves: fever for temperature, hypo- or hyperglycaemia for sugar, acidosis or alkalosis for pH. Any large drift threatens cell function and immediately triggers corrective mechanisms.$c$,
  tips_fr = $c$Retiens le trio gagnant : 37 °C, 1 g/L, pH 7,4.$c$,
  tips_en = $c$Remember the winning trio: 37 °C, 1 g/L, pH 7.4.$c$,
  traps_fr = $c$Le pH sanguin normal est légèrement alcalin (7,4) : il n'est jamais acide, même si on parle d'« acidose » pour une baisse.$c$,
  traps_en = $c$Normal blood pH is slightly alkaline (7.4): it is never acidic, even though a drop is called "acidosis".$c$
where id = '5dd1687e-fc6b-5e63-9631-c3bc9ee6ba34';

-- homeostasie-fonctions [3] — Les 4 grandes fonctions physiologiques
update public.lesson_cards set
  explanation_fr = $c$Quatre grandes fonctions complémentaires assurent la vie de l'organisme. La nutrition apporte l'énergie et la matière et regroupe le plus d'appareils : digestif, respiratoire, cardiovasculaire et urinaire. La relation met le corps en lien avec le milieu extérieur grâce au système nerveux et aux organes des sens. La reproduction assure la pérennité de l'espèce. Enfin, le maintien de l'intégrité protège l'organisme et stabilise son milieu intérieur (immunité, homéostasie). Aucune ne travaille seule : elles sont étroitement interdépendantes.$c$,
  explanation_en = $c$Four complementary functions sustain the life of the body. Nutrition supplies energy and matter and gathers the most apparatuses: digestive, respiratory, cardiovascular and urinary. Relation links the body to the outside world through the nervous system and the sense organs. Reproduction ensures the survival of the species. Finally, maintaining integrity protects the body and stabilises its internal environment (immunity, homeostasis). None works alone: they are closely interdependent.$c$,
  tips_fr = $c$Relie chaque fonction à ses appareils : pour la nutrition, pense digestion + respiration + circulation + urines.$c$,
  tips_en = $c$Link each function to its apparatuses: for nutrition, think digestion + respiration + circulation + urine.$c$,
  traps_fr = $c$Les quatre fonctions ne sont jamais isolées : elles se complètent en permanence.$c$,
  traps_en = $c$The four functions are never isolated: they constantly complement one another.$c$
where id = 'f0115605-14f4-5d1f-8e65-6b53dce49a3c';
