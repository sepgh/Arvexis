package io.github.sepgh.arvexis.editor.ffmpeg;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

/**
 * Extracts media metadata from a file by running {@code ffprobe} and
 * parsing its JSON output.
 *
 * <p>Alpha channel detection checks the {@code pix_fmt} field against
 * known alpha-carrying pixel formats (e.g., {@code yuva444p10le} for
 * ProRes 4444, {@code rgba}, {@code argb}, {@code bgra}).</p>
 */
@Component
public class FFprobeMediaAnalyzer {

    private static final Logger log = LoggerFactory.getLogger(FFprobeMediaAnalyzer.class);

    private static final Set<String> ALPHA_PIXEL_FORMATS = Set.of(
        "yuva420p", "yuva422p", "yuva444p",
        "yuva420p9be", "yuva420p9le",
        "yuva420p10be", "yuva420p10le",
        "yuva420p16be", "yuva420p16le",
        "yuva422p10be", "yuva422p10le",
        "yuva422p12be", "yuva422p12le",
        "yuva422p16be", "yuva422p16le",
        "yuva444p9be", "yuva444p9le",
        "yuva444p10be", "yuva444p10le",
        "yuva444p12be", "yuva444p12le",
        "yuva444p16be", "yuva444p16le",
        "rgba", "rgba64be", "rgba64le",
        "argb", "bgra", "abgr",
        "ya8", "ya16be", "ya16le",
        "gbrap", "gbrap10be", "gbrap10le",
        "gbrap12be", "gbrap12le", "gbrap16be", "gbrap16le"
    );

    private String ffprobePath = "ffprobe";
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void setFfprobePath(String path) {
        this.ffprobePath = path;
    }

    /**
     * Runs ffprobe on the given file and returns a populated {@link MediaInfo}.
     */
    public MediaInfo analyze(Path filePath) throws IOException {
        if (!Files.isReadable(filePath)) {
            throw new IOException("File is not readable: " + filePath);
        }

        List<String> command = java.util.List.of(
            ffprobePath,
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            filePath.toAbsolutePath().toString()
        );

        ProcessResult result = ProcessRunner.run(command, 30);
        if (!result.isSuccess()) {
            throw new IOException("ffprobe failed for " + filePath + ": " + result.getStderr());
        }

        return parseProbeOutput(filePath, result.getStdout());
    }

    private MediaInfo parseProbeOutput(Path filePath, String json) throws IOException {
        JsonNode root = objectMapper.readTree(json);
        MediaInfo info = new MediaInfo();
        info.setFilePath(filePath.toAbsolutePath().toString());

        JsonNode format = root.path("format");
        if (format.has("duration")) {
            info.setDuration(format.get("duration").asDouble());
        }
        if (format.has("size")) {
            info.setFileSize(format.get("size").asLong());
        }

        JsonNode streams = root.path("streams");
        JsonNode videoStream = findStream(streams, "video");
        JsonNode audioStream = findStream(streams, "audio");
        info.setHasAudio(audioStream != null);

        if (videoStream != null) {
            info.setMediaType("video");
            info.setCodec(videoStream.path("codec_name").asText(null));
            info.setWidth(videoStream.has("width") ? videoStream.get("width").asInt() : null);
            info.setHeight(videoStream.has("height") ? videoStream.get("height").asInt() : null);

            String pixFmt = videoStream.path("pix_fmt").asText(null);
            info.setPixelFormat(pixFmt);
            info.setHasAlpha(detectAlpha(pixFmt, videoStream, streams));

            String rFrameRate = videoStream.path("r_frame_rate").asText(null);
            if (rFrameRate != null) {
                info.setFrameRate(parseFrameRate(rFrameRate));
            }

            if (!format.has("duration") && videoStream.has("duration")) {
                info.setDuration(videoStream.get("duration").asDouble());
            }
        } else if (audioStream != null) {
            info.setMediaType("audio");
        }

        if (audioStream != null) {
            if (info.getCodec() == null) {
                info.setCodec(audioStream.path("codec_name").asText(null));
            }
            String sampleRate = audioStream.path("sample_rate").asText(null);
            if (sampleRate != null) {
                try { info.setAudioSampleRate(Integer.parseInt(sampleRate)); } catch (NumberFormatException ignored) {}
            }
            info.setAudioChannels(audioStream.has("channels") ? audioStream.get("channels").asInt() : null);

            if (!format.has("duration") && audioStream.has("duration") && info.getDuration() == null) {
                info.setDuration(audioStream.get("duration").asDouble());
            }
        }

        if (info.getFileSize() == null) {
            try { info.setFileSize(Files.size(filePath)); } catch (IOException ignored) {}
        }

        return info;
    }

    private JsonNode findStream(JsonNode streams, String codecType) {
        if (streams == null || !streams.isArray()) return null;
        for (JsonNode stream : streams) {
            if (codecType.equals(stream.path("codec_type").asText())) {
                return stream;
            }
        }
        return null;
    }

    private boolean detectAlpha(String pixFmt, JsonNode videoStream, JsonNode streams) {
        if (pixFmt != null && ALPHA_PIXEL_FORMATS.contains(pixFmt.toLowerCase())) {
            return true;
        }
        // VP9+alpha in WebM signals alpha via an alpha_mode=1 tag on the single video stream
        // (the alpha plane is stored as block additions, not a separate stream).
        if (videoStream != null
                && "1".equals(videoStream.path("tags").path("alpha_mode").asText(null))) {
            return true;
        }
        // Fallback: some encoders do produce a dedicated second video stream for the alpha plane.
        return countStreams(streams, "video") > 1;
    }

    private int countStreams(JsonNode streams, String codecType) {
        if (streams == null || !streams.isArray()) return 0;
        int count = 0;
        for (JsonNode stream : streams) {
            if (codecType.equals(stream.path("codec_type").asText())) {
                count++;
            }
        }
        return count;
    }

    private Double parseFrameRate(String rational) {
        if (rational == null || rational.isBlank()) return null;
        String[] parts = rational.split("/");
        if (parts.length == 2) {
            try {
                double num = Double.parseDouble(parts[0]);
                double den = Double.parseDouble(parts[1]);
                return den != 0 ? num / den : null;
            } catch (NumberFormatException ignored) {}
        }
        try {
            return Double.parseDouble(rational);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
