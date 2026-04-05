package com.engine.editor.service;

import com.engine.editor.controller.dto.CreateProjectRequest;
import com.engine.editor.controller.dto.UpdateProjectConfigRequest;
import com.engine.editor.exception.ProjectException;
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
import java.util.List;
import java.util.Map;

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
        config.setFps(req.fps() != null ? req.fps() : 30);
        config.setAudioSampleRate(req.audioSampleRate() != null ? req.audioSampleRate() : 44100);
        config.setAudioBitRate(req.audioBitRate() != null ? req.audioBitRate() : 128);
        config.setDecisionTimeoutSecs(req.decisionTimeoutSecs() != null ? req.decisionTimeoutSecs() : 5.0);
        config.setDefaultBackgroundColor(req.defaultBackgroundColor() != null ? req.defaultBackgroundColor() : "#000000");
        config.setHideDecisionButtons(false);
        config.setFfmpegThreads(req.ffmpegThreads());  // null = Auto

        insertConfig(config);
        currentConfig     = config;
        currentProjectPath = projectDir;

        log.info("Created project '{}' at {}", config.getName(), projectDir);
        return config;
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
        if (req.fps() != null)                    currentConfig.setFps(req.fps());
        if (req.audioSampleRate() != null)        currentConfig.setAudioSampleRate(req.audioSampleRate());
        if (req.audioBitRate() != null)           currentConfig.setAudioBitRate(req.audioBitRate());
        if (req.decisionTimeoutSecs() != null)    currentConfig.setDecisionTimeoutSecs(req.decisionTimeoutSecs());
        if (req.defaultLocaleCode() != null)      currentConfig.setDefaultLocaleCode(req.defaultLocaleCode());
        if (req.defaultBackgroundColor() != null) currentConfig.setDefaultBackgroundColor(req.defaultBackgroundColor());
        if (req.hideDecisionButtons() != null)     currentConfig.setHideDecisionButtons(req.hideDecisionButtons());
        if (Boolean.TRUE.equals(req.ffmpegThreadsAuto())) {
            currentConfig.setFfmpegThreads(null);
        } else if (req.ffmpegThreads() != null) {
            currentConfig.setFfmpegThreads(req.ffmpegThreads());
        }

        saveConfig(currentConfig);
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
                 hide_decision_buttons, ffmpeg_threads)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            config.getFfmpegThreads()
        );
    }

    private void saveConfig(ProjectConfigData config) {
        currentJdbc.update("""
            UPDATE project_config SET
                name = ?, assets_directory = ?, output_directory = ?,
                preview_resolution = ?, compile_resolutions = ?, fps = ?,
                audio_sample_rate = ?, audio_bit_rate = ?,
                decision_timeout_secs = ?, default_locale_code = ?,
                default_background_color = ?, hide_decision_buttons = ?, ffmpeg_threads = ?
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
            config.getFfmpegThreads()
        );
    }

    private ProjectConfigData loadConfig() {
        List<ProjectConfigData> rows = currentJdbc.query(
            "SELECT * FROM project_config WHERE id = 1",
            (rs, rowNum) -> {
                ProjectConfigData c = new ProjectConfigData();
                c.setName(rs.getString("name"));
                c.setAssetsDirectory(rs.getString("assets_directory"));
                c.setOutputDirectory(rs.getString("output_directory"));
                c.setPreviewResolution(rs.getString("preview_resolution"));
                c.setCompileResolutions(fromJson(rs.getString("compile_resolutions")));
                c.setFps(rs.getInt("fps"));
                c.setAudioSampleRate(rs.getInt("audio_sample_rate"));
                c.setAudioBitRate(rs.getInt("audio_bit_rate"));
                c.setDecisionTimeoutSecs(rs.getDouble("decision_timeout_secs"));
                c.setDefaultLocaleCode(rs.getString("default_locale_code"));
                c.setDefaultBackgroundColor(rs.getString("default_background_color"));
                c.setHideDecisionButtons(rs.getInt("hide_decision_buttons") == 1);
                int threads = rs.getInt("ffmpeg_threads");
                c.setFfmpegThreads(rs.wasNull() ? null : threads);
                return c;
            }
        );
        return rows.isEmpty() ? null : rows.get(0);
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
