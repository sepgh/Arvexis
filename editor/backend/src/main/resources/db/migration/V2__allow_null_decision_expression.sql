-- Allow NULL expression on decision conditions (else branch has no expression)
CREATE TABLE node_decision_conditions_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id         TEXT    NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    condition_order INTEGER NOT NULL,
    expression      TEXT,
    is_else         INTEGER NOT NULL DEFAULT 0
);

INSERT INTO node_decision_conditions_new
    SELECT id, node_id, condition_order, expression, is_else
    FROM node_decision_conditions;

DROP TABLE node_decision_conditions;

ALTER TABLE node_decision_conditions_new RENAME TO node_decision_conditions;
