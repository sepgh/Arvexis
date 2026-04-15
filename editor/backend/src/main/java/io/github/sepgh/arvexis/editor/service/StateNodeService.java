package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.controller.dto.AssignmentRequest;
import io.github.sepgh.arvexis.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class StateNodeService {

    private final ProjectService projectService;

    public StateNodeService(ProjectService projectService) {
        this.projectService = projectService;
    }

    public record AssignmentData(long id, int assignmentOrder, String expression) {}

    public record StateDataResponse(String nodeId, List<AssignmentData> assignments) {}

    public StateDataResponse getStateData(String nodeId) {
        requireStateNode(nodeId);
        return new StateDataResponse(nodeId, loadAssignments(nodeId));
    }

    public StateDataResponse saveAssignments(String nodeId, List<AssignmentRequest> reqs) {
        requireStateNode(nodeId);
        JdbcTemplate jdbc = projectService.requireJdbc();

        for (AssignmentRequest r : reqs) {
            if (r.expression() == null || r.expression().isBlank())
                throw new ProjectException("Assignment expression must not be blank");
        }

        jdbc.update("DELETE FROM node_state_assignments WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            jdbc.update("""
                INSERT INTO node_state_assignments (node_id, assignment_order, expression)
                VALUES (?, ?, ?)
                """, nodeId, i, reqs.get(i).expression().trim());
        }
        return getStateData(nodeId);
    }

    private List<AssignmentData> loadAssignments(String nodeId) {
        return projectService.requireJdbc().query("""
            SELECT id, assignment_order, expression
            FROM node_state_assignments WHERE node_id = ? ORDER BY assignment_order
            """, (rs, row) -> new AssignmentData(
                rs.getLong("id"),
                rs.getInt("assignment_order"),
                rs.getString("expression")
            ), nodeId);
    }

    private void requireStateNode(String nodeId) {
        Integer count = projectService.requireJdbc().queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=? AND type='state'", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("State node not found: " + nodeId);
    }
}
