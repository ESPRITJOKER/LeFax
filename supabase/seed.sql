-- Lefax Course — reference seed data for local/dev environments.
-- Mirrors the copy and structure of the Claude Design reference
-- (Lefax Course.dc.html / Lefax Course Admin.dc.html), extended with the
-- CDC's full 6-subject Medicine list (Biologie, Chimie, Physique,
-- Mathématiques, Français, Culture générale — the design only mocked the
-- first three as examples).
-- Run automatically by `supabase db reset`, or manually via
-- `supabase db execute -f supabase/seed.sql` once migrations are applied.

-- ---------------------------------------------------------------------------
-- Subjects (Médecine track)
-- ---------------------------------------------------------------------------
insert into public.subjects (slug, name_fr, name_en, track, position) values
  ('biologie', 'Biologie', 'Biology', 'medicine', 1),
  ('chimie', 'Chimie', 'Chemistry', 'medicine', 2),
  ('physique', 'Physique', 'Physics', 'medicine', 3),
  ('mathematiques', 'Mathématiques', 'Mathematics', 'medicine', 4),
  ('francais', 'Français', 'French', 'medicine', 5),
  ('culture-generale', 'Culture générale', 'General Knowledge', 'medicine', 6);

-- ---------------------------------------------------------------------------
-- Chapters
-- ---------------------------------------------------------------------------
insert into public.chapters (subject_id, slug, name_fr, name_en, position)
select s.id, c.slug, c.name_fr, c.name_en, c.position
from public.subjects s
join (values
  ('biologie', 'la-cellule', 'La cellule', 'The Cell', 1),
  ('biologie', 'genetique', 'Génétique', 'Genetics', 2),
  ('biologie', 'physiologie-humaine', 'Physiologie humaine', 'Human Physiology', 3),
  ('chimie', 'structure-atomique', 'Structure atomique', 'Atomic Structure', 1),
  ('chimie', 'liaisons-chimiques', 'Liaisons chimiques', 'Chemical Bonds', 2),
  ('chimie', 'reactions-chimiques', 'Réactions chimiques', 'Chemical Reactions', 3),
  ('physique', 'mecanique', 'Mécanique', 'Mechanics', 1),
  ('physique', 'electricite', 'Électricité', 'Electricity', 2),
  ('physique', 'optique', 'Optique', 'Optics', 3),
  ('mathematiques', 'analyse', 'Analyse', 'Calculus', 1),
  ('mathematiques', 'algebre', 'Algèbre', 'Algebra', 2),
  ('francais', 'comprehension-de-texte', 'Compréhension de texte', 'Reading Comprehension', 1),
  ('francais', 'grammaire-et-syntaxe', 'Grammaire et syntaxe', 'Grammar and Syntax', 2),
  ('culture-generale', 'actualite-et-societe', 'Actualité et société', 'Current Affairs and Society', 1),
  ('culture-generale', 'institutions-camerounaises', 'Institutions camerounaises', 'Cameroonian Institutions', 2)
) as c(subject_slug, slug, name_fr, name_en, position) on c.subject_slug = s.slug;

-- ---------------------------------------------------------------------------
-- Lessons — Biologie / La cellule (fully fleshed out, matches design reference)
-- ---------------------------------------------------------------------------
insert into public.lessons (
  chapter_id, slug, title_fr, title_en, objectives_fr, objectives_en,
  content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en,
  duration_minutes, difficulty, position
)
select ch.id, l.slug, l.title_fr, l.title_en, l.objectives_fr, l.objectives_en,
  l.content_fr, l.content_en, l.summary_fr, l.summary_en, l.key_points_fr, l.key_points_en,
  l.duration_minutes, l.difficulty::difficulty_level, l.position
