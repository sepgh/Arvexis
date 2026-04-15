package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.exception.ProjectException;
import io.github.sepgh.arvexis.editor.model.ProjectConfigData;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

@Service
public class ManifestService {

    private static final String MANIFEST_FILE = "manifest.json";
    private final ObjectMapper mapper = new ObjectMapper()
        .enable(SerializationFeature.INDENT_OUTPUT);

    private final ProjectService projectService;

    public ManifestService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Public ────────────────────────────────────────────────────────────────

    public Path generateManifest() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        ProjectConfigData config = projectService.getConfig();
        Path projectDir = projectService.getCurrentProjectPath();

        // ── BFS from root to find reachable nodes ─────────────────────────────
        String rootId = findRootId(jdbc);
        if (rootId == null) throw new ProjectException("No root node set — cannot generate manifest");

        Map<String, Map<String, Object>> allNodes = loadAllNodes(jdbc);
        Set<String> reachable = bfsReachable(rootId, allNodes.keySet(), jdbc);

        // ── Build manifest map ─────────────────────────────────────────────────
        Map<String, Object> manifest = new LinkedHashMap<>();
        manifest.put("version", "1.0");
        manifest.put("generatedAt", Instant.now().toString());
        manifest.put("project", buildProjectSection(config));
        manifest.put("ambientZones", buildAmbientZones(config));
        manifest.put("assetsDirectory", config.getAssetsDirectory());
        manifest.put("rootNodeId", rootId);

        // Reachable nodes with full detail
        List<Map<String, Object>> nodeList = new ArrayList<>();
        for (String nodeId : reachable) {
            nodeList.add(buildNodeEntry(nodeId, allNodes.get(nodeId), config, jdbc));
        }
        manifest.put("nodes", nodeList);

        // Edges between reachable nodes
        List<Map<String, Object>> edgeList = buildEdges(reachable, config, jdbc);
        manifest.put("edges", edgeList);

        // Localization (filtered to reachable scenes)
        manifest.put("localization", buildLocalization(reachable, jdbc));

