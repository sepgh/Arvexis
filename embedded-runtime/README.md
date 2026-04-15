# Embedded Runtime

`embedded-runtime/` contains the embeddable Arvexis runtime libraries for host Java applications.

## Modules

- `embedded-runtime-core`
- `embedded-runtime-player-web`
- `embedded-runtime-spring-boot-starter`
- `embedded-runtime-spring-data-jpa`
- `embedded-runtime-testkit`

## Typical Spring Boot host setup

Add the starter and, optionally, the JPA reference adapter.

```xml
<dependency>
    <groupId>io.github.sepgh.arvexis</groupId>
    <artifactId>embedded-runtime-spring-boot-starter</artifactId>
    <version>${arvexis.version}</version>
</dependency>

<dependency>
    <groupId>io.github.sepgh.arvexis</groupId>
    <artifactId>embedded-runtime-spring-data-jpa</artifactId>
    <version>${arvexis.version}</version>
</dependency>
```

## Required host beans

A host application must provide game lookup and can override identity, access control, and persistence.

```java
@Configuration
class EmbeddedRuntimeHostConfiguration {
    @Bean
    GameDefinitionProvider gameDefinitionProvider() {
        return gameKey -> Optional.ofNullable(registry().get(gameKey.value()));
    }

    @Bean
    PlayerResolver playerResolver() {
        return auth -> new PlayerProfile(
            new PlayerId("player-123"),
            "player-123",
            "player-123",
            Map.of("tenant", "demo"),
            "Demo Player"
        );
    }

    @Bean
    GameAccessPolicy gameAccessPolicy() {
        return (player, gameDefinition) -> true;
    }
}
```

## Mount path configuration

```properties
embedded.runtime.base-path=/host/runtime
embedded.runtime.player-assets-path=/host/runtime/player
```

This exposes endpoints such as:

- `GET /host/runtime/games/{gameKey}/api/game/info`
- `GET /host/runtime/games/{gameKey}/api/game/state`
- `POST /host/runtime/games/{gameKey}/api/game/decide`
- `POST /host/runtime/games/{gameKey}/api/game/restart`
- `GET /host/runtime/play/{gameKey}`

## JPA reference persistence

When a `DataSource` is present and the host does not provide its own `GameSessionRepository`, `embedded-runtime-spring-data-jpa` auto-configures a JPA-backed session repository.

Hosts that want full control can still provide their own `GameSessionRepository` bean and the reference adapter will back off.

## Test support

`embedded-runtime-testkit` contains in-memory helpers for service and integration tests.
