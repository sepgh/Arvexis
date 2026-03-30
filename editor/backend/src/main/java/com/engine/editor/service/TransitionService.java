package com.engine.editor.service;

import com.engine.editor.controller.dto.AudioTrackRequest;
import com.engine.editor.controller.dto.VideoLayerRequest;
import com.engine.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;

@Service
public class TransitionService {

    private static final Set<String> VALID_TRANSITIONS = Set.of(
        "none", "fade_in", "fade_out", "crossfade",
        "slide_left", "slide_right", "wipe", "dissolve", "cut", "video"
    );
    private static final double MAX_SECS = 5.0;

    private final ProjectService projectService;

    public TransitionService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Response types ────────────────────────────────────────────────────────

    public record TransitionLayerData(
        long id, int layerOrder, String assetId, String assetFileName,
        boolean hasAlpha, Double duration, double startAt, Integer startAtFrames,
        boolean alphaError, boolean freezeLastFrame
    ) {}

    public record TransitionAudioData(
        long id, int trackOrder, String assetId, String assetFileName,
        Double duration, double startAt, Integer startAtFrames
    ) {}

    public record TransitionResponse(
        String edgeId,
        String sourceNodeId,
        String targetNodeId,
        String targetNodeType,
        boolean transitionAllowed,
        String type,
        Double duration,
        String backgroundColor,
        List<TransitionLayerData> videoLayers,
        List<TransitionAudioData> audioTracks
    ) {}

    // ── Read ──────────────────────────────────────────────────────────────────

    public TransitionResponse getTransition(String edgeId) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireEdge(jdbc, edgeId);

        // Get edge + target node type in one query
        List<Object[]> row = jdbc.query("""
            SELECT e.source_node_id, e.target_node_id, n.type AS target_type,
                   t.type AS trans_type, t.duration, t.background_color
            FROM edges e
            JOIN nodes n ON n.id = e.target_node_id
            LEFT JOIN edge_transitions t ON t.edge_id = e.id
            WHERE e.id = ?
            """, (rs, i) -> new Object[]{
                rs.getString("source_node_id"),
                rs.getString("target_node_id"),
                rs.getString("target_type"),
                rs.getString("trans_type"),
                rs.getObject("duration") != null ? rs.getDouble("duration") : null,
                rs.getString("background_color")
            }, edgeId);

        if (row.isEmpty()) throw new ProjectException("Edge not found: " + edgeId);
        Object[] r = row.get(0);

        String sourceNodeId  = (String) r[0];
        String targetNodeId  = (String) r[1];
        String targetType    = (String) r[2];
        String transType     = (String) r[3];
        Double duration      = (Double) r[4];
        String bgColor       = (String) r[5];
        boolean allowed      = "scene".equals(targetType);

        List<TransitionLayerData> layers = allowed ? loadVideoLayers(jdbc, edgeId) : List.of();
        List<TransitionAudioData> audio  = allowed ? loadAudioTracks(jdbc, edgeId) : List.of();

