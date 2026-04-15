package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.exception.ProjectException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class LocalizationService {

    private final ProjectService projectService;

    public LocalizationService(ProjectService projectService) {
        this.projectService = projectService;
    }

    // ── Locales ───────────────────────────────────────────────────────────────

    public List<Map<String, Object>> listLocales() {
        JdbcTemplate jdbc = projectService.requireJdbc();
        return jdbc.queryForList("SELECT code, name FROM locales ORDER BY code");
    }

    public Map<String, Object> addLocale(String code, String name) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        jdbc.update("INSERT INTO locales(code, name) VALUES(?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name",
            code, name);
        return Map.of("code", code, "name", name);
    }

    public void deleteLocale(String code) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        int rows = jdbc.update("DELETE FROM locales WHERE code=?", code);
        if (rows == 0) throw new ProjectException("Locale not found: " + code);
    }

    // ── Subtitles ─────────────────────────────────────────────────────────────

    public List<Map<String, Object>> getSubtitles(String sceneId, String localeCode) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        if (sceneId != null && localeCode != null) {
            return toSubtitleList(jdbc.queryForList(
                "SELECT id, scene_id, locale_code, start_time, end_time, text " +
                "FROM subtitle_entries WHERE scene_id=? AND locale_code=? ORDER BY start_time",
                sceneId, localeCode));
        } else if (sceneId != null) {
            return toSubtitleList(jdbc.queryForList(
                "SELECT id, scene_id, locale_code, start_time, end_time, text " +
                "FROM subtitle_entries WHERE scene_id=? ORDER BY locale_code, start_time",
                sceneId));
        } else if (localeCode != null) {
            return toSubtitleList(jdbc.queryForList(
                "SELECT id, scene_id, locale_code, start_time, end_time, text " +
                "FROM subtitle_entries WHERE locale_code=? ORDER BY scene_id, start_time",
                localeCode));
        } else {
            return toSubtitleList(jdbc.queryForList(
                "SELECT id, scene_id, locale_code, start_time, end_time, text " +
                "FROM subtitle_entries ORDER BY scene_id, locale_code, start_time"));
        }
    }

    public Map<String, Object> upsertSubtitle(String id, String sceneId, String localeCode,
                                               double startTime, double endTime, String text) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireLocale(jdbc, localeCode);
        requireScene(jdbc, sceneId);
        if (id == null) id = UUID.randomUUID().toString();
        jdbc.update("""
            INSERT INTO subtitle_entries(id, scene_id, locale_code, start_time, end_time, text)
            VALUES(?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              scene_id=excluded.scene_id, locale_code=excluded.locale_code,
              start_time=excluded.start_time, end_time=excluded.end_time, text=excluded.text
            """, id, sceneId, localeCode, startTime, endTime, text);
        return Map.of("id", id, "sceneId", sceneId, "localeCode", localeCode,
            "startTime", startTime, "endTime", endTime, "text", text);
    }

    public void deleteSubtitle(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        int rows = jdbc.update("DELETE FROM subtitle_entries WHERE id=?", id);
        if (rows == 0) throw new ProjectException("Subtitle entry not found: " + id);
    }

    // ── Decision translations ─────────────────────────────────────────────────

    public List<Map<String, Object>> getDecisionTranslations(String sceneId, String localeCode) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        if (sceneId != null && localeCode != null) {
            return toTranslationList(jdbc.queryForList(
                "SELECT id, decision_key, scene_id, locale_code, label " +
                "FROM decision_translations WHERE scene_id=? AND locale_code=? ORDER BY decision_key",
                sceneId, localeCode));
        } else if (sceneId != null) {
            return toTranslationList(jdbc.queryForList(
                "SELECT id, decision_key, scene_id, locale_code, label " +
                "FROM decision_translations WHERE scene_id=? ORDER BY locale_code, decision_key",
                sceneId));
        } else if (localeCode != null) {
            return toTranslationList(jdbc.queryForList(
                "SELECT id, decision_key, scene_id, locale_code, label " +
                "FROM decision_translations WHERE locale_code=? ORDER BY scene_id, decision_key",
                localeCode));
        } else {
            return toTranslationList(jdbc.queryForList(
                "SELECT id, decision_key, scene_id, locale_code, label " +
                "FROM decision_translations ORDER BY scene_id, locale_code, decision_key"));
        }
    }

    public Map<String, Object> upsertDecisionTranslation(String id, String decisionKey,
                                                          String sceneId, String localeCode,
                                                          String label) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        requireLocale(jdbc, localeCode);
        requireScene(jdbc, sceneId);
        if (id == null) id = UUID.randomUUID().toString();
        jdbc.update("""
            INSERT INTO decision_translations(id, decision_key, scene_id, locale_code, label)
            VALUES(?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              decision_key=excluded.decision_key, scene_id=excluded.scene_id,
              locale_code=excluded.locale_code, label=excluded.label
            """, id, decisionKey, sceneId, localeCode, label);
        return Map.of("id", id, "decisionKey", decisionKey, "sceneId", sceneId,
            "localeCode", localeCode, "label", label);
    }

    public void deleteDecisionTranslation(String id) {
        JdbcTemplate jdbc = projectService.requireJdbc();
        int rows = jdbc.update("DELETE FROM decision_translations WHERE id=?", id);
        if (rows == 0) throw new ProjectException("Decision translation not found: " + id);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void requireLocale(JdbcTemplate jdbc, String code) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM locales WHERE code=?", Integer.class, code);
        if (count == null || count == 0)
            throw new ProjectException("Locale not found: " + code);
    }

    private void requireScene(JdbcTemplate jdbc, String sceneId) {
        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM nodes WHERE id=? AND type='scene'", Integer.class, sceneId);
        if (count == null || count == 0)
            throw new ProjectException("Scene not found: " + sceneId);
    }

    private List<Map<String, Object>> toSubtitleList(List<Map<String, Object>> rows) {
        return rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",         r.get("id"));
            m.put("sceneId",    r.get("scene_id"));
            m.put("localeCode", r.get("locale_code"));
            m.put("startTime",  r.get("start_time"));
            m.put("endTime",    r.get("end_time"));
            m.put("text",       r.get("text"));
            return m;
        }).toList();
    }

    private List<Map<String, Object>> toTranslationList(List<Map<String, Object>> rows) {
        return rows.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",          r.get("id"));
            m.put("decisionKey", r.get("decision_key"));
            m.put("sceneId",     r.get("scene_id"));
            m.put("localeCode",  r.get("locale_code"));
            m.put("label",       r.get("label"));
            return m;
        }).toList();
    }
}
