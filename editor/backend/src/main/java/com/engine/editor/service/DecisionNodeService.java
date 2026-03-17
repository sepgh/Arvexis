package com.engine.editor.service;

import com.engine.editor.controller.dto.ConditionRequest;
import com.engine.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class DecisionNodeService {

    private final ProjectService projectService;

    public DecisionNodeService(ProjectService projectService) {
        this.projectService = projectService;
    }

    public record ConditionData(
        long id, int conditionOrder, String expression,
        boolean isElse, String edgeId, String targetNodeName
    ) {}

    public record DecisionDataResponse(String nodeId, List<ConditionData> conditions) {}

    public DecisionDataResponse getDecisionData(String nodeId) {
        requireDecisionNode(nodeId);
        return new DecisionDataResponse(nodeId, loadConditions(nodeId));
    }

    public DecisionDataResponse saveConditions(String nodeId, List<ConditionRequest> reqs) {
        requireDecisionNode(nodeId);

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
        jdbc.update("DELETE FROM node_decision_conditions WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            ConditionRequest r = reqs.get(i);
            boolean isElse = Boolean.TRUE.equals(r.isElse());
            jdbc.update("""
                INSERT INTO node_decision_conditions (node_id, condition_order, expression, is_else)
                VALUES (?, ?, ?, ?)
                """, nodeId, i, isElse ? null : r.expression().trim(), isElse ? 1 : 0);
        }
        return getDecisionData(nodeId);
    }

    private List<ConditionData> loadConditions(String nodeId) {
        return projectService.requireJdbc().query("""
            SELECT c.id, c.condition_order, c.expression, c.is_else,
                   e.id AS edge_id, n.name AS target_node_name
            FROM node_decision_conditions c
            LEFT JOIN edges e
                ON e.source_node_id = ? AND e.source_condition_order = c.condition_order
            LEFT JOIN nodes n ON n.id = e.target_node_id
            WHERE c.node_id = ?
            ORDER BY c.condition_order
            """, (rs, row) -> {
                boolean isElse = rs.getInt("is_else") == 1;
                return new ConditionData(
                    rs.getLong("id"),
                    rs.getInt("condition_order"),
                    isElse ? null : rs.getString("expression"),
                    isElse,
                    rs.getString("edge_id"),
                    rs.getString("target_node_name")
                );
            }, nodeId, nodeId);
    }

    private void requireDecisionNode(String nodeId) {
        Integer count = projectService.requireJdbc().queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=? AND type='decision'", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("Decision node not found: " + nodeId);
    }
}
