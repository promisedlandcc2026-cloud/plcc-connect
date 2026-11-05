# Requirements Document

## Introduction

This feature defines the Standard Operating Procedure (SOP) for church administrators and pastors at Promised Land Christian Center (PLCC) to manage sermon data in Supabase so that the PLCC Connect app displays current, accurate sermon content. The SOP covers adding new sermons, updating existing sermons, and structuring the fill-in-the-blank outline format that appears in the Message Guide section of the app.

The `sermons` table in Supabase is the single source of truth for the SermonNotes component. When the table is empty or no record exists for the current date, the app falls back to a static placeholder. This SOP ensures non-technical staff can confidently manage that data without developer assistance.

## Glossary

- **Admin**: A church staff member or pastor authorized to access the Supabase dashboard and manage sermon data.
- **Supabase Dashboard**: The web-based interface at supabase.com where the Admin manages database records.
- **sermons Table**: The Supabase database table that stores all sermon records for the PLCC Connect app.
- **Outline**: A JSON array of sermon points stored in the `outline` column, each containing a fill-in-the-blank sentence and its answer.
- **OutlinePoint**: A single object within the Outline array with fields `id`, `text`, and `missingWord`.
- **Fill-in-the-Blank**: A sermon outline sentence where `________` (eight underscores) marks the word the congregation must supply.
- **missingWord**: The correct answer for a fill-in-the-blank point; used by the app to verify the congregation member's input.
- **SermonNotes Component**: The React component in the PLCC Connect app that fetches and displays the latest sermon from Supabase.
- **Latest Sermon**: The sermon record with the most recent `date` value that is on or before today's date, as determined by the app's query (`ORDER BY date DESC LIMIT 1`).

---

## Requirements

### Requirement 1: Sermon Record Structure

**User Story:** As an Admin, I want to know exactly which fields are required for a sermon record, so that I can enter data correctly and the app displays it without errors.

#### Acceptance Criteria

1. THE Admin SHALL populate all of the following columns when inserting a new sermon record: `title`, `scripture`, `book`, `version`, `speaker`, `date`, `outline`.
2. THE `date` column SHALL be entered in `YYYY-MM-DD` format (e.g., `2025-06-22`).
3. THE `scripture` column SHALL contain the verse reference only (e.g., `John 3:16` or `Psalm 23:1-3`), not the verse text.
4. THE `book` column SHALL contain the full book name matching the scripture reference (e.g., `John`, `Psalms`).
5. THE `version` column SHALL contain the Bible translation abbreviation (e.g., `KJV`, `NIV`, `NKJV`).
6. THE `outline` column SHALL contain a valid JSON array of OutlinePoint objects.
7. IF the `outline` column contains malformed JSON, THEN THE SermonNotes Component SHALL fall back to displaying the static placeholder sermon from `data.ts`.

---

### Requirement 2: Outline JSON Format

**User Story:** As an Admin, I want clear instructions on how to format the outline JSON, so that fill-in-the-blank points display and validate correctly in the app.

#### Acceptance Criteria

1. THE Outline SHALL be a JSON array where each element is an OutlinePoint object with exactly three fields: `id`, `text`, and `missingWord`.
2. THE `id` field SHALL be a unique integer starting at `1` and incrementing by `1` for each subsequent point.
3. THE `text` field SHALL contain the full sentence with exactly `________` (eight underscores) marking the blank where the missing word belongs.
4. THE `missingWord` field SHALL contain the single word or short phrase that correctly fills the blank in the corresponding `text` field.
5. WHEN a congregation member types a word that matches `missingWord` (case-insensitive), THE SermonNotes Component SHALL display a "Scripture Verified" confirmation on that point.
6. IF a sermon outline point has no fill-in-the-blank, THEN THE `text` field SHALL contain the full sentence without any `________` marker, and THE `missingWord` field SHALL be set to an empty string `""`.

---

### Requirement 3: Adding a New Sermon

