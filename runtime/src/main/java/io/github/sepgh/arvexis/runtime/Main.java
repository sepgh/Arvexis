package io.github.sepgh.arvexis.runtime;

import java.nio.file.Path;

/**
 * Entry point for the compiled runtime server.
 *
 * Usage:  java -jar runtime.jar [--port PORT] [--output OUTPUT_DIR]
 *
 * Defaults: port=8090, output=./output  (relative to CWD, which should be the
 *           compiled project directory containing manifest.json and output/)
 */
public class Main {

    public static void main(String[] args) throws Exception {
        int port = 8090;
        Path outputDir = Path.of("output").toAbsolutePath();

        for (int i = 0; i < args.length - 1; i++) {
            switch (args[i]) {
                case "--port"   -> port      = Integer.parseInt(args[i + 1]);
                case "--output" -> outputDir = Path.of(args[i + 1]).toAbsolutePath();
            }
        }

        Path manifestFile = Path.of("manifest.json").toAbsolutePath();

        System.out.println("=== Arvexis — Runtime ===");
        System.out.println("  Manifest : " + manifestFile);
        System.out.println("  Output   : " + outputDir);
        System.out.println("  Port     : " + port);

        RuntimeServer server = new RuntimeServer(port, manifestFile, outputDir);
        server.start();

        System.out.println("  Ready    : http://localhost:" + port + "/");
        System.out.println("  Press Ctrl+C to stop.");
        Thread.currentThread().join();
    }
}
