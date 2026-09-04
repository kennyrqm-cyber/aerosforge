# AEROSFORGE™ Content Asset Record

Each production asset should carry these fields:

- `asset_id`
- `lesson_id`
- `series`
- `format`
- `working_title`
- `hook`
- `learning_objective`
- `audience`
- `primary_source_ids`
- `rights_status`
- `license_or_permission`
- `attribution_text`
- `originality_review`
- `fact_check_status`
- `aviation_safety_review`
- `human_approval`
- `ai_assistance_log`
- `media_ids`
- `target_platforms`
- `publication_status`
- `published_urls`
- `created_at`
- `updated_at`

## Publication states
DRAFT → SOURCE CHECK → ORIGINALITY CHECK → RIGHTS CHECK → FACT CHECK → SAFETY REVIEW → HUMAN APPROVAL → SCHEDULED/PUBLISHED

Any failed gate returns the asset to revision. Rights-unknown assets remain unpublished.
