-- Seçilen film, dizi, oyun, takım, şarkı ve sanatçı artık kapak görseliyle tutulur.
ALTER TABLE "user_profiles" ADD COLUMN "watched_json" JSONB;
ALTER TABLE "user_profiles" ADD COLUMN "movies_json" JSONB;
ALTER TABLE "user_profiles" ADD COLUMN "teams_json" JSONB;
ALTER TABLE "user_profiles" ADD COLUMN "games_json" JSONB;
ALTER TABLE "user_profiles" ADD COLUMN "songs_json" JSONB;
ALTER TABLE "user_profiles" ADD COLUMN "artists_json" JSONB;

UPDATE "user_profiles" AS profile
SET
  "watched_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."watched") AS elem), '[]'::jsonb),
  "movies_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."movies") AS elem), '[]'::jsonb),
  "teams_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."teams") AS elem), '[]'::jsonb),
  "games_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."games") AS elem), '[]'::jsonb),
  "songs_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."songs") AS elem), '[]'::jsonb),
  "artists_json" = COALESCE((SELECT jsonb_agg(jsonb_build_object('title', elem, 'imageUrl', NULL)) FROM unnest(profile."artists") AS elem), '[]'::jsonb);

ALTER TABLE "user_profiles" DROP COLUMN "watched";
ALTER TABLE "user_profiles" DROP COLUMN "movies";
ALTER TABLE "user_profiles" DROP COLUMN "teams";
ALTER TABLE "user_profiles" DROP COLUMN "games";
ALTER TABLE "user_profiles" DROP COLUMN "songs";
ALTER TABLE "user_profiles" DROP COLUMN "artists";

ALTER TABLE "user_profiles" RENAME COLUMN "watched_json" TO "watched";
ALTER TABLE "user_profiles" RENAME COLUMN "movies_json" TO "movies";
ALTER TABLE "user_profiles" RENAME COLUMN "teams_json" TO "teams";
ALTER TABLE "user_profiles" RENAME COLUMN "games_json" TO "games";
ALTER TABLE "user_profiles" RENAME COLUMN "songs_json" TO "songs";
ALTER TABLE "user_profiles" RENAME COLUMN "artists_json" TO "artists";

ALTER TABLE "user_profiles"
  ALTER COLUMN "watched" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "watched" SET NOT NULL,
  ALTER COLUMN "movies" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "movies" SET NOT NULL,
  ALTER COLUMN "teams" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "teams" SET NOT NULL,
  ALTER COLUMN "games" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "games" SET NOT NULL,
  ALTER COLUMN "songs" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "songs" SET NOT NULL,
  ALTER COLUMN "artists" SET DEFAULT '[]'::jsonb,
  ALTER COLUMN "artists" SET NOT NULL;
