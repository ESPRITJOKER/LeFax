-- The teacher submit-for-review endpoint upserts on (content_type,
-- content_id) so re-submitting the same rejected item updates the existing
-- review row instead of creating a duplicate — but no unique constraint
-- backed that, so every upsert failed with 42P10.
alter table content_reviews
  add constraint content_reviews_content_type_content_id_key unique (content_type, content_id);
