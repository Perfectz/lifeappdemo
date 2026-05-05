# LifeQuest OS Portfolio Demo

LifeQuest OS is a local-first personal operating loop with a JRPG-inspired interface.
The portfolio demo is intentionally fake data and is removable from Settings.

## Demo Story

- Dashboard shows one daily plan, a main quest, bounded side quests, and latest metrics.
- Quest Log, Metrics, Journal, and Reports are populated without using Patrick's real data.
- AI and voice features preserve confirmation boundaries before data is changed.
- Health import previews records before storing normalized metrics.

## Data Safety

- Demo metrics and journals use `source: "demo"`.
- Demo records that do not have a source field use the `demo-` ID prefix.
- Resetting demo data removes only demo records and preserves real local records.
- The app does not provide diagnosis or treatment advice.

## Screenshot Flow

1. Open Settings.
2. Enable Demo Mode.
3. Capture Dashboard, Quest Log, Metrics, Journal, and Reports.
4. Reset Demo Data before returning to real local use.
