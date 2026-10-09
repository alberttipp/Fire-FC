-- Allow source='skills_passport' on assignments (the "Train this" loop). Applied via
-- MCP 'assignments_allow_skills_passport_source' 2026-10-09.
alter table assignments drop constraint if exists assignments_source_check;
alter table assignments add constraint assignments_source_check
  check (source = any (array['coach','parent','player','autopilot','skills_passport']));
