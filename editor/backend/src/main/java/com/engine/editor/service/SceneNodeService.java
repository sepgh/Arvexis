package com.engine.editor.service;

import com.engine.editor.controller.dto.AudioTrackRequest;
import com.engine.editor.controller.dto.DecisionItemRequest;
import com.engine.editor.controller.dto.VideoLayerRequest;
import com.engine.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;

@Service
public class SceneNodeService {

    private final ProjectService projectService;

    public SceneNodeService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Response DTOs ─────────────────────────────────────────────────────────

    public record VideoLayerData(
        long id, int layerOrder, String assetId, String assetFileName,
        boolean hasAlpha, Double duration, double startAt, Integer startAtFrames,
        boolean alphaError, boolean freezeLastFrame, boolean loopLayer
    ) {}

    public record AudioTrackData(
        long id, int trackOrder, String assetId, String assetFileName,
        Double duration, double startAt, Integer startAtFrames
    ) {}

    public record DecisionItemData(
        long id, String decisionKey, boolean isDefault, int decisionOrder
    ) {}

    public record SceneDataResponse(
        String nodeId,
        List<VideoLayerData> videoLayers,
        List<AudioTrackData> audioTracks,
        List<DecisionItemData> decisions,
        Double computedDuration
    ) {}

    // ── Read ──────────────────────────────────────────────────────────────────

    public SceneDataResponse getSceneData(String nodeId) {
        requireSceneNode(nodeId);
        JdbcTemplate jdbc = projectService.requireJdbc();

        List<VideoLayerData> layers = loadVideoLayers(jdbc, nodeId);
        List<AudioTrackData> tracks = loadAudioTracks(jdbc, nodeId);
        List<DecisionItemData> decisions = loadDecisions(jdbc, nodeId);
        Double duration = computeDuration(layers, tracks);

        return new SceneDataResponse(nodeId, layers, tracks, decisions, duration);
    }

    // ── Video layers ──────────────────────────────────────────────────────────

