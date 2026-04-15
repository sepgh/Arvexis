package io.github.sepgh.arvexis.embeddedruntime.jpa;

import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeSpis.GameSessionRepository;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameKey;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSession;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.GameSessionId;
import io.github.sepgh.arvexis.embeddedruntime.core.RuntimeTypes.PlayerId;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
    classes = EmbeddedRuntimeJpaBackoffTest.CustomRepositoryJpaApplication.class,
    properties = {
        "spring.datasource.url=jdbc:h2:mem:embedded-runtime-jpa-backoff;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driverClassName=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
    }
)
class EmbeddedRuntimeJpaBackoffTest {
    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private GameSessionRepository gameSessionRepository;

    @Test
    void backsOffWhenHostProvidesCustomGameSessionRepository() {
        assertThat(applicationContext.getBeansOfType(GameSessionRepository.class)).hasSize(1);
        assertThat(gameSessionRepository).isSameAs(applicationContext.getBean("customGameSessionRepository"));
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    static class CustomRepositoryJpaApplication {
        @Bean
        GameSessionRepository customGameSessionRepository() {
            return new GameSessionRepository() {
                @Override
                public Optional<GameSession> findById(GameSessionId sessionId) {
                    return Optional.empty();
                }

                @Override
                public Optional<GameSession> findLatest(PlayerId playerId, GameKey gameKey) {
                    return Optional.empty();
                }

                @Override
                public boolean existsByPlayerAndGame(PlayerId playerId, GameKey gameKey) {
                    return false;
                }

                @Override
                public GameSession save(GameSession gameSession) {
                    return gameSession;
                }
            };
        }
    }
}