        return new TransitionResponse(edgeId, sourceNodeId, targetNodeId, targetType,
            allowed, transType, duration, bgColor, layers, audio);
    }

    // ── Update type/duration ──────────────────────────────────────────────────

    public TransitionResponse setTransitionType(String edgeId, String type, Double duration) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireEdge(jdbc, edgeId);
        requireTargetIsScene(jdbc, edgeId);

        if (!VALID_TRANSITIONS.contains(type))
            throw new ProjectException("Invalid transition type: " + type);
        if (duration != null && duration > MAX_SECS)
            throw new ProjectException("Transition duration cannot exceed " + MAX_SECS + " seconds");

        // Preserve existing backgroundColor when only changing type/duration
        String existingBg = null;
        try {
            existingBg = jdbc.queryForObject(
                "SELECT background_color FROM edge_transitions WHERE edge_id=?", String.class, edgeId);
        } catch (Exception ignored) {}
        jdbc.update("DELETE FROM edge_transitions WHERE edge_id = ?", edgeId);
        if (!"none".equals(type)) {
            jdbc.update("INSERT INTO edge_transitions (edge_id, type, duration, background_color) VALUES (?, ?, ?, ?)",
                edgeId, type, duration, existingBg);
        }
        if (!"video".equals(type)) {
            jdbc.update("DELETE FROM transition_video_layers WHERE edge_id = ?", edgeId);
            jdbc.update("DELETE FROM transition_audio_tracks WHERE edge_id = ?", edgeId);
        }
        return getTransition(edgeId);
    }

    // ── Background color ──────────────────────────────────────────────────────

    public TransitionResponse setBackgroundColor(String edgeId, String backgroundColor) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireEdge(jdbc, edgeId);
        requireTargetIsScene(jdbc, edgeId);
        jdbc.update("UPDATE edge_transitions SET background_color = ? WHERE edge_id = ?",
            backgroundColor, edgeId);
        return getTransition(edgeId);
    }

    // ── Video layers ──────────────────────────────────────────────────────────

    public TransitionResponse saveVideoLayers(String edgeId, List<VideoLayerRequest> reqs) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireEdge(jdbc, edgeId);
        requireTargetIsScene(jdbc, edgeId);

        jdbc.update("DELETE FROM transition_video_layers WHERE edge_id = ?", edgeId);
        for (int i = 0; i < reqs.size(); i++) {
            VideoLayerRequest r = reqs.get(i);
            if (r.assetId() == null) throw new ProjectException("assetId required");
            requireAssetExists(jdbc, r.assetId());
            int freeze = Boolean.TRUE.equals(r.freezeLastFrame()) ? 1 : 0;
            jdbc.update("""
                INSERT INTO transition_video_layers (edge_id, asset_id, layer_order, start_at, start_at_frames, freeze_last_frame)
                VALUES (?, ?, ?, ?, ?, ?)
                """, edgeId, r.assetId(), i, r.startAt() != null ? r.startAt() : 0.0, r.startAtFrames(), freeze);
        }
        return getTransition(edgeId);
    }

    // ── Audio tracks ──────────────────────────────────────────────────────────

    public TransitionResponse saveAudioTracks(String edgeId, List<AudioTrackRequest> reqs) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireEdge(jdbc, edgeId);
        requireTargetIsScene(jdbc, edgeId);

        jdbc.update("DELETE FROM transition_audio_tracks WHERE edge_id = ?", edgeId);
        for (int i = 0; i < reqs.size(); i++) {
            AudioTrackRequest r = reqs.get(i);
            if (r.assetId() == null) throw new ProjectException("assetId required");
            requireAssetExists(jdbc, r.assetId());
            jdbc.update("""
                INSERT INTO transition_audio_tracks (edge_id, asset_id, track_order, start_at, start_at_frames)
                VALUES (?, ?, ?, ?, ?)
                """, edgeId, r.assetId(), i, r.startAt() != null ? r.startAt() : 0.0, r.startAtFrames());
        }
        return getTransition(edgeId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<TransitionLayerData> loadVideoLayers(JdbcTemplate jdbc, String edgeId) {
        List<TransitionLayerData> rows = jdbc.query("""
            SELECT tvl.id, tvl.layer_order, tvl.asset_id, tvl.start_at, tvl.start_at_frames,
                   tvl.freeze_last_frame, a.file_name, a.has_alpha, a.duration
            FROM transition_video_layers tvl
            JOIN assets a ON a.id = tvl.asset_id
            WHERE tvl.edge_id = ? ORDER BY tvl.layer_order
            """, (rs, i) -> new TransitionLayerData(
                rs.getLong("id"), rs.getInt("layer_order"),
                rs.getString("asset_id"), rs.getString("file_name"),
                rs.getInt("has_alpha") == 1,
                rs.getObject("duration") != null ? rs.getDouble("duration") : null,
                rs.getDouble("start_at"),
                rs.getObject("start_at_frames") != null ? rs.getInt("start_at_frames") : null,
                false,
                rs.getInt("freeze_last_frame") == 1
            ), edgeId);

        for (int i = 0; i < rows.size(); i++) {
            TransitionLayerData vl = rows.get(i);
            if (i > 0 && !vl.hasAlpha()) {
                rows.set(i, new TransitionLayerData(vl.id(), vl.layerOrder(), vl.assetId(),
                    vl.assetFileName(), vl.hasAlpha(), vl.duration(), vl.startAt(), vl.startAtFrames(), true, vl.freezeLastFrame()));
            }
        }
        return rows;
    }

    private List<TransitionAudioData> loadAudioTracks(JdbcTemplate jdbc, String edgeId) {
        return jdbc.query("""
            SELECT tat.id, tat.track_order, tat.asset_id, tat.start_at, tat.start_at_frames,
                   a.file_name, a.duration
            FROM transition_audio_tracks tat
            JOIN assets a ON a.id = tat.asset_id
            WHERE tat.edge_id = ? ORDER BY tat.track_order
            """, (rs, i) -> new TransitionAudioData(
                rs.getLong("id"), rs.getInt("track_order"),
                rs.getString("asset_id"), rs.getString("file_name"),
                rs.getObject("duration") != null ? rs.getDouble("duration") : null,
                rs.getDouble("start_at"),
                rs.getObject("start_at_frames") != null ? rs.getInt("start_at_frames") : null
            ), edgeId);
    }

    private void requireEdge(JdbcTemplate jdbc, String edgeId) {
        Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM edges WHERE id=?", Integer.class, edgeId);
        if (c == null || c == 0) throw new ProjectException("Edge not found: " + edgeId);
    }

    private void requireTargetIsScene(JdbcTemplate jdbc, String edgeId) {
        Integer c = jdbc.queryForObject("""
            SELECT COUNT(*) FROM edges e JOIN nodes n ON n.id=e.target_node_id
            WHERE e.id=? AND n.type='scene'
            """, Integer.class, edgeId);
        if (c == null || c == 0)
            throw new ProjectException("Transition only allowed on edges targeting scene nodes");
    }

    private void requireAssetExists(JdbcTemplate jdbc, String assetId) {
        Integer c = jdbc.queryForObject("SELECT COUNT(*) FROM assets WHERE id=?", Integer.class, assetId);
        if (c == null || c == 0) throw new ProjectException("Asset not found: " + assetId);
    }
}
