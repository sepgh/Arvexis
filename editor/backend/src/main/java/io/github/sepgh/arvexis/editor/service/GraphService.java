package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.controller.dto.CreateEdgeRequest;
import io.github.sepgh.arvexis.editor.controller.dto.CreateNodeRequest;
import io.github.sepgh.arvexis.editor.controller.dto.UpdateEdgeRequest;
import io.github.sepgh.arvexis.editor.controller.dto.UpdateNodeRequest;
import io.github.sepgh.arvexis.editor.exception.ProjectException;
import io.github.sepgh.arvexis.editor.model.AmbientConfigData;
import io.github.sepgh.arvexis.editor.model.EdgeTransitionData;
import io.github.sepgh.arvexis.editor.model.GraphEdge;
import io.github.sepgh.arvexis.editor.model.GraphNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * CRUD operations for graph nodes and edges.
 * All data access goes through {@link ProjectService#requireJdbc()}.
 */
@Service
public class GraphService {

    private static final Set<String> VALID_NODE_TYPES  = Set.of("scene", "state", "condition");
    private static final Set<String> VALID_TRANSITIONS = Set.of(
        "none", "fade_in", "fade_out", "crossfade",
        "slide_left", "slide_right", "wipe", "dissolve", "cut", "video"
    );
    private static final double MAX_TRANSITION_SECS = 5.0;
    private static final Pattern HEX_COLOR_PATTERN = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private final ProjectService projectService;

    public GraphService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────

    public GraphNode createNode(CreateNodeRequest req) {
        if (req.name() == null || req.name().isBlank())
            throw new ProjectException("Node name must not be blank");
        if (!VALID_NODE_TYPES.contains(req.type()))
            throw new ProjectException("Invalid node type: " + req.type());

        JdbcTemplate jdbc = projectService.requireJdbc();
        String id = req.id() != null && !req.id().isBlank() ? req.id().trim() : UUID.randomUUID().toString();
        double x = req.posX() != null ? req.posX() : 0.0;
        double y = req.posY() != null ? req.posY() : 0.0;

        jdbc.update("""
            INSERT INTO nodes (id, name, type, is_root, is_end, pos_x, pos_y)
            VALUES (?, ?, ?, 0, 0, ?, ?)
            """, id, req.name().trim(), req.type(), x, y);

        return getNode(id);
    }

    public List<GraphNode> listNodes() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphNode> nodes = jdbc.query(
            "SELECT * FROM nodes ORDER BY pos_y, pos_x", this::mapNode);
        nodes.forEach(n -> n.setExits(loadExits(jdbc, n)));
        return nodes;
    }

    public GraphNode getNode(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphNode> rows = jdbc.query(
            "SELECT * FROM nodes WHERE id = ?", this::mapNode, id);
        if (rows.isEmpty()) throw new ProjectException("Node not found: " + id);
        GraphNode n = rows.get(0);
        n.setExits(loadExits(jdbc, n));
        return n;
    }

    public GraphNode updateNode(String id, UpdateNodeRequest req) {
        GraphNode existing = getNode(id);
        JdbcTemplate jdbc = projectService.requireJdbc();

        String name       = req.name()     != null ? req.name().trim() : existing.getName();
        boolean isEnd     = req.isEnd()    != null ? req.isEnd()       : existing.isEnd();
        boolean autoCont  = req.autoContinue() != null ? req.autoContinue() : existing.isAutoContinue();
        boolean loopVid   = req.loopVideo() != null ? req.loopVideo() : existing.isLoopVideo();
        String bgColor    = Boolean.TRUE.equals(req.clearBackgroundColor()) ? null
                          : (req.backgroundColor() != null ? req.backgroundColor() : existing.getBackgroundColor());
        String dac        = req.decisionAppearanceConfig() != null
                          ? req.decisionAppearanceConfig()
                          : existing.getDecisionAppearanceConfig();
        String musicAsset = Boolean.TRUE.equals(req.clearMusicAsset()) ? null
                          : (req.musicAssetId() != null ? req.musicAssetId() : existing.getMusicAssetId());
        AmbientConfigData ambient = resolveAmbientConfig(existing.getAmbient(), req.ambient());
        Boolean hideDecisionButtons = Boolean.TRUE.equals(req.clearDecisionInputModeOverride())
            ? null
            : (req.hideDecisionButtons() != null ? req.hideDecisionButtons() : existing.getHideDecisionButtons());
        Boolean showDecisionInputIndicator = Boolean.TRUE.equals(req.clearDecisionInputModeOverride())
            ? null
            : (req.showDecisionInputIndicator() != null ? req.showDecisionInputIndicator() : existing.getShowDecisionInputIndicator());
        if (hideDecisionButtons != null && !hideDecisionButtons) {
            showDecisionInputIndicator = false;
        }
        double posX       = req.posX() != null ? req.posX() : existing.getPosX();
        double posY       = req.posY() != null ? req.posY() : existing.getPosY();

        if (name.isBlank()) throw new ProjectException("Node name must not be blank");
        if (bgColor != null && !HEX_COLOR_PATTERN.matcher(bgColor).matches()) {
            throw new ProjectException("Node background color must be a hex color like #000000");
        }

        jdbc.update("""
            UPDATE nodes SET name=?, is_end=?, auto_continue=?, loop_video=?, background_color=?,
                decision_appearance_config=?, music_asset_id=?, ambient_action=?, ambient_zone_id=?,
                ambient_volume_override=?, ambient_fade_ms_override=?, hide_decision_buttons=?,
                show_decision_input_indicator=?, pos_x=?, pos_y=?
            WHERE id=?
            """, name, isEnd ? 1 : 0, autoCont ? 1 : 0, loopVid ? 1 : 0, bgColor, dac, musicAsset,
            ambient.getAction(), ambient.getZoneId(), ambient.getVolumeOverride(), ambient.getFadeMsOverride(),
            toDbFlag(hideDecisionButtons), toDbFlag(showDecisionInputIndicator), posX, posY, id);

        return getNode(id);
    }

    public void deleteNode(String id) {
        getNode(id); // throws if not found
        projectService.requireJdbc().update("DELETE FROM nodes WHERE id = ?", id);
    }

    public GraphNode setRoot(String id) {
        getNode(id); // throws if not found
        JdbcTemplate jdbc = projectService.requireJdbc();
        jdbc.update("UPDATE nodes SET is_root = 0");
        jdbc.update("UPDATE nodes SET is_root = 1 WHERE id = ?", id);
        return getNode(id);
    }

    public void clearRoot() {
        projectService.requireJdbc().update("UPDATE nodes SET is_root = 0");
    }

    // ── Edges ─────────────────────────────────────────────────────────────────

    public GraphEdge createEdge(CreateEdgeRequest req) {
        if (req.sourceNodeId() == null || req.targetNodeId() == null)
            throw new ProjectException("sourceNodeId and targetNodeId are required");

        JdbcTemplate jdbc = projectService.requireJdbc();

        // Validate both nodes exist
        requireNodeExists(jdbc, req.sourceNodeId());
        requireNodeExists(jdbc, req.targetNodeId());

        // Enforce one edge per exit: check source handle is not already used
        if (req.sourceDecisionKey() != null) {
            Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=? AND source_decision_key=?",
                Integer.class, req.sourceNodeId(), req.sourceDecisionKey());
            if (dup != null && dup > 0)
                throw new ProjectException(
                    "Exit '" + req.sourceDecisionKey() + "' already has an outgoing edge");
        } else if (req.sourceConditionName() != null) {
            Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=? AND source_condition_name=?",
                Integer.class, req.sourceNodeId(), req.sourceConditionName());
            if (dup != null && dup > 0)
                throw new ProjectException(
                    "Condition exit '" + req.sourceConditionName() + "' already has an outgoing edge");
        } else {
            // State node: only one outgoing edge allowed
            Integer dup = jdbc.queryForObject(
                "SELECT COUNT(*) FROM edges WHERE source_node_id=?",
                Integer.class, req.sourceNodeId());
            if (dup != null && dup > 0)
                throw new ProjectException("This node already has an outgoing edge");
        }

        // Resolve source_condition_order from condition name for runtime compat
        Integer condOrder = null;
        if (req.sourceConditionName() != null) {
            List<Integer> orders = jdbc.queryForList(
                "SELECT condition_order FROM node_decision_conditions WHERE node_id=? AND name=?",
                Integer.class, req.sourceNodeId(), req.sourceConditionName());
            if (!orders.isEmpty()) condOrder = orders.get(0);
        } else {
            condOrder = req.sourceConditionOrder();
        }

        String id = req.id() != null && !req.id().isBlank() ? req.id().trim() : UUID.randomUUID().toString();
        jdbc.update("""
            INSERT INTO edges (id, source_node_id, target_node_id,
                               source_decision_key, source_condition_order, source_condition_name)
            VALUES (?, ?, ?, ?, ?, ?)
            """, id, req.sourceNodeId(), req.targetNodeId(),
                req.sourceDecisionKey(), condOrder, req.sourceConditionName());

        return getEdge(id);
    }

    public List<GraphEdge> listEdges() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphEdge> edges = jdbc.query("SELECT * FROM edges", this::mapEdge);
        edges.forEach(e -> {
            e.setTransition(loadTransition(jdbc, e.getId()));
            e.setAmbient(loadEdgeAmbient(jdbc, e.getId()));
        });
        return edges;
    }

    public GraphEdge getEdge(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<GraphEdge> rows = jdbc.query("SELECT * FROM edges WHERE id=?", this::mapEdge, id);
        if (rows.isEmpty()) throw new ProjectException("Edge not found: " + id);
        GraphEdge edge = rows.get(0);
        edge.setTransition(loadTransition(jdbc, id));
        edge.setAmbient(loadEdgeAmbient(jdbc, id));
        return edge;
    }

    public GraphEdge updateEdge(String id, UpdateEdgeRequest req) {
        getEdge(id); // throws if not found
        JdbcTemplate jdbc = projectService.requireJdbc();

        if (req.transitionType() != null) {
            if (!VALID_TRANSITIONS.contains(req.transitionType()))
                throw new ProjectException("Invalid transition type: " + req.transitionType());
            if (req.transitionDuration() != null && req.transitionDuration() > MAX_TRANSITION_SECS)
                throw new ProjectException(
                    "Transition duration cannot exceed " + MAX_TRANSITION_SECS + " seconds");

            jdbc.update("DELETE FROM edge_transitions WHERE edge_id = ?", id);
            if (!"none".equals(req.transitionType())) {
                jdbc.update("""
                    INSERT INTO edge_transitions (edge_id, type, duration, config)
                    VALUES (?, ?, ?, ?)
                    """, id, req.transitionType(), req.transitionDuration(), req.transitionConfig());
            }
        }
        return getEdge(id);
    }

    public void deleteEdge(String id) {
        getEdge(id); // throws if not found
        projectService.requireJdbc().update("DELETE FROM edges WHERE id = ?", id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private GraphNode mapNode(ResultSet rs, int row) throws SQLException {
        GraphNode n = new GraphNode();
        n.setId(rs.getString("id"));
        n.setName(rs.getString("name"));
        n.setType(rs.getString("type"));
        n.setRoot(rs.getInt("is_root") == 1);
        n.setEnd(rs.getInt("is_end") == 1);
        n.setAutoContinue(rs.getInt("auto_continue") == 1);
        n.setLoopVideo(rs.getInt("loop_video") == 1);
        n.setBackgroundColor(rs.getString("background_color"));
        n.setDecisionAppearanceConfig(rs.getString("decision_appearance_config"));
        n.setMusicAssetId(rs.getString("music_asset_id"));
        n.setAmbient(readAmbientConfig(
            rs.getString("ambient_action"),
            rs.getString("ambient_zone_id"),
            nullableDouble(rs, "ambient_volume_override"),
            nullableInteger(rs, "ambient_fade_ms_override")
        ));
        n.setHideDecisionButtons(nullableFlag(rs, "hide_decision_buttons"));
        n.setShowDecisionInputIndicator(nullableFlag(rs, "show_decision_input_indicator"));
        n.setPosX(rs.getDouble("pos_x"));
        n.setPosY(rs.getDouble("pos_y"));
        return n;
    }

    private GraphEdge mapEdge(ResultSet rs, int row) throws SQLException {
        GraphEdge e = new GraphEdge();
        e.setId(rs.getString("id"));
        e.setSourceNodeId(rs.getString("source_node_id"));
        e.setSourceDecisionKey(rs.getString("source_decision_key"));
        int condOrder = rs.getInt("source_condition_order");
        e.setSourceConditionOrder(rs.wasNull() ? null : condOrder);
        e.setSourceConditionName(rs.getString("source_condition_name"));
        e.setTargetNodeId(rs.getString("target_node_id"));
        return e;
    }

    private EdgeTransitionData loadTransition(JdbcTemplate jdbc, String edgeId) {
        List<EdgeTransitionData> rows = jdbc.query(
            "SELECT * FROM edge_transitions WHERE edge_id = ?",
            (rs, row) -> {
                EdgeTransitionData t = new EdgeTransitionData();
                t.setType(rs.getString("type"));
                double dur = rs.getDouble("duration");
                t.setDuration(rs.wasNull() ? null : dur);
                t.setConfig(rs.getString("config"));
                return t;
            }, edgeId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private AmbientConfigData loadEdgeAmbient(JdbcTemplate jdbc, String edgeId) {
        List<AmbientConfigData> rows = jdbc.query(
            "SELECT ambient_action, ambient_zone_id, ambient_volume_override, ambient_fade_ms_override FROM edge_ambient WHERE edge_id = ?",
            (rs, row) -> readAmbientConfig(
                rs.getString("ambient_action"),
                rs.getString("ambient_zone_id"),
                nullableDouble(rs, "ambient_volume_override"),
                nullableInteger(rs, "ambient_fade_ms_override")
            ),
            edgeId
        );
        return rows.isEmpty() ? AmbientSupport.defaultConfig() : rows.get(0);
    }

    private void requireNodeExists(JdbcTemplate jdbc, String nodeId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=?", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("Node not found: " + nodeId);
    }

    private AmbientConfigData resolveAmbientConfig(AmbientConfigData existing, io.github.sepgh.arvexis.editor.controller.dto.AmbientConfigRequest request) {
        AmbientConfigData current = existing != null ? existing : AmbientSupport.defaultConfig();
        if (request == null) {
            return current;
        }
        String action = request.action() != null ? request.action() : current.getAction();
        String zoneId = request.zoneId() != null ? request.zoneId() : current.getZoneId();
        Double volumeOverride = Boolean.TRUE.equals(request.clearVolumeOverride())
            ? null
            : (request.volumeOverride() != null ? request.volumeOverride() : current.getVolumeOverride());
        Integer fadeMsOverride = Boolean.TRUE.equals(request.clearFadeMsOverride())
            ? null
            : (request.fadeMsOverride() != null ? request.fadeMsOverride() : current.getFadeMsOverride());
        AmbientConfigData resolved = AmbientSupport.normalizeConfig(action, zoneId, volumeOverride, fadeMsOverride);
        if ("set".equals(resolved.getAction())) {
            requireAmbientZoneExists(resolved.getZoneId());
        }
        return resolved;
    }

    private AmbientConfigData readAmbientConfig(String action, String zoneId, Double volumeOverride, Integer fadeMsOverride) {
        AmbientConfigData ambient = AmbientSupport.normalizeConfig(action, zoneId, volumeOverride, fadeMsOverride);
        if ("set".equals(ambient.getAction())) {
            requireAmbientZoneExists(ambient.getZoneId());
        }
        return ambient;
    }

    private void requireAmbientZoneExists(String zoneId) {
        if (zoneId == null || zoneId.isBlank()) {
            throw new ProjectException("Ambient zone id is required");
        }
        boolean exists = projectService.getConfig().getAmbientZones() != null
            && projectService.getConfig().getAmbientZones().stream().anyMatch(zone -> zoneId.equals(zone.getId()));
        if (!exists) {
            throw new ProjectException("Ambient zone not found: " + zoneId);
        }
    }

    private Integer toDbFlag(Boolean value) {
        if (value == null) return null;
        return value ? 1 : 0;
    }

    private Double nullableDouble(ResultSet rs, String columnName) throws SQLException {
        double value = rs.getDouble(columnName);
        return rs.wasNull() ? null : value;
    }

    private Integer nullableInteger(ResultSet rs, String columnName) throws SQLException {
        int value = rs.getInt(columnName);
        return rs.wasNull() ? null : value;
    }

    private Boolean nullableFlag(ResultSet rs, String columnName) throws SQLException {
        int value = rs.getInt(columnName);
        return rs.wasNull() ? null : value == 1;
    }

    private List<GraphNode.NodeExit> loadExits(JdbcTemplate jdbc, GraphNode node) {
        List<GraphNode.NodeExit> exits = new ArrayList<>();
        if ("scene".equals(node.getType())) {
            List<java.util.Map<String, Object>> rows = jdbc.queryForList(
                "SELECT decision_key, is_default FROM scene_decisions WHERE node_id=? ORDER BY decision_order",
                node.getId());
            if (rows.isEmpty()) {
                exits.add(new GraphNode.NodeExit("CONTINUE", "Continue", true));
            } else {
                for (var r : rows) {
                    exits.add(new GraphNode.NodeExit(
                        (String) r.get("decision_key"),
                        (String) r.get("decision_key"),
                        ((Number) r.get("is_default")).intValue() == 1
                    ));
                }
            }
        } else if ("condition".equals(node.getType())) {
            List<java.util.Map<String, Object>> rows = jdbc.queryForList(
                "SELECT name, condition_order, is_else FROM node_decision_conditions WHERE node_id=? ORDER BY condition_order",
                node.getId());
            for (var r : rows) {
                String rawName = (String) r.get("name");
                boolean isElse = ((Number) r.get("is_else")).intValue() == 1;
                String key  = rawName != null ? rawName : (isElse ? "else" : "cond-" + r.get("condition_order"));
                String label = rawName != null ? rawName : (isElse ? "else" : "Condition " + r.get("condition_order"));
                exits.add(new GraphNode.NodeExit(key, label, isElse));
            }
        }
        return exits;
    }
}
