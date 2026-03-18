package com.engine.editor.service;

import com.engine.editor.controller.dto.ConditionRequest;
import com.engine.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ConditionNodeService {

    private final ProjectService projectService;

    public ConditionNodeService(ProjectService projectService) {
        this.projectService = projectService;
    }

    public record ConditionData(
        long id, int conditionOrder, String name, String expression,
        boolean isElse, String edgeId, String targetNodeName
    ) {}

    public record ConditionDataResponse(String nodeId, List<ConditionData> conditions) {}

    public ConditionDataResponse getConditionData(String nodeId) {
        requireConditionNode(nodeId);
        return new ConditionDataResponse(nodeId, loadConditions(nodeId));
    }

    public ConditionDataResponse saveConditions(String nodeId, List<ConditionRequest> reqs) {
        requireConditionNode(nodeId);

        // Validate: exactly one else, always last
        long elseCount = reqs.stream().filter(r -> Boolean.TRUE.equals(r.isElse())).count();
        if (elseCount != 1)
            throw new ProjectException("Exactly one else condition is required");
        if (!Boolean.TRUE.equals(reqs.get(reqs.size() - 1).isElse()))
            throw new ProjectException("The else condition must be last");

        // Non-else conditions must have an expression
        for (int i = 0; i < reqs.size() - 1; i++) {
            ConditionRequest r = reqs.get(i);
            if (r.expression() == null || r.expression().isBlank())
                throw new ProjectException("Condition expression must not be blank");
        }

        JdbcTemplate jdbc = projectService.requireJdbc();

        // Build a map of existing condition names → edge connections to preserve them
        // When conditions are renamed/reordered, update edges accordingly
        List<ConditionData> existing = loadConditions(nodeId);

        jdbc.update("DELETE FROM node_decision_conditions WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            ConditionRequest r = reqs.get(i);
            boolean isElse = Boolean.TRUE.equals(r.isElse());
            String name = r.name() != null && !r.name().isBlank() ? r.name().trim() : null;
            jdbc.update("""
                INSERT INTO node_decision_conditions (node_id, condition_order, name, expression, is_else)
                VALUES (?, ?, ?, ?, ?)
                """, nodeId, i, name, isElse ? null : r.expression().trim(), isElse ? 1 : 0);
        }

        // Update source_condition_order and source_condition_name on connected edges
        for (int i = 0; i < reqs.size(); i++) {
            ConditionRequest r = reqs.get(i);
            String newName = r.name() != null && !r.name().isBlank() ? r.name().trim() : null;
            if (newName != null) {
                // Update any edges that had the old name
                String oldName = existing.stream()
                    .filter(c -> newName.equals(c.name()))
                    .map(c -> c.name())
                    .findFirst().orElse(null);
                if (oldName != null) {
                    jdbc.update(
                        "UPDATE edges SET source_condition_order=? WHERE source_node_id=? AND source_condition_name=?",
                        i, nodeId, newName);
                }
            }
        }

        return getConditionData(nodeId);
    }

    private List<ConditionData> loadConditions(String nodeId) {
        return projectService.requireJdbc().query("""
            SELECT c.id, c.condition_order, c.name, c.expression, c.is_else,
                   e.id AS edge_id, n.name AS target_node_name
            FROM node_decision_conditions c
            LEFT JOIN edges e
                ON e.source_node_id = ? AND (
                    (e.source_condition_name IS NOT NULL AND e.source_condition_name = c.name)
                    OR (e.source_condition_name IS NULL AND e.source_condition_order = c.condition_order)
                )
            LEFT JOIN nodes n ON n.id = e.target_node_id
            WHERE c.node_id = ?
            ORDER BY c.condition_order
            """, (rs, row) -> {
                boolean isElse = rs.getInt("is_else") == 1;
                return new ConditionData(
                    rs.getLong("id"),
                    rs.getInt("condition_order"),
                    rs.getString("name"),
                    isElse ? null : rs.getString("expression"),
                    isElse,
                    rs.getString("edge_id"),
                    rs.getString("target_node_name")
                );
            }, nodeId, nodeId);
    }

    private void requireConditionNode(String nodeId) {
        Integer count = projectService.requireJdbc().queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=? AND type='condition'", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("Condition node not found: " + nodeId);
    }
}