        // Write to file
        Path outFile = projectDir.resolve(MANIFEST_FILE);
        try {
            mapper.writeValue(outFile.toFile(), manifest);
        } catch (IOException e) {
            throw new ProjectException("Failed to write manifest: " + e.getMessage(), e);
        }
        return outFile;
    }

    public Path requireManifestFile() {
        Path file = projectService.getCurrentProjectPath().resolve(MANIFEST_FILE);
        if (!Files.exists(file))
            throw new ProjectException("Manifest not found. Generate it first with POST /api/compile/manifest.");
        return file;
    }

    // ── BFS ───────────────────────────────────────────────────────────────────

    private String findRootId(JdbcTemplate jdbc) {
        List<String> roots = jdbc.queryForList(
            "SELECT id FROM nodes WHERE is_root=1 LIMIT 1", String.class);
        return roots.isEmpty() ? null : roots.get(0);
    }

    private Set<String> bfsReachable(String rootId, Set<String> allIds, JdbcTemplate jdbc) {
        // Build adjacency
        Map<String, List<String>> adj = new HashMap<>();
        for (String id : allIds) adj.put(id, new ArrayList<>());
        jdbc.queryForList("SELECT source_node_id, target_node_id FROM edges")
            .forEach(row -> adj.computeIfAbsent((String) row.get("source_node_id"), k -> new ArrayList<>())
                               .add((String) row.get("target_node_id")));

        Set<String> visited = new LinkedHashSet<>(); // preserve insertion order
        Queue<String> queue = new ArrayDeque<>();
        queue.add(rootId);
        visited.add(rootId);
        while (!queue.isEmpty()) {
            String cur = queue.poll();
            for (String next : adj.getOrDefault(cur, List.of())) {
                if (visited.add(next)) queue.add(next);
            }
        }
        return visited;
    }

    // ── Nodes ─────────────────────────────────────────────────────────────────

    private Map<String, Map<String, Object>> loadAllNodes(JdbcTemplate jdbc) {
        Map<String, Map<String, Object>> map = new LinkedHashMap<>();
        jdbc.queryForList("SELECT * FROM nodes").forEach(r -> map.put((String) r.get("id"), r));
        return map;
    }

    private Map<String, Object> buildNodeEntry(String nodeId, Map<String, Object> nodeRow,
                                                ProjectConfigData config, JdbcTemplate jdbc) {
        Map<String, Object> n = new LinkedHashMap<>();
        n.put("id",   nodeId);
        n.put("name", nodeRow.get("name"));
        n.put("type", nodeRow.get("type"));
        n.put("isRoot", intFlag(nodeRow.get("is_root")));
        n.put("isEnd",  intFlag(nodeRow.get("is_end")));
        n.put("posX", nodeRow.get("pos_x"));
        n.put("posY", nodeRow.get("pos_y"));

        String type = (String) nodeRow.get("type");
        switch (type) {
            case "scene"    -> fillSceneNode(n, nodeId, config, jdbc);
            case "state"    -> fillStateNode(n, nodeId, jdbc);
            case "condition" -> fillConditionNode(n, nodeId, jdbc);
        }
        return n;
    }

    private void fillSceneNode(Map<String, Object> n, String nodeId,
                                ProjectConfigData config, JdbcTemplate jdbc) {
        n.put("backgroundColor",
            jdbc.queryForObject("SELECT CASE WHEN background_color IS NULL OR TRIM(background_color) = '' THEN ? ELSE background_color END FROM nodes WHERE id=?",
                String.class,
                config.getDefaultBackgroundColor() != null ? config.getDefaultBackgroundColor() : "#000000",
                nodeId));

        // Decision appearance & loop flag
        Map<String, Object> nodeFullRow = jdbc.queryForMap("SELECT * FROM nodes WHERE id=?", nodeId);
        String cfg = (String) nodeFullRow.get("decision_appearance_config");
        n.put("decisionAppearanceConfig", cfg);
        n.put("loopVideo", intFlag(nodeFullRow.get("loop_video")));
        n.put("hideDecisionButtons", nullableIntFlag(nodeFullRow.get("hide_decision_buttons")));
        n.put("showDecisionInputIndicator", nullableIntFlag(nodeFullRow.get("show_decision_input_indicator")));

        // Background music asset
        String musicAssetId = (String) nodeFullRow.get("music_asset_id");
        if (musicAssetId != null) {
            List<Map<String, Object>> musicRows = jdbc.queryForList(
                "SELECT file_path, file_name FROM assets WHERE id=?", musicAssetId);
            if (!musicRows.isEmpty()) {
                n.put("musicAssetId", musicAssetId);
                n.put("musicAssetRelPath", relPath(config.getAssetsDirectory(),
                    (String) musicRows.get(0).get("file_path")));
                n.put("musicAssetFileName", musicRows.get(0).get("file_name"));
            }
        }

        n.put("ambient", buildAmbientConfig(
            nodeFullRow.get("ambient_action"),
            nodeFullRow.get("ambient_zone_id"),
            nodeFullRow.get("ambient_volume_override"),
            nodeFullRow.get("ambient_fade_ms_override")
        ));

        // Video layers with relative asset path
        List<Map<String, Object>> layers = jdbc.queryForList("""
            SELECT nvl.layer_order, nvl.start_at, nvl.start_at_frames, nvl.freeze_last_frame, nvl.loop_layer,
                   a.id AS asset_id, a.file_path, a.file_name, a.has_alpha, a.codec, a.duration
            FROM node_video_layers nvl JOIN assets a ON a.id=nvl.asset_id
            WHERE nvl.node_id=? ORDER BY nvl.layer_order
            """, nodeId);
        int fps = config.getFps() > 0 ? config.getFps() : 30;
        List<Map<String, Object>> layerList = new ArrayList<>();
        for (Map<String, Object> r : layers) {
            Map<String, Object> l = new LinkedHashMap<>();
            l.put("layerOrder", r.get("layer_order"));
            l.put("assetId",    r.get("asset_id"));
            l.put("assetFileName", r.get("file_name"));
            l.put("assetRelPath", relPath(config.getAssetsDirectory(), (String) r.get("file_path")));
            l.put("hasAlpha",        intFlag(r.get("has_alpha")));
            l.put("codec",           r.get("codec"));
            l.put("freezeLastFrame", intFlag(r.get("freeze_last_frame")));
            l.put("loopLayer",       intFlag(r.get("loop_layer")));
            l.put("duration", r.get("duration"));
            l.put("startAtFrames", r.get("start_at_frames"));
            l.put("startAt",  resolveStartAt(r.get("start_at"), r.get("start_at_frames"), fps));
            layerList.add(l);
        }
        n.put("videoLayers", layerList);

        // Audio tracks
        List<Map<String, Object>> audios = jdbc.queryForList("""
            SELECT nat.track_order, nat.start_at, nat.start_at_frames, a.id AS asset_id, a.file_path, a.file_name, a.duration
            FROM node_audio_tracks nat JOIN assets a ON a.id=nat.asset_id
            WHERE nat.node_id=? ORDER BY nat.track_order
            """, nodeId);
        List<Map<String, Object>> audioList = new ArrayList<>();
        for (Map<String, Object> r : audios) {
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("trackOrder", r.get("track_order"));
            t.put("assetId",    r.get("asset_id"));
            t.put("assetFileName", r.get("file_name"));
            t.put("assetRelPath", relPath(config.getAssetsDirectory(), (String) r.get("file_path")));
            t.put("duration", r.get("duration"));
            t.put("startAtFrames", r.get("start_at_frames"));
            t.put("startAt",  resolveStartAt(r.get("start_at"), r.get("start_at_frames"), fps));
            audioList.add(t);
        }
        n.put("audioTracks", audioList);

        // Decisions
        List<Map<String, Object>> decs = jdbc.queryForList("""
            SELECT decision_key, is_default, decision_order, keyboard_key, condition_expression
            FROM scene_decisions WHERE node_id=? ORDER BY decision_order
            """, nodeId);
        List<Map<String, Object>> decList = new ArrayList<>();
        for (Map<String, Object> r : decs) {
            Map<String, Object> d = new LinkedHashMap<>();
            d.put("decisionKey",   r.get("decision_key"));
            d.put("isDefault",     intFlag(r.get("is_default")));
            d.put("decisionOrder", r.get("decision_order"));
            d.put("keyboardKey",   r.get("keyboard_key"));
            d.put("conditionExpression", r.get("condition_expression"));
            decList.add(d);
        }
        n.put("decisions", decList);

        // Scene-level auto-continue (only meaningful when there are no explicit decisions)
        n.put("autoContinue", intFlag(jdbc.queryForObject(
            "SELECT auto_continue FROM nodes WHERE id=?", Integer.class, nodeId)));

        // Computed duration
        double dur = computeSceneDuration(layerList, audioList);
        n.put("computedDuration", dur > 0 ? dur : null);
    }

    private void fillStateNode(Map<String, Object> n, String nodeId, JdbcTemplate jdbc) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT assignment_order, expression FROM node_state_assignments
            WHERE node_id=? ORDER BY assignment_order
            """, nodeId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("order",      r.get("assignment_order"));
            a.put("expression", r.get("expression"));
            list.add(a);
        }
        n.put("assignments", list);
    }

    private void fillConditionNode(Map<String, Object> n, String nodeId, JdbcTemplate jdbc) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT condition_order, expression, is_else FROM node_decision_conditions
            WHERE node_id=? ORDER BY condition_order
            """, nodeId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("order",      r.get("condition_order"));
            c.put("expression", r.get("expression"));
            c.put("isElse",     intFlag(r.get("is_else")));
            list.add(c);
        }
        n.put("conditions", list);
    }

    // ── Edges ─────────────────────────────────────────────────────────────────

    private List<Map<String, Object>> buildEdges(Set<String> reachable,
                                                  ProjectConfigData config,
                                                  JdbcTemplate jdbc) {
        List<Map<String, Object>> result = new ArrayList<>();
        List<Map<String, Object>> allEdges = jdbc.queryForList("SELECT * FROM edges");
        for (Map<String, Object> row : allEdges) {
            String src = (String) row.get("source_node_id");
            String tgt = (String) row.get("target_node_id");
            if (!reachable.contains(src) || !reachable.contains(tgt)) continue;

            String edgeId = (String) row.get("id");
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("id",           edgeId);
            e.put("sourceNodeId", src);
            e.put("targetNodeId", tgt);
            e.put("sourceDecisionKey",    row.get("source_decision_key"));
            e.put("sourceConditionOrder", row.get("source_condition_order"));
            e.put("transition", buildTransition(edgeId, config, jdbc));
            e.put("ambient", buildEdgeAmbient(edgeId, jdbc));
            result.add(e);
        }
        return result;
    }

    private Map<String, Object> buildTransition(String edgeId, ProjectConfigData config,
                                                  JdbcTemplate jdbc) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT type, duration, background_color FROM edge_transitions WHERE edge_id=?", edgeId);
        if (rows.isEmpty()) return null;
        Map<String, Object> row = rows.get(0);

        Map<String, Object> t = new LinkedHashMap<>();
        t.put("type",            row.get("type"));
        t.put("duration",        row.get("duration"));
        t.put("backgroundColor", row.get("background_color"));

        if ("video".equals(row.get("type"))) {
            t.put("videoLayers", buildTransVideoLayers(edgeId, config, jdbc));
            t.put("audioTracks", buildTransAudioTracks(edgeId, config, jdbc));
        }
        return t;
    }

    private List<Map<String, Object>> buildTransVideoLayers(String edgeId,
                                                              ProjectConfigData config,
                                                              JdbcTemplate jdbc) {
        int fps = config.getFps() > 0 ? config.getFps() : 30;
        return jdbc.queryForList("""
            SELECT tvl.layer_order, tvl.start_at, tvl.start_at_frames, tvl.freeze_last_frame,
                   a.id AS asset_id, a.file_path, a.file_name, a.has_alpha, a.codec, a.duration
            FROM transition_video_layers tvl JOIN assets a ON a.id=tvl.asset_id
            WHERE tvl.edge_id=? ORDER BY tvl.layer_order
            """, edgeId).stream().map(r -> {
                Map<String, Object> l = new LinkedHashMap<>();
                l.put("layerOrder",       r.get("layer_order"));
                l.put("assetId",          r.get("asset_id"));
                l.put("assetFileName",    r.get("file_name"));
                l.put("assetRelPath",     relPath(config.getAssetsDirectory(), (String) r.get("file_path")));
                l.put("hasAlpha",         intFlag(r.get("has_alpha")));
                l.put("codec",            r.get("codec"));
                l.put("freezeLastFrame",  intFlag(r.get("freeze_last_frame")));
                l.put("duration",         r.get("duration"));
                l.put("startAtFrames",    r.get("start_at_frames"));
                l.put("startAt",          resolveStartAt(r.get("start_at"), r.get("start_at_frames"), fps));
                return l;
            }).toList();
    }

    private List<Map<String, Object>> buildTransAudioTracks(String edgeId,
                                                              ProjectConfigData config,
                                                              JdbcTemplate jdbc) {
        int fps = config.getFps() > 0 ? config.getFps() : 30;
        return jdbc.queryForList("""
            SELECT tat.track_order, tat.start_at, tat.start_at_frames, a.id AS asset_id, a.file_path, a.file_name, a.duration
            FROM transition_audio_tracks tat JOIN assets a ON a.id=tat.asset_id
            WHERE tat.edge_id=? ORDER BY tat.track_order
            """, edgeId).stream().map(r -> {
                Map<String, Object> t = new LinkedHashMap<>();
                t.put("trackOrder",    r.get("track_order"));
                t.put("assetId",       r.get("asset_id"));
                t.put("assetFileName", r.get("file_name"));
                t.put("assetRelPath",  relPath(config.getAssetsDirectory(), (String) r.get("file_path")));
                t.put("duration",      r.get("duration"));
                t.put("startAtFrames", r.get("start_at_frames"));
                t.put("startAt",       resolveStartAt(r.get("start_at"), r.get("start_at_frames"), fps));
                return t;
            }).toList();
    }

    // ── Localization ──────────────────────────────────────────────────────────

    private Map<String, Object> buildLocalization(Set<String> reachableSceneIds, JdbcTemplate jdbc) {
        Map<String, Object> loc = new LinkedHashMap<>();

        loc.put("locales", jdbc.queryForList("SELECT code, name FROM locales ORDER BY code")
            .stream().map(r -> Map.of("code", r.get("code"), "name", r.get("name"))).toList());

        loc.put("subtitles", jdbc.queryForList(
            "SELECT id, scene_id, locale_code, start_time, end_time, text FROM subtitle_entries ORDER BY scene_id, locale_code, start_time")
            .stream()
            .filter(r -> reachableSceneIds.contains(r.get("scene_id")))
            .map(r -> {
                Map<String, Object> s = new LinkedHashMap<>();
                s.put("id",         r.get("id"));
                s.put("sceneId",    r.get("scene_id"));
                s.put("localeCode", r.get("locale_code"));
                s.put("startTime",  r.get("start_time"));
                s.put("endTime",    r.get("end_time"));
                s.put("text",       r.get("text"));
                return s;
            }).toList());

        loc.put("decisionTranslations", jdbc.queryForList(
            "SELECT id, decision_key, scene_id, locale_code, label FROM decision_translations ORDER BY scene_id, locale_code")
            .stream()
            .filter(r -> reachableSceneIds.contains(r.get("scene_id")))
            .map(r -> {
                Map<String, Object> dt = new LinkedHashMap<>();
                dt.put("id",          r.get("id"));
                dt.put("decisionKey", r.get("decision_key"));
                dt.put("sceneId",     r.get("scene_id"));
                dt.put("localeCode",  r.get("locale_code"));
                dt.put("label",       r.get("label"));
                return dt;
            }).toList());

        return loc;
    }

    // ── Project section ───────────────────────────────────────────────────────

    private Map<String, Object> buildProjectSection(ProjectConfigData c) {
        Map<String, Object> p = new LinkedHashMap<>();
        p.put("name",                c.getName());
        p.put("fps",                 c.getFps());
        p.put("previewResolution",   c.getPreviewResolution());
        p.put("compileResolutions",  c.getCompileResolutions());
        p.put("audioSampleRate",     c.getAudioSampleRate());
        p.put("audioBitRate",        c.getAudioBitRate());
        p.put("decisionTimeoutSecs", c.getDecisionTimeoutSecs());
        p.put("defaultLocaleCode",   c.getDefaultLocaleCode());
        p.put("defaultBackgroundColor", c.getDefaultBackgroundColor());
        p.put("hideDecisionButtons", c.isHideDecisionButtons());
        p.put("showDecisionInputIndicator", c.isShowDecisionInputIndicator());
        return p;
    }

    private List<Map<String, Object>> buildAmbientZones(ProjectConfigData config) {
        if (config.getAmbientZones() == null || config.getAmbientZones().isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> zones = new ArrayList<>();
        for (var zone : config.getAmbientZones()) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", zone.getId());
            entry.put("name", zone.getName());
            entry.put("assetId", zone.getAssetId());
            entry.put("assetFileName", zone.getAssetFileName());
            entry.put("assetRelPath", zone.getAssetRelPath());
            entry.put("defaultVolume", zone.getDefaultVolume());
            entry.put("defaultFadeMs", zone.getDefaultFadeMs());
            entry.put("loop", zone.isLoop());
            zones.add(entry);
        }
        return zones;
    }

    private Map<String, Object> buildEdgeAmbient(String edgeId, JdbcTemplate jdbc) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT ambient_action, ambient_zone_id, ambient_volume_override, ambient_fade_ms_override FROM edge_ambient WHERE edge_id=?",
            edgeId
        );
        if (rows.isEmpty()) {
            return buildAmbientConfig("inherit", null, null, null);
        }
        Map<String, Object> row = rows.get(0);
        return buildAmbientConfig(
            row.get("ambient_action"),
            row.get("ambient_zone_id"),
            row.get("ambient_volume_override"),
            row.get("ambient_fade_ms_override")
        );
    }

    private Map<String, Object> buildAmbientConfig(Object actionValue, Object zoneIdValue, Object volumeOverrideValue, Object fadeMsOverrideValue) {
        Map<String, Object> ambient = new LinkedHashMap<>();
        String action = AmbientSupport.normalizeAction(actionValue != null ? actionValue.toString() : null);
        ambient.put("action", action);
        if (!"set".equals(action)) {
            return ambient;
        }
        if (zoneIdValue != null) {
            ambient.put("zoneId", zoneIdValue);
        }
        if (volumeOverrideValue != null) {
            ambient.put("volumeOverride", toDouble(volumeOverrideValue));
        }
        if (fadeMsOverrideValue != null) {
            ambient.put("fadeMsOverride", toInt(fadeMsOverrideValue));
        }
        return ambient;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String relPath(String assetsDir, String filePath) {
        if (filePath == null || assetsDir == null) return filePath;
        try {
            Path base = Path.of(assetsDir).toAbsolutePath().normalize();
            Path file = Path.of(filePath).toAbsolutePath().normalize();
            return base.relativize(file).toString().replace('\\', '/');
        } catch (Exception e) {
            return filePath;
        }
    }

    private boolean intFlag(Object val) {
        if (val == null) return false;
        if (val instanceof Boolean b) return b;
        if (val instanceof Number n) return n.intValue() == 1;
        return "1".equals(val.toString()) || "true".equalsIgnoreCase(val.toString());
    }

    private Boolean nullableIntFlag(Object val) {
        if (val == null) return null;
        if (val instanceof Boolean b) return b;
        if (val instanceof Number n) return n.intValue() == 1;
        return "1".equals(val.toString()) || "true".equalsIgnoreCase(val.toString());
    }

    private double computeSceneDuration(List<Map<String, Object>> layers,
                                         List<Map<String, Object>> audios) {
        double max = -1;
        for (Map<String, Object> l : layers) {
            if (Boolean.TRUE.equals(l.get("loopLayer"))) continue; // looped layers fill the scene, not determine its duration
            Object dur = l.get("duration");
            Object start = l.get("startAt");
            if (dur != null) max = Math.max(max, toDouble(dur) + toDouble(start));
        }
        for (Map<String, Object> t : audios) {
            Object dur = t.get("duration");
            Object start = t.get("startAt");
            if (dur != null) max = Math.max(max, toDouble(dur) + toDouble(start));
        }
        if (max < 0) {
            for (Map<String, Object> l : layers) {
                Object dur = l.get("duration");
                Object start = l.get("startAt");
                if (dur != null) max = Math.max(max, toDouble(dur) + toDouble(start));
            }
        }
        if (max < 0) return 0;
        return max;
    }

    private double resolveStartAt(Object startAtSeconds, Object startAtFrames, int fps) {
        if (startAtFrames instanceof Number n && n.intValue() >= 0) {
            return n.intValue() / (double) fps;
        }
        return toDouble(startAtSeconds);
    }

    private double toDouble(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (Exception e) { return 0; }
    }

    private int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.intValue();
        try { return Integer.parseInt(val.toString()); } catch (Exception e) { return 0; }
    }
}