    public SceneDataResponse saveVideoLayers(String nodeId, List<VideoLayerRequest> reqs) {
        requireSceneNode(nodeId);
        JdbcTemplate jdbc = projectService.requireJdbc();

        jdbc.update("DELETE FROM node_video_layers WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            VideoLayerRequest r = reqs.get(i);
            if (r.assetId() == null) throw new ProjectException("assetId is required for each layer");
            requireAssetExists(jdbc, r.assetId());
            int freeze = Boolean.TRUE.equals(r.freezeLastFrame()) ? 1 : 0;
            int loop  = Boolean.TRUE.equals(r.loopLayer()) ? 1 : 0;
            jdbc.update("""
                INSERT INTO node_video_layers (node_id, asset_id, layer_order, start_at, start_at_frames, freeze_last_frame, loop_layer)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, nodeId, r.assetId(), i, r.startAt() != null ? r.startAt() : 0.0, r.startAtFrames(), freeze, loop);
        }
        return getSceneData(nodeId);
    }

    // ── Audio tracks ──────────────────────────────────────────────────────────

    public SceneDataResponse saveAudioTracks(String nodeId, List<AudioTrackRequest> reqs) {
        requireSceneNode(nodeId);
        JdbcTemplate jdbc = projectService.requireJdbc();

        jdbc.update("DELETE FROM node_audio_tracks WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            AudioTrackRequest r = reqs.get(i);
            if (r.assetId() == null) throw new ProjectException("assetId is required for each track");
            requireAssetExists(jdbc, r.assetId());
            jdbc.update("""
                INSERT INTO node_audio_tracks (node_id, asset_id, track_order, start_at, start_at_frames)
                VALUES (?, ?, ?, ?, ?)
                """, nodeId, r.assetId(), i, r.startAt() != null ? r.startAt() : 0.0, r.startAtFrames());
        }
        return getSceneData(nodeId);
    }

    // ── Decisions ─────────────────────────────────────────────────────────────

    public SceneDataResponse saveDecisions(String nodeId, List<DecisionItemRequest> reqs) {
        requireSceneNode(nodeId);
        JdbcTemplate jdbc = projectService.requireJdbc();

        long defaultCount = reqs.stream().filter(r -> Boolean.TRUE.equals(r.isDefault())).count();
        if (!reqs.isEmpty() && defaultCount != 1)
            throw new ProjectException("Exactly one decision must be marked as default");

        Set<String> keys = new HashSet<>();
        for (DecisionItemRequest r : reqs) {
            if (r.decisionKey() == null || r.decisionKey().isBlank())
                throw new ProjectException("decisionKey must not be blank");
            if (!keys.add(r.decisionKey()))
                throw new ProjectException("Duplicate decisionKey: " + r.decisionKey());
        }

        jdbc.update("DELETE FROM scene_decisions WHERE node_id = ?", nodeId);
        for (int i = 0; i < reqs.size(); i++) {
            DecisionItemRequest r = reqs.get(i);
            int order = r.decisionOrder() != null ? r.decisionOrder() : i;
            jdbc.update("""
                INSERT INTO scene_decisions (node_id, decision_key, is_default, decision_order)
                VALUES (?, ?, ?, ?)
                """, nodeId, r.decisionKey().trim(), Boolean.TRUE.equals(r.isDefault()) ? 1 : 0, order);
        }
        return getSceneData(nodeId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private List<VideoLayerData> loadVideoLayers(JdbcTemplate jdbc, String nodeId) {
        List<VideoLayerData> rows = jdbc.query("""
            SELECT nvl.id, nvl.layer_order, nvl.asset_id, nvl.start_at, nvl.start_at_frames,
                   nvl.freeze_last_frame, nvl.loop_layer, a.file_name, a.has_alpha, a.duration
            FROM node_video_layers nvl
            JOIN assets a ON a.id = nvl.asset_id
            WHERE nvl.node_id = ?
            ORDER BY nvl.layer_order
            """, (rs, rowNum) -> mapVideoLayer(rs), nodeId);

        // Mark alpha errors: non-bottom layers (order > 0) that lack alpha
        for (int i = 0; i < rows.size(); i++) {
            VideoLayerData vl = rows.get(i);
            boolean alphaError = i > 0 && !vl.hasAlpha();
            if (alphaError) {
                rows.set(i, new VideoLayerData(vl.id(), vl.layerOrder(), vl.assetId(),
                    vl.assetFileName(), vl.hasAlpha(), vl.duration(), vl.startAt(), vl.startAtFrames(), true, vl.freezeLastFrame(), vl.loopLayer()));
            }
        }
        return rows;
    }

    private VideoLayerData mapVideoLayer(ResultSet rs) throws SQLException {
        return new VideoLayerData(
            rs.getLong("id"),
            rs.getInt("layer_order"),
            rs.getString("asset_id"),
            rs.getString("file_name"),
            rs.getInt("has_alpha") == 1,
            rs.getObject("duration") != null ? rs.getDouble("duration") : null,
            rs.getDouble("start_at"),
            rs.getObject("start_at_frames") != null ? rs.getInt("start_at_frames") : null,
            false,
            rs.getInt("freeze_last_frame") == 1,
            rs.getInt("loop_layer") == 1
        );
    }

    private List<AudioTrackData> loadAudioTracks(JdbcTemplate jdbc, String nodeId) {
        return jdbc.query("""
            SELECT nat.id, nat.track_order, nat.asset_id, nat.start_at, nat.start_at_frames,
                   a.file_name, a.duration
            FROM node_audio_tracks nat
            JOIN assets a ON a.id = nat.asset_id
            WHERE nat.node_id = ?
            ORDER BY nat.track_order
            """, (rs, rowNum) -> new AudioTrackData(
                rs.getLong("id"),
                rs.getInt("track_order"),
                rs.getString("asset_id"),
                rs.getString("file_name"),
                rs.getObject("duration") != null ? rs.getDouble("duration") : null,
                rs.getDouble("start_at"),
                rs.getObject("start_at_frames") != null ? rs.getInt("start_at_frames") : null
            ), nodeId);
    }

    private List<DecisionItemData> loadDecisions(JdbcTemplate jdbc, String nodeId) {
        return jdbc.query("""
            SELECT id, decision_key, is_default, decision_order
            FROM scene_decisions WHERE node_id = ? ORDER BY decision_order
            """, (rs, rowNum) -> new DecisionItemData(
                rs.getLong("id"),
                rs.getString("decision_key"),
                rs.getInt("is_default") == 1,
                rs.getInt("decision_order")
            ), nodeId);
    }

    private Double computeDuration(List<VideoLayerData> layers, List<AudioTrackData> tracks) {
        double max = -1;
        for (VideoLayerData vl : layers) {
            if (vl.loopLayer()) continue; // looped layers fill the scene, not determine its duration
            if (vl.duration() != null) max = Math.max(max, vl.startAt() + vl.duration());
        }
        for (AudioTrackData at : tracks) {
            if (at.duration() != null) max = Math.max(max, at.startAt() + at.duration());
        }
        if (max < 0) {
            for (VideoLayerData vl : layers) {
                if (vl.duration() != null) max = Math.max(max, vl.startAt() + vl.duration());
            }
        }
        return max < 0 ? null : max;
    }

    private void requireSceneNode(String nodeId) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=? AND type='scene'", Integer.class, nodeId);
        if (count == null || count == 0)
            throw new ProjectException("Scene node not found: " + nodeId);
    }

    private void requireAssetExists(JdbcTemplate jdbc, String assetId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM assets WHERE id=?", Integer.class, assetId);
        if (count == null || count == 0)
            throw new ProjectException("Asset not found: " + assetId);
    }
}
