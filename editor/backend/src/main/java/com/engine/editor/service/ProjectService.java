package com.engine.editor.service;

import com.engine.editor.controller.dto.AmbientZoneRequest;
import com.engine.editor.controller.dto.CreateProjectRequest;
import com.engine.editor.controller.dto.UpdateProjectConfigRequest;
import com.engine.editor.exception.ProjectException;
import com.engine.editor.model.AmbientZoneData;
import com.engine.editor.model.ProjectConfigData;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Manages the project lifecycle: create, open, close.
 *
 * <p>Each project is a directory containing a {@code project.db} SQLite file
 * and an {@code assets/} directory. This service owns the project-specific
 * {@link DataSource} and {@link JdbcTemplate}; all other services that need
 * direct DB access should inject {@code ProjectService} and call
 * {@link #requireJdbc()}.</p>
 */
@Service
public class ProjectService {

    private static final Logger log = LoggerFactory.getLogger(ProjectService.class);
    private static final String DB_FILE_NAME = "project.db";
    private static final String DEFAULT_ASSETS_DIR = "assets";
    private static final String DEFAULT_OUTPUT_DIR = "output";

    private final ObjectMapper objectMapper = new ObjectMapper();

    private volatile HikariDataSource currentDataSource;
    private volatile JdbcTemplate     currentJdbc;
    private volatile Path             currentProjectPath;
    private volatile ProjectConfigData currentConfig;

    // ── Public API ────────────────────────────────────────────────────────────

    public synchronized ProjectConfigData createProject(CreateProjectRequest req) {
        if (req.directoryPath() == null || req.directoryPath().isBlank()) {
            throw new ProjectException("directoryPath is required");
        }
        if (req.name() == null || req.name().isBlank()) {
            throw new ProjectException("name is required");
        }

        Path projectDir = Paths.get(req.directoryPath()).toAbsolutePath().normalize();
        Path dbFile     = projectDir.resolve(DB_FILE_NAME);

        if (Files.exists(dbFile)) {
            throw new ProjectException("A project already exists at: " + projectDir +
                                        ". Use /api/project/open to open it.");
        }

        try {
            Files.createDirectories(projectDir);
        } catch (IOException e) {
            throw new ProjectException("Cannot create project directory: " + projectDir, e);
        }

        String assetsDir = req.assetsDirectory() != null
            ? req.assetsDirectory()
            : projectDir.resolve(DEFAULT_ASSETS_DIR).toString();
        String outputDir = req.outputDirectory() != null
            ? req.outputDirectory()
            : projectDir.resolve(DEFAULT_OUTPUT_DIR).toString();

        try {
            Files.createDirectories(Paths.get(assetsDir));
            Files.createDirectories(Paths.get(outputDir));
        } catch (IOException e) {
            throw new ProjectException("Cannot create assets/output directories", e);
        }

        switchDataSource(dbFile);
        runMigrations(currentDataSource);

        ProjectConfigData config = new ProjectConfigData();
        config.setName(req.name());
        config.setAssetsDirectory(assetsDir);
        config.setOutputDirectory(outputDir);
        config.setPreviewResolution(req.previewResolution() != null ? req.previewResolution() : "1280x720");
        config.setCompileResolutions(req.compileResolutions() != null
            ? req.compileResolutions() : List.of("2K", "1080p", "720p"));
        config.setAmbientZones(List.of());
        config.setFps(req.fps() != null ? req.fps() : 30);
        config.setAudioSampleRate(req.audioSampleRate() != null ? req.audioSampleRate() : 44100);
        config.setAudioBitRate(req.audioBitRate() != null ? req.audioBitRate() : 128);
        config.setDecisionTimeoutSecs(req.decisionTimeoutSecs() != null ? req.decisionTimeoutSecs() : 5.0);
        config.setDefaultBackgroundColor(req.defaultBackgroundColor() != null ? req.defaultBackgroundColor() : "#000000");
        config.setHideDecisionButtons(false);
        config.setShowDecisionInputIndicator(false);
        config.setFfmpegThreads(req.ffmpegThreads());  // null = Auto

        insertConfig(config);
        currentConfig     = loadConfig();
        currentProjectPath = projectDir;

        log.info("Created project '{}' at {}", config.getName(), projectDir);
        return currentConfig;
    }

    public synchronized ProjectConfigData openProject(String directoryPath) {
        if (directoryPath == null || directoryPath.isBlank()) {
            throw new ProjectException("directoryPath is required");
        }

        Path projectDir = Paths.get(directoryPath).toAbsolutePath().normalize();
        Path dbFile     = projectDir.resolve(DB_FILE_NAME);
        Path assetsDir  = projectDir.resolve(DEFAULT_ASSETS_DIR);

        if (!Files.isDirectory(projectDir)) {
            throw new ProjectException("Directory does not exist: " + projectDir);
        }
        if (!Files.exists(dbFile)) {
            throw new ProjectException("Not a valid project directory (missing project.db): " + projectDir);
        }
        if (!Files.isDirectory(assetsDir)) {
            throw new ProjectException("Not a valid project directory (missing assets/): " + projectDir);
        }

        switchDataSource(dbFile);
        runMigrations(currentDataSource);

        ProjectConfigData config = loadConfig();
        if (config == null) {
            throw new ProjectException("Project database exists but has no configuration. It may be corrupted.");
        }

        currentConfig     = config;
        currentProjectPath = projectDir;

        log.info("Opened project '{}' from {}", config.getName(), projectDir);
        return config;
    }

    public boolean isOpen() {
        return currentProjectPath != null;
    }

    public Path getCurrentProjectPath() {
        return currentProjectPath;
    }

    public ProjectConfigData getConfig() {
        requireOpen();
        return currentConfig;
    }

    public ProjectConfigData updateConfig(UpdateProjectConfigRequest req) {
        requireOpen();

        if (req.name() != null)                  currentConfig.setName(req.name());
        if (req.assetsDirectory() != null)        currentConfig.setAssetsDirectory(req.assetsDirectory());
        if (req.outputDirectory() != null)        currentConfig.setOutputDirectory(req.outputDirectory());
        if (req.previewResolution() != null)      currentConfig.setPreviewResolution(req.previewResolution());
        if (req.compileResolutions() != null)     currentConfig.setCompileResolutions(req.compileResolutions());
        if (req.ambientZones() != null) {
            List<AmbientZoneData> ambientZones = normalizeAmbientZones(req.ambientZones());
            ensureAmbientZoneReferencesRemainValid(ambientZones);
            currentConfig.setAmbientZones(ambientZones);
        }
        if (req.fps() != null)                    currentConfig.setFps(req.fps());
        if (req.audioSampleRate() != null)        currentConfig.setAudioSampleRate(req.audioSampleRate());
        if (req.audioBitRate() != null)           currentConfig.setAudioBitRate(req.audioBitRate());
        if (req.decisionTimeoutSecs() != null)    currentConfig.setDecisionTimeoutSecs(req.decisionTimeoutSecs());
        if (req.defaultLocaleCode() != null)      currentConfig.setDefaultLocaleCode(req.defaultLocaleCode());
        if (req.defaultBackgroundColor() != null) currentConfig.setDefaultBackgroundColor(req.defaultBackgroundColor());
        if (req.hideDecisionButtons() != null)     currentConfig.setHideDecisionButtons(req.hideDecisionButtons());
        if (req.showDecisionInputIndicator() != null) currentConfig.setShowDecisionInputIndicator(req.showDecisionInputIndicator());
        if (Boolean.TRUE.equals(req.ffmpegThreadsAuto())) {
            currentConfig.setFfmpegThreads(null);
        } else if (req.ffmpegThreads() != null) {
            currentConfig.setFfmpegThreads(req.ffmpegThreads());
        }

        saveConfig(currentConfig);
        currentConfig = loadConfig();
        return currentConfig;
    }

    /**
     * Returns the {@link JdbcTemplate} for the currently-open project.
     * Throws if no project is open.
     */
    public JdbcTemplate requireJdbc() {
        requireOpen();
        return currentJdbc;
    }

    /**
     * Returns the raw {@link DataSource} for the currently-open project,
     * e.g. for programmatic Flyway runs from other services.
     */
    public DataSource requireDataSource() {
        requireOpen();
        return currentDataSource;
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private void requireOpen() {
        if (!isOpen()) {
            throw new ProjectException("No project is currently open. " +
                                        "Create or open a project first.");
        }
    }

    private void switchDataSource(Path dbFile) {
        if (currentDataSource != null && !currentDataSource.isClosed()) {
            log.debug("Closing previous project DataSource");
            currentDataSource.close();
        }

        HikariConfig hikari = new HikariConfig();
        hikari.setJdbcUrl("jdbc:sqlite:" + dbFile.toAbsolutePath());
        hikari.setDriverClassName("org.sqlite.JDBC");
        hikari.setMaximumPoolSize(1);
        hikari.setMinimumIdle(1);
        hikari.setConnectionTestQuery("SELECT 1");

        currentDataSource = new HikariDataSource(hikari);
        currentJdbc       = new JdbcTemplate(currentDataSource);
        log.debug("Opened project DataSource at {}", dbFile);
    }

    private void runMigrations(DataSource ds) {
        Flyway flyway = Flyway.configure()
            .dataSource(ds)
            .locations("classpath:db/migration")
            .baselineOnMigrate(false)
            .load();
        var result = flyway.migrate();
        log.debug("Flyway: applied {} migration(s)", result.migrationsExecuted);
    }

    private void insertConfig(ProjectConfigData config) {
        currentJdbc.update("""
            INSERT INTO project_config
                (id, name, assets_directory, output_directory, preview_resolution,
                 compile_resolutions, fps, audio_sample_rate, audio_bit_rate,
                 decision_timeout_secs, default_locale_code, default_background_color,
                 hide_decision_buttons, show_decision_input_indicator, ffmpeg_threads)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            config.getName(),
            config.getAssetsDirectory(),
            config.getOutputDirectory(),
            config.getPreviewResolution(),
            toJson(config.getCompileResolutions()),
            config.getFps(),
            config.getAudioSampleRate(),
            config.getAudioBitRate(),
            config.getDecisionTimeoutSecs(),
            config.getDefaultLocaleCode(),
            config.getDefaultBackgroundColor(),
            config.isHideDecisionButtons() ? 1 : 0,
            config.isShowDecisionInputIndicator() ? 1 : 0,
            config.getFfmpegThreads()
        );
        saveAmbientZones(config.getAmbientZones());
    }

    private void saveConfig(ProjectConfigData config) {
        currentJdbc.update("""
            UPDATE project_config SET
                name = ?, assets_directory = ?, output_directory = ?,
                preview_resolution = ?, compile_resolutions = ?, fps = ?,
                audio_sample_rate = ?, audio_bit_rate = ?,
                decision_timeout_secs = ?, default_locale_code = ?,
                default_background_color = ?, hide_decision_buttons = ?,
                show_decision_input_indicator = ?, ffmpeg_threads = ?
            WHERE id = 1
            """,
            config.getName(),
            config.getAssetsDirectory(),
            config.getOutputDirectory(),
            config.getPreviewResolution(),
            toJson(config.getCompileResolutions()),
            config.getFps(),
            config.getAudioSampleRate(),
            config.getAudioBitRate(),
            config.getDecisionTimeoutSecs(),
            config.getDefaultLocaleCode(),
            config.getDefaultBackgroundColor(),
            config.isHideDecisionButtons() ? 1 : 0,
            config.isShowDecisionInputIndicator() ? 1 : 0,
            config.getFfmpegThreads()
        );
        saveAmbientZones(config.getAmbientZones());
    }

    private ProjectConfigData loadConfig() {
        List<Map<String, Object>> rows = currentJdbc.queryForList("SELECT * FROM project_config WHERE id = 1");
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        ProjectConfigData c = new ProjectConfigData();
        c.setName((String) row.get("name"));
        c.setAssetsDirectory((String) row.get("assets_directory"));
        c.setOutputDirectory((String) row.get("output_directory"));
        c.setPreviewResolution((String) row.get("preview_resolution"));
        c.setCompileResolutions(fromJson((String) row.get("compile_resolutions")));
        c.setFps(((Number) row.get("fps")).intValue());
        c.setAudioSampleRate(((Number) row.get("audio_sample_rate")).intValue());
        c.setAudioBitRate(((Number) row.get("audio_bit_rate")).intValue());
        c.setDecisionTimeoutSecs(((Number) row.get("decision_timeout_secs")).doubleValue());
        c.setDefaultLocaleCode((String) row.get("default_locale_code"));
        c.setDefaultBackgroundColor((String) row.get("default_background_color"));
        c.setHideDecisionButtons(((Number) row.get("hide_decision_buttons")).intValue() == 1);
        c.setShowDecisionInputIndicator(((Number) row.get("show_decision_input_indicator")).intValue() == 1);
        Object threads = row.get("ffmpeg_threads");
        c.setFfmpegThreads(threads instanceof Number number ? number.intValue() : null);
        c.setAmbientZones(loadAmbientZones(c.getAssetsDirectory()));
        return c;
    }

    private List<AmbientZoneData> normalizeAmbientZones(List<AmbientZoneRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            return List.of();
        }
        List<AmbientZoneData> zones = new ArrayList<>();
        Set<String> seenIds = new LinkedHashSet<>();
        for (AmbientZoneRequest request : requests) {
            if (request == null) {
                continue;
            }
            String name = request.name() != null ? request.name().trim() : "";
            if (name.isBlank()) {
                throw new ProjectException("Ambient zone name must not be blank");
            }
            String assetId = request.assetId() != null ? request.assetId().trim() : null;
            if (assetId == null || assetId.isBlank()) {
                throw new ProjectException("Ambient zone '" + name + "' must reference an audio asset");
            }
            requireAudioAssetExists(assetId);
            String id = request.id() != null && !request.id().isBlank()
                ? request.id().trim()
                : UUID.randomUUID().toString();
            if (!seenIds.add(id)) {
                throw new ProjectException("Duplicate ambient zone id: " + id);
            }
            AmbientZoneData zone = new AmbientZoneData();
            zone.setId(id);
            zone.setName(name);
            zone.setAssetId(assetId);
            Double defaultVolume = AmbientSupport.clampVolume(request.defaultVolume());
            Integer defaultFadeMs = AmbientSupport.clampFadeMs(request.defaultFadeMs());
            zone.setDefaultVolume(defaultVolume != null ? defaultVolume : 1.0);
            zone.setDefaultFadeMs(defaultFadeMs != null ? defaultFadeMs : 1000);
            zone.setLoop(request.loop() == null || request.loop());
            zones.add(zone);
        }
        return List.copyOf(zones);
    }

    private void saveAmbientZones(List<AmbientZoneData> zones) {
        currentJdbc.update("DELETE FROM ambient_zones");
        if (zones == null || zones.isEmpty()) {
            return;
        }
        for (AmbientZoneData zone : zones) {
            currentJdbc.update("""
                INSERT INTO ambient_zones (id, name, asset_id, default_volume, default_fade_ms, loop)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                zone.getId(),
                zone.getName(),
                zone.getAssetId(),
                zone.getDefaultVolume(),
                zone.getDefaultFadeMs(),
                zone.isLoop() ? 1 : 0
            );
        }
    }

    private List<AmbientZoneData> loadAmbientZones(String assetsDirectory) {
        return currentJdbc.query("""
            SELECT z.id, z.name, z.asset_id, z.default_volume, z.default_fade_ms, z.loop,
                   a.file_name, a.file_path
            FROM ambient_zones z
            LEFT JOIN assets a ON a.id = z.asset_id
            ORDER BY z.name COLLATE NOCASE, z.id
            """, (rs, rowNum) -> {
                AmbientZoneData zone = new AmbientZoneData();
                zone.setId(rs.getString("id"));
                zone.setName(rs.getString("name"));
                zone.setAssetId(rs.getString("asset_id"));
                zone.setAssetFileName(rs.getString("file_name"));
                zone.setAssetRelPath(relPath(assetsDirectory, rs.getString("file_path")));
                zone.setDefaultVolume(rs.getDouble("default_volume"));
                zone.setDefaultFadeMs(rs.getInt("default_fade_ms"));
                zone.setLoop(rs.getInt("loop") == 1);
                return zone;
            });
    }

    private void requireAudioAssetExists(String assetId) {
        Integer count = currentJdbc.queryForObject(
            "SELECT COUNT(*) FROM assets WHERE id = ? AND media_type = 'audio'",
            Integer.class,
            assetId
        );
        if (count == null || count == 0) {
            throw new ProjectException("Audio asset not found: " + assetId);
        }
    }

    private void ensureAmbientZoneReferencesRemainValid(List<AmbientZoneData> zones) {
        Set<String> validZoneIds = zones.stream()
            .map(AmbientZoneData::getId)
            .filter(Objects::nonNull)
            .collect(LinkedHashSet::new, Set::add, Set::addAll);

        List<String> missingSceneRefs = currentJdbc.queryForList(
            "SELECT DISTINCT ambient_zone_id FROM nodes WHERE ambient_action = 'set' AND ambient_zone_id IS NOT NULL",
            String.class
        ).stream().filter(zoneId -> !validZoneIds.contains(zoneId)).toList();
        if (!missingSceneRefs.isEmpty()) {
            throw new ProjectException("Ambient zone still referenced by scene config: " + missingSceneRefs.get(0));
        }

        List<String> missingEdgeRefs = currentJdbc.queryForList(
            "SELECT DISTINCT ambient_zone_id FROM edge_ambient WHERE ambient_action = 'set' AND ambient_zone_id IS NOT NULL",
            String.class
        ).stream().filter(zoneId -> !validZoneIds.contains(zoneId)).toList();
        if (!missingEdgeRefs.isEmpty()) {
            throw new ProjectException("Ambient zone still referenced by edge config: " + missingEdgeRefs.get(0));
        }
    }

    private String relPath(String assetsDir, String filePath) {
        if (filePath == null || assetsDir == null) {
            return filePath;
        }
        try {
            Path base = Path.of(assetsDir).toAbsolutePath().normalize();
            Path file = Path.of(filePath).toAbsolutePath().normalize();
            return base.relativize(file).toString().replace('\\', '/');
        } catch (Exception e) {
            return filePath;
        }
    }

    private String toJson(List<String> list) {
        if (list == null) return null;
        try { return objectMapper.writeValueAsString(list); }
        catch (JsonProcessingException e) { return "[]"; }
    }

    private List<String> fromJson(String json) {
        if (json == null || json.isBlank()) return List.of();
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (JsonProcessingException e) { return List.of(); }
    }
}
