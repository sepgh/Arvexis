package io.github.sepgh.arvexis.editor.service;

import io.github.sepgh.arvexis.editor.exception.ProjectException;
import io.github.sepgh.arvexis.editor.model.AmbientConfigData;

import java.util.Locale;
import java.util.Set;

final class AmbientSupport {

    static final Set<String> VALID_ACTIONS = Set.of("inherit", "set", "stop");

    private AmbientSupport() {}

    static AmbientConfigData defaultConfig() {
        return normalizeConfig("inherit", null, null, null);
    }

    static AmbientConfigData normalizeConfig(String action, String zoneId, Double volumeOverride, Integer fadeMsOverride) {
        String normalizedAction = normalizeAction(action);
        AmbientConfigData config = new AmbientConfigData();
        config.setAction(normalizedAction);
        if ("inherit".equals(normalizedAction)) {
            config.setVolumeOverride(clampVolume(volumeOverride));
            config.setFadeMsOverride(clampFadeMs(fadeMsOverride));
            return config;
        }
        if ("stop".equals(normalizedAction)) {
            config.setFadeMsOverride(clampFadeMs(fadeMsOverride));
            return config;
        }
        String normalizedZoneId = normalizeZoneId(zoneId);
        if (normalizedZoneId == null) {
            throw new ProjectException("Ambient action 'set' requires a zoneId");
        }
        config.setZoneId(normalizedZoneId);
        config.setVolumeOverride(clampVolume(volumeOverride));
        config.setFadeMsOverride(clampFadeMs(fadeMsOverride));
        return config;
    }

    static String normalizeAction(String action) {
        if (action == null || action.isBlank()) {
            return "inherit";
        }
        String normalized = action.trim().toLowerCase(Locale.ROOT);
        if (!VALID_ACTIONS.contains(normalized)) {
            throw new ProjectException("Invalid ambient action: " + action);
        }
        return normalized;
    }

    static String normalizeZoneId(String zoneId) {
        if (zoneId == null || zoneId.isBlank()) {
            return null;
        }
        return zoneId.trim();
    }

    static Double clampVolume(Double value) {
        if (value == null) {
            return null;
        }
        return Math.max(0.0, Math.min(1.0, value));
    }

    static Integer clampFadeMs(Integer value) {
        if (value == null) {
            return null;
        }
        return Math.max(0, value);
    }
}
