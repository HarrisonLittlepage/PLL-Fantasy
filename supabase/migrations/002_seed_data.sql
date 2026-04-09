-- supabase/migrations/002_seed_data.sql
-- Run this AFTER 001_initial.sql
-- Inserts all PLL players and the default 10-week schedule + 2 playoff weeks

-- ── PLAYERS ───────────────────────────────────────────────────────────────────
insert into public.players (name, position, pll_team, avg_pts) values
('Jeff Teat','A','New York Atlas',38),
('Xander Dickson','A','New York Atlas',45),
('Connor Shellenberger','A','New York Atlas',36),
('Ryan Brown','A','Boston Cannons',30),
('Pat Kavanagh','A','Boston Cannons',33),
('Matt Campbell','A','Boston Cannons',29),
('Grant Ament','A','Utah Archers',40),
('Peter Baum','A','Utah Archers',32),
('Dylan Molloy','A','Carolina Chaos',30),
('Miles Thompson','A','Carolina Chaos',28),
('Jack Concannon','A','Denver Outlaws',31),
('Wesley Berg','A','Philadelphia Waterdogs',35),
('Zed Williams','A','Maryland Whipsnakes',29),
('Will Manny','A','California Redwoods',26),
('Curtis Dickson','A','Denver Outlaws',27),
('Tom Schreiber','M','Denver Outlaws',34),
('Lyle Thompson','M','Carolina Chaos',36),
('Paul Rabil','M','Boston Cannons',30),
('Rob Pannell','M','California Redwoods',28),
('Jules Heningburg','M','New York Atlas',24),
('Kieran McArdle','M','Maryland Whipsnakes',26),
('Brad Smith','M','Philadelphia Waterdogs',20),
('Josh Byrne','M','Boston Cannons',22),
('Jake Bernhardt','M','Maryland Whipsnakes',19),
('Dox Aitken','M','Utah Archers',22),
('Chris Pickel','D','Maryland Whipsnakes',18),
('Joe Nardella','D','Carolina Chaos',15),
('Matt Dunn','D','Boston Cannons',16),
('Ryan Drenner','D','New York Atlas',14),
('Max Epple','D','Boston Cannons',17),
('Tim Muller','D','Utah Archers',13),
('Dylan Foulds','D','Denver Outlaws',12),
('John Sexton','D','California Redwoods',14),
('Cam Wyers','D','New York Atlas',15),
('Jeremy Guiel','D','Philadelphia Waterdogs',11),
('Nick Mariano','SSDM','Maryland Whipsnakes',22),
('Connor Martin','SSDM','Boston Cannons',19),
('Drew Simoneau','SSDM','Denver Outlaws',17),
('TD Ierlan','FO','New York Atlas',34),
('Jerome Thompson','FO','Maryland Whipsnakes',30),
('John Seymour','FO','Boston Cannons',26),
('Mikey Wynne','FO','Denver Outlaws',22),
('Chris Aslanian','FO','Philadelphia Waterdogs',20),
('Connor Kirst','G','Boston Cannons',28),
('Alex Rode','G','New York Atlas',22),
('Pat Harbeson','G','Maryland Whipsnakes',20),
('Jack Kelly','G','California Redwoods',18),
('Drew Adams','G','Carolina Chaos',16),
('Matt Russell','G','Denver Outlaws',14),
('Kyle Bernlohr','G','Utah Archers',24);

-- ── FANTASY TEAMS ─────────────────────────────────────────────────────────────
-- You'll replace these with your real team names after creating user accounts
-- The commissioner assigns users to teams via the Commissioner > Manage Users panel
insert into public.fantasy_teams (name, owner_name, icon) values
('Team 1','Owner 1','⚡'),
('Team 2','Owner 2','🔥'),
('Team 3','Owner 3','🦅'),
('Team 4','Owner 4','👑'),
('Team 5','Owner 5','🎯'),
('Team 6','Owner 6','💥');

-- ── WEEK SCHEDULE ─────────────────────────────────────────────────────────────
-- 10 regular season weeks. Weeks 11-12 are playoffs (matchups generated dynamically from standings).
-- bye_team_id and double_team_id reference fantasy_teams.id (1-6)
-- Update these IDs after you create your real teams above (they'll get IDs 1-6 in order)
insert into public.week_schedule (week, week_type, bye_team_id, double_team_id) values
(1, 'regular', null, null),
(2, 'regular', null, null),
(3, 'regular', 3, 4),   -- Team 3 on bye, Team 4 double-header
(4, 'regular', null, null),
(5, 'regular', 6, 1),   -- Team 6 on bye, Team 1 double-header
(6, 'regular', null, null),
(7, 'regular', null, null),
(8, 'regular', null, null),
(9, 'regular', 2, 5),   -- Team 2 on bye, Team 5 double-header
(10, 'regular', null, null),
(11, 'playoffs', null, null),
(12, 'playoffs', null, null);

-- Update playoff labels
update public.week_schedule set playoff_label = 'Semifinals' where week = 11;
update public.week_schedule set playoff_label = 'Championship' where week = 12;

-- ── MATCHUPS (Regular Season) ─────────────────────────────────────────────────
-- Round-robin schedule for 6 teams. Adjust team IDs to match your fantasy_teams rows.
-- These assume teams have IDs 1-6. If your IDs differ after insert, update accordingly.
insert into public.matchups (week, home_team_id, away_team_id) values
-- Week 1
(1, 1, 2), (1, 3, 4), (1, 5, 6),
-- Week 2
(2, 1, 3), (2, 2, 5), (2, 4, 6),
-- Week 3 (Team 3 bye, Team 4 double-header)
(3, 1, 2), (3, 4, 5), (3, 4, 6),
-- Week 4
(4, 1, 4), (4, 2, 3), (4, 5, 6),
-- Week 5 (Team 6 bye, Team 1 double-header)
(5, 1, 2), (5, 3, 4), (5, 1, 5),
-- Week 6
(6, 1, 2), (6, 3, 5), (6, 4, 6),
-- Week 7
(7, 1, 3), (7, 2, 6), (7, 4, 5),
-- Week 8
(8, 1, 5), (8, 2, 4), (8, 3, 6),
-- Week 9 (Team 2 bye, Team 5 double-header)
(9, 1, 3), (9, 5, 4), (9, 5, 6),
-- Week 10
(10, 1, 6), (10, 2, 5), (10, 3, 4);
