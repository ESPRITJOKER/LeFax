-- 0010: Publish the MCQ bank directly to the student side.
--
-- Product decision (2026-07-27): rather than approving each question by hand in
-- the admin AI Review dashboard, publish every still-pending content_approval
-- row straight into live quizzes/questions/choices. This is exactly what the
-- ai-content edge function's 'approve' action does per row (find-or-create the
-- lesson's quiz, insert the question + its choices), applied in bulk here.
--
-- Idempotent: only 'pending' rows are processed, and each is flipped to
-- 'approved' as it is published, so a re-run (or a fresh db reset after 0007
-- seeds the pending rows) does nothing further.

do $$
declare
  r record;
  v_quiz_id uuid;
  v_question_id uuid;
  v_pos int;
  opt jsonb;
  c_pos int;
begin
  for r in
    select ca.id, ca.lesson_id, ca.generated_payload as p
    from public.content_approval ca
    where ca.status = 'pending' and ca.lesson_id is not null
    order by ca.created_at, ca.id
  loop
    -- Find or create the lesson's quiz.
    select q.id into v_quiz_id from public.quizzes q where q.lesson_id = r.lesson_id limit 1;
    if v_quiz_id is null then
      insert into public.quizzes (lesson_id, title_fr, title_en)
      select r.lesson_id, 'Test — ' || l.title_fr, 'Test — ' || l.title_en
      from public.lessons l where l.id = r.lesson_id
      returning id into v_quiz_id;
    end if;

    -- Append the question after any already-present ones.
    select coalesce(max(position) + 1, 0) into v_pos from public.questions where quiz_id = v_quiz_id;

    insert into public.questions (quiz_id, text_fr, text_en, explanation_fr, explanation_en, ai_generated, position)
    values (
      v_quiz_id,
      r.p->>'text_fr',
      r.p->>'text_en',
      coalesce(r.p->>'explanation_fr', ''),
      coalesce(r.p->>'explanation_en', ''),
      true,
      v_pos
    )
    returning id into v_question_id;

    -- Insert the choices in payload order.
    c_pos := 0;
    for opt in select value from jsonb_array_elements(r.p->'options')
    loop
      insert into public.choices (question_id, text_fr, text_en, is_correct, position)
      values (
        v_question_id,
        opt->>'text_fr',
        opt->>'text_en',
        coalesce((opt->>'is_correct')::boolean, false),
        c_pos
      );
      c_pos := c_pos + 1;
    end loop;

    update public.content_approval
      set status = 'approved', reviewed_at = now()
      where id = r.id;
  end loop;
end $$;