from public.chapters ch
join public.subjects s on s.id = ch.subject_id
join (values
  (
    'biologie', 'la-cellule',
    'structure-de-la-cellule', 'Structure de la cellule', 'Cell Structure',
    array['Comprendre la cellule comme unité de base du vivant','Identifier les principaux organites','Décrire le rôle de chaque organite'],
    array['Understand the cell as the basic unit of life','Identify the main organelles','Describe the role of each organelle'],
    'La cellule est l''unité structurelle et fonctionnelle de tout être vivant. Elle est composée de différentes parties qui travaillent ensemble pour assurer la vie de l''organisme : la membrane plasmique qui délimite la cellule, le cytoplasme où se déroulent les réactions chimiques, et le noyau qui contient le matériel génétique.',
    'The cell is the structural and functional unit of all living things. It is made up of different parts that work together to sustain the life of the organism: the plasma membrane which delimits the cell, the cytoplasm where chemical reactions take place, and the nucleus which holds the genetic material.',
    'La cellule regroupe noyau, cytoplasme et membrane plasmique en une unité fonctionnelle.',
    'The cell brings together the nucleus, cytoplasm, and plasma membrane into one functional unit.',
    array['Le noyau contient l''ADN','La mitochondrie produit l''énergie','La membrane régule les échanges'],
    array['The nucleus holds DNA','The mitochondria produce energy','The membrane regulates exchange'],
    12, 'easy', 1
  ),
  (
    'biologie', 'la-cellule',
    'membrane-plasmique', 'Membrane plasmique', 'Plasma Membrane',
    array['Décrire la structure en bicouche lipidique','Comprendre la perméabilité sélective'],
    array['Describe the lipid bilayer structure','Understand selective permeability'],
    'Cette leçon couvre : Membrane plasmique. Lisez attentivement le contenu puis validez vos acquis avec le test qui suit.',
    'This lesson covers: Plasma Membrane. Read the content carefully, then check your understanding with the quiz that follows.',
    '', '', array[]::text[], array[]::text[], 10, 'easy', 2
  ),
  (
    'biologie', 'la-cellule',
    'noyau-et-organites', 'Noyau et organites', 'Nucleus and Organelles',
    array['Cartographier les organites cellulaires majeurs'],
    array['Map the major cell organelles'],
    'Cette leçon couvre : Noyau et organites. Lisez attentivement le contenu puis validez vos acquis avec le test qui suit.',
    'This lesson covers: Nucleus and Organelles. Read the content carefully, then check your understanding with the quiz that follows.',
    '', '', array[]::text[], array[]::text[], 14, 'medium', 3
  ),
  (
    'biologie', 'la-cellule',
    'division-cellulaire', 'Division cellulaire', 'Cell Division',
    array['Distinguer mitose et méiose'],
    array['Distinguish mitosis and meiosis'],
    'Cette leçon couvre : Division cellulaire. Lisez attentivement le contenu puis validez vos acquis avec le test qui suit.',
    'This lesson covers: Cell Division. Read the content carefully, then check your understanding with the quiz that follows.',
    '', '', array[]::text[], array[]::text[], 15, 'medium', 4
  ),
  (
    'biologie', 'la-cellule',
    'transport-cellulaire', 'Transport cellulaire', 'Cellular Transport',
    array['Comprendre diffusion, osmose et transport actif'],
    array['Understand diffusion, osmosis, and active transport'],
    'Cette leçon couvre : Transport cellulaire. Lisez attentivement le contenu puis validez vos acquis avec le test qui suit.',
    'This lesson covers: Cellular Transport. Read the content carefully, then check your understanding with the quiz that follows.',
    '', '', array[]::text[], array[]::text[], 12, 'hard', 5
  )
) as l(subject_slug, chapter_slug, slug, title_fr, title_en, objectives_fr, objectives_en, content_fr, content_en, summary_fr, summary_en, key_points_fr, key_points_en, duration_minutes, difficulty, position)
  on l.subject_slug = s.slug and l.chapter_slug = ch.slug;

