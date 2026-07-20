-- Minimal realistic sample content under Médecine so the new read-heavy
-- student screens (lesson viewer, QCM practice, exam leaderboard, FaxCoins
-- store, diagnostic test) can be verified end-to-end against real data
-- instead of only an empty state. Not production content — a seed fixture.

insert into subjects (id, branch_id, name, order_index)
select gen_random_uuid(), b.id, 'Biologie Cellulaire', 1
from branches b
where b.slug = 'medecine'
  and not exists (select 1 from subjects s where s.branch_id = b.id and s.name = 'Biologie Cellulaire');

insert into chapters (id, subject_id, name, order_index)
select gen_random_uuid(), s.id, 'Division Cellulaire', 1
from subjects s
where s.name = 'Biologie Cellulaire'
  and not exists (select 1 from chapters c where c.subject_id = s.id and c.name = 'Division Cellulaire');

insert into lessons (id, chapter_id, title, is_published, order_index, estimated_minutes)
select gen_random_uuid(), c.id, 'Mitose et Méiose', true, 1, 15
from chapters c
where c.name = 'Division Cellulaire'
  and not exists (select 1 from lessons l where l.chapter_id = c.id and l.title = 'Mitose et Méiose');

insert into lesson_cards (id, lesson_id, card_type, text_content, order_index, is_published)
select gen_random_uuid(), l.id, 'text',
  'La mitose est le processus par lequel une cellule mère se divise pour produire deux cellules filles génétiquement identiques.',
  1, true
from lessons l
where l.title = 'Mitose et Méiose'
  and not exists (select 1 from lesson_cards lc where lc.lesson_id = l.id and lc.order_index = 1);

insert into lesson_cards (id, lesson_id, card_type, text_content, order_index, is_published)
select gen_random_uuid(), l.id, 'text',
  'Prophase : la chromatine se condense en chromosomes visibles, l''enveloppe nucléaire commence à se désagréger.',
  2, true
from lessons l
where l.title = 'Mitose et Méiose'
  and not exists (select 1 from lesson_cards lc where lc.lesson_id = l.id and lc.order_index = 2);

insert into lesson_cards (id, lesson_id, card_type, text_content, order_index, is_published)
select gen_random_uuid(), l.id, 'text',
  'Métaphase : les chromosomes s''alignent sur la plaque équatoriale de la cellule.',
  3, true
from lessons l
where l.title = 'Mitose et Méiose'
  and not exists (select 1 from lesson_cards lc where lc.lesson_id = l.id and lc.order_index = 3);

insert into lesson_cards (id, lesson_id, card_type, text_content, order_index, is_published)
select gen_random_uuid(), l.id, 'text',
  'Anaphase et Télophase : les chromatides sœurs se séparent puis deux noyaux distincts se reforment.',
  4, true
from lessons l
where l.title = 'Mitose et Méiose'
  and not exists (select 1 from lesson_cards lc where lc.lesson_id = l.id and lc.order_index = 4);

-- QCMs: 3 easy, 2 intermediate, 1 hard
insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'Combien de cellules filles produit une mitose ?',
  '[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"3"},{"id":"d","text":"4"}]'::jsonb,
  'b', 'La mitose produit deux cellules filles génétiquement identiques à la cellule mère.', 'easy', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'Combien de cellules filles produit une mitose ?');

insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'Durant quelle phase les chromosomes s''alignent-ils sur la plaque équatoriale ?',
  '[{"id":"a","text":"Prophase"},{"id":"b","text":"Métaphase"},{"id":"c","text":"Anaphase"},{"id":"d","text":"Télophase"}]'::jsonb,
  'b', 'C''est la définition même de la métaphase.', 'easy', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'Durant quelle phase les chromosomes s''alignent-ils sur la plaque équatoriale ?');

insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'Quelle structure commence à se désagréger en prophase ?',
  '[{"id":"a","text":"La membrane plasmique"},{"id":"b","text":"L''enveloppe nucléaire"},{"id":"c","text":"Le cytosquelette"},{"id":"d","text":"La paroi cellulaire"}]'::jsonb,
  'b', 'L''enveloppe nucléaire se désagrège pour permettre aux chromosomes de migrer.', 'easy', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'Quelle structure commence à se désagréger en prophase ?');

insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'Que deviennent les chromatides sœurs en anaphase ?',
  '[{"id":"a","text":"Elles fusionnent"},{"id":"b","text":"Elles se séparent"},{"id":"c","text":"Elles se dupliquent"},{"id":"d","text":"Elles disparaissent"}]'::jsonb,
  'b', 'Les chromatides sœurs se séparent et migrent vers les pôles opposés de la cellule.', 'intermediate', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'Que deviennent les chromatides sœurs en anaphase ?');

insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'En quoi la méiose diffère-t-elle fondamentalement de la mitose ?',
  '[{"id":"a","text":"Elle produit des cellules diploïdes"},{"id":"b","text":"Elle produit 4 cellules haploïdes"},{"id":"c","text":"Elle ne concerne que les cellules somatiques"},{"id":"d","text":"Elle ne comporte qu''une seule division"}]'::jsonb,
  'b', 'La méiose comporte deux divisions successives et produit 4 cellules haploïdes (gamètes).', 'intermediate', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'En quoi la méiose diffère-t-elle fondamentalement de la mitose ?');

