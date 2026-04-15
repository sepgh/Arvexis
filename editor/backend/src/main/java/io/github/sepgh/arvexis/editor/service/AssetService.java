package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.controller.dto.ScanResultResponse;
import io.github.sepgh.arvexis.editor.exception.ProjectException;
import io.github.sepgh.arvexis.editor.ffmpeg.FFprobeMediaAnalyzer;
import io.github.sepgh.arvexis.editor.ffmpeg.MediaInfo;
import io.github.sepgh.arvexis.editor.model.Asset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Manages asset scanning, indexing, tagging, and retrieval.
 *
 * <p>All database access goes through {@link ProjectService#requireJdbc()},
 * so a project must be open before any method is called.</p>
 */
@Service
public class AssetService {

    private static final Logger log = LoggerFactory.getLogger(AssetService.class);

    private static final Set<String> VIDEO_EXTENSIONS = Set.of(
        "mp4", "mov", "avi", "mkv", "webm", "m4v", "mpg", "mpeg",
        "wmv", "flv", "ogv", "mxf", "ts", "mts", "m2ts"
    );
    private static final Set<String> AUDIO_EXTENSIONS = Set.of(
        "mp3", "wav", "aac", "ogg", "flac", "m4a", "wma", "opus", "aif", "aiff"
    );

    private final ProjectService projectService;
    private final FFprobeMediaAnalyzer analyzer;

    public AssetService(ProjectService projectService, FFprobeMediaAnalyzer analyzer) {
        this.projectService = projectService;
        this.analyzer = analyzer;
    }

    // ── Scan ─────────────────────────────────────────────────────────────────

    public ScanResultResponse scan() {
        String assetsDir = projectService.getConfig().getAssetsDirectory();
        if (assetsDir == null || assetsDir.isBlank()) {
            throw new ProjectException("Project assets directory is not configured");
        }

        Path root = Paths.get(assetsDir);
        if (!Files.isDirectory(root)) {
            throw new ProjectException("Assets directory does not exist: " + root);
        }

        JdbcTemplate jdbc = projectService.requireJdbc();

        // Collect all media files in the assets tree
        List<Path> mediaFiles;
        try (Stream<Path> walk = Files.walk(root)) {
            mediaFiles = walk
                .filter(Files::isRegularFile)
                .filter(p -> detectMediaType(p) != null)
                .toList();
        } catch (IOException e) {
            throw new ProjectException("Failed to walk assets directory: " + e.getMessage(), e);
        }

        // Existing DB paths
        List<String> existingPaths = jdbc.queryForList(
            "SELECT file_path FROM assets", String.class);
        Set<String> existingSet = Set.copyOf(existingPaths);
        Set<String> foundPaths  = mediaFiles.stream()
            .map(p -> p.toAbsolutePath().toString())
            .collect(Collectors.toSet());

        int added = 0, updated = 0, removed = 0, skipped = 0;

        // Process found files
        for (Path file : mediaFiles) {
            String absPath = file.toAbsolutePath().toString();
            String mediaType = detectMediaType(file);

            if (existingSet.contains(absPath)) {
                // Check if file size changed (cheap change detection)
                Long dbSize = jdbc.queryForObject(
                    "SELECT file_size FROM assets WHERE file_path = ?", Long.class, absPath);
                long diskSize;
                try { diskSize = Files.size(file); } catch (IOException e) { skipped++; continue; }

                if (dbSize != null && dbSize == diskSize) {
                    skipped++;
                    continue;
                }
                // Re-analyze
                Asset asset = analyzeFile(file, mediaType, root);
                if (asset != null) {
                    updateAsset(jdbc, asset, absPath);
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                // New file
                Asset asset = analyzeFile(file, mediaType, root);
                if (asset != null) {
                    insertAsset(jdbc, asset);
                    added++;
                } else {
                    skipped++;
                }
            }
        }

        // Remove DB entries whose files no longer exist
        for (String dbPath : existingPaths) {
            if (!foundPaths.contains(dbPath)) {
                jdbc.update("DELETE FROM assets WHERE file_path = ?", dbPath);
                removed++;
            }
        }

        int total = jdbc.queryForObject("SELECT COUNT(*) FROM assets", Integer.class);
        log.info("Asset scan: +{} added, ~{} updated, -{} removed, {} skipped, {} total",
                 added, updated, removed, skipped, total);
        return new ScanResultResponse(added, updated, removed, skipped, total);
    }

    // ── List / get ────────────────────────────────────────────────────────────

    public List<Asset> listAssets(String directory, String mediaType, List<String> tags) {
        JdbcTemplate jdbc = projectService.requireJdbc();

        StringBuilder sql = new StringBuilder("SELECT * FROM assets WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (directory != null && !directory.isBlank()) {
            sql.append(" AND directory = ?");
            params.add(directory);
        }
        if (mediaType != null && !mediaType.isBlank()) {
            sql.append(" AND media_type = ?");
            params.add(mediaType);
        }
        if (tags != null && !tags.isEmpty()) {
            String placeholders = tags.stream().map(t -> "?").collect(Collectors.joining(","));
            sql.append(" AND id IN (SELECT asset_id FROM asset_tags WHERE tag IN (")
               .append(placeholders)
               .append(") GROUP BY asset_id HAVING COUNT(DISTINCT tag) = ?)");
            params.addAll(tags);
            params.add(tags.size());
        }
        sql.append(" ORDER BY directory, file_name");

        List<Asset> assets = jdbc.query(sql.toString(), params.toArray(), this::mapAsset);
        assets.forEach(a -> a.setTags(loadTags(jdbc, a.getId())));
        return assets;
    }

    public Asset getAsset(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        List<Asset> rows = jdbc.query("SELECT * FROM assets WHERE id = ?", this::mapAsset, id);
        if (rows.isEmpty()) throw new ProjectException("Asset not found: " + id);
        Asset asset = rows.get(0);
        asset.setTags(loadTags(jdbc, id));
        return asset;
    }

    // ── Upload / folder management ────────────────────────────────────────────

    public Asset uploadAsset(String subfolder, String fileName, byte[] bytes) {
        String assetsDir = projectService.getConfig().getAssetsDirectory();
        if (assetsDir == null || assetsDir.isBlank())
            throw new ProjectException("Project assets directory is not configured");

        Path root = Paths.get(assetsDir);
        Path dir  = (subfolder != null && !subfolder.isBlank())
            ? root.resolve(subfolder).normalize()
            : root;
        // Prevent path traversal
        if (!dir.startsWith(root))
            throw new ProjectException("Invalid subfolder path");

        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new ProjectException("Failed to create directory: " + e.getMessage(), e);
        }

        Path dest = dir.resolve(fileName);
        if (Files.exists(dest))
            throw new ProjectException("File already exists: " + fileName);

        try {
            Files.write(dest, bytes);
        } catch (IOException e) {
            throw new ProjectException("Failed to write file: " + e.getMessage(), e);
        }

        String mediaType = detectMediaType(dest);
        if (mediaType == null)
            throw new ProjectException("Unsupported file type: " + fileName);

        Asset asset = analyzeFile(dest, mediaType, root);
        if (asset == null)
            throw new ProjectException("Failed to analyse uploaded file — check FFprobe is available");

        insertAsset(projectService.requireJdbc(), asset);
        return getAsset(asset.getId());
    }

    public void createFolder(String subfolder) {
        if (subfolder == null || subfolder.isBlank())
            throw new ProjectException("Subfolder name must not be blank");

        String assetsDir = projectService.getConfig().getAssetsDirectory();
        if (assetsDir == null || assetsDir.isBlank())
            throw new ProjectException("Project assets directory is not configured");

        Path root = Paths.get(assetsDir);
        Path dir  = root.resolve(subfolder).normalize();
        if (!dir.startsWith(root))
            throw new ProjectException("Invalid subfolder path");

        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new ProjectException("Failed to create folder: " + e.getMessage(), e);
        }
    }

    public List<String> listFolders() {
        String assetsDir = projectService.getConfig().getAssetsDirectory();
        if (assetsDir == null || assetsDir.isBlank()) return List.of();
        Path root = Paths.get(assetsDir);
        if (!Files.isDirectory(root)) return List.of();
        try (Stream<Path> walk = Files.walk(root, 3)) {
            return walk
                .filter(Files::isDirectory)
                .filter(p -> !p.equals(root))
                .map(p -> root.relativize(p).toString())
                .sorted()
                .toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    // ── Tags ─────────────────────────────────────────────────────────────────

    public Asset addTag(String assetId, String tag) {
        if (tag == null || tag.isBlank()) throw new ProjectException("Tag must not be blank");
        String normalised = tag.trim().toLowerCase();

        JdbcTemplate jdbc = projectService.requireJdbc();
        ensureAssetExists(jdbc, assetId);

        jdbc.update("INSERT OR IGNORE INTO tags (tag) VALUES (?)", normalised);
        jdbc.update("INSERT OR IGNORE INTO asset_tags (asset_id, tag) VALUES (?,?)", assetId, normalised);
        return getAsset(assetId);
    }

    public void removeTag(String assetId, String tag) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        ensureAssetExists(jdbc, assetId);
        jdbc.update("DELETE FROM asset_tags WHERE asset_id = ? AND tag = ?", assetId, tag);
    }

    public List<String> listAllTags() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        return jdbc.queryForList("SELECT tag FROM tags ORDER BY tag", String.class);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private String detectMediaType(Path file) {
        String name = file.getFileName().toString().toLowerCase();
        int dot = name.lastIndexOf('.');
        if (dot < 0) return null;
        String ext = name.substring(dot + 1);
        if (VIDEO_EXTENSIONS.contains(ext)) return "video";
        if (AUDIO_EXTENSIONS.contains(ext)) return "audio";
        return null;
    }

    private Asset analyzeFile(Path file, String mediaType, Path assetsRoot) {
        try {
            MediaInfo info = analyzer.analyze(file);
            Asset asset = new Asset();
            asset.setId(UUID.randomUUID().toString());
            asset.setFilePath(file.toAbsolutePath().toString());
            asset.setFileName(file.getFileName().toString());
            asset.setDirectory(assetsRoot.relativize(file.getParent()).toString());
            asset.setMediaType(mediaType);
            asset.setHasAlpha(info.isHasAlpha());
            asset.setCodec(info.getCodec());
            if (info.getWidth() != null && info.getHeight() != null) {
                asset.setResolution(info.getWidth() + "x" + info.getHeight());
            }
            asset.setFrameRate(info.getFrameRate());
            asset.setDuration(info.getDuration());
            asset.setFileSize(info.getFileSize());
            return asset;
        } catch (IOException e) {
            log.warn("Failed to analyze {}: {}", file, e.getMessage());
            return null;
        }
    }

    private void insertAsset(JdbcTemplate jdbc, Asset a) {
        jdbc.update("""
            INSERT INTO assets
                (id, file_path, file_name, directory, media_type, has_alpha,
                 codec, resolution, frame_rate, duration, file_size)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,
            a.getId(), a.getFilePath(), a.getFileName(), a.getDirectory(),
            a.getMediaType(), a.isHasAlpha() ? 1 : 0,
            a.getCodec(), a.getResolution(), a.getFrameRate(),
            a.getDuration(), a.getFileSize()
        );
    }

    private void updateAsset(JdbcTemplate jdbc, Asset a, String existingPath) {
        jdbc.update("""
            UPDATE assets SET
                file_name=?, directory=?, media_type=?, has_alpha=?,
                codec=?, resolution=?, frame_rate=?, duration=?, file_size=?
            WHERE file_path=?
            """,
            a.getFileName(), a.getDirectory(), a.getMediaType(), a.isHasAlpha() ? 1 : 0,
            a.getCodec(), a.getResolution(), a.getFrameRate(),
            a.getDuration(), a.getFileSize(), existingPath
        );
    }

    private Asset mapAsset(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        Asset a = new Asset();
        a.setId(rs.getString("id"));
        a.setFilePath(rs.getString("file_path"));
        a.setFileName(rs.getString("file_name"));
        a.setDirectory(rs.getString("directory"));
        a.setMediaType(rs.getString("media_type"));
        a.setHasAlpha(rs.getInt("has_alpha") == 1);
        a.setCodec(rs.getString("codec"));
        a.setResolution(rs.getString("resolution"));
        double fr = rs.getDouble("frame_rate");
        a.setFrameRate(rs.wasNull() ? null : fr);
        double dur = rs.getDouble("duration");
        a.setDuration(rs.wasNull() ? null : dur);
        long fs = rs.getLong("file_size");
        a.setFileSize(rs.wasNull() ? null : fs);
        return a;
    }

    private List<String> loadTags(JdbcTemplate jdbc, String assetId) {
        return jdbc.queryForList(
            "SELECT tag FROM asset_tags WHERE asset_id = ? ORDER BY tag", String.class, assetId);
    }

    private void ensureAssetExists(JdbcTemplate jdbc, String assetId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM assets WHERE id = ?", Integer.class, assetId);
        if (count == null || count == 0) throw new ProjectException("Asset not found: " + assetId);
    }
}