-- ---------------------------------------------------------------------------
-- Quiz for "Structure de la cellule" (the 10 questions from the design reference)
-- ---------------------------------------------------------------------------
with target_lesson as (
  select l.id from public.lessons l
  join public.chapters ch on ch.id = l.chapter_id
  join public.subjects s on s.id = ch.subject_id
  where s.slug = 'biologie' and ch.slug = 'la-cellule' and l.slug = 'structure-de-la-cellule'
),
new_quiz as (
  insert into public.quizzes (lesson_id, title_fr, title_en, difficulty, passing_score)
  select id, 'Test — Structure de la cellule', 'Test — Cell Structure', 'easy', 50 from target_lesson
  returning id
),
q as (
  insert into public.questions (quiz_id, text_fr, text_en, explanation_fr, explanation_en, difficulty, position)
  select nq.id, v.text_fr, v.text_en, v.explanation_fr, v.explanation_en, 'easy', v.position
  from new_quiz nq, (values
    ('Quelle partie de la cellule contient le matériel génétique ?', 'Which part of the cell contains the genetic material?', 'Le noyau renferme l''ADN sous forme de chromatine.', 'The nucleus holds DNA in the form of chromatin.', 1),
    ('Quel organite produit l''énergie (ATP) ?', 'Which organelle produces energy (ATP)?', 'La mitochondrie est le site de la respiration cellulaire.', 'The mitochondria is the site of cellular respiration.', 2),
    ('La membrane plasmique est principalement composée de :', 'The plasma membrane is mainly made of:', 'Une bicouche de phospholipides forme la membrane.', 'A phospholipid bilayer forms the membrane.', 3),
    ('Quel organite synthétise les protéines ?', 'Which organelle synthesizes proteins?', 'Les ribosomes traduisent l''ARNm en protéines.', 'Ribosomes translate mRNA into proteins.', 4),
    ('Le réticulum endoplasmique lisse est impliqué dans :', 'The smooth ER is involved in:', 'Le REL synthétise les lipides et détoxifie la cellule.', 'The smooth ER synthesizes lipids and detoxifies the cell.', 5),
    ('Quel organite dégrade les déchets cellulaires ?', 'Which organelle breaks down cellular waste?', 'Le lysosome contient des enzymes digestives.', 'The lysosome contains digestive enzymes.', 6),
    ('Les cellules procaryotes se distinguent des eucaryotes par :', 'Prokaryotic cells differ from eukaryotic cells by:', 'Les procaryotes n''ont pas de noyau délimité par une membrane.', 'Prokaryotes lack a membrane-bound nucleus.', 7),
    ('Quel est le rôle principal de l''appareil de Golgi ?', 'What is the main role of the Golgi apparatus?', 'Il modifie, trie et exporte les protéines.', 'It modifies, sorts, and exports proteins.', 8),
    ('Le cytosquelette est composé de :', 'The cytoskeleton is made of:', 'Microtubules et microfilaments soutiennent la cellule.', 'Microtubules and microfilaments support the cell.', 9),
    ('La mitose produit :', 'Mitotic division produces:', 'Deux cellules filles génétiquement identiques.', 'Two genetically identical daughter cells.', 10)
  ) as v(text_fr, text_en, explanation_fr, explanation_en, position)
  returning id, position
)
insert into public.choices (question_id, text_fr, text_en, is_correct, position)
select q.id, c.text_fr, c.text_en, c.is_correct, c.position
from q
join (values
  (1, 'Ribosome', 'Ribosome', false, 1),
  (1, 'Membrane plasmique', 'Plasma membrane', false, 2),
  (1, 'Noyau', 'Nucleus', true, 3),
  (1, 'Mitochondrie', 'Mitochondria', false, 4),
  (2, 'Appareil de Golgi', 'Golgi apparatus', false, 1),
  (2, 'Mitochondrie', 'Mitochondria', true, 2),
  (2, 'Lysosome', 'Lysosome', false, 3),
  (2, 'Ribosome', 'Ribosome', false, 4),
  (3, 'Cellulose', 'Cellulose', false, 1),
  (3, 'Phospholipides', 'Phospholipids', true, 2),
  (3, 'Amidon', 'Starch', false, 3),
  (3, 'Chitine', 'Chitin', false, 4),
  (4, 'Ribosome', 'Ribosome', true, 1),
  (4, 'Lysosome', 'Lysosome', false, 2),
  (4, 'Vacuole', 'Vacuole', false, 3),
  (4, 'Peroxysome', 'Peroxisome', false, 4),
  (5, 'La synthèse des lipides', 'Lipid synthesis', true, 1),
  (5, 'La digestion cellulaire', 'Cell digestion', false, 2),
  (5, 'La division cellulaire', 'Cell division', false, 3),
  (5, 'Le stockage de l''ADN', 'DNA storage', false, 4),
  (6, 'Lysosome', 'Lysosome', true, 1),
  (6, 'Ribosome', 'Ribosome', false, 2),
  (6, 'Noyau', 'Nucleus', false, 3),
  (6, 'Chloroplaste', 'Chloroplast', false, 4),
  (7, 'L''absence de noyau délimité', 'Absence of a defined nucleus', true, 1),
  (7, 'La présence de mitochondries', 'Presence of mitochondria', false, 2),
  (7, 'Une membrane plasmique', 'A plasma membrane', false, 3),
  (7, 'La présence de ribosomes', 'Presence of ribosomes', false, 4),
  (8, 'Produire de l''énergie', 'Produce energy', false, 1),
  (8, 'Modifier et exporter les protéines', 'Modify and export proteins', true, 2),
  (8, 'Stocker l''ADN', 'Store DNA', false, 3),
  (8, 'Digérer les lipides', 'Digest lipids', false, 4),
  (9, 'Microtubules et microfilaments', 'Microtubules and microfilaments', true, 1),
  (9, 'Ribosomes', 'Ribosomes', false, 2),
  (9, 'Phospholipides', 'Phospholipids', false, 3),
  (9, 'Chromosomes', 'Chromosomes', false, 4),
  (10, 'Des cellules haploïdes', 'Haploid cells', false, 1),
  (10, 'Deux cellules filles identiques', 'Two identical daughter cells', true, 2),
  (10, 'Quatre gamètes', 'Four gametes', false, 3),
  (10, 'Une seule grande cellule', 'One large cell', false, 4)
) as c(qpos, text_fr, text_en, is_correct, position) on c.qpos = q.position;