insert into qcms (id, lesson_id, question, options, correct_option_id, explanation, difficulty, is_published)
select gen_random_uuid(), l.id,
  'Le crossing-over (enjambement) se produit durant quelle étape de la méiose ?',
  '[{"id":"a","text":"Prophase I"},{"id":"b","text":"Métaphase II"},{"id":"c","text":"Anaphase I"},{"id":"d","text":"Télophase II"}]'::jsonb,
  'a', 'Le crossing-over a lieu en prophase I, entre chromosomes homologues appariés, et génère la diversité génétique.', 'hard', true
from lessons l where l.title = 'Mitose et Méiose'
  and not exists (select 1 from qcms q where q.lesson_id = l.id and q.question = 'Le crossing-over (enjambement) se produit durant quelle étape de la méiose ?');

-- One past paper (premium tier, unlockable with FaxCoins)
insert into past_papers (id, branch_id, subject_id, title, school_name, year, paper_url, correction_text, access_tier, unlock_price_coins, is_published)
select gen_random_uuid(), b.id, s.id,
  'Concours FMSB 2024 — Biologie Cellulaire',
  'FMSB', 2024,
  'https://example.com/sample-past-paper.pdf',
  'Corrigé complet disponible après débloquage.',
  'premium', 20, true
from branches b
join subjects s on s.branch_id = b.id and s.name = 'Biologie Cellulaire'
where b.slug = 'medecine'
  and not exists (select 1 from past_papers p where p.title = 'Concours FMSB 2024 — Biologie Cellulaire');

-- One mock exam, currently open (opens 1h ago, 2h duration) so the exam
-- flow and leaderboard can be exercised without waiting.
insert into mock_exams (id, branch_id, title, opens_at, closes_at, duration_seconds, questions, status)
select gen_random_uuid(), b.id, 'Concours Blanc Médecine — Semaine 1',
  now() - interval '1 hour', now() + interval '1 hour', 7200,
  (select coalesce(jsonb_agg(q.id), '[]'::jsonb) from qcms q join lessons l on l.id = q.lesson_id where l.title = 'Mitose et Méiose'),
  'open'
from branches b
where b.slug = 'medecine'
  and not exists (select 1 from mock_exams m where m.title = 'Concours Blanc Médecine — Semaine 1');

-- Diagnostic test questions (4 across the one seeded subject)
insert into diagnostic_questions (id, branch_id, subject_id, question, options, correct_option_id, order_index)
select gen_random_uuid(), b.id, s.id,
  'Quel organite est responsable de la production d''énergie (ATP) dans la cellule ?',
  '[{"id":"a","text":"Le noyau"},{"id":"b","text":"La mitochondrie"},{"id":"c","text":"Le ribosome"},{"id":"d","text":"L''appareil de Golgi"}]'::jsonb,
  'b', 1
from branches b join subjects s on s.branch_id = b.id and s.name = 'Biologie Cellulaire'
where b.slug = 'medecine'
  and not exists (select 1 from diagnostic_questions dq where dq.subject_id = s.id and dq.order_index = 1);

insert into diagnostic_questions (id, branch_id, subject_id, question, options, correct_option_id, order_index)
select gen_random_uuid(), b.id, s.id,
  'La mitose produit combien de cellules filles ?',
  '[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"3"},{"id":"d","text":"4"}]'::jsonb,
  'b', 2
from branches b join subjects s on s.branch_id = b.id and s.name = 'Biologie Cellulaire'
where b.slug = 'medecine'
  and not exists (select 1 from diagnostic_questions dq where dq.subject_id = s.id and dq.order_index = 2);

insert into diagnostic_questions (id, branch_id, subject_id, question, options, correct_option_id, order_index)
select gen_random_uuid(), b.id, s.id,
  'Quelle molécule porte l''information génétique ?',
  '[{"id":"a","text":"ARN messager"},{"id":"b","text":"ADN"},{"id":"c","text":"Protéine"},{"id":"d","text":"Lipide"}]'::jsonb,
  'b', 3
from branches b join subjects s on s.branch_id = b.id and s.name = 'Biologie Cellulaire'
where b.slug = 'medecine'
  and not exists (select 1 from diagnostic_questions dq where dq.subject_id = s.id and dq.order_index = 3);

insert into diagnostic_questions (id, branch_id, subject_id, question, options, correct_option_id, order_index)
select gen_random_uuid(), b.id, s.id,
  'Le crossing-over survient durant quel processus ?',
  '[{"id":"a","text":"La mitose"},{"id":"b","text":"La méiose"},{"id":"c","text":"La glycolyse"},{"id":"d","text":"La phagocytose"}]'::jsonb,
  'b', 4
from branches b join subjects s on s.branch_id = b.id and s.name = 'Biologie Cellulaire'
where b.slug = 'medecine'
  and not exists (select 1 from diagnostic_questions dq where dq.subject_id = s.id and dq.order_index = 4);
