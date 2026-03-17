package com.engine.editor.service;

import com.engine.editor.controller.dto.CompatibilityCheckResponse;
import com.engine.editor.model.Asset;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Validates that a set of video assets (in layer order, bottom-first) can be
 * composited together in a scene or transition.
 *
 * <p>Rules enforced:</p>
 * <ul>
 *   <li>All asset IDs must exist in the database.</li>
 *   <li>All assets must be video (not audio) for the video layer check.</li>
 *   <li>Every layer except the bottom one (index 0) <em>must</em> have an alpha
 *       channel — non-alpha layers on top produce undefined compositing results.</li>
 *   <li>Resolutions that differ across layers generate a warning (FFmpeg will
 *       scale automatically, but the result may be unintended).</li>
 *   <li>Frame rates that differ across layers generate a warning.</li>
 * </ul>
 */
@Service
public class AssetCompatibilityChecker {

    private final AssetService assetService;

    public AssetCompatibilityChecker(AssetService assetService) {
        this.assetService = assetService;
    }

    /**
     * Check compatibility of video assets in the given layer order (index 0 = bottom).
     *
     * @param assetIds ordered list of video asset IDs (bottom layer first)
     * @return a {@link CompatibilityCheckResponse} with any errors or warnings
     */
    public CompatibilityCheckResponse check(List<String> assetIds) {
        List<String> errors   = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (assetIds == null || assetIds.isEmpty()) {
            return new CompatibilityCheckResponse(true, errors, warnings);
        }

        // Resolve assets (collect errors for missing ones)
        List<Asset> assets = new ArrayList<>();
        for (String id : assetIds) {
            try {
                Asset a = assetService.getAsset(id);
                assets.add(a);
            } catch (Exception e) {
                errors.add("Asset not found: " + id);
                assets.add(null);
            }
        }

        // Validate each layer
        for (int i = 0; i < assets.size(); i++) {
            Asset a = assets.get(i);
            if (a == null) continue;

            if (!"video".equals(a.getMediaType())) {
                errors.add("Layer " + i + " (" + a.getFileName() + ") is not a video asset. " +
                           "Use audio tracks for audio files.");
            }

            if (i > 0 && !a.isHasAlpha()) {
                errors.add("Layer " + i + " (" + a.getFileName() + ") has no alpha channel. " +
                           "Non-bottom layers must have an alpha channel to composite correctly. " +
                           "Use a format that supports alpha (e.g., ProRes 4444, WebM/VP9 with alpha).");
            }
        }

        // Check resolution consistency (warnings only)
        List<String> resolutions = assets.stream()
            .filter(a -> a != null && a.getResolution() != null)
            .map(Asset::getResolution)
            .distinct()
            .toList();
        if (resolutions.size() > 1) {
            warnings.add("Layers have different resolutions: " + String.join(", ", resolutions) +
                         ". FFmpeg will scale to match but this may cause quality loss or unexpected framing.");
        }

        // Check frame rate consistency (warnings only)
        List<Double> frameRates = assets.stream()
            .filter(a -> a != null && a.getFrameRate() != null)
            .map(Asset::getFrameRate)
            .distinct()
            .toList();
        if (frameRates.size() > 1) {
            List<String> frStrings = frameRates.stream()
                .map(fr -> String.format("%.2f", fr))
                .toList();
            warnings.add("Layers have different frame rates: " + String.join(", ", frStrings) +
                         " fps. FFmpeg will drop/duplicate frames to match the output rate.");
        }

        return new CompatibilityCheckResponse(errors.isEmpty(), errors, warnings);
    }
}
