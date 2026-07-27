-- Lefax Course — Biologie content pack #1
-- Source material: two teacher DOCX chapters ("Organisation générale de l'être
-- humain" and "Cytologie I") plus their QCM banks. Produced as micro-learning
-- lessons (bilingual FR/EN) with inline image-upload placeholders, and a curated
-- set of bilingual MCQs (with corrections) routed to the admin review queue.
--
-- Design decisions (agreed with the product owner):
--   * Lessons are PUBLISHED immediately (published = true).
--   * MCQs land in content_approval as 'pending' — they appear in the admin AI
--     Review dashboard with their correct answer + explanation, and only go live
--     into quizzes/questions/choices when an admin approves them (ai-content
--     edge function, action 'approve'). This honours FR-10 (only admin publishes).
--   * Lesson bodies use the line-based mini-markup rendered by
--     src/lib/lessonContent.tsx. Image placeholders are written as
--     [[IMG: <what the diagram should show>]] so an admin knows exactly which
--     illustration to upload where.
--
-- Idempotent for the subject/chapters/lessons (ON CONFLICT DO NOTHING on their
-- unique keys). content_approval has no natural unique key; this migration is
-- expected to run once, like all Supabase migrations.

-- ---------------------------------------------------------------------------
-- 0. AI/system-generated review rows have no human submitter.
-- ---------------------------------------------------------------------------
alter table public.content_approval alter column submitted_by drop not null;

-- ---------------------------------------------------------------------------
-- 1. Subject (idempotent — Biologie already exists in seed.sql, but this keeps
--    the migration self-contained for projects seeded differently).
-- ---------------------------------------------------------------------------
insert into public.subjects (slug, name_fr, name_en, track, position)
values ('biologie', 'Biologie', 'Biology', 'medicine', 1)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Chapters
-- ---------------------------------------------------------------------------
insert into public.chapters (subject_id, slug, name_fr, name_en, position)
select s.id, v.slug, v.name_fr, v.name_en, v.position
from public.subjects s
cross join (values
  ('organisation-etre-humain', 'Organisation générale de l''être humain', 'General Organization of the Human Body', 1),
  ('cytologie-i', 'Cytologie I — La cellule', 'Cytology I — The Cell', 2)
) as v(slug, name_fr, name_en, position)
where s.slug = 'biologie'
on conflict (subject_id, slug) do nothing;

-- ===========================================================================
-- CHAPTER A — Organisation générale de l'être humain
-- ===========================================================================

-- --- Lesson A1 : Les niveaux d'organisation ---------------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'niveaux-organisation', 'Les niveaux d''organisation', 'Levels of Organization',
  array['Situer la cellule comme unité de base du vivant','Ordonner les niveaux d''organisation du corps humain','Distinguer molécules organiques et inorganiques'],
  array['Identify the cell as the basic unit of life','Order the levels of organization of the human body','Tell organic and inorganic molecules apart'],
$c$## L'organisme, un assemblage hiérarchisé
Le corps humain est constitué de milliards de **cellules**. La cellule est l'élément structural et fonctionnel de base de l'être vivant : elle sait se nourrir, croître, se reproduire et interagir avec son environnement.
Les éléments du corps s'emboîtent du plus simple au plus complexe, chaque niveau étant bâti à partir du précédent.
[[IMG: Schéma en pyramide des niveaux d'organisation : Atomes → Molécules → Cellules → Tissus → Organes → Appareils/Systèmes → Organisme]]
- **Atomes** : les plus petits constituants de la matière.
- **Molécules** : combinaisons d'atomes.
- **Cellules** : première unité vivante.
- **Tissus, organes, appareils** : niveaux d'intégration croissants.

## Le niveau chimique : atomes et molécules
Quatre atomes (bioéléments) représentent à eux seuls 96 % de la masse du corps : le **Carbone (C)**, l'**Hydrogène (H)**, l'**Oxygène (O)** et l'**Azote (N)**.
On classe les molécules en deux grandes catégories :
- **Molécules inorganiques (minérales)** : l'eau (H₂O, ≈ 60-70 % de l'organisme), les sels minéraux et les ions (Na⁺, K⁺, Ca²⁺, Cl⁻).
- **Molécules organiques** : elles sont bâties autour d'une chaîne carbonée. Quatre grandes familles : glucides, lipides, protides (acides aminés / protéines) et acides nucléiques (ADN, ARN).
[!INFO] Une molécule est dite « organique » lorsqu'elle possède une chaîne de carbone. C'est le repère le plus fiable pour la reconnaître.
[!APP] Un ion sodium (Na⁺) et une molécule de glucose sont présents dans le sang. Lequel est une molécule organique ? Justifiez. ||| Le glucose est une molécule organique (famille des glucides) car il contient une chaîne carbonée. L'ion sodium est un élément minéral (inorganique).

## Le niveau cellulaire
La cellule est l'unité structurale, fonctionnelle et génétique de base du vivant.
Le corps humain est **pluricellulaire** et composé de cellules **eucaryotes** (à noyau individualisé), contrairement aux **procaryotes** comme les bactéries.$c$,
$c$## The body as a nested hierarchy
The human body is made of billions of **cells**. The cell is the basic structural and functional unit of a living being: it can feed itself, grow, reproduce and interact with its environment.
The parts of the body nest from simplest to most complex, each level built from the one below it.
[[IMG: Pyramid diagram of the levels of organization: Atoms → Molecules → Cells → Tissues → Organs → Systems → Organism]]
- **Atoms**: the smallest constituents of matter.
- **Molecules**: combinations of atoms.
- **Cells**: the first living unit.
- **Tissues, organs, systems**: increasing levels of integration.

## The chemical level: atoms and molecules
Four atoms (bio-elements) alone make up 96% of the body's mass: **Carbon (C)**, **Hydrogen (H)**, **Oxygen (O)** and **Nitrogen (N)**.
Molecules fall into two broad categories:
- **Inorganic (mineral) molecules**: water (H₂O, ≈ 60-70% of the body), mineral salts and ions (Na⁺, K⁺, Ca²⁺, Cl⁻).
- **Organic molecules**: built around a carbon chain. Four families: carbohydrates, lipids, proteins (amino acids), and nucleic acids (DNA, RNA).
[!INFO] A molecule is called « organic » when it is built around a carbon chain. That is the most reliable clue for recognising one.
[!APP] A sodium ion (Na⁺) and a glucose molecule are both in the blood. Which one is an organic molecule? Justify. ||| Glucose is an organic molecule (carbohydrate family) because it contains a carbon chain. The sodium ion is a mineral (inorganic) element.

## The cellular level
The cell is the basic structural, functional and genetic unit of life.
The human body is **multicellular** and made of **eukaryotic** cells (with a defined nucleus), unlike **prokaryotes** such as bacteria.$c$,
$c$Le corps s'organise en niveaux emboîtés, des atomes à l'organisme, la cellule étant la première unité vivante.$c$,
$c$The body is organised in nested levels, from atoms to organism, with the cell as the first living unit.$c$,
  array['Ordre : atomes → molécules → cellules → tissus → organes → appareils → organisme','C, H, O, N = 96 % de la masse du corps','Organique = présence d''une chaîne carbonée'],
  array['Order: atoms → molecules → cells → tissues → organs → systems → organism','C, H, O, N = 96% of body mass','Organic = has a carbon chain'],
  8, 'easy', 1, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Organisation — Niveaux d'organisation","text_fr":"Quelle est la classification exacte, de la plus petite à la plus grande échelle ?","text_en":"What is the correct ordering, from the smallest to the largest scale?","explanation_fr":"Les niveaux s'emboîtent du plus simple au plus complexe : molécules, puis cellules, puis tissus, puis organes, puis appareils.","explanation_en":"Levels nest from simplest to most complex: molecules, then cells, then tissues, then organs, then systems.","options":[{"text_fr":"Cellules, tissu, appareil, organe, molécules","text_en":"Cells, tissue, system, organ, molecules","is_correct":false},{"text_fr":"Appareil, tissu, cellule, molécules","text_en":"System, tissue, cell, molecules","is_correct":false},{"text_fr":"Molécules, cellules, tissu, organe, appareil","text_en":"Molecules, cells, tissue, organ, system","is_correct":true},{"text_fr":"Appareil, cellule, molécules, organe, tissu","text_en":"System, cell, molecules, organ, tissue","is_correct":false}]}$j$),
($j${"source":"Organisation — Niveaux d'organisation","text_fr":"Quelle est l'unité structurale et fonctionnelle de base du vivant ?","text_en":"What is the basic structural and functional unit of life?","explanation_fr":"Par définition, la cellule est la plus petite entité capable d'accomplir de façon autonome les fonctions de la vie.","explanation_en":"By definition, the cell is the smallest entity able to carry out the functions of life on its own.","options":[{"text_fr":"L'organite","text_en":"The organelle","is_correct":false},{"text_fr":"La cellule","text_en":"The cell","is_correct":true},{"text_fr":"Le tissu","text_en":"The tissue","is_correct":false},{"text_fr":"La molécule","text_en":"The molecule","is_correct":false}]}$j$),
($j${"source":"Organisation — Niveaux d'organisation","text_fr":"Quels quatre éléments représentent environ 96 % de la masse du corps humain ?","text_en":"Which four elements make up about 96% of the human body's mass?","explanation_fr":"Le carbone, l'hydrogène, l'oxygène et l'azote sont les quatre bioéléments majoritaires de l'organisme.","explanation_en":"Carbon, hydrogen, oxygen and nitrogen are the four main bio-elements of the body.","options":[{"text_fr":"C, H, O, N","text_en":"C, H, O, N","is_correct":true},{"text_fr":"Na, K, Ca, Cl","text_en":"Na, K, Ca, Cl","is_correct":false},{"text_fr":"C, O, Fe, S","text_en":"C, O, Fe, S","is_correct":false},{"text_fr":"H, O, P, Ca","text_en":"H, O, P, Ca","is_correct":false}]}$j$),
($j${"source":"Organisation — Niveaux d'organisation","text_fr":"Parmi ces molécules du sang, laquelle est organique ?","text_en":"Among these molecules found in blood, which one is organic?","explanation_fr":"Le glucose possède une chaîne carbonée : c'est une molécule organique. L'eau, les sels et les ions sont inorganiques.","explanation_en":"Glucose has a carbon chain, so it is organic. Water, salts and ions are inorganic.","options":[{"text_fr":"L'eau (H₂O)","text_en":"Water (H₂O)","is_correct":false},{"text_fr":"L'ion chlorure (Cl⁻)","text_en":"Chloride ion (Cl⁻)","is_correct":false},{"text_fr":"Le glucose","text_en":"Glucose","is_correct":true},{"text_fr":"Le sel minéral (NaCl)","text_en":"Mineral salt (NaCl)","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain' and l.slug = 'niveaux-organisation';

-- --- Lesson A2 : Tissus, organes, appareils et systèmes ---------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'tissus-organes-appareils', 'Tissus, organes, appareils et systèmes', 'Tissues, Organs and Systems',
  array['Définir un tissu et citer les 4 types primaires','Distinguer organe, appareil et système'],
  array['Define a tissue and list the 4 primary types','Tell organs, systems and body-systems apart'],
$c$## Le niveau tissulaire
Un **tissu** est un groupe de cellules semblables qui coopèrent pour assurer une même fonction. Le corps compte **4 types de tissus primaires**.
[[IMG: Planche comparative des 4 tissus primaires : épithélial, conjonctif, musculaire, nerveux (une vignette histologique par type)]]
- **Tissu épithélial** : revêtement (peau, muqueuse digestive) et sécrétion (glandes, ex. pancréas exocrine).
- **Tissu conjonctif** : soutien, protection et liaison (os, cartilage, sang).
- **Tissu musculaire** : production de mouvement (muscle squelettique, cardiaque, lisse).
- **Tissu nerveux** : communication et traitement de l'information (neurones et cellules gliales).
[!INFO] Le sang est un cas particulier : c'est une sous-catégorie du tissu **conjonctif**.

## Organes, appareils et systèmes
Un **organe** est une structure composée de plusieurs tissus différents remplissant une fonction précise (ex. les os et les muscles participent à la locomotion).
Un **appareil** ou un **système** est un assemblage d'organes.
### Appareil ou système ?
- **Système** : ensemble d'organes de **structure histologique semblable** (même tissu prédominant), répartis dans tout le corps. Ex. système nerveux, système endocrinien, système immunitaire.
- **Appareil** : ensemble d'organes **dissemblables** (tissus différents), bien délimités, qui concourent à une même fonction. Ex. appareil digestif, appareil respiratoire.
[!PIEGE] Les mots « appareil » et « système » s'échangent souvent dans l'usage courant, mais la distinction structurale (tissu semblable vs dissemblable) reste un piège classique de concours.
[!APP] Le système nerveux est-il un système ou un appareil ? Justifiez. ||| C'est un **système** : ses organes (cerveau, moelle épinière, nerfs) sont tous formés du même tissu prédominant, le tissu nerveux, réparti dans tout le corps.$c$,
$c$## The tissue level
A **tissue** is a group of similar cells that cooperate to carry out one function. The body has **4 primary tissue types**.
[[IMG: Comparative plate of the 4 primary tissues: epithelial, connective, muscle, nervous (one histology thumbnail per type)]]
- **Epithelial tissue**: covering (skin, digestive lining) and secretion (glands, e.g. exocrine pancreas).
- **Connective tissue**: support, protection and linkage (bone, cartilage, blood).
- **Muscle tissue**: movement (skeletal, cardiac, smooth muscle).
- **Nervous tissue**: communication and information processing (neurons and glial cells).
[!INFO] Blood is a special case: it is a sub-category of **connective** tissue.

## Organs and systems
An **organ** is a structure made of several different tissues carrying out a precise function (e.g. bones and muscles enable locomotion).
A **system** (or body-system) is an assembly of organs.
### System or apparatus?
- **System (système)**: a set of organs with **similar histological structure** (same predominant tissue), spread throughout the body. E.g. nervous system, endocrine system, immune system.
- **Apparatus (appareil)**: a set of **dissimilar** organs (different tissues), well delimited, that serve one overall function. E.g. digestive apparatus, respiratory apparatus.
[!PIEGE] The words « apparatus » and « system » are often swapped in everyday use, but the structural distinction (similar vs different tissue) is a classic exam trap.
[!APP] Is the nervous system a « système » or an « appareil »? Justify. ||| It is a **système**: its organs (brain, spinal cord, nerves) are all made of the same predominant tissue, nervous tissue, spread throughout the body.$c$,
$c$Les cellules forment 4 types de tissus, qui forment des organes, puis des appareils (tissus différents) et des systèmes (tissu prédominant semblable).$c$,
$c$Cells form 4 tissue types, which form organs, then apparatuses (different tissues) and systems (one similar predominant tissue).$c$,
  array['4 tissus : épithélial, conjonctif, musculaire, nerveux','Organe = plusieurs tissus pour une fonction','Système = tissu semblable ; Appareil = tissus différents'],
  array['4 tissues: epithelial, connective, muscle, nervous','Organ = several tissues for one function','System = similar tissue; Apparatus = different tissues'],
  10, 'medium', 2, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Organisation — Tissus et organes","text_fr":"Parmi ces propositions, laquelle ne désigne PAS un organe ?","text_en":"Which of these is NOT an organ?","explanation_fr":"L'épiderme est un tissu (épithélium de revêtement). La peau, qui réunit épiderme et derme, est un organe.","explanation_en":"The epidermis is a tissue (covering epithelium). The skin, which combines epidermis and dermis, is an organ.","options":[{"text_fr":"Le cœur","text_en":"The heart","is_correct":false},{"text_fr":"La rate","text_en":"The spleen","is_correct":false},{"text_fr":"L'épiderme","text_en":"The epidermis","is_correct":true},{"text_fr":"La peau","text_en":"The skin","is_correct":false}]}$j$),
($j${"source":"Organisation — Tissus et organes","text_fr":"Lequel de ces éléments n'est PAS l'un des 4 types de tissus primaires ?","text_en":"Which of these is NOT one of the 4 primary tissue types?","explanation_fr":"Le sang est une sous-catégorie du tissu conjonctif. Les 4 familles primaires sont : épithélial, conjonctif, musculaire et nerveux.","explanation_en":"Blood is a sub-category of connective tissue. The 4 primary families are epithelial, connective, muscle and nervous.","options":[{"text_fr":"Le tissu épithélial","text_en":"Epithelial tissue","is_correct":false},{"text_fr":"Le tissu sanguin","text_en":"Blood tissue","is_correct":true},{"text_fr":"Le tissu musculaire","text_en":"Muscle tissue","is_correct":false},{"text_fr":"Le tissu nerveux","text_en":"Nervous tissue","is_correct":false}]}$j$),
($j${"source":"Organisation — Tissus et organes","text_fr":"Un ensemble d'organes de même tissu prédominant, répartis dans tout le corps, définit :","text_en":"A set of organs sharing one predominant tissue, spread throughout the body, defines:","explanation_fr":"C'est la définition d'un système (ex. système nerveux). Un appareil réunit au contraire des organes de tissus différents.","explanation_en":"That is the definition of a system (e.g. nervous system). An apparatus, by contrast, groups organs of different tissues.","options":[{"text_fr":"Un appareil","text_en":"An apparatus","is_correct":false},{"text_fr":"Un système","text_en":"A system","is_correct":true},{"text_fr":"Un organe","text_en":"An organ","is_correct":false},{"text_fr":"Un tissu","text_en":"A tissue","is_correct":false}]}$j$),
($j${"source":"Organisation — Tissus et organes","text_fr":"Pourquoi la peau est-elle considérée comme un organe ?","text_en":"Why is the skin considered an organ?","explanation_fr":"La peau associe plusieurs tissus différents (épiderme épithélial, derme conjonctif) pour une fonction précise : c'est donc un organe.","explanation_en":"The skin combines several different tissues (epithelial epidermis, connective dermis) for a precise function, so it is an organ.","options":[{"text_fr":"Parce qu'elle est faite d'un seul tissu","text_en":"Because it is made of a single tissue","is_correct":false},{"text_fr":"Parce qu'elle associe plusieurs tissus pour une fonction","text_en":"Because it combines several tissues for one function","is_correct":true},{"text_fr":"Parce qu'elle est un système","text_en":"Because it is a system","is_correct":false},{"text_fr":"Parce qu'elle ne contient pas de cellules","text_en":"Because it contains no cells","is_correct":false}]}$j$),
($j${"source":"Organisation — Tissus et organes","text_fr":"Quelle est la fonction principale du tissu conjonctif ?","text_en":"What is the main function of connective tissue?","explanation_fr":"Le tissu conjonctif assure le soutien, la protection et la liaison (os, cartilage, sang).","explanation_en":"Connective tissue provides support, protection and linkage (bone, cartilage, blood).","options":[{"text_fr":"Le revêtement et la sécrétion","text_en":"Covering and secretion","is_correct":false},{"text_fr":"Le soutien, la protection et la liaison","text_en":"Support, protection and linkage","is_correct":true},{"text_fr":"La production de mouvement","text_en":"Producing movement","is_correct":false},{"text_fr":"Le traitement de l'information","text_en":"Processing information","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain' and l.slug = 'tissus-organes-appareils';

-- --- Lesson A3 : Homéostasie et grandes fonctions ---------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'homeostasie-fonctions', 'Homéostasie et grandes fonctions', 'Homeostasis and the Major Functions',
  array['Définir l''homéostasie et citer 3 paramètres régulés','Nommer les 4 grandes fonctions physiologiques'],
  array['Define homeostasis and name 3 regulated parameters','Name the 4 major physiological functions'],
$c$## L'homéostasie
Les systèmes et appareils assurent l'**homéostasie** : la capacité de l'organisme à maintenir une stabilité relative de son **milieu intérieur** (sang, lymphe, liquide interstitiel) malgré les variations de l'environnement extérieur.
Trois paramètres régulés à connaître :
- **Température corporelle** ≈ 37 °C
- **Glycémie** ≈ 1 g/L
- **pH sanguin** entre 7,35 et 7,45
[[IMG: Schéma d'une boucle de rétroaction homéostatique : stimulus → récepteur → centre de contrôle → effecteur → retour à la valeur de consigne]]

## Les quatre grandes fonctions physiologiques
Les appareils et systèmes remplissent quatre grandes fonctions **interdépendantes** qui se complètent.
- **Nutrition** : croissance et entretien de l'organisme (appareils digestif, respiratoire, cardiovasculaire, urinaire).
- **Relation** : mise en relation avec le milieu extérieur via le système nerveux (réception par les organes des sens → traitement → commande à l'appareil locomoteur).
- **Reproduction** : transmission de la vie et perpétuation de l'espèce (appareil reproducteur).
- **Maintien de l'intégrité** : protection et stabilité du milieu intérieur (homéostasie).
[!PIEGE] Les grandes fonctions ne travaillent **jamais** de façon isolée : elles agissent en synergie et sont interdépendantes.$c$,
$c$## Homeostasis
The body's systems maintain **homeostasis**: the ability to keep a relatively stable **internal environment** (blood, lymph, interstitial fluid) despite changes in the outside world.
Three regulated parameters worth knowing:
- **Body temperature** ≈ 37 °C
- **Blood glucose** ≈ 1 g/L
- **Blood pH** between 7.35 and 7.45
[[IMG: Diagram of a homeostatic feedback loop: stimulus → receptor → control centre → effector → return to set point]]

## The four major physiological functions
The body's systems carry out four **interdependent** functions that complement each other.
- **Nutrition**: growth and maintenance of the body (digestive, respiratory, cardiovascular, urinary systems).
- **Relation**: connecting with the outside world through the nervous system (sensed by sense organs → processed → commands the locomotor system).
- **Reproduction**: passing on life and perpetuating the species (reproductive system).
- **Maintaining integrity**: protection and stability of the internal environment (homeostasis).
[!PIEGE] The major functions **never** work in isolation: they act in synergy and are interdependent.$c$,
$c$L'homéostasie maintient le milieu intérieur stable ; quatre grandes fonctions interdépendantes assurent la vie : nutrition, relation, reproduction et maintien de l'intégrité.$c$,
$c$Homeostasis keeps the internal environment stable; four interdependent functions sustain life: nutrition, relation, reproduction and maintaining integrity.$c$,
  array['Homéostasie = stabilité du milieu intérieur','Repères : 37 °C, glycémie ≈ 1 g/L, pH 7,35-7,45','4 fonctions : nutrition, relation, reproduction, intégrité'],
  array['Homeostasis = stable internal environment','Benchmarks: 37 °C, glucose ≈ 1 g/L, pH 7.35-7.45','4 functions: nutrition, relation, reproduction, integrity'],
  8, 'medium', 3, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Organisation — Homéostasie","text_fr":"Concernant les grandes fonctions physiologiques, quelle affirmation est FAUSSE ?","text_en":"Regarding the major physiological functions, which statement is FALSE?","explanation_fr":"Les grandes fonctions agissent en synergie et sont interdépendantes : elles ne fonctionnent pas de façon isolée.","explanation_en":"The major functions act in synergy and are interdependent: they do not work in isolation.","options":[{"text_fr":"Il en existe 4 grandes.","text_en":"There are 4 of them.","is_correct":false},{"text_fr":"Elles fonctionnent de façon isolée.","text_en":"They work in isolation.","is_correct":true},{"text_fr":"La nutrition permet la croissance et l'entretien.","text_en":"Nutrition enables growth and maintenance.","is_correct":false},{"text_fr":"Le système nerveux porte la fonction de relation.","text_en":"The nervous system drives the relation function.","is_correct":false}]}$j$),
($j${"source":"Organisation — Homéostasie","text_fr":"Qu'est-ce que l'homéostasie ?","text_en":"What is homeostasis?","explanation_fr":"L'homéostasie est le maintien d'une stabilité relative du milieu intérieur malgré les variations de l'environnement externe.","explanation_en":"Homeostasis is keeping the internal environment relatively stable despite changes in the external environment.","options":[{"text_fr":"La multiplication des cellules","text_en":"Cell multiplication","is_correct":false},{"text_fr":"Le maintien de la stabilité du milieu intérieur","text_en":"Keeping the internal environment stable","is_correct":true},{"text_fr":"La production de mouvement","text_en":"Producing movement","is_correct":false},{"text_fr":"La transmission de l'information génétique","text_en":"Transmitting genetic information","is_correct":false}]}$j$),
($j${"source":"Organisation — Homéostasie","text_fr":"Quelle est la fourchette normale du pH sanguin ?","text_en":"What is the normal range of blood pH?","explanation_fr":"Le pH sanguin est finement régulé entre 7,35 et 7,45.","explanation_en":"Blood pH is tightly regulated between 7.35 and 7.45.","options":[{"text_fr":"6,8 – 7,0","text_en":"6.8 – 7.0","is_correct":false},{"text_fr":"7,35 – 7,45","text_en":"7.35 – 7.45","is_correct":true},{"text_fr":"7,8 – 8,0","text_en":"7.8 – 8.0","is_correct":false},{"text_fr":"5,0 – 5,5","text_en":"5.0 – 5.5","is_correct":false}]}$j$),
($j${"source":"Organisation — Homéostasie","text_fr":"Quel appareil ne participe PAS directement au maintien immédiat de l'homéostasie ?","text_en":"Which apparatus does NOT directly take part in the immediate maintenance of homeostasis?","explanation_fr":"L'appareil génital sert à la pérennité de l'espèce, non au maintien des constantes internes immédiates de l'individu.","explanation_en":"The reproductive apparatus serves the survival of the species, not the immediate maintenance of the individual's internal constants.","options":[{"text_fr":"L'appareil respiratoire","text_en":"The respiratory apparatus","is_correct":false},{"text_fr":"L'appareil génital","text_en":"The reproductive apparatus","is_correct":true},{"text_fr":"L'appareil cardiovasculaire","text_en":"The cardiovascular apparatus","is_correct":false},{"text_fr":"L'appareil urinaire","text_en":"The urinary apparatus","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'organisation-etre-humain' and l.slug = 'homeostasie-fonctions';

-- ===========================================================================
-- CHAPTER B — Cytologie I : la cellule et ses composantes
-- ===========================================================================

-- --- Lesson B1 : Introduction et organisation cellulaire --------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'introduction-organisation', 'Introduction et organisation cellulaire', 'Introduction and Cell Organization',
  array['Définir la cytologie et la cellule','Distinguer procaryotes et eucaryotes','Décrire l''architecture d''une cellule eucaryote'],
  array['Define cytology and the cell','Tell prokaryotes and eukaryotes apart','Describe the architecture of a eukaryotic cell'],
$c$## Qu'est-ce que la cytologie ?
La **cytologie** (du grec *kytos* = cellule et *logos* = étude) est la branche de la biologie qui étudie la cellule.
**Principe fondamental** : la cellule est l'unité structurale et fonctionnelle de base de tous les êtres vivants. C'est le plus petit constituant vivant capable d'accomplir toutes les fonctions de la vie (métabolisme, multiplication, échanges).
[[IMG: Photomicrographie de cellules au microscope optique, légendée pour situer la membrane, le cytoplasme et le noyau]]
[!INFO] Repère historique : la cellule a été observée pour la première fois par **Robert Hooke en 1665**, sur des coupes de liège, avec un microscope optique rudimentaire.
[[IMG: Gravure historique du microscope de Robert Hooke et de sa coupe de liège (1665)]]

## Procaryotes et eucaryotes
On sépare le vivant en deux grandes catégories selon la structure cellulaire :
- **Procaryotes** (ex. bactéries) : organismes unicellulaires **sans noyau individualisé** ; le matériel génétique baigne directement dans le cytosol.
- **Eucaryotes** : organismes (uni- ou pluricellulaires) possédant un **noyau délimité** par une enveloppe nucléaire et des organites compartimentés.
[!INFO] Étymologie : *pro-karyon* = « avant le noyau » ; *eu-karyon* = « vrai noyau ». Ces deux racines suffisent à retrouver la définition sans l'apprendre par cœur.

## Architecture d'une cellule eucaryote
- **La membrane plasmique** (ou plasmalemme) : la limite de la cellule.
- **Le protoplasme** : tout le contenu interne, divisé en **noyau** et **cytoplasme** (lui-même formé du cytosol liquide et des organites).$c$,
$c$## What is cytology?
**Cytology** (from Greek *kytos* = cell and *logos* = study) is the branch of biology that studies the cell.
**Core principle**: the cell is the basic structural and functional unit of every living thing. It is the smallest living unit able to perform all the functions of life (metabolism, reproduction, exchanges).
[[IMG: Light-microscope photomicrograph of cells, labelled to locate the membrane, cytoplasm and nucleus]]
[!INFO] Historical marker: the cell was first observed by **Robert Hooke in 1665**, on slices of cork, using a rudimentary optical microscope.
[[IMG: Historical engraving of Robert Hooke's microscope and his cork slice (1665)]]

## Prokaryotes and eukaryotes
Life splits into two broad categories by cell structure:
- **Prokaryotes** (e.g. bacteria): single-celled organisms **with no defined nucleus**; the genetic material sits directly in the cytosol.
- **Eukaryotes**: organisms (single- or multi-celled) with a **nucleus enclosed** by a nuclear envelope and compartmentalised organelles.
[!INFO] Etymology: *pro-karyon* = « before the nucleus »; *eu-karyon* = « true nucleus ». These two roots are enough to recover the definitions without rote learning.

## Architecture of a eukaryotic cell
- **The plasma membrane** (plasmalemma): the boundary of the cell.
- **The protoplasm**: all the internal content, divided into the **nucleus** and the **cytoplasm** (itself made of liquid cytosol and the organelles).$c$,
$c$La cytologie étudie la cellule, unité de base du vivant ; les eucaryotes ont un noyau et des organites, contrairement aux procaryotes.$c$,
$c$Cytology studies the cell, the basic unit of life; eukaryotes have a nucleus and organelles, unlike prokaryotes.$c$,
  array['Cellule = unité structurale et fonctionnelle du vivant','Procaryote = sans noyau ; eucaryote = noyau + organites','Cellule = membrane + protoplasme (noyau + cytoplasme)'],
  array['Cell = structural and functional unit of life','Prokaryote = no nucleus; eukaryote = nucleus + organelles','Cell = membrane + protoplasm (nucleus + cytoplasm)'],
  10, 'easy', 1, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Introduction","text_fr":"À quel chercheur attribue-t-on la première observation de la cellule au microscope en 1665 ?","text_en":"Which researcher is credited with the first observation of the cell under the microscope in 1665?","explanation_fr":"Robert Hooke a observé des compartiments dans des coupes de liège et les a nommés « cellules ».","explanation_en":"Robert Hooke observed compartments in slices of cork and named them « cells ».","options":[{"text_fr":"Antoine van Leeuwenhoek","text_en":"Antoine van Leeuwenhoek","is_correct":false},{"text_fr":"Louis Pasteur","text_en":"Louis Pasteur","is_correct":false},{"text_fr":"Robert Hooke","text_en":"Robert Hooke","is_correct":true},{"text_fr":"James Watson","text_en":"James Watson","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Introduction","text_fr":"Quelle est la principale caractéristique d'un organisme procaryote ?","text_en":"What is the main defining feature of a prokaryotic organism?","explanation_fr":"Les procaryotes (comme les bactéries) ont leur matériel génétique libre dans le cytoplasme, sans enveloppe nucléaire.","explanation_en":"Prokaryotes (such as bacteria) have their genetic material free in the cytoplasm, with no nuclear envelope.","options":[{"text_fr":"Ils n'ont pas de membrane plasmique.","text_en":"They have no plasma membrane.","is_correct":false},{"text_fr":"Ils sont dépourvus d'enveloppe nucléaire individualisée.","text_en":"They lack a defined nuclear envelope.","is_correct":true},{"text_fr":"Leur matériel génétique est de l'ARN.","text_en":"Their genetic material is RNA.","is_correct":false},{"text_fr":"Ils sont toujours pluricellulaires.","text_en":"They are always multicellular.","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Introduction","text_fr":"Quelle est la plus petite entité de l'organisme pouvant vivre de façon autonome ?","text_en":"What is the smallest entity of the body able to live independently?","explanation_fr":"La cellule est l'unité de base capable de manifester seule les propriétés de la vie.","explanation_en":"The cell is the basic unit able to display the properties of life on its own.","options":[{"text_fr":"L'organite","text_en":"The organelle","is_correct":false},{"text_fr":"Le tissu","text_en":"The tissue","is_correct":false},{"text_fr":"La cellule","text_en":"The cell","is_correct":true},{"text_fr":"Le noyau","text_en":"The nucleus","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Introduction","text_fr":"Qu'est-ce qui distingue une cellule procaryote d'une cellule eucaryote ?","text_en":"What distinguishes a prokaryotic cell from a eukaryotic cell?","explanation_fr":"Les procaryotes ne possèdent aucun organite délimité par une membrane, contrairement aux eucaryotes.","explanation_en":"Prokaryotes have no membrane-bound organelles, unlike eukaryotes.","options":[{"text_fr":"Les procaryotes ont un noyau et une paroi.","text_en":"Prokaryotes have a nucleus and a wall.","is_correct":false},{"text_fr":"Les procaryotes n'ont pas d'organites délimités par des membranes.","text_en":"Prokaryotes have no membrane-bound organelles.","is_correct":true},{"text_fr":"Les procaryotes possèdent un centriole.","text_en":"Prokaryotes have a centriole.","is_correct":false},{"text_fr":"Les procaryotes n'ont pas de ribosomes.","text_en":"Prokaryotes have no ribosomes.","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Introduction","text_fr":"La cellule est formée de :","text_en":"A cell is made of:","explanation_fr":"La cellule est délimitée par la membrane plasmique ; tout le contenu interne (noyau + cytoplasme) forme le protoplasme.","explanation_en":"The cell is bounded by the plasma membrane; all the inner content (nucleus + cytoplasm) forms the protoplasm.","options":[{"text_fr":"Uniquement de protoplasme","text_en":"Protoplasm only","is_correct":false},{"text_fr":"Protoplasme + membrane plasmique","text_en":"Protoplasm + plasma membrane","is_correct":true},{"text_fr":"Hyaloplasme + membrane plasmique","text_en":"Hyaloplasm + plasma membrane","is_correct":false},{"text_fr":"Morphoplasme + membrane plasmique","text_en":"Morphoplasm + plasma membrane","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'introduction-organisation';

-- --- Lesson B2 : La membrane plasmique --------------------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'membrane-plasmique', 'La membrane plasmique', 'The Plasma Membrane',
  array['Décrire le modèle de la mosaïque fluide','Donner la composition biochimique de la membrane','Expliquer la perméabilité sélective'],
  array['Describe the fluid mosaic model','Give the biochemical composition of the membrane','Explain selective permeability'],
$c$## Le modèle de la mosaïque fluide
La membrane plasmique est organisée selon le modèle de la **mosaïque fluide** : une **bicouche lipidique** dotée d'une **perméabilité sélective**, capable de contrôler les entrées et sorties de substances.
[[IMG: Schéma de la membrane plasmique en mosaïque fluide : bicouche de phospholipides, cholestérol, protéines intrinsèques et extrinsèques, glycocalix sur la face externe]]

## Composition biochimique moyenne
- **Protéines (~55 %)** : intrinsèques (transmembranaires) ou extrinsèques (périphériques, internes ou externes).
- **Lipides (~25-40 %)** : phospholipides et cholestérol. Chaque phospholipide est **amphiphile** : une tête hydrophile (vers les milieux aqueux) et deux queues hydrophobes (vers l'intérieur de la membrane).
- **Glucides (~3-10 %)** : uniquement sur la face **extracellulaire**, où ils forment le **glycocalix**, essentiel à la reconnaissance cellulaire.
[!PIEGE] Les protéines sont majoritaires **en masse** (~55 %), pas les lipides. Et les glucides ne se trouvent que sur la face externe de la membrane.
[!INFO] Le cholestérol s'intercale entre les phospholipides et joue le rôle de tampon de fluidité : il stabilise la membrane à haute température et l'empêche de se figer à basse température.$c$,
$c$## The fluid mosaic model
The plasma membrane follows the **fluid mosaic** model: a **lipid bilayer** with **selective permeability**, able to control what enters and leaves the cell.
[[IMG: Diagram of the fluid mosaic plasma membrane: phospholipid bilayer, cholesterol, intrinsic and extrinsic proteins, glycocalyx on the outer face]]

## Average biochemical composition
- **Proteins (~55%)**: intrinsic (transmembrane) or extrinsic (peripheral, inner or outer).
- **Lipids (~25-40%)**: phospholipids and cholesterol. Each phospholipid is **amphiphilic**: a hydrophilic head (facing the watery media) and two hydrophobic tails (facing the inside of the membrane).
- **Carbohydrates (~3-10%)**: only on the **outer (extracellular)** face, where they form the **glycocalyx**, essential for cell recognition.
[!PIEGE] Proteins are the majority **by mass** (~55%), not lipids. And carbohydrates are found only on the outer face of the membrane.
[!INFO] Cholesterol slots between the phospholipids and acts as a fluidity buffer: it stabilises the membrane at high temperature and stops it from freezing at low temperature.$c$,
$c$La membrane est une bicouche lipidique en mosaïque fluide, majoritairement protéique en masse, à perméabilité sélective ; les glucides sont sur la face externe.$c$,
$c$The membrane is a fluid-mosaic lipid bilayer, mostly protein by mass, with selective permeability; carbohydrates sit on the outer face.$c$,
  array['Mosaïque fluide = bicouche + perméabilité sélective','En masse : protéines ~55 % > lipides > glucides','Phospholipide amphiphile ; glucides = face externe (glycocalix)'],
  array['Fluid mosaic = bilayer + selective permeability','By mass: proteins ~55% > lipids > carbohydrates','Amphiphilic phospholipid; carbohydrates = outer face (glycocalyx)'],
  10, 'medium', 2, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Quel composant est majoritaire en masse dans la membrane plasmique ?","text_en":"Which component is the majority by mass in the plasma membrane?","explanation_fr":"La membrane contient en moyenne ~55 % de protéines, 25-40 % de lipides et seulement 3-10 % de glucides.","explanation_en":"The membrane contains on average ~55% proteins, 25-40% lipids and only 3-10% carbohydrates.","options":[{"text_fr":"Les glucides","text_en":"Carbohydrates","is_correct":false},{"text_fr":"Les lipides","text_en":"Lipids","is_correct":false},{"text_fr":"Les protéines","text_en":"Proteins","is_correct":true},{"text_fr":"L'eau","text_en":"Water","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Sur quelle face de la membrane trouve-t-on exclusivement les glucides ?","text_en":"On which face of the membrane are carbohydrates found exclusively?","explanation_fr":"Les glucides sont liés à des lipides ou protéines sur la face extracellulaire, formant le glycocalix.","explanation_en":"Carbohydrates are bound to lipids or proteins on the extracellular face, forming the glycocalyx.","options":[{"text_fr":"Uniquement la face extracellulaire","text_en":"The extracellular face only","is_correct":true},{"text_fr":"Uniquement la face cytosolique","text_en":"The cytosolic face only","is_correct":false},{"text_fr":"Les deux faces de façon symétrique","text_en":"Both faces symmetrically","is_correct":false},{"text_fr":"À l'intérieur de la bicouche","text_en":"Inside the bilayer","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Pourquoi un phospholipide membranaire est-il dit « amphiphile » ?","text_en":"Why is a membrane phospholipid called « amphiphilic »?","explanation_fr":"Il possède une tête hydrophile et deux queues hydrophobes, ce qui permet l'auto-assemblage en bicouche.","explanation_en":"It has a hydrophilic head and two hydrophobic tails, which lets it self-assemble into a bilayer.","options":[{"text_fr":"Il est soluble dans l'eau chaude et froide.","text_en":"It dissolves in hot and cold water.","is_correct":false},{"text_fr":"Il possède deux têtes chargées.","text_en":"It has two charged heads.","is_correct":false},{"text_fr":"Il a une tête hydrophile et deux queues hydrophobes.","text_en":"It has a hydrophilic head and two hydrophobic tails.","is_correct":true},{"text_fr":"Il change de charge selon le pH.","text_en":"It changes charge with pH.","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Quel est le rôle du cholestérol dans la membrane plasmique animale ?","text_en":"What is the role of cholesterol in the animal plasma membrane?","explanation_fr":"Le cholestérol régule la fluidité : il stabilise la membrane à haute température et l'empêche de se figer à basse température.","explanation_en":"Cholesterol regulates fluidity: it stabilises the membrane at high temperature and prevents it from freezing at low temperature.","options":[{"text_fr":"Il bloque tout transport d'eau.","text_en":"It blocks all water transport.","is_correct":false},{"text_fr":"Il régule la fluidité membranaire.","text_en":"It regulates membrane fluidity.","is_correct":true},{"text_fr":"Il dépolarise la membrane.","text_en":"It depolarises the membrane.","is_correct":false},{"text_fr":"Il synthétise les protéines.","text_en":"It synthesises proteins.","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Quelle proposition décrit la microstructure de la membrane (mosaïque fluide) ?","text_en":"Which statement describes the membrane's microstructure (fluid mosaic)?","explanation_fr":"Des protéines sont insérées de façon asymétrique dans une bicouche de phospholipides (modèle de Singer et Nicolson).","explanation_en":"Proteins are inserted asymmetrically within a phospholipid bilayer (Singer-Nicolson model).","options":[{"text_fr":"Une couche de protéines enrobant les phospholipides","text_en":"A protein layer coating the phospholipids","is_correct":false},{"text_fr":"Des protéines incorporées dans une bicouche de phospholipides","text_en":"Proteins embedded in a phospholipid bilayer","is_correct":true},{"text_fr":"Des phospholipides pris entre deux couches de protéines","text_en":"Phospholipids sandwiched between two protein layers","is_correct":false},{"text_fr":"Uniquement des lipides sans protéines","text_en":"Only lipids, no proteins","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Membrane plasmique","text_fr":"Une bicouche lipidique pure est perméable à :","text_en":"A pure lipid bilayer is permeable to:","explanation_fr":"La partie centrale hydrophobe laisse passer les molécules hydrophobes/liposolubles (comme O₂), mais bloque les ions et grosses molécules polaires.","explanation_en":"The hydrophobic core lets hydrophobic/lipid-soluble molecules through (like O₂) but blocks ions and large polar molecules.","options":[{"text_fr":"L'ion sodium (Na⁺)","text_en":"The sodium ion (Na⁺)","is_correct":false},{"text_fr":"Les composés hydrophobes","text_en":"Hydrophobic compounds","is_correct":true},{"text_fr":"Le glucose","text_en":"Glucose","is_correct":false},{"text_fr":"L'ion chlorure (Cl⁻)","text_en":"The chloride ion (Cl⁻)","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'membrane-plasmique';

-- --- Lesson B3 : Les transports membranaires -------------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'transports-membranaires', 'Les transports membranaires', 'Membrane Transport',
  array['Distinguer transport passif et transport actif','Expliquer diffusion simple, facilitée et osmose','Comprendre pompes et transports vésiculaires'],
  array['Tell passive and active transport apart','Explain simple diffusion, facilitated diffusion and osmosis','Understand pumps and vesicular transport'],
$c$## Transport passif (sans ATP)
Les substances se déplacent **selon leur gradient** de concentration (du plus concentré au moins concentré), sans dépense d'énergie.
[[IMG: Schéma comparatif des transports membranaires : diffusion simple, diffusion facilitée (canal / perméase), osmose (aquaporine) et transport actif (pompe Na⁺/K⁺)]]
- **Diffusion simple** : petites molécules non polaires et liposolubles (O₂, CO₂). Les molécules polaires ou chargées ne traversent pas directement la bicouche.
- **Diffusion facilitée** : via des protéines transporteuses (canaux ou perméases) pour les molécules hydrophiles ou polaires (ex. glucose).
- **Osmose** : diffusion **du solvant (l'eau)** à travers une membrane semi-perméable, du milieu **hypotonique** (moins concentré en soluté) vers le milieu **hypertonique** (plus concentré).
[[IMG: Schéma de l'osmose : passage de l'eau par les aquaporines, d'un compartiment hypotonique vers un compartiment hypertonique]]
[!PIEGE] Bien que la molécule d'eau soit fortement polaire (et ne puisse donc traverser la bicouche), elle est assez petite pour passer par des pores protéiques : les **aquaporines**.

## Transport actif (avec ATP)
Le **transport actif** permet le passage de molécules **contre** leur gradient grâce à des **pompes protéiques** (ex. pompe Na⁺/K⁺), au prix d'une consommation d'ATP.
Les **transports vésiculaires** (mouvements de masse) requièrent aussi de l'énergie : **endocytose** (entrée de matériel) et **exocytose** (sortie de matériel).
[!APP] Le glucose ne traverse pas directement la bicouche. Comment franchit-il la membrane, et pourquoi sans consommer d'énergie ? ||| Par **diffusion facilitée**, via des protéines transporteuses (perméases de type GLUT), en suivant son gradient de concentration : c'est un transport passif, malgré l'intervention d'une protéine.$c$,
$c$## Passive transport (no ATP)
Substances move **down their concentration gradient** (from more to less concentrated), with no energy cost.
[[IMG: Comparative diagram of membrane transport: simple diffusion, facilitated diffusion (channel / permease), osmosis (aquaporin) and active transport (Na⁺/K⁺ pump)]]
- **Simple diffusion**: small non-polar, lipid-soluble molecules (O₂, CO₂). Polar or charged molecules do not cross the bilayer directly.
- **Facilitated diffusion**: via carrier proteins (channels or permeases) for hydrophilic or polar molecules (e.g. glucose).
- **Osmosis**: diffusion **of the solvent (water)** across a semi-permeable membrane, from the **hypotonic** side (less concentrated in solute) to the **hypertonic** side (more concentrated).
[[IMG: Osmosis diagram: water moving through aquaporins, from a hypotonic compartment to a hypertonic compartment]]
[!PIEGE] Even though the water molecule is strongly polar (and so cannot cross the bilayer), it is small enough to pass through protein pores: the **aquaporins**.

## Active transport (with ATP)
**Active transport** moves molecules **against** their gradient using **protein pumps** (e.g. the Na⁺/K⁺ pump), at the cost of ATP.
**Vesicular transport** (bulk movement) also needs energy: **endocytosis** (material in) and **exocytosis** (material out).
[!APP] Glucose cannot cross the bilayer directly. How does it get across the membrane, and why without spending energy? ||| By **facilitated diffusion**, through carrier proteins (GLUT-type permeases), following its concentration gradient: it is passive transport, despite a protein being involved.$c$,
$c$Le transport passif suit le gradient sans ATP (diffusion simple, facilitée, osmose) ; le transport actif va contre le gradient grâce à des pompes qui consomment de l'ATP.$c$,
$c$Passive transport follows the gradient without ATP (simple, facilitated, osmosis); active transport goes against the gradient using ATP-consuming pumps.$c$,
  array['Passif = selon le gradient, sans ATP ; Actif = contre le gradient, avec ATP','Osmose = diffusion de l''eau vers le milieu hypertonique','Eau : polaire mais petite → passe par les aquaporines'],
  array['Passive = down the gradient, no ATP; Active = against the gradient, with ATP','Osmosis = water diffusing toward the hypertonic side','Water: polar but small → passes through aquaporins'],
  12, 'hard', 3, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Quel transport déplace les molécules selon leur gradient, sans consommer d'ATP ?","text_en":"Which transport moves molecules down their gradient without spending ATP?","explanation_fr":"Le transport passif (diffusion simple et facilitée) se fait spontanément du milieu le plus concentré vers le moins concentré.","explanation_en":"Passive transport (simple and facilitated diffusion) happens spontaneously from the more to the less concentrated side.","options":[{"text_fr":"Le transport actif","text_en":"Active transport","is_correct":false},{"text_fr":"Le transport passif","text_en":"Passive transport","is_correct":true},{"text_fr":"L'endocytose","text_en":"Endocytosis","is_correct":false},{"text_fr":"L'exocytose","text_en":"Exocytosis","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Comment appelle-t-on la diffusion du solvant (l'eau) à travers une membrane à perméabilité sélective ?","text_en":"What is the name for the diffusion of the solvent (water) across a selectively permeable membrane?","explanation_fr":"L'osmose est la diffusion de l'eau du milieu hypotonique vers le milieu hypertonique.","explanation_en":"Osmosis is the diffusion of water from the hypotonic side to the hypertonic side.","options":[{"text_fr":"La pinocytose","text_en":"Pinocytosis","is_correct":false},{"text_fr":"La phagocytose","text_en":"Phagocytosis","is_correct":false},{"text_fr":"L'osmose","text_en":"Osmosis","is_correct":true},{"text_fr":"La bêta-oxydation","text_en":"Beta-oxidation","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Comment l'eau traverse-t-elle rapidement la membrane malgré sa forte polarité ?","text_en":"How does water cross the membrane quickly despite its strong polarity?","explanation_fr":"L'eau passe par des pores protéiques sélectifs appelés aquaporines (diffusion facilitée / osmose).","explanation_en":"Water passes through selective protein pores called aquaporins (facilitated diffusion / osmosis).","options":[{"text_fr":"Par diffusion simple à travers les queues hydrophobes","text_en":"By simple diffusion through the hydrophobic tails","is_correct":false},{"text_fr":"Par transport actif consommant de l'ATP","text_en":"By ATP-consuming active transport","is_correct":false},{"text_fr":"Par des pores protéiques appelés aquaporines","text_en":"Through protein pores called aquaporins","is_correct":true},{"text_fr":"Par endocytose permanente","text_en":"By constant endocytosis","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Quelle proposition décrit correctement le transport actif primaire ?","text_en":"Which statement correctly describes primary active transport?","explanation_fr":"Il déplace des solutés contre leur gradient en hydrolysant directement l'ATP (pompes ATPases).","explanation_en":"It moves solutes against their gradient by directly hydrolysing ATP (ATPase pumps).","options":[{"text_fr":"Le passage de l'eau du milieu concentré vers le moins concentré","text_en":"Water moving from the concentrated to the less concentrated side","is_correct":false},{"text_fr":"Le transport de solutés contre le gradient avec hydrolyse d'ATP","text_en":"Moving solutes against the gradient with ATP hydrolysis","is_correct":true},{"text_fr":"La diffusion de petites molécules hydrophobes","text_en":"Diffusion of small hydrophobic molecules","is_correct":false},{"text_fr":"L'entrée de nutriments par déformation de la membrane","text_en":"Nutrient entry by membrane deformation","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Par quel mécanisme le glucose entre-t-il dans les cellules musculaires selon son gradient ?","text_en":"By which mechanism does glucose enter muscle cells down its gradient?","explanation_fr":"Trop polaire et volumineux pour la bicouche, le glucose utilise une diffusion facilitée par des transporteurs GLUT (transport passif).","explanation_en":"Too polar and bulky for the bilayer, glucose uses facilitated diffusion via GLUT transporters (passive transport).","options":[{"text_fr":"La diffusion simple","text_en":"Simple diffusion","is_correct":false},{"text_fr":"La diffusion facilitée par un transporteur (GLUT)","text_en":"Facilitated diffusion via a transporter (GLUT)","is_correct":true},{"text_fr":"Le transport actif primaire","text_en":"Primary active transport","is_correct":false},{"text_fr":"La phagocytose","text_en":"Phagocytosis","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Transports membranaires","text_fr":"Le phénomène osmotique se produit toujours :","text_en":"Osmosis always occurs:","explanation_fr":"L'eau diffuse du milieu hypotonique (moins concentré en soluté) vers le milieu hypertonique (plus concentré).","explanation_en":"Water diffuses from the hypotonic side (less concentrated in solute) to the hypertonic side (more concentrated).","options":[{"text_fr":"Du milieu hypertonique vers l'hypotonique","text_en":"From hypertonic to hypotonic","is_correct":false},{"text_fr":"Du milieu hypotonique vers l'hypertonique","text_en":"From hypotonic to hypertonic","is_correct":true},{"text_fr":"Toujours de l'intérieur vers l'extérieur de la cellule","text_en":"Always from inside to outside the cell","is_correct":false},{"text_fr":"Uniquement pour les ions","text_en":"Only for ions","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'transports-membranaires';

-- --- Lesson B4 : Le noyau et le cytoplasme ----------------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'noyau-cytoplasme', 'Le noyau et le cytoplasme', 'The Nucleus and the Cytoplasm',
  array['Décrire le noyau et son enveloppe','Distinguer hyaloplasme et morphoplasme','Citer les composants du cytosquelette'],
  array['Describe the nucleus and its envelope','Tell hyaloplasm and morphoplasm apart','List the components of the cytoskeleton'],
$c$## Le noyau
Le **noyau** est le compartiment principal : il renferme l'information génétique sous forme d'**ADN** associé à des protéines (la **chromatine**).
[[IMG: Schéma du noyau : double enveloppe nucléaire, pores nucléaires, chromatine et nucléole]]
- Il est entouré d'une **enveloppe nucléaire à double membrane** (interne et externe).
- Il communique avec le cytosol par des **pores nucléaires** qui régulent le passage des macromolécules (comme les ARN).
- Il contient le **nucléole**, lieu de transcription des ARNr et d'assemblage des sous-unités ribosomiques.

## Le cytoplasme
Le cytoplasme regroupe le **hyaloplasme** (fraction liquide) et le **morphoplasme** (structures figurées, c'est-à-dire les organites).
[[IMG: Schéma d'ensemble d'une cellule eucaryote animale montrant le cytoplasme et la position des principaux organites]]
### Le hyaloplasme
- **Cytosol** : liquide aqueux dans lequel baignent les organites et les complexes protéiques.
- **Cytosquelette** : réseau de filaments protéiques responsable de la forme, des mouvements et du transport interne. Il comprend les **microfilaments d'actine**, les **filaments intermédiaires** et les **microtubules**.
[!INFO] La membrane externe de l'enveloppe nucléaire est en continuité directe avec le réticulum endoplasmique.$c$,
$c$## The nucleus
The **nucleus** is the main compartment: it holds the genetic information as **DNA** bound to proteins (the **chromatin**).
[[IMG: Nucleus diagram: double nuclear envelope, nuclear pores, chromatin and nucleolus]]
- It is surrounded by a **double-membrane nuclear envelope** (inner and outer).
- It communicates with the cytosol through **nuclear pores** that control the passage of macromolecules (such as RNA).
- It contains the **nucleolus**, where rRNA is transcribed and ribosomal subunits are assembled.

## The cytoplasm
The cytoplasm gathers the **hyaloplasm** (liquid fraction) and the **morphoplasm** (the shaped structures, i.e. the organelles).
[[IMG: Overview diagram of an animal eukaryotic cell showing the cytoplasm and the position of the main organelles]]
### The hyaloplasm
- **Cytosol**: the watery liquid in which organelles and protein complexes are bathed.
- **Cytoskeleton**: a network of protein filaments responsible for shape, movement and internal transport. It includes **actin microfilaments**, **intermediate filaments** and **microtubules**.
[!INFO] The outer membrane of the nuclear envelope is directly continuous with the endoplasmic reticulum.$c$,
$c$Le noyau (double enveloppe percée de pores, chromatine, nucléole) abrite l'ADN ; le cytoplasme réunit le hyaloplasme (cytosol + cytosquelette) et les organites.$c$,
$c$The nucleus (double envelope with pores, chromatin, nucleolus) holds the DNA; the cytoplasm brings together the hyaloplasm (cytosol + cytoskeleton) and the organelles.$c$,
  array['Enveloppe nucléaire = double membrane + pores nucléaires','Nucléole = synthèse des ARNr et des sous-unités ribosomiques','Cytosquelette = microfilaments, filaments intermédiaires, microtubules'],
  array['Nuclear envelope = double membrane + nuclear pores','Nucleolus = rRNA and ribosomal subunit synthesis','Cytoskeleton = microfilaments, intermediate filaments, microtubules'],
  10, 'medium', 4, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Noyau et cytoplasme","text_fr":"Qu'est-ce que le hyaloplasme ?","text_en":"What is the hyaloplasm?","explanation_fr":"Le hyaloplasme est la fraction soluble de la cellule (cytosol) structurée par le cytosquelette.","explanation_en":"The hyaloplasm is the soluble fraction of the cell (cytosol) structured by the cytoskeleton.","options":[{"text_fr":"La membrane externe du noyau","text_en":"The outer membrane of the nucleus","is_correct":false},{"text_fr":"L'ensemble des organites","text_en":"All the organelles","is_correct":false},{"text_fr":"L'association du cytosol et du cytosquelette","text_en":"The cytosol together with the cytoskeleton","is_correct":true},{"text_fr":"Le liquide de la mitochondrie","text_en":"The fluid inside the mitochondrion","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Noyau et cytoplasme","text_fr":"Quelle proposition sur l'enveloppe nucléaire est exacte ?","text_en":"Which statement about the nuclear envelope is correct?","explanation_fr":"L'enveloppe nucléaire est un double feuillet membranaire percé de pores nucléaires assurant les échanges sélectifs.","explanation_en":"The nuclear envelope is a double membrane pierced by nuclear pores that allow selective exchange.","options":[{"text_fr":"C'est une membrane simple identique à la membrane plasmique.","text_en":"It is a single membrane identical to the plasma membrane.","is_correct":false},{"text_fr":"C'est un double feuillet membranaire percé de pores nucléaires.","text_en":"It is a double membrane pierced by nuclear pores.","is_correct":true},{"text_fr":"Elle est totalement imperméable.","text_en":"It is completely impermeable.","is_correct":false},{"text_fr":"Elle disparaît définitivement après une division.","text_en":"It disappears permanently after one division.","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Noyau et cytoplasme","text_fr":"Quelle est la fonction principale du nucléole ?","text_en":"What is the main function of the nucleolus?","explanation_fr":"Le nucléole transcrit les ARNr et assemble les sous-unités des ribosomes.","explanation_en":"The nucleolus transcribes rRNA and assembles the ribosomal subunits.","options":[{"text_fr":"Stocker les lipides de réserve","text_en":"Store reserve lipids","is_correct":false},{"text_fr":"Transcrire les ARNr et assembler les sous-unités ribosomiques","text_en":"Transcribe rRNA and assemble ribosomal subunits","is_correct":true},{"text_fr":"Traduire les ARNm en protéines","text_en":"Translate mRNA into proteins","is_correct":false},{"text_fr":"Réparer l'ADN double-brin","text_en":"Repair double-stranded DNA","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Noyau et cytoplasme","text_fr":"De quoi est constitué le noyau ?","text_en":"What is the nucleus made of?","explanation_fr":"Le noyau contient la chromatine (ADN + histones) et le nucléole, entourés de l'enveloppe nucléaire.","explanation_en":"The nucleus contains chromatin (DNA + histones) and the nucleolus, enclosed by the nuclear envelope.","options":[{"text_fr":"Uniquement de cytosol","text_en":"Cytosol only","is_correct":false},{"text_fr":"De chromatine et d'un nucléole","text_en":"Chromatin and a nucleolus","is_correct":true},{"text_fr":"De microtubules uniquement","text_en":"Microtubules only","is_correct":false},{"text_fr":"De phospholipides de réserve","text_en":"Reserve phospholipids","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'noyau-cytoplasme';

-- --- Lesson B5 : Les organites ----------------------------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'organites', 'Les organites', 'The Organelles',
  array['Associer chaque organite à sa fonction','Repérer les organites à double membrane et semi-autonomes','Distinguer cellule animale et cellule végétale'],
  array['Match each organelle to its function','Spot double-membrane and semi-autonomous organelles','Tell animal and plant cells apart'],
$c$## Les organites et leurs fonctions
Le **morphoplasme** est constitué des organites de la cellule.
[[IMG: Planche légendée des organites d'une cellule animale : mitochondrie, appareil de Golgi, RER, REL, ribosomes, lysosome, peroxysome, centrioles]]
- **Mitochondrie** : centrale énergétique (production d'ATP par la respiration cellulaire aérobie). Organite **semi-autonome** (possède son propre ADN).
- **Appareil de Golgi** : maturation, tri et emballage des protéines et lipides dans des vésicules ; formé d'empilements de saccules (dictyosomes).
- **RER (réticulum endoplasmique rugueux)** : synthèse des protéines destinées à la membrane ou à la sécrétion ; parsemé de ribosomes sur sa face cytosolique.
- **REL (réticulum endoplasmique lisse)** : synthèse des lipides (phospholipides, hormones stéroïdes) et détoxification ; dépourvu de ribosomes.
- **Ribosome** : lecture de l'ARNm et assemblage des acides aminés (la **traduction**) ; formé de deux sous-unités (ARNr + protéines).
- **Lysosome** : digestion intracellulaire ; vésicule d'enzymes hydrolytiques actives à pH acide (≈ 5).
- **Peroxysome** : détoxification ; neutralise le peroxyde d'hydrogène (H₂O₂) grâce à la catalase.
- **Centrioles / centrosome** : participent à la division cellulaire et à la formation des cils et flagelles.
[!PIEGE] RER = protéines (ribosomes visibles) ; REL = lipides (pas de ribosomes). Ne pas les inverser.

## Cellule animale ou végétale ?
En plus des organites de la cellule animale, la **cellule végétale** possède : une **paroi cellulosique** rigide, des **chloroplastes** (siège de la photosynthèse) et une grande **vacuole centrale** (turgescence).
[!APP] Une cellule présente de nombreux ribosomes fixés sur un réseau membranaire, mais aucun chloroplaste ni paroi rigide. De quel organite s'agit-il, et de quel type de cellule provient-elle ? ||| Il s'agit du **RER** (ribosomes fixés). L'absence de chloroplaste et de paroi rigide indique une **cellule animale**.$c$,
$c$## The organelles and their functions
The **morphoplasm** is made up of the cell's organelles.
[[IMG: Labelled plate of the organelles of an animal cell: mitochondrion, Golgi apparatus, RER, SER, ribosomes, lysosome, peroxisome, centrioles]]
- **Mitochondrion**: the power plant (ATP production via aerobic cellular respiration). A **semi-autonomous** organelle (it has its own DNA).
- **Golgi apparatus**: maturation, sorting and packaging of proteins and lipids into vesicles; made of stacked sacs (dictyosomes).
- **RER (rough endoplasmic reticulum)**: synthesis of proteins bound for the membrane or for secretion; studded with ribosomes on its cytosolic face.
- **SER (smooth endoplasmic reticulum)**: synthesis of lipids (phospholipids, steroid hormones) and detoxification; no ribosomes.
- **Ribosome**: reads the mRNA and assembles amino acids (**translation**); made of two subunits (rRNA + proteins).
- **Lysosome**: intracellular digestion; a vesicle of hydrolytic enzymes active at acidic pH (≈ 5).
- **Peroxisome**: detoxification; neutralises hydrogen peroxide (H₂O₂) thanks to catalase.
- **Centrioles / centrosome**: take part in cell division and in forming cilia and flagella.
[!PIEGE] RER = proteins (visible ribosomes); SER = lipids (no ribosomes). Do not swap them.

## Animal or plant cell?
In addition to the organelles of the animal cell, the **plant cell** also has: a rigid **cellulose wall**, **chloroplasts** (site of photosynthesis) and a large **central vacuole** (turgor).
[!APP] A cell shows many ribosomes attached to a membrane network, but no chloroplast and no rigid wall. Which organelle is it, and what kind of cell does it come from? ||| It is the **RER** (attached ribosomes). The lack of chloroplast and rigid wall points to an **animal cell**.$c$,
$c$Chaque organite a une fonction précise ; mitochondrie et noyau ont une double membrane, la mitochondrie est semi-autonome ; la cellule végétale ajoute paroi, chloroplastes et vacuole.$c$,
$c$Each organelle has a precise function; mitochondrion and nucleus have a double membrane, the mitochondrion is semi-autonomous; the plant cell adds a wall, chloroplasts and a vacuole.$c$,
  array['Mitochondrie = ATP, semi-autonome (ADN propre)','RER = protéines ; REL = lipides ; lysosome = digestion (pH ≈ 5)','Végétal = paroi + chloroplastes + grande vacuole'],
  array['Mitochondrion = ATP, semi-autonomous (own DNA)','RER = proteins; SER = lipids; lysosome = digestion (pH ≈ 5)','Plant = wall + chloroplasts + large vacuole'],
  12, 'medium', 5, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Organites","text_fr":"Quel organite est la « centrale énergétique » de la cellule (synthèse d'ATP) ?","text_en":"Which organelle is the cell's « power plant » (ATP synthesis)?","explanation_fr":"La mitochondrie produit l'ATP lors de la respiration cellulaire aérobie.","explanation_en":"The mitochondrion produces ATP during aerobic cellular respiration.","options":[{"text_fr":"La mitochondrie","text_en":"The mitochondrion","is_correct":true},{"text_fr":"Le lysosome","text_en":"The lysosome","is_correct":false},{"text_fr":"L'appareil de Golgi","text_en":"The Golgi apparatus","is_correct":false},{"text_fr":"Le peroxysome","text_en":"The peroxisome","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Quel organite porte des ribosomes sur sa face externe ?","text_en":"Which organelle carries ribosomes on its outer face?","explanation_fr":"Le RER doit son aspect granuleux aux ribosomes qui traduisent les protéines à sécréter ou membranaires.","explanation_en":"The RER owes its granular look to the ribosomes translating secreted or membrane proteins.","options":[{"text_fr":"Le réticulum endoplasmique lisse (REL)","text_en":"The smooth endoplasmic reticulum (SER)","is_correct":false},{"text_fr":"Le réticulum endoplasmique rugueux (RER)","text_en":"The rough endoplasmic reticulum (RER)","is_correct":true},{"text_fr":"L'appareil de Golgi","text_en":"The Golgi apparatus","is_correct":false},{"text_fr":"Le centriole","text_en":"The centriole","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Quel organite assure la digestion intracellulaire grâce à ses enzymes à pH acide ?","text_en":"Which organelle handles intracellular digestion using acidic-pH enzymes?","explanation_fr":"Les lysosomes contiennent des hydrolases acides qui dégradent les macromolécules et organites usagés.","explanation_en":"Lysosomes contain acid hydrolases that break down worn-out macromolecules and organelles.","options":[{"text_fr":"Le peroxysome","text_en":"The peroxisome","is_correct":false},{"text_fr":"Le lysosome","text_en":"The lysosome","is_correct":true},{"text_fr":"L'appareil de Golgi","text_en":"The Golgi apparatus","is_correct":false},{"text_fr":"Le ribosome","text_en":"The ribosome","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Quelle est la fonction principale de l'appareil de Golgi ?","text_en":"What is the main function of the Golgi apparatus?","explanation_fr":"Il reçoit les protéines du RER, les modifie, les trie et les emballe dans des vésicules.","explanation_en":"It receives proteins from the RER, modifies, sorts and packages them into vesicles.","options":[{"text_fr":"La synthèse des acides gras","text_en":"Fatty-acid synthesis","is_correct":false},{"text_fr":"La détoxification des radicaux libres","text_en":"Free-radical detoxification","is_correct":false},{"text_fr":"La maturation, le tri et l'emballage des protéines","text_en":"Maturation, sorting and packaging of proteins","is_correct":true},{"text_fr":"La production d'ATP","text_en":"ATP production","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Quel organite synthétise les lipides et participe à la détoxification cellulaire ?","text_en":"Which organelle synthesises lipids and takes part in cell detoxification?","explanation_fr":"Le REL est le site majeur de la synthèse lipidique et de la détoxification (cytochrome P450).","explanation_en":"The SER is the main site of lipid synthesis and detoxification (cytochrome P450).","options":[{"text_fr":"Le réticulum endoplasmique rugueux (RER)","text_en":"The rough endoplasmic reticulum (RER)","is_correct":false},{"text_fr":"Le réticulum endoplasmique lisse (REL)","text_en":"The smooth endoplasmic reticulum (SER)","is_correct":true},{"text_fr":"Le lysosome","text_en":"The lysosome","is_correct":false},{"text_fr":"Le nucléole","text_en":"The nucleolus","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Quel organite, absent de la cellule animale, capte l'énergie lumineuse chez les végétaux ?","text_en":"Which organelle, absent from animal cells, captures light energy in plants?","explanation_fr":"Les chloroplastes réalisent la photosynthèse grâce à la chlorophylle.","explanation_en":"Chloroplasts carry out photosynthesis using chlorophyll.","options":[{"text_fr":"La mitochondrie","text_en":"The mitochondrion","is_correct":false},{"text_fr":"Le lysosome","text_en":"The lysosome","is_correct":false},{"text_fr":"Le chloroplaste","text_en":"The chloroplast","is_correct":true},{"text_fr":"La vacuole","text_en":"The vacuole","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Organites","text_fr":"Parmi ces organites, lesquels possèdent une double membrane ?","text_en":"Among these organelles, which one has a double membrane?","explanation_fr":"Le noyau et la mitochondrie possèdent une double membrane ; le RE, le Golgi et le lysosome n'en ont qu'une.","explanation_en":"The nucleus and the mitochondrion have a double membrane; the ER, Golgi and lysosome have only one.","options":[{"text_fr":"L'appareil de Golgi","text_en":"The Golgi apparatus","is_correct":false},{"text_fr":"La mitochondrie","text_en":"The mitochondrion","is_correct":true},{"text_fr":"Le lysosome","text_en":"The lysosome","is_correct":false},{"text_fr":"Le réticulum endoplasmique","text_en":"The endoplasmic reticulum","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'organites';

-- --- Lesson B6 : Les acides nucléiques (ADN et ARN) -------------------------
insert into public.lessons (chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position, published)
select ch.id, 'acides-nucleiques', 'Les acides nucléiques (ADN et ARN)', 'Nucleic Acids (DNA and RNA)',
  array['Décrire la composition d''un nucléotide','Classer les bases azotées (puriques / pyrimidiques)','Énoncer la structure de l''ADN (Watson et Crick)'],
  array['Describe the make-up of a nucleotide','Classify the nitrogenous bases (purines / pyrimidines)','State the structure of DNA (Watson and Crick)'],
$c$## Nucléotides : les briques des acides nucléiques
L'**ADN** et l'**ARN** sont des polymères d'unités appelées **nucléotides**.
[[IMG: Schéma d'un nucléotide : pentose + groupement phosphate + base azotée, avec la distinction nucléoside / nucléotide]]
Un nucléotide assemble **3 éléments** :
- Un **pentose** (sucre à 5 carbones) : le ribose (ARN) ou le 2'-désoxyribose (ADN).
- Un **groupement phosphate** : relie les sucres par des liaisons **phosphodiesters**.
- Une **base azotée**.
[!PIEGE] Un **nucléoside** = sucre + base azotée (**sans** le phosphate). Ex. adénosine, cytidine. Ajoutez un phosphate et vous obtenez un nucléotide.

## Les bases azotées
- **Bases puriques** (2 cycles) : **Adénine (A)** et **Guanine (G)**.
- **Bases pyrimidiques** (1 cycle) : **Cytosine (C)**, **Thymine (T, propre à l'ADN)** et **Uracile (U, propre à l'ARN)**.

## Structure de l'ADN (Watson et Crick, 1953)
[[IMG: Schéma de la double hélice d'ADN : deux brins antiparallèles, appariements A=T (2 liaisons hydrogène) et C≡G (3 liaisons hydrogène)]]
L'ADN eucaryote est majoritairement nucléaire (sauf l'ADN mitochondrial). Il est :
- **Bicaténaire** (deux brins).
- **Hélicoïdal** (double hélice).
- **Complémentaire** : A s'apparie à T par **2 liaisons hydrogène** ; C s'apparie à G par **3 liaisons hydrogène**.
- **Antiparallèle** : un brin orienté 5'→3', l'autre 3'→5'.
[!PIEGE] Chez les eucaryotes, l'ADN n'est **jamais** libre dans le cytosol (même l'ADN mitochondrial reste dans la mitochondrie).
[!APP] Vous identifiez une molécule faite d'un ribose et d'une base uracile, mais sans groupement phosphate. Comment l'appelle-t-on, et pourquoi n'est-ce pas un nucléotide ? ||| C'est un **nucléoside** (l'uridine) : il lui manque le groupement phosphate qui caractérise un nucléotide.$c$,
$c$## Nucleotides: the building blocks of nucleic acids
**DNA** and **RNA** are polymers of units called **nucleotides**.
[[IMG: Diagram of a nucleotide: pentose + phosphate group + nitrogenous base, with the nucleoside / nucleotide distinction]]
A nucleotide combines **3 parts**:
- A **pentose** (5-carbon sugar): ribose (RNA) or 2'-deoxyribose (DNA).
- A **phosphate group**: links the sugars via **phosphodiester** bonds.
- A **nitrogenous base**.
[!PIEGE] A **nucleoside** = sugar + base (**without** the phosphate). E.g. adenosine, cytidine. Add a phosphate and you get a nucleotide.

## The nitrogenous bases
- **Purine bases** (2 rings): **Adenine (A)** and **Guanine (G)**.
- **Pyrimidine bases** (1 ring): **Cytosine (C)**, **Thymine (T, DNA-only)** and **Uracil (U, RNA-only)**.

## Structure of DNA (Watson and Crick, 1953)
[[IMG: DNA double-helix diagram: two antiparallel strands, A=T (2 hydrogen bonds) and C≡G (3 hydrogen bonds) pairings]]
Eukaryotic DNA is mostly nuclear (except mitochondrial DNA). It is:
- **Double-stranded** (two strands).
- **Helical** (double helix).
- **Complementary**: A pairs with T via **2 hydrogen bonds**; C pairs with G via **3 hydrogen bonds**.
- **Antiparallel**: one strand runs 5'→3', the other 3'→5'.
[!PIEGE] In eukaryotes, DNA is **never** free in the cytosol (even mitochondrial DNA stays inside the mitochondrion).
[!APP] You identify a molecule made of a ribose and a uracil base, but with no phosphate group. What is it called, and why is it not a nucleotide? ||| It is a **nucleoside** (uridine): it lacks the phosphate group that defines a nucleotide.$c$,
$c$Les acides nucléiques sont des polymères de nucléotides (pentose + phosphate + base) ; l'ADN est bicaténaire, hélicoïdal, complémentaire (A=T, C≡G) et antiparallèle.$c$,
$c$Nucleic acids are polymers of nucleotides (pentose + phosphate + base); DNA is double-stranded, helical, complementary (A=T, C≡G) and antiparallel.$c$,
  array['Nucléotide = pentose + phosphate + base ; nucléoside = sans phosphate','Purines A, G (2 cycles) ; pyrimidines C, T, U (1 cycle)','ADN : bicaténaire, antiparallèle, A=T (2 liaisons H), C≡G (3 liaisons H)'],
  array['Nucleotide = pentose + phosphate + base; nucleoside = no phosphate','Purines A, G (2 rings); pyrimidines C, T, U (1 ring)','DNA: double-stranded, antiparallel, A=T (2 H-bonds), C≡G (3 H-bonds)'],
  14, 'hard', 6, true
from public.chapters ch join public.subjects s on s.id = ch.subject_id
where s.slug = 'biologie' and ch.slug = 'cytologie-i'
on conflict (chapter_id, slug) do nothing;

insert into public.content_approval (lesson_id, submitted_by, status, generated_payload)
select l.id, null, 'pending', payload::jsonb
from public.lessons l join public.chapters ch on ch.id = l.chapter_id join public.subjects s on s.id = ch.subject_id
cross join (values
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Quelle base azotée est exclusive à l'ADN et absente de l'ARN ?","text_en":"Which nitrogenous base is exclusive to DNA and absent from RNA?","explanation_fr":"L'ADN contient la thymine (T) ; l'ARN la remplace par l'uracile (U).","explanation_en":"DNA contains thymine (T); RNA replaces it with uracil (U).","options":[{"text_fr":"L'adénine (A)","text_en":"Adenine (A)","is_correct":false},{"text_fr":"L'uracile (U)","text_en":"Uracil (U)","is_correct":false},{"text_fr":"La thymine (T)","text_en":"Thymine (T)","is_correct":true},{"text_fr":"La guanine (G)","text_en":"Guanine (G)","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Quel pentose entre dans la composition des nucléotides de l'ARN ?","text_en":"Which pentose is part of RNA nucleotides?","explanation_fr":"L'ARN contient du ribose ; l'ADN contient du 2'-désoxyribose.","explanation_en":"RNA contains ribose; DNA contains 2'-deoxyribose.","options":[{"text_fr":"Le glucose","text_en":"Glucose","is_correct":false},{"text_fr":"Le désoxyribose","text_en":"Deoxyribose","is_correct":false},{"text_fr":"Le ribose","text_en":"Ribose","is_correct":true},{"text_fr":"Le fructose","text_en":"Fructose","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Selon Watson et Crick, la structure de l'ADN est :","text_en":"According to Watson and Crick, the structure of DNA is:","explanation_fr":"L'ADN forme une double hélice bicaténaire dont les deux brins sont antiparallèles.","explanation_en":"DNA forms a double-stranded helix whose two strands are antiparallel.","options":[{"text_fr":"Monocaténaire et linéaire","text_en":"Single-stranded and linear","is_correct":false},{"text_fr":"Bicaténaire, hélicoïdale et antiparallèle","text_en":"Double-stranded, helical and antiparallel","is_correct":true},{"text_fr":"Circulaire et uniquement cytoplasmique","text_en":"Circular and cytoplasmic only","is_correct":false},{"text_fr":"Antiparallèle et monocaténaire","text_en":"Antiparallel and single-stranded","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Qu'est-ce qu'un nucléoside ?","text_en":"What is a nucleoside?","explanation_fr":"Un nucléoside est l'association d'un pentose et d'une base azotée ; l'ajout d'un phosphate en fait un nucléotide.","explanation_en":"A nucleoside is a pentose plus a nitrogenous base; adding a phosphate makes it a nucleotide.","options":[{"text_fr":"Un phosphate et un sucre","text_en":"A phosphate and a sugar","is_correct":false},{"text_fr":"Une base azotée et un sucre","text_en":"A nitrogenous base and a sugar","is_correct":true},{"text_fr":"Une base, un sucre et trois phosphates","text_en":"A base, a sugar and three phosphates","is_correct":false},{"text_fr":"Un polymère d'acides aminés","text_en":"A polymer of amino acids","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Quelles bases appartiennent à la famille des pyrimidines (un seul cycle) ?","text_en":"Which bases belong to the pyrimidine family (single ring)?","explanation_fr":"Les pyrimidines (un cycle) sont C, T et U ; les purines (deux cycles) sont A et G.","explanation_en":"Pyrimidines (one ring) are C, T and U; purines (two rings) are A and G.","options":[{"text_fr":"L'adénine et la guanine","text_en":"Adenine and guanine","is_correct":false},{"text_fr":"La cytosine, la thymine et l'uracile","text_en":"Cytosine, thymine and uracil","is_correct":true},{"text_fr":"L'adénine, la thymine et l'uracile","text_en":"Adenine, thymine and uracil","is_correct":false},{"text_fr":"La guanine et la cytosine","text_en":"Guanine and cytosine","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Quelle liaison unit deux nucléotides consécutifs le long d'un brin d'ADN ?","text_en":"Which bond links two consecutive nucleotides along a DNA strand?","explanation_fr":"La liaison phosphodiester unit le carbone 3' d'un pentose au carbone 5' du pentose suivant.","explanation_en":"The phosphodiester bond links the 3' carbon of one pentose to the 5' carbon of the next.","options":[{"text_fr":"Une liaison hydrogène","text_en":"A hydrogen bond","is_correct":false},{"text_fr":"Une liaison peptidique","text_en":"A peptide bond","is_correct":false},{"text_fr":"Une liaison phosphodiester","text_en":"A phosphodiester bond","is_correct":true},{"text_fr":"Une liaison ionique","text_en":"An ionic bond","is_correct":false}]}$j$),
($j${"source":"Cytologie I — Acides nucléiques","text_fr":"Que traduit la complémentarité des bases dans la double hélice d'ADN ?","text_en":"What does base complementarity mean in the DNA double helix?","explanation_fr":"A s'apparie à T par 2 liaisons hydrogène et C à G par 3 liaisons hydrogène.","explanation_en":"A pairs with T via 2 hydrogen bonds and C with G via 3 hydrogen bonds.","options":[{"text_fr":"Une purine s'apparie avec une autre purine.","text_en":"A purine pairs with another purine.","is_correct":false},{"text_fr":"L'adénine s'apparie avec la cytosine.","text_en":"Adenine pairs with cytosine.","is_correct":false},{"text_fr":"A s'apparie à T (2 liaisons H) et C à G (3 liaisons H).","text_en":"A pairs with T (2 H-bonds) and C with G (3 H-bonds).","is_correct":true},{"text_fr":"La thymine s'apparie avec l'uracile.","text_en":"Thymine pairs with uracil.","is_correct":false}]}$j$)
) as t(payload)
where s.slug = 'biologie' and ch.slug = 'cytologie-i' and l.slug = 'acides-nucleiques';