-- ---------------------------------------------------------------------------
-- FaxCoin shop items
-- ---------------------------------------------------------------------------
insert into public.shop_items (key, name_fr, name_en, price_coins, item_type, is_limited, stock_remaining) values
  ('past-paper-2023', 'Sujet Médecine 2023', '2023 Medicine Past Paper', 25, 'past_paper', true, 500),
  ('past-paper-2022', 'Sujet Médecine 2022', '2022 Medicine Past Paper', 25, 'past_paper', true, 500),
  ('past-paper-2021', 'Sujet Médecine 2021', '2021 Medicine Past Paper', 20, 'past_paper', true, 500),
  ('correction-chimie', 'Corrigé détaillé Chimie', 'Detailed Chemistry Correction', 15, 'correction', true, 500),
  ('past-paper-2020', 'Sujet Médecine 2020', '2020 Medicine Past Paper', 20, 'past_paper', true, 500),
  ('correction-physique', 'Corrigé détaillé Physique', 'Detailed Physics Correction', 15, 'correction', true, 500);

-- ---------------------------------------------------------------------------
-- Daily engagement tasks (CDC 6.6)
-- ---------------------------------------------------------------------------
insert into public.daily_tasks (key, label_fr, label_en, reward_coins, sort_order) values
  ('follow_facebook', 'Suivre notre page Facebook', 'Follow our Facebook page', 5, 1),
  ('follow_instagram', 'Suivre notre compte Instagram', 'Follow our Instagram account', 5, 2),
  ('follow_tiktok', 'Suivre notre compte TikTok', 'Follow our TikTok account', 5, 3),
  ('follow_linkedin', 'Suivre notre page LinkedIn', 'Follow our LinkedIn page', 3, 4),
  ('subscribe_youtube', 'S''abonner à notre chaîne YouTube', 'Subscribe to our YouTube channel', 5, 5),
  ('like_post', 'Aimer la publication du jour', 'Like today''s post', 3, 6),
  ('comment_post', 'Commenter la publication du jour', 'Comment on today''s post', 5, 7),
  ('share_post', 'Partager la publication du jour', 'Share today''s post', 5, 8),
  ('invite_friend', 'Inviter un ami', 'Invite a friend', 10, 9),
  ('rate_app', 'Noter l''application', 'Rate the app', 5, 10),
  ('survey', 'Répondre au sondage du jour', 'Answer today''s survey', 3, 11);

-- ---------------------------------------------------------------------------
-- Badges
-- ---------------------------------------------------------------------------
insert into public.badges (key, name_fr, name_en, description_fr, description_en, icon) values
  ('cell-expert', 'Expert Cellule', 'Cell Expert', 'Score parfait sur le chapitre La cellule', 'Perfect score on The Cell chapter', 'medal'),
  ('streak-7', 'Série de 7 jours', '7-Day Streak', '7 jours de connexion consécutifs', '7 consecutive days logged in', 'flame'),
  ('mock-finisher', 'Finisseur de concours blanc', 'Mock Exam Finisher', 'A complété un concours blanc', 'Completed a mock exam', 'trophy');

-- ---------------------------------------------------------------------------
-- Global settings (quotas / limits — CDC 6.6, 6.5)
-- ---------------------------------------------------------------------------
insert into public.settings (key, value) values
  ('daily_tasks_rewarded_limit', '5'),
  ('shop_unlock_rarity_enabled', 'true'),
  ('otp_max_attempts', '5');

-- ---------------------------------------------------------------------------
-- Example scheduled mock exam
-- ---------------------------------------------------------------------------
insert into public.mock_exams (title_fr, title_en, opens_at, closes_at, duration_minutes, question_count, passing_score, instructions_fr, instructions_en, status)
values (
  'Concours blanc hebdomadaire', 'Weekly mock exam',
  now() + interval '3 days', now() + interval '3 days 3 hours',
  180, 60, 50,
  array['Assurez-vous d''avoir une connexion stable','Aucune pause n''est autorisée pendant l''épreuve','Les résultats sont publiés immédiatement après correction'],
  array['Make sure you have a stable connection','No pauses are allowed during the exam','Results are published right after grading'],
  'scheduled'
);
