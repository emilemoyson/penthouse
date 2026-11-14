# Metrics for the weekly food report

`weekly_summary` already computes these; read them, don't recompute. Same rules as the kitchen panel.

| Line | Field | Missing data |
| --- | --- | --- |
| Spend | `spend.total` (= `spend.groceries` + `spend.eating_out`) vs `budget.weekly`, left = `budget.left` | `budget.weekly` null → "no budget set" (stored in `kv` key `food_budget`) |
| Protein | `spend.protein_per_dollar` (protein over meals that have a cost) | null → "no meals with a cost logged" |
| Per meal | `spend.cost_per_meal.home.avg_cost` and `.out.avg_cost`, with `meals_with_cost` as n | null → "no costed home/out meals"; if `meals_without_cost` > 0, say how many meals had no cost |
| Waste | `waste.items` (names), `waste.value_lost` | empty → "nothing went off" |

Notes:
- Protein per dollar and cost per meal only count meals with a cost. If most meals have none, say the numbers rest on few meals.
- Good recommendation patterns: an item that keeps going to waste (buy smaller), protein per dollar dropping (swap a source), out meals costing well above home meals (cook one more night), over budget (name the biggest day from `spend.by_day`).
