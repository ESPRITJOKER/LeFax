-- Seed the 6 CDC branches (only Médecine active at launch, WEB-E02) and the
-- target-school display metadata shown on the onboarding screen.

insert into branches (slug, name, description, is_active, order_index) values
  ('medecine', 'Médecine', 'FMSB et facultés de médecine', true, 1),
  ('ingenierie', 'Ingénierie', 'Polytechnique, ENSP, ENSTP', false, 2),
  ('agronomie', 'Agronomie', 'FASA et écoles d''agronomie', false, 3),
  ('management', 'Management', 'ESSEC, ENAM et écoles de management', false, 4),
  ('infirmerie', 'Infirmerie', 'IDE et écoles paramédicales', false, 5),
  ('enseignement', 'Enseignement', 'ENS et ENSET', false, 6)
on conflict (slug) do nothing;

insert into target_schools (branch_id, name, subtitle, icon, order_index)
select b.id, s.name, s.subtitle, s.icon, s.order_index
from (values
  ('medecine', 'FMSB', 'Faculté de Médecine et des Sciences Biomédicales', 'medical_services', 1),
  ('ingenierie', 'Polytechnique', 'École Nationale Supérieure Polytechnique', 'engineering', 1),
  ('ingenierie', 'ENSP', 'École Nationale Supérieure Polytechnique de Yaoundé', 'precision_manufacturing', 2),
  ('agronomie', 'FASA', 'Faculté d''Agronomie et des Sciences Agricoles', 'agriculture', 1),
  ('management', 'ENAM', 'École Nationale d''Administration et de Magistrature', 'account_balance', 1),
  ('infirmerie', 'IDE', 'Institut de Formation en Soins Infirmiers', 'health_and_safety', 1),
  ('enseignement', 'ENS', 'École Normale Supérieure', 'school', 1)
) as s(branch_slug, name, subtitle, icon, order_index)
join branches b on b.slug = s.branch_slug::branch_slug_enum
on conflict do nothing;
