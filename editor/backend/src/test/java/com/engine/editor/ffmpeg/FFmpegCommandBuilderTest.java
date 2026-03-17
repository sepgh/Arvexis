package com.engine.editor.ffmpeg;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FFmpegCommandBuilderTest {

    @Test
    void buildMinimalCommand() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/input.mp4")
            .output("/tmp/output.mp4")
            .build();

        assertEquals("ffmpeg", cmd.get(0));
        assertTrue(cmd.contains("-i"));
        assertTrue(cmd.contains("/tmp/input.mp4"));
        assertEquals("/tmp/output.mp4", cmd.get(cmd.size() - 1));
    }

    @Test
    void outputMustBeLast() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .overwrite()
            .input("/tmp/a.mp4")
            .videoCodec("libx264")
            .audioCodec("aac")
            .output("/tmp/out.mp4")
            .build();

        assertEquals("/tmp/out.mp4", cmd.get(cmd.size() - 1));
    }

    @Test
    void overwriteFlagPresent() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .overwrite()
            .input("/tmp/a.mp4")
            .output("/tmp/b.mp4")
            .build();

        assertTrue(cmd.contains("-y"));
        // -y must appear before the first -i
        assertTrue(cmd.indexOf("-y") < cmd.indexOf("-i"));
    }

    @Test
    void filterComplexIncluded() {
        String filter = "[0:v][1:v]overlay=0:0[out]";
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/bg.mp4")
            .input("/tmp/overlay.mov")
            .filterComplex(filter)
            .mapVideo("[out]")
            .output("/tmp/result.mp4")
            .build();

        assertTrue(cmd.contains("-filter_complex"));
        int filterIdx = cmd.indexOf("-filter_complex");
        assertEquals(filter, cmd.get(filterIdx + 1));
    }

    @Test
    void multipleInputsInOrder() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/a.mp4")
            .input("/tmp/b.mp4")
            .input("/tmp/c.mp4")
            .output("/tmp/out.mp4")
            .build();

        List<String> inputs = cmd.stream()
            .filter(s -> s.endsWith(".mp4") && !s.equals("/tmp/out.mp4"))
            .toList();

        assertEquals(List.of("/tmp/a.mp4", "/tmp/b.mp4", "/tmp/c.mp4"), inputs);
    }

    @Test
    void colorInputGeneratesLavfiInput() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .colorInput("black", "1920x1080", 30, 10.0)
            .output("/tmp/out.mp4")
            .build();

        assertTrue(cmd.contains("-f"));
        assertTrue(cmd.contains("lavfi"));
        assertTrue(cmd.stream().anyMatch(s -> s.startsWith("color=c=black")));
    }

    @Test
    void hlsOptionsIncluded() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/scene.mp4")
            .videoCodec("copy")
            .audioCodec("copy")
            .hlsSegmentDuration(6)
            .hlsPlaylistType("vod")
            .hlsSegmentFilename("/tmp/hls/segment_%05d.ts")
            .output("/tmp/hls/playlist.m3u8")
            .build();

        assertTrue(cmd.contains("-hls_time"));
        assertTrue(cmd.contains("6"));
        assertTrue(cmd.contains("-hls_playlist_type"));
        assertTrue(cmd.contains("vod"));
        assertTrue(cmd.contains("-hls_segment_filename"));
    }

    @Test
    void missingOutputThrowsException() {
        assertThrows(IllegalStateException.class, () ->
            FFmpegCommandBuilder.create()
                .input("/tmp/a.mp4")
                .build()
        );
    }

    @Test
    void customFfmpegPath() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .ffmpegPath("/usr/local/bin/ffmpeg")
            .input("/tmp/a.mp4")
            .output("/tmp/b.mp4")
            .build();

        assertEquals("/usr/local/bin/ffmpeg", cmd.get(0));
    }

    @Test
    void videoBitRateFormattedCorrectly() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/a.mp4")
            .videoBitRate(4000)
            .output("/tmp/b.mp4")
            .build();

        int idx = cmd.indexOf("-b:v");
        assertNotEquals(-1, idx);
        assertEquals("4000k", cmd.get(idx + 1));
    }

    @Test
    void resultIsImmutable() {
        List<String> cmd = FFmpegCommandBuilder.create()
            .input("/tmp/a.mp4")
            .output("/tmp/b.mp4")
            .build();

        assertThrows(UnsupportedOperationException.class, () -> cmd.add("extra"));
    }
}