**User Story:** As an Admin, I want step-by-step instructions for adding a new sermon record in Supabase, so that the app shows the correct sermon on Sunday morning.

#### Acceptance Criteria

1. WHEN the Admin navigates to the Supabase Dashboard and opens the `sermons` table, THE Dashboard SHALL display the Table Editor with all existing sermon records.
2. WHEN the Admin clicks "Insert row", THE Dashboard SHALL present an input form with one field per column.
3. THE Admin SHALL enter the `date` value as the Sunday date of the service in `YYYY-MM-DD` format before saving.
4. THE Admin SHALL paste the complete, valid JSON array into the `outline` field before saving.
5. WHEN the Admin saves the record, THE Supabase Dashboard SHALL confirm the insert with no error messages.
6. WHEN the PLCC Connect app is refreshed after the record is saved, THE SermonNotes Component SHALL display the new sermon if its `date` is the most recent date on or before today.

---

### Requirement 4: Updating an Existing Sermon

**User Story:** As an Admin, I want to know how to edit a sermon record after it has been saved, so that I can correct mistakes without creating duplicate entries.

#### Acceptance Criteria

1. WHEN the Admin locates the target sermon row in the Supabase Table Editor and clicks the row to edit it, THE Dashboard SHALL allow inline editing of any field.
2. THE Admin SHALL update only the fields that require correction and leave all other fields unchanged.
3. WHEN the Admin saves the updated record, THE Supabase Dashboard SHALL confirm the update with no error messages.
4. WHEN the PLCC Connect app is refreshed after the update, THE SermonNotes Component SHALL display the corrected sermon data.
5. IF the Admin changes the `date` field of a sermon to a future date, THEN THE SermonNotes Component SHALL no longer display that sermon until that date is reached.

---

### Requirement 5: Sermon Visibility and Timing

**User Story:** As an Admin, I want to understand when a sermon becomes visible in the app, so that I can schedule entries in advance without accidentally showing next week's sermon early.

#### Acceptance Criteria

1. THE SermonNotes Component SHALL always display the sermon whose `date` is the most recent value that is less than or equal to today's date.
2. WHEN multiple sermon records exist, THE SermonNotes Component SHALL display only the one with the highest `date` value that does not exceed today's date.
3. WHERE the Admin wants to pre-load future sermons, THE Admin SHALL enter the future Sunday date in the `date` field; THE SermonNotes Component SHALL not display that record until that date arrives.
4. IF no sermon record exists with a `date` on or before today, THEN THE SermonNotes Component SHALL display the static fallback sermon defined in `data.ts`.

---

### Requirement 6: Outline JSON Template and Examples

**User Story:** As an Admin, I want a ready-to-use JSON template and a worked example, so that I can copy, fill in, and paste the outline without making formatting errors.

#### Acceptance Criteria

1. THE SOP SHALL provide a minimal JSON template with one OutlinePoint that the Admin can copy and extend.
2. THE SOP SHALL provide a complete worked example with three OutlinePoints matching the style used in the PLCC Connect app.
3. THE SOP SHALL include a checklist the Admin can follow before saving to verify the JSON is correctly formatted.
4. WHEN the Admin uses the provided template verbatim and replaces only the placeholder values, THE resulting JSON SHALL be valid and accepted by the Supabase Dashboard without errors.

---

### Requirement 7: Access and Permissions

**User Story:** As an Admin, I want to know what Supabase access level is required to manage sermon data, so that the right people are set up with the right permissions.

#### Acceptance Criteria

1. THE Admin SHALL have at minimum the "Editor" role in the Supabase project to insert and update rows in the `sermons` table.
2. WHERE a new staff member needs access, THE existing project Owner SHALL invite them via the Supabase Dashboard under Settings → Team.
3. IF an Admin attempts to save a record without the required permissions, THEN THE Supabase Dashboard SHALL display an authorization error and THE record SHALL not be saved.
4. THE SOP SHALL specify that database schema changes (adding/removing columns) require the "Owner" role and SHALL NOT be performed by general Admins.
