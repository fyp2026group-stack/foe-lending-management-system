# Equipment source contract

GET /api/lending/sources (existing cookie authentication, all four roles).

Query: q (trimmed case-insensitive literal substring, max 120 characters), categoryId, labId, itemId (UUID), kind (RETURNABLE/CONSUMABLE), policy (NONE/LECTURER/HOD/BOTH), limit (1..100, default 100), offset (0..100000, default 0), availableOnly (true/false).

Response: {items, total, limit, offset}. total counts eligible item/lab/location sources, not distinct equipment. Stable order: item, lab, location, then UUID ties. Each source retains itemId,item,kind,uom,labId,lab,locationId,location,availableQuantity,policy; adds categoryId,category,specifications (actual item JSON). No description exists in the model.

q searches item/category/lab/location names and their UUID identifiers. It does not search or disclose asset IDs/serials. Both availableOnly values retain existing AVAILABLE positive bulk-only semantics: false does not grant access to unavailable stock. Sources must have active item/category/lab/location and existing feasible non-self lecturer/HOD approval. Auth and resolver semantics remain unchanged. No unbounded rows are loaded into the app; SQL counts and pages one statement snapshot. Unknown/invalid query fields return 422 INVALID.
